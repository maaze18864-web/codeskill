"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { adminBugsAPI } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { BugReport, bugImageSrc, initials, priorityLabels, statusLabels, timeAgo } from "@/lib/bugs";
import {
  ArrowLeft, Bug, CalendarDays, Camera, Check, CheckCircle2, Clock3, ImagePlus,
  Loader2, MessageCircle, Pencil, RotateCcw, Save, Send, ShieldAlert, Sparkles, X,
} from "lucide-react";

const statusStyle = {
  new: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/15 dark:bg-sky-300/10 dark:text-sky-300",
  in_process: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-300",
  fixed: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-300/10 dark:text-emerald-300",
} as const;
const priorityStyle = {
  low: "bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-300",
  medium: "bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300",
  high: "bg-orange-50 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300",
  critical: "bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300",
} as const;
const COMMENTER_STORAGE_KEY = "codeskill_bug_commenter_name";

export default function AdminBugDetailPage() {
  const params = useParams<{ id: string }>();
  const bugId = params.id;
  const { user } = useAuth();
  const [bug, setBug] = useState<BugReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [claimDismissed, setClaimDismissed] = useState(false);
  const [assigneeName, setAssigneeName] = useState("");
  const [claimError, setClaimError] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [commenterName, setCommenterName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDetailsError, setEditDetailsError] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [editCommentError, setEditCommentError] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [imageError, setImageError] = useState("");
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectedImagesRef = useRef(selectedImages);
  useEffect(() => { selectedImagesRef.current = selectedImages; }, [selectedImages]);

  useEffect(() => {
    const rememberedName = localStorage.getItem(COMMENTER_STORAGE_KEY);
    setCommenterName(rememberedName || user?.name || "");
    setAssigneeName(user?.name || "");
  }, [user?.name]);

  useEffect(() => () => selectedImagesRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview)), []);

  useEffect(() => {
    if (!lightbox) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [lightbox]);

  const fetchBug = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await adminBugsAPI.getById(bugId);
      setBug(response.data as BugReport);
      setClaimDismissed(false);
    } catch (error: any) {
      setLoadError(error?.response?.data?.message || "This bug report could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [bugId]);

  useEffect(() => { void fetchBug(); }, [fetchBug]);

  const timeline = useMemo(() => bug?.activities || [], [bug?.activities]);

  const startEditingDetails = () => {
    if (!bug) return;
    setEditTitle(bug.title);
    setEditDescription(bug.description);
    setEditDetailsError("");
    setIsEditingDetails(true);
  };

  const saveDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editTitle.trim().length < 3) { setEditDetailsError("Title must contain at least 3 characters."); return; }
    if (editDescription.trim().length < 8) { setEditDetailsError("Description must contain at least 8 characters."); return; }
    setEditDetailsError("");
    setIsSavingDetails(true);
    try {
      const response = await adminBugsAPI.updateBug(bugId, { title: editTitle.trim(), description: editDescription.trim() });
      setBug(response.data as BugReport);
      setIsEditingDetails(false);
      toast.success("Bug details updated");
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setEditDetailsError(Array.isArray(message) ? message.join(" ") : message || "The bug details could not be saved.");
      toast.error("Could not save bug details");
    } finally {
      setIsSavingDetails(false);
    }
  };

  const saveComment = async (commentId: string) => {
    if (editCommentText.trim().length < 1) { setEditCommentError("Comment cannot be empty."); return; }
    setEditCommentError("");
    setIsSavingComment(true);
    try {
      const response = await adminBugsAPI.updateComment(bugId, commentId, editCommentText.trim());
      setBug(response.data as BugReport);
      setEditingCommentId(null);
      toast.success("Comment updated");
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setEditCommentError(Array.isArray(message) ? message.join(" ") : message || "The comment could not be saved.");
      toast.error("Could not save comment");
    } finally {
      setIsSavingComment(false);
    }
  };

  const claimBug = async () => {
    const name = assigneeName.trim();
    if (name.length < 2) { setClaimError("Enter your name (at least 2 characters)."); return; }
    setClaimError("");
    setIsClaiming(true);
    try {
      const response = await adminBugsAPI.assign(bugId, name);
      setBug(response.data as BugReport);
      toast.success("You are now working on this bug");
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setClaimError(Array.isArray(message) ? message.join(" ") : message || "Could not claim this bug.");
      toast.error("Could not assign the bug");
      await fetchBug();
    } finally {
      setIsClaiming(false);
    }
  };

  const changeStatus = async (status: "fixed" | "new") => {
    if (!bug) return;
    setIsChangingStatus(true);
    try {
      const response = await adminBugsAPI.updateStatus(bug.id, status);
      setBug(response.data as BugReport);
      toast.success(status === "fixed" ? "Bug marked as fixed" : "Bug reopened");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not update the bug status");
    } finally {
      setIsChangingStatus(false);
    }
  };

  const chooseImages = (files: FileList | null) => {
    if (!files) return;
    let error = "";
    const accepted: Array<{ file: File; preview: string }> = [];
    for (const file of Array.from(files)) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { error = "Choose PNG, JPG, or WebP images."; continue; }
      if (file.size > 5 * 1024 * 1024) { error = `${file.name} is larger than 5 MB.`; continue; }
      if ((bug?.imageCount || 0) + selectedImages.length + accepted.length >= 20) { error = "A bug can have up to 20 images."; break; }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    setSelectedImages((current) => [...current, ...accepted]);
    setImageError(error);
  };

  const uploadImages = async () => {
    if (!selectedImages.length) { imageInputRef.current?.click(); return; }
    const data = new FormData();
    selectedImages.forEach(({ file }) => data.append("images", file));
    setIsUploadingImages(true);
    try {
      const response = await adminBugsAPI.addImages(bugId, data);
      selectedImages.forEach(({ preview }) => URL.revokeObjectURL(preview));
      setSelectedImages([]);
      setBug(response.data as BugReport);
      setImageError("");
      toast.success("Images added to the report");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Images could not be uploaded");
    } finally {
      setIsUploadingImages(false);
    }
  };

  const submitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (commenterName.trim().length < 2) { setCommentError("Enter your name (at least 2 characters)."); return; }
    if (!commentText.trim()) { setCommentError("Write a comment before sending."); return; }
    setCommentError("");
    setIsCommenting(true);
    try {
      localStorage.setItem(COMMENTER_STORAGE_KEY, commenterName.trim());
      const response = await adminBugsAPI.addComment(bugId, { commenterName: commenterName.trim(), text: commentText.trim() });
      setBug(response.data as BugReport);
      setCommentText("");
      toast.success("Comment added");
    } catch (error: any) {
      setCommentError(error?.response?.data?.message || "The comment could not be added.");
      toast.error("Could not add comment");
    } finally {
      setIsCommenting(false);
    }
  };

  if (isLoading) return <main className="mx-auto max-w-[1180px] animate-pulse px-4 py-7 md:px-7"><div className="mb-5 h-5 w-28 rounded bg-slate-200 dark:bg-white/10"/><div className="mb-4 h-36 rounded-3xl bg-slate-200 dark:bg-white/10"/><div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]"><div className="h-72 rounded-3xl bg-slate-200 dark:bg-white/10"/><div className="h-72 rounded-3xl bg-slate-200 dark:bg-white/10"/></div></main>;
  if (loadError || !bug) return <main className="grid min-h-[55vh] place-items-center px-4"><div className="max-w-md rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-lg dark:border-rose-300/15 dark:bg-slate-900"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300"><ShieldAlert size={22}/></div><h1 className="text-lg font-bold text-slate-900 dark:text-white">Could not open bug report</h1><p role="alert" className="mt-2 text-[12px] text-slate-500 dark:text-slate-400">{loadError}</p><button type="button" onClick={() => void fetchBug()} className="mt-5 rounded-xl bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground">Try again</button></div></main>;

  const isClaimable = bug.status === "new" && !bug.assigneeName && !claimDismissed;
  const canFix = bug.isAssignee && bug.status === "in_process";
  const canReopen = bug.status === "fixed";
  const canEditDetails = bug.canEditBug !== false;

  return <main className="min-h-full px-4 py-5 md:px-7 md:py-7">
    <div className="mx-auto max-w-[1180px]">
      <Link href="/admin/bugs" className="mb-5 inline-flex items-center gap-2 rounded-lg py-1 text-[12px] font-semibold text-slate-500 transition hover:text-primary dark:text-slate-400"><ArrowLeft size={15}/>All bug reports</Link>
      <section className={`mb-5 overflow-hidden rounded-3xl border bg-white/80 shadow-[0_15px_45px_rgba(15,23,42,.07)] backdrop-blur-xl dark:bg-slate-900/65 ${bug.status === "fixed" ? "border-emerald-200/80 dark:border-emerald-400/15" : "border-slate-200/70 dark:border-white/[0.08]"}`}>
        <div className="p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyle[bug.status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{statusLabels[bug.status]}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${priorityStyle[bug.priority]}`}>{priorityLabels[bug.priority]} priority</span><span className="ml-auto text-[10px] font-mono text-slate-400">BUG-{bug.id.slice(0, 8).toUpperCase()}</span></div>
          {isEditingDetails ? <form onSubmit={saveDetails} className="space-y-3">
            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Title<input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={180} required className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] font-bold text-slate-900 outline-none focus:border-primary dark:border-white/10 dark:bg-slate-950/60 dark:text-white"/></label>
            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Description<textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={10000} required rows={5} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-normal leading-6 text-slate-700 outline-none focus:border-primary dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-200"/></label>
            {editDetailsError && <p role="alert" className="text-[10px] text-rose-600 dark:text-rose-300">{editDetailsError}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsEditingDetails(false)} disabled={isSavingDetails} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]"><X size={13}/>Cancel</button><button type="submit" disabled={isSavingDetails} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[10px] font-bold text-primary-foreground disabled:opacity-60">{isSavingDetails ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}Save</button></div>
          </form> : <>
            <div className="flex items-start justify-between gap-3"><h1 className={`min-w-0 flex-1 text-[24px] font-bold tracking-[-.03em] text-slate-950 dark:text-white sm:text-[30px] ${bug.status === "fixed" ? "decoration-emerald-500/35" : ""}`}>{bug.title}</h1>{canEditDetails && <button type="button" onClick={startEditingDetails} aria-label="Edit bug title and description" title="Edit bug details" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary dark:border-white/10 dark:text-slate-300"><Pencil size={13}/><span className="hidden sm:inline">Edit</span></button>}</div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[9px] font-bold text-white">{initials(bug.creatorName)}</span>Reported by <strong className="font-semibold text-slate-700 dark:text-slate-200">{bug.creatorName}</strong></span><span className="inline-flex items-center gap-1"><CalendarDays size={13}/>{new Date(bug.createdAt).toLocaleString()}</span>{bug.editedAt && <span title={`Edited ${new Date(bug.editedAt).toLocaleString()}`} className="text-slate-400">(edited)</span>}<span className="inline-flex items-center gap-1"><MessageCircle size={13}/>{bug.commentCount} comments</span><span className="inline-flex items-center gap-1"><Camera size={13}/>{bug.imageCount} images</span></div>
            <p className="mt-5 whitespace-pre-wrap text-[13px] leading-[1.8] text-slate-700 dark:text-slate-300">{bug.description}</p>
          </>}
          {bug.assigneeName && <div className={`mt-5 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] ${bug.status === "fixed" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-400/[0.08] dark:text-emerald-200" : "bg-amber-50 text-amber-800 dark:bg-amber-400/[0.08] dark:text-amber-200"}`}><span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[9px] font-bold text-white">{initials(bug.assigneeName)}</span>{bug.status === "fixed" ? <>Fixed by <strong>{bug.assigneeName}</strong>{bug.fixedAt && <span className="text-current/70">· {new Date(bug.fixedAt).toLocaleString()}</span>}</> : <>Being worked on by <strong>{bug.assigneeName}</strong></>}</div>}
        </div>

        {isClaimable && <div className="border-t border-sky-100 bg-sky-50/70 p-5 dark:border-sky-300/10 dark:bg-sky-300/[0.04] sm:px-7"><div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-300/10 dark:text-sky-300"><Sparkles size={18}/></div><div className="flex-1"><h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Do you want to work on this bug?</h2><p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">Claiming it will let everyone know you are handling it.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={assigneeName} onChange={(event) => setAssigneeName(event.target.value)} maxLength={80} placeholder="Your name" aria-label="Assignee name" className="min-w-0 flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-sky-400 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"/><button type="button" onClick={() => void claimBug()} disabled={isClaiming} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-[11px] font-bold text-white transition hover:bg-sky-800 disabled:opacity-60 dark:bg-sky-500 dark:text-slate-950">{isClaiming ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}Yes, I’ll take it</button><button type="button" onClick={() => setClaimDismissed(true)} className="rounded-xl border border-slate-200 px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-white dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.05]">No</button></div>{claimError && <p role="alert" className="mt-2 text-[10px] text-rose-600 dark:text-rose-300">{claimError}</p>}</div></div></div>}

        {bug.status === "new" && bug.assigneeName && <div className="border-t border-amber-100 bg-amber-50/60 px-5 py-3 text-[11px] text-amber-800 dark:border-amber-300/10 dark:bg-amber-300/[0.04] dark:text-amber-200">Being worked on by <strong>{bug.assigneeName}</strong></div>}
        {(canFix || canReopen) && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 dark:border-white/[0.07] dark:bg-white/[0.02]"><p className="text-[11px] text-slate-600 dark:text-slate-400">{canFix ? "You’re assigned to this report." : "This report is complete. Reopen it if more work is needed."}</p>{canFix ? <button type="button" onClick={() => void changeStatus("fixed")} disabled={isChangingStatus} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 size={15}/>{isChangingStatus ? "Saving…" : "Mark as Fixed"}</button> : <button type="button" onClick={() => void changeStatus("new")} disabled={isChangingStatus} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-[11px] font-bold text-amber-800 transition hover:bg-amber-50 disabled:opacity-60 dark:border-amber-300/20 dark:bg-slate-900 dark:text-amber-200"><RotateCcw size={14}/>{isChangingStatus ? "Saving…" : "Reopen"}</button>}</div>}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,.8fr)]">
        <div className="space-y-5">
          <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-900/65 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white"><Camera size={17} className="text-primary"/>Screenshots</h2><p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{bug.imageCount} of 20 images · click a thumbnail to zoom</p></div><div><input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(event) => { chooseImages(event.target.files); event.currentTarget.value = ""; }}/><button type="button" onClick={() => imageInputRef.current?.click()} disabled={bug.imageCount + selectedImages.length >= 20} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-white/10 dark:text-slate-300"><ImagePlus size={14}/>Add Images</button></div></div>
            {(bug.images?.length || selectedImages.length) ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(bug.images || []).map((image) => <button key={image.id} type="button" onClick={() => setLightbox(bugImageSrc(image.url))} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950"><img src={bugImageSrc(image.url)} alt="Bug report screenshot" className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/><span className="absolute inset-0 grid place-items-center bg-slate-950/0 text-white opacity-0 transition group-hover:bg-slate-950/25 group-hover:opacity-100"><Camera size={20}/></span></button>)}{selectedImages.map(({ file, preview }, index) => <div key={`${file.name}-${index}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-dashed border-primary/50 bg-slate-100 dark:bg-slate-950"><button type="button" onClick={() => setLightbox(preview)} className="h-full w-full"><img src={preview} alt={`Upload preview ${file.name}`} className="h-full w-full object-cover"/></button><button type="button" aria-label={`Remove ${file.name}`} onClick={() => { URL.revokeObjectURL(preview); setSelectedImages((current) => current.filter((item) => item.preview !== preview)); }} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-slate-950/75 text-white"><X size={14}/></button></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-9 text-center dark:border-white/15"><div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"><ImagePlus size={17}/></div><p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">No screenshots attached</p><p className="mt-1 text-[10px] text-slate-500">Attach screenshots to make the issue easier to reproduce.</p></div>}
            {imageError && <p role="alert" className="mt-2 text-[10px] text-rose-600 dark:text-rose-300">{imageError}</p>}
            {selectedImages.length > 0 && <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-slate-500">{selectedImages.length} image{selectedImages.length === 1 ? "" : "s"} ready to upload</span><button type="button" onClick={() => void uploadImages()} disabled={isUploadingImages} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-[10px] font-bold text-primary-foreground disabled:opacity-60">{isUploadingImages ? <Loader2 size={13} className="animate-spin"/> : <ImagePlus size={13}/>}Upload images</button></div>}
          </section>

          <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-900/65 sm:p-6">
            <div className="mb-5"><h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white"><MessageCircle size={17} className="text-primary"/>Comments <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">{bug.comments?.length || 0}</span></h2><p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Keep the discussion together with this report.</p></div>
            {bug.comments?.length ? <div className="mb-5 space-y-4">{bug.comments.map((comment) => <article key={comment.id} className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[10px] font-bold text-white">{initials(comment.authorName)}</div><div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-slate-50 px-3.5 py-3 dark:bg-slate-950/45"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className="text-[11px] font-bold text-slate-900 dark:text-white">{comment.authorName}</h3><time className="text-[9px] text-slate-400" dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time>{comment.editedAt && <span title={`Edited ${new Date(comment.editedAt).toLocaleString()}`} className="text-[9px] text-slate-400">(edited)</span>}{comment.canEdit && editingCommentId !== comment.id && <button type="button" onClick={() => { setEditingCommentId(comment.id); setEditCommentText(comment.text); setEditCommentError(""); }} title="Edit comment" aria-label={`Edit comment by ${comment.authorName}`} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-semibold text-slate-500 hover:bg-white hover:text-primary dark:text-slate-400 dark:hover:bg-white/[0.06]"><Pencil size={11}/>Edit</button>}</div>{editingCommentId === comment.id ? <div className="mt-2 space-y-2"><textarea value={editCommentText} onChange={(event) => setEditCommentText(event.target.value)} maxLength={3000} rows={3} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-700 outline-none focus:border-primary dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"/>{editCommentError && <p role="alert" className="text-[10px] text-rose-600 dark:text-rose-300">{editCommentError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditingCommentId(null); setEditCommentError(""); }} disabled={isSavingComment} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[9px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">Cancel</button><button type="button" onClick={() => void saveComment(comment.id)} disabled={isSavingComment} className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[9px] font-bold text-primary-foreground disabled:opacity-60">{isSavingComment ? <Loader2 size={11} className="animate-spin"/> : <Save size={11}/>}Save</button></div></div> : <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-slate-700 dark:text-slate-300">{comment.text}</p>}</div></article>)}</div> : <div className="mb-5 rounded-2xl bg-slate-50 px-4 py-6 text-center dark:bg-slate-950/35"><p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">No comments yet</p><p className="mt-1 text-[10px] text-slate-400">Start the conversation below.</p></div>}
            <form onSubmit={submitComment} className="space-y-3 border-t border-slate-100 pt-4 dark:border-white/[0.07]"><div className="grid gap-3 sm:grid-cols-[minmax(130px,.65fr)_minmax(0,1.35fr)]"><label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Your name<input value={commenterName} onChange={(event) => setCommenterName(event.target.value)} maxLength={80} required placeholder="Name" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] outline-none focus:border-primary dark:border-white/10 dark:bg-slate-950/50 dark:text-white"/></label><label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Comment<textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={3000} required rows={2} placeholder="Add a useful detail or update…" className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] outline-none focus:border-primary dark:border-white/10 dark:bg-slate-950/50 dark:text-white"/></label></div>{commentError && <p role="alert" className="text-[10px] text-rose-600 dark:text-rose-300">{commentError}</p>}<div className="flex items-center justify-between gap-3"><p className="text-[9px] text-slate-400">Your name is remembered on this device.</p><button type="submit" disabled={isCommenting} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-[10px] font-bold text-primary-foreground disabled:opacity-60">{isCommenting ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>}Post comment</button></div></form>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-900/65"><h2 className="mb-4 flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-white"><Clock3 size={16} className="text-primary"/>Activity</h2>{timeline.length ? <ol className="space-y-0">{timeline.map((activity, index) => <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0"><div className="relative flex w-7 shrink-0 justify-center"><span className={`z-10 grid h-7 w-7 place-items-center rounded-full ${activity.type === "fixed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : activity.type === "assigned" ? "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300" : activity.type === "edited" ? "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300" : "bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-slate-300"}`}>{activity.type === "fixed" ? <CheckCircle2 size={13}/> : activity.type === "assigned" ? <Sparkles size={13}/> : activity.type === "edited" ? <Pencil size={13}/> : activity.type === "reopened" ? <RotateCcw size={13}/> : <Bug size={13}/>}</span>{index < timeline.length - 1 && <span className="absolute bottom-0 top-7 w-px bg-slate-200 dark:bg-white/10"/>}</div><div className="min-w-0 flex-1 pt-0.5"><p className="text-[11px] leading-4 text-slate-700 dark:text-slate-300">{activity.message}</p><time className="mt-1 block text-[9px] text-slate-400" dateTime={activity.createdAt}>{timeAgo(activity.createdAt)} · {new Date(activity.createdAt).toLocaleString()}</time></div></li>)}</ol> : <p className="text-[11px] text-slate-500">No activity recorded.</p>}</section>
          <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-900/65"><h2 className="mb-4 text-[14px] font-bold text-slate-900 dark:text-white">Report details</h2><dl className="space-y-3 text-[11px]"><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Status</dt><dd className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusStyle[bug.status]}`}>{statusLabels[bug.status]}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Priority</dt><dd className="font-semibold text-slate-800 dark:text-slate-200">{priorityLabels[bug.priority]}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Created</dt><dd className="text-right text-slate-700 dark:text-slate-300">{new Date(bug.createdAt).toLocaleDateString()}</dd></div>{bug.fixedAt && <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Fixed on</dt><dd className="text-right text-slate-700 dark:text-slate-300">{new Date(bug.fixedAt).toLocaleDateString()}</dd></div>}</dl></section>
        </aside>
      </div>
    </div>
    {lightbox && <div role="dialog" aria-modal="true" aria-label="Screenshot preview" onClick={() => setLightbox(null)} className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"><button type="button" aria-label="Close image preview" onClick={() => setLightbox(null)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X size={20}/></button><img src={lightbox} alt="Bug screenshot enlarged" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl"/></div>}
  </main>;
}
