"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { adminBugsAPI } from "@/config/api";
import { BugReport, BugPriority, BugStatus, initials, priorityLabels, statusLabels } from "@/lib/bugs";
import { BUG_DRAFT_KEY, clearBugDraftImages, readBugDraftImages, saveBugDraftImages } from "@/lib/bug-draft-storage";
import toast from "react-hot-toast";
import {
  Bug, CalendarDays, Camera, Check, ChevronRight, Clock3, ImagePlus, Loader2,
  MessageCircle, Minimize2, Plus, Search, Sparkles, X,
} from "lucide-react";

type BugCounts = { total: number; new: number; in_process: number; fixed: number };
type ReportDraft = { creatorName: string; title: string; description: string; priority: BugPriority };
type DraftImage = { file: File; preview: string };
type StoredDraft = {
  version: 1;
  draft: ReportDraft;
  panelState: "open" | "minimized";
  imageCount: number;
  savedAt: string;
};

const emptyCounts: BugCounts = { total: 0, new: 0, in_process: 0, fixed: 0 };
const emptyDraft: ReportDraft = { creatorName: "", title: "", description: "", priority: "medium" };
const statuses: Array<"all" | BugStatus> = ["all", "new", "in_process", "fixed"];
const statusStyle: Record<BugStatus, string> = {
  new: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/15 dark:bg-sky-300/10 dark:text-sky-300",
  in_process: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-300",
  fixed: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-300/10 dark:text-emerald-300",
};
const priorityStyle: Record<BugPriority, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-300",
  medium: "bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300",
  high: "bg-orange-50 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300",
  critical: "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
};

function StatusBadge({ status }: { status: BugStatus }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{statusLabels[status]}</span>;
}

function SkeletonCard() {
  return <div className="animate-pulse rounded-2xl border border-slate-200/70 bg-white/75 p-5 dark:border-white/[0.08] dark:bg-slate-900/60">
    <div className="mb-5 flex justify-between"><span className="h-6 w-20 rounded-full bg-slate-200 dark:bg-white/10"/><span className="h-6 w-16 rounded-full bg-slate-200 dark:bg-white/10"/></div>
    <div className="mb-3 h-5 w-3/4 rounded bg-slate-200 dark:bg-white/10"/><div className="mb-2 h-3 w-full rounded bg-slate-100 dark:bg-white/[0.06]"/><div className="mb-5 h-3 w-2/3 rounded bg-slate-100 dark:bg-white/[0.06]"/>
    <div className="flex justify-between border-t border-slate-100 pt-4 dark:border-white/[0.06]"><span className="h-3 w-24 rounded bg-slate-100 dark:bg-white/[0.06]"/><span className="h-3 w-20 rounded bg-slate-100 dark:bg-white/[0.06]"/></div>
  </div>;
}

function readStoredDraft(): StoredDraft | null {
  try {
    const value = localStorage.getItem(BUG_DRAFT_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as StoredDraft;
    if (parsed?.version !== 1 || !parsed.draft) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function AdminBugsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BugReport[]>([]);
  const [counts, setCounts] = useState<BugCounts>(emptyCounts);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "priority">("newest");
  const [activeStatus, setActiveStatus] = useState<"all" | BugStatus>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMinimized, setReportMinimized] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [imagesRestoreFailed, setImagesRestoreFailed] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"saved" | "saving">("saved");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<DraftImage[]>([]);
  const selectedFilesRef = useRef(selectedFiles);
  const persistedFilesRef = useRef(selectedFiles);
  const draftRef = useRef(emptyDraft);
  const panelStateRef = useRef<{ open: boolean; minimized: boolean; active: boolean }>({ open: false, minimized: false, active: false });
  const [fileError, setFileError] = useState("");
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState<ReportDraft>(emptyDraft);

  useEffect(() => {
    draftRef.current = draft;
    selectedFilesRef.current = selectedFiles;
    panelStateRef.current = { open: reportOpen, minimized: reportMinimized, active: hasDraft };
  }, [draft, hasDraft, reportMinimized, reportOpen, selectedFiles]);

  useEffect(() => {
    const stored = readStoredDraft();
    if (stored) {
      setDraft({ ...emptyDraft, ...stored.draft });
      setHasDraft(true);
      setReportMinimized(stored.panelState === "minimized");
      setReportOpen(stored.panelState !== "minimized");
      setDraftRestored(true);
      if (stored.imageCount > 0) {
        void readBugDraftImages().then((files) => {
          if (files.length !== stored.imageCount) setImagesRestoreFailed(true);
          setSelectedFiles(files.map((file) => ({ file, preview: URL.createObjectURL(file) })));
        }).catch(() => setImagesRestoreFailed(true));
      }
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (user?.name && !hasDraft && !draft.creatorName.trim()) {
      setDraft((current) => current.creatorName ? current : { ...current, creatorName: user.name });
    }
  }, [draft.creatorName, hasDraft, user?.name]);

  const fetchBugs = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await adminBugsAPI.getAll({ search: search.trim(), sort });
      setItems(response.data?.items || []);
      setCounts(response.data?.counts || emptyCounts);
    } catch (error: any) {
      setLoadError(error?.response?.data?.message || "Bug reports could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [search, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchBugs(); }, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [fetchBugs, search]);

  useEffect(() => () => selectedFilesRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview)), []);

  const persistDraftNow = useCallback(() => {
    const state = panelStateRef.current;
    if (!state.active) return;
    const files = selectedFilesRef.current.map(({ file }) => file);
    const snapshot: StoredDraft = {
      version: 1,
      draft: draftRef.current,
      panelState: state.minimized ? "minimized" : "open",
      imageCount: files.length,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(BUG_DRAFT_KEY, JSON.stringify(snapshot));
      void saveBugDraftImages(files).catch(() => setImagesRestoreFailed(true));
    } catch {
      toast.error("This browser could not save the bug draft.");
    }
  }, []);

  useEffect(() => {
    if (!draftReady || !hasDraft) return;
    const timer = window.setTimeout(async () => {
      const files = selectedFiles.map(({ file }) => file);
      const snapshot: StoredDraft = {
        version: 1,
        draft,
        panelState: reportMinimized ? "minimized" : "open",
        imageCount: files.length,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(BUG_DRAFT_KEY, JSON.stringify(snapshot));
        if (persistedFilesRef.current !== selectedFiles) {
          await saveBugDraftImages(files);
          persistedFilesRef.current = selectedFiles;
        }
        setImagesRestoreFailed(false);
      } catch {
        setImagesRestoreFailed(files.length > 0);
      } finally {
        setDraftSaveStatus("saved");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, draftReady, hasDraft, reportMinimized, selectedFiles]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      const hasUnsavedText = Boolean(draft.title.trim() || draft.description.trim() || selectedFiles.length);
      if (hasDraft && hasUnsavedText && draftSaveStatus === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    const persistWhenHidden = () => { if (document.visibilityState === "hidden") persistDraftNow(); };
    window.addEventListener("pagehide", persistDraftNow);
    document.addEventListener("visibilitychange", persistWhenHidden);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      window.removeEventListener("pagehide", persistDraftNow);
      document.removeEventListener("visibilitychange", persistWhenHidden);
    };
  }, [draft, draftSaveStatus, hasDraft, persistDraftNow, selectedFiles.length]);

  const visibleItems = useMemo(() => activeStatus === "all" ? items : items.filter((bug) => bug.status === activeStatus), [activeStatus, items]);
  const countsFor = (status: "all" | BugStatus) => status === "all" ? counts.total : counts[status];

  const openReport = () => {
    setFormError("");
    setDraftSaveStatus("saving");
    setReportOpen(true);
    setReportMinimized(false);
    setHasDraft(true);
  };

  const selectFiles = useCallback((incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const valid: DraftImage[] = [];
    let error = "";
    const existing = selectedFiles.length;
    for (const file of Array.from(incoming)) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { error = "Choose PNG, JPG, or WebP images."; continue; }
      if (file.size > 5 * 1024 * 1024) { error = `${file.name} is larger than 5 MB.`; continue; }
      if (existing + valid.length >= 10) { error = "You can attach up to 10 images to one report."; break; }
      valid.push({ file, preview: URL.createObjectURL(file) });
    }
    if (valid.length) setHasDraft(true);
    if (valid.length) setDraftSaveStatus("saving");
    setSelectedFiles((current) => [...current, ...valid]);
    setFileError(error);
  }, [selectedFiles.length]);

  useEffect(() => {
    if (!reportOpen) return;
    const pasteImage = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items || []).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file));
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (images.length) {
        event.preventDefault();
        selectFiles(images);
      }
    };
    window.addEventListener("paste", pasteImage);
    return () => window.removeEventListener("paste", pasteImage);
  }, [reportOpen, selectFiles]);

  const discardDraft = async () => {
    if (!window.confirm("Discard this bug report draft and its screenshots?")) return;
    selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
    setSelectedFiles([]);
    setDraft({ ...emptyDraft, creatorName: user?.name || "" });
    setReportOpen(false);
    setReportMinimized(false);
    setHasDraft(false);
    setDraftRestored(false);
    setFileError("");
    setFormError("");
    localStorage.removeItem(BUG_DRAFT_KEY);
    await clearBugDraftImages().catch(() => undefined);
  };

  const submitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (draft.creatorName.trim().length < 2) return setFormError("Enter your name (at least 2 characters).");
    if (draft.title.trim().length < 3) return setFormError("Enter a title (at least 3 characters).");
    if (draft.description.trim().length < 8) return setFormError("Add a little more detail (at least 8 characters).");
    const formData = new FormData();
    formData.append("creatorName", draft.creatorName.trim());
    formData.append("title", draft.title.trim());
    formData.append("description", draft.description.trim());
    formData.append("priority", draft.priority);
    selectedFiles.forEach(({ file }) => formData.append("images", file));
    setIsSubmitting(true);
    try {
      await adminBugsAPI.create(formData);
      toast.success("Bug report submitted");
      selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
      setSelectedFiles([]);
      setDraft({ ...emptyDraft, creatorName: user?.name || "" });
      setReportOpen(false);
      setReportMinimized(false);
      setHasDraft(false);
      setDraftRestored(false);
      localStorage.removeItem(BUG_DRAFT_KEY);
      await clearBugDraftImages().catch(() => undefined);
      await fetchBugs();
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setFormError(Array.isArray(message) ? message.join(" ") : message || "The report could not be submitted.");
      toast.error("Could not submit the report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateDraft = (updates: Partial<ReportDraft>) => {
    setHasDraft(true);
    setDraftSaveStatus("saving");
    setDraft((current) => ({ ...current, ...updates }));
  };

  const imagePreviews = selectedFiles.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">{selectedFiles.map(({ file, preview }, index) => <div key={`${file.name}-${index}-${preview}`} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 dark:border-white/10"><img src={preview} alt={`Preview ${file.name}`} className="h-full w-full object-cover"/><button type="button" aria-label={`Remove ${file.name}`} onClick={() => { URL.revokeObjectURL(preview); setDraftSaveStatus("saving"); setSelectedFiles((current) => current.filter((item) => item.preview !== preview)); }} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-950/75 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"><X size={13}/></button></div>)}</div>;

  const reportPanel = reportOpen ? <aside className="min-w-0 animate-in slide-in-from-right-3 fade-in duration-300 xl:sticky xl:top-5">
    <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,.12)] dark:border-white/[0.09] dark:bg-slate-900/95 sm:p-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto">
      <div className="mb-4 flex items-start justify-between gap-3"><div><span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-400/10 dark:text-rose-300"><Bug size={12}/> New report</span><h2 className="text-lg font-bold text-slate-950 dark:text-white">Report a bug</h2><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Share what happened so the team can take a look.</p></div><button type="button" onClick={() => { setDraftSaveStatus("saving"); setReportOpen(false); setReportMinimized(true); }} aria-label="Minimize report draft" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"><Minimize2 size={13}/><span className="hidden sm:inline">Minimize</span></button></div>
      {draftRestored && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">Draft restored{imagesRestoreFailed ? " · Some screenshots could not be restored from this browser." : ""}</p>}
      {!draftRestored && imagesRestoreFailed && <p role="alert" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[10px] font-medium text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">Draft text is saved, but screenshots could not be stored in this browser.</p>}
      <form onSubmit={submitReport} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFiles(event.dataTransfer.files); }} className="space-y-3">
        <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300">Your name<input value={draft.creatorName} onChange={(event) => updateDraft({ creatorName: event.target.value })} maxLength={80} required placeholder="Name" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-slate-950/60 dark:text-white"/></label>
        <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300">Title<input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} maxLength={180} required placeholder="A short summary of the issue" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-slate-950/60 dark:text-white"/></label>
        <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300">Description<textarea value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} maxLength={10000} required rows={6} placeholder="What did you do, what happened, and what did you expect?" className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] font-normal outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-slate-950/60 dark:text-white"/></label>
        <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300">Priority<select value={draft.priority} onChange={(event) => updateDraft({ priority: event.target.value as BugPriority })} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] font-normal outline-none focus:border-primary dark:border-white/10 dark:bg-slate-950/60 dark:text-white"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <div><div className="mb-1.5 flex flex-wrap items-center justify-between gap-1"><span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">Screenshots <span className="font-normal text-slate-400">optional</span></span><span className="text-[9px] text-slate-400">PNG, JPG, WebP · max 5 MB each</span></div><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3 text-[10px] font-semibold text-slate-600 transition hover:border-primary hover:text-primary dark:border-white/15 dark:bg-slate-950/30 dark:text-slate-300"><ImagePlus size={15}/>Choose or drop images<input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(event) => { selectFiles(event.target.files); event.currentTarget.value = ""; }}/></label><p className="mt-1 text-[9px] text-slate-400">Tip: paste a screenshot with Ctrl+V.</p>{fileError && <p role="alert" className="mt-1.5 text-[10px] text-rose-600 dark:text-rose-300">{fileError}</p>}{imagePreviews}</div>
        {formError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-700 dark:border-rose-300/15 dark:bg-rose-400/10 dark:text-rose-300">{formError}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.08]"><span aria-live="polite" className="inline-flex items-center gap-1 text-[9px] text-slate-400">{draftSaveStatus === "saving" ? <><Loader2 size={11} className="animate-spin"/>Saving draft…</> : <><Check size={11} className="text-emerald-500"/>Draft saved</>}</span><button type="button" onClick={() => void discardDraft()} className="rounded-lg px-2 py-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]">Discard draft</button></div>
        <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[11px] font-bold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}Submit report</button>
      </form>
    </section>
  </aside> : hasDraft && reportMinimized ? <aside className="animate-in slide-in-from-right-3 fade-in duration-300 xl:sticky xl:top-5"><div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-white/90 p-4 shadow-sm dark:border-violet-300/15 dark:bg-slate-900/90"><div className="min-w-0"><p className="flex items-center gap-2 text-[11px] font-bold text-slate-900 dark:text-white"><span className="h-2 w-2 rounded-full bg-violet-500"/>Draft in progress</p><p className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400">{draft.title || "Untitled bug report"}</p></div><button type="button" onClick={() => { setDraftSaveStatus("saving"); setReportMinimized(false); setReportOpen(true); }} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-[10px] font-bold text-primary-foreground">Reopen</button></div></aside> : null;

  return <main className="min-h-full px-4 py-5 md:px-7 md:py-7">
    <div className="mx-auto max-w-[1450px]">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-violet-700 dark:border-violet-300/15 dark:bg-violet-300/10 dark:text-violet-300"><Sparkles size={12}/> ADMIN WORKSPACE</span><h1 className="text-[26px] font-bold tracking-[-.035em] text-slate-950 dark:text-white">Bug tracker</h1><p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">Capture issues, coordinate fixes, and keep the team in the loop.</p></div>
        <button type="button" onClick={openReport} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12px] font-bold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><Plus size={16}/>{reportMinimized ? "Reopen Draft" : hasDraft ? "Continue Draft" : "Report Bug"}</button>
      </div>

      <section aria-label="Bug report totals" className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {([["Total", counts.total, Bug, "text-violet-600 dark:text-violet-300", "bg-violet-50 dark:bg-violet-400/10"], ["New", counts.new, Sparkles, "text-sky-600 dark:text-sky-300", "bg-sky-50 dark:bg-sky-400/10"], ["In Process", counts.in_process, Clock3, "text-amber-600 dark:text-amber-300", "bg-amber-50 dark:bg-amber-400/10"], ["Fixed", counts.fixed, Check, "text-emerald-600 dark:text-emerald-300", "bg-emerald-50 dark:bg-emerald-400/10"]] as const).map(([label, value, Icon, color, background]) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/75 p-4 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-900/60"><div className={`grid h-10 w-10 place-items-center rounded-xl ${background} ${color}`}><Icon size={18}/></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p><p className="mt-0.5 text-xl font-bold text-slate-950 dark:text-white">{value}</p></div></div>)}
      </section>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter bugs by status">{statuses.map((status) => { const label = status === "all" ? "All" : statusLabels[status]; const selected = activeStatus === status; return <button key={status} type="button" role="tab" aria-selected={selected} onClick={() => setActiveStatus(status)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-slate-200/80 bg-white/75 text-slate-600 hover:border-primary/40 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300"}`}>{label}<span className={`rounded-full px-1.5 py-0.5 text-[9px] ${selected ? "bg-white/20" : "bg-slate-100 dark:bg-white/[0.08]"}`}>{countsFor(status)}</span></button>; })}</div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto"><label className="relative flex-1 xl:w-[290px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or creator" className="w-full rounded-xl border border-slate-200/80 bg-white/75 py-2.5 pl-9 pr-3 text-[12px] text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-slate-900/65 dark:text-slate-100 dark:placeholder:text-slate-500"/></label><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort bug reports" className="rounded-xl border border-slate-200/80 bg-white/75 px-3 py-2.5 text-[12px] font-semibold text-slate-700 shadow-sm outline-none focus:border-primary dark:border-white/10 dark:bg-slate-900/65 dark:text-slate-200"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">Highest priority</option></select></div>
      </div>

      {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700 dark:border-rose-300/15 dark:bg-rose-400/10 dark:text-rose-300"><span>{loadError}</span><button type="button" onClick={() => void fetchBugs()} className="font-bold underline">Retry</button></div>}

      <div className={reportOpen || (hasDraft && reportMinimized) ? "grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]" : ""}>
        {reportPanel}
        <section aria-label="Bug reports" className="min-w-0">
          {isLoading ? <div className={`grid gap-4 ${reportOpen || (hasDraft && reportMinimized) ? "md:grid-cols-1 2xl:grid-cols-2" : "md:grid-cols-2 2xl:grid-cols-3"}`}>{Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index}/>)}</div>
            : visibleItems.length ? <div className={`grid gap-4 ${reportOpen || (hasDraft && reportMinimized) ? "md:grid-cols-1 2xl:grid-cols-2" : "md:grid-cols-2 2xl:grid-cols-3"}`}>
              {visibleItems.map((bug) => <Link href={`/admin/bugs/${bug.id}`} key={bug.id} onClickCapture={persistDraftNow} className={`group flex min-h-[245px] flex-col rounded-2xl border bg-white/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,.055)] ring-1 ring-slate-200/60 backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(15,23,42,.12)] dark:bg-slate-900/65 dark:ring-white/[0.05] ${bug.status === "fixed" ? "border-emerald-200/80 dark:border-emerald-400/15" : "border-white/90 dark:border-white/[0.08]"}`}>
                <div className="mb-4 flex items-center justify-between gap-2"><StatusBadge status={bug.status}/><span className={`rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${priorityStyle[bug.priority]}`}>{priorityLabels[bug.priority]}</span></div>
                <h2 className={`text-[15px] font-bold leading-5 text-slate-900 transition group-hover:text-primary dark:text-slate-100 ${bug.status === "fixed" ? "line-through decoration-emerald-500/40" : ""}`}>{bug.title}</h2>
                <p className="mt-2 flex-1 text-[12px] leading-[1.65] text-slate-600 dark:text-slate-300" style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>{bug.description}</p>
                {bug.assigneeName && <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50/80 px-2.5 py-2 text-[10px] font-semibold text-amber-800 dark:bg-amber-300/[0.08] dark:text-amber-200"><span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[9px] font-bold text-white">{initials(bug.assigneeName)}</span>{bug.status === "fixed" ? "Fixed by:" : "Working by:"} {bug.assigneeName}</div>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500 dark:border-white/[0.07] dark:text-slate-400"><span className="inline-flex items-center gap-1.5"><span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[8px] font-bold text-white">{initials(bug.creatorName)}</span><span className="max-w-[100px] truncate">{bug.creatorName}</span></span><span className="inline-flex items-center gap-2"><span className="inline-flex items-center gap-1"><CalendarDays size={12}/>{new Date(bug.createdAt).toLocaleDateString()}</span>{bug.editedAt && <span title={`Edited ${new Date(bug.editedAt).toLocaleString()}`} className="text-slate-400">(edited)</span>}<span className="inline-flex items-center gap-1"><MessageCircle size={12}/>{bug.commentCount}</span><span className="inline-flex items-center gap-1"><Camera size={12}/>{bug.imageCount}</span></span><ChevronRight size={15} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-primary"/></div>
              </Link>)}
            </div> : <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 px-5 py-16 text-center dark:border-white/15 dark:bg-slate-900/40"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"><Bug size={25}/></div><h2 className="text-[16px] font-bold text-slate-900 dark:text-white">{search.trim() ? "No matching bugs" : activeStatus === "all" ? "No bugs yet 🎉" : `No ${statusLabels[activeStatus].toLowerCase()} bugs`}</h2><p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-slate-500 dark:text-slate-400">{search.trim() ? "No reports match your search. Try a different title or creator." : activeStatus !== "all" ? `There are no ${statusLabels[activeStatus].toLowerCase()} reports in this view.` : "Everything looks clear. Report an issue when you spot one."}</p>{!search.trim() && activeStatus === "all" && <button type="button" onClick={openReport} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12px] font-bold text-primary-foreground"><Plus size={15}/>Report the first bug</button>}</div>}
        </section>
      </div>
    </div>
  </main>;
}
