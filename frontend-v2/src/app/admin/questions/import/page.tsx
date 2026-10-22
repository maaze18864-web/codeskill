"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Code,
  BookOpen,
  Layers,
  Sparkles,
  Zap,
  Check,
  X,
  FileCode,
  GitMerge,
  ShieldCheck,
} from "lucide-react";
import { adminQuestionsAPI } from "@/config/api";
import { importErrorMessage } from "@/lib/import-error";
import { Spinner } from "@/components/ui/spinner";

interface PreviewData {
  sheetNames: string[];
  selectedSheet: string | null;
  summary: {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    newCount?: number;
    exactDuplicateCount?: number;
    conflictCount?: number;
    toInsertCount?: number;
    toUpdateCount?: number;
  };
  validRows: any[];
  errors: { row: number; question?: string; questionType?: string; error: string; isDuplicate?: boolean }[];
}

export default function ImportQuestionsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [instantPush, setInstantPush] = useState(false);
  const [mergeStrategy, setMergeStrategy] = useState<"skip" | "update" | "merge">("merge");
  const [activeTab, setActiveTab] = useState<"all" | "new" | "duplicates" | "conflicts" | "errors">("all");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [importResult, setImportResult] = useState<{
    totalProcessed: number;
    insertedCount: number;
    updatedCount: number;
    skippedCount?: number;
    mergeStrategy?: string;
    message?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [committedRows, setCommittedRows] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleFileSelect = (selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      setErrorMessage("Please upload a valid CSV or Excel spreadsheet (.csv, .xlsx, .xls).");
      return;
    }
    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMessage("Question files must be 15 MiB or smaller.");
      return;
    }
    setFile(selectedFile);
    setErrorMessage(null);
    setPreviewData(null);
    setSelectedSheet("");
    setImportResult(null);

    void processPreview(selectedFile, undefined, instantPush);
  };

  const handleOneAttemptAutoImport = async (selectedFile: File) => {
    setIsValidating(true);
    setIsCommitting(true);
    setErrorMessage(null);
    try {
      const res = await adminQuestionsAPI.autoImport(selectedFile, mergeStrategy);
      const data = res.data;
      setImportResult({
        totalProcessed: data.count || data.validCount || 0,
        insertedCount: data.summary?.insertedCount ?? data.insertedCount ?? 0,
        updatedCount: data.summary?.updatedCount ?? data.updatedCount ?? 0,
        skippedCount: data.summary?.skippedCount ?? data.skippedCount ?? 0,
        mergeStrategy: data.mergeStrategy || mergeStrategy,
        message: data.message,
      });
    } catch (err: any) {
      setErrorMessage(
        importErrorMessage(err, "Failed to automatically import questions.")
      );
    } finally {
      setIsValidating(false);
      setIsCommitting(false);
    }
  };

  const processPreview = async (selectedFile: File, sheetName?: string, autoIfSingleSheet = false) => {
    setIsValidating(true);
    setErrorMessage(null);
    setPreviewData(null);
    try {
      const res = await adminQuestionsAPI.importPreview(selectedFile, sheetName);
      setPreviewData(res.data);
      setSelectedSheet(res.data.selectedSheet || "");
      if (autoIfSingleSheet && res.data.sheetNames.length === 1) {
        await handleOneAttemptAutoImport(selectedFile);
      }
    } catch (err: any) {
      setErrorMessage(
        importErrorMessage(err, "Could not validate the question spreadsheet. Please check the file format and required columns.")
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || previewData.summary.totalRows === 0) return;

    setIsCommitting(true);
    setCommittedRows(0);
    setErrorMessage(null);
    let processedRows = 0;
    try {
      // The API accepts up to 4 MiB of JSON. Keep each request well below that
      // limit while preserving the selected merge strategy for every batch.
      const maxBatchBytes = 2 * 1024 * 1024;
      const batches: any[][] = [];
      let batch: any[] = [];
      let batchBytes = new Blob([JSON.stringify({ validRows: [], mergeStrategy })]).size;
      for (const row of previewData.validRows) {
        const rowBytes = new Blob([JSON.stringify(row)]).size + 1;
        if (rowBytes + batchBytes > maxBatchBytes && batch.length > 0) {
          batches.push(batch);
          batch = [];
          batchBytes = new Blob([JSON.stringify({ validRows: [], mergeStrategy })]).size;
        }
        if (rowBytes + batchBytes > maxBatchBytes) {
          throw new Error("A question is too large to import. Reduce its code or test-case content and retry.");
        }
        batch.push(row);
        batchBytes += rowBytes;
      }
      if (batch.length > 0) batches.push(batch);

      const data = { totalProcessed: 0, insertedCount: 0, updatedCount: 0, skippedCount: 0 };
      for (const rows of batches) {
        const res = await adminQuestionsAPI.confirmImport(rows, mergeStrategy, rows.length, file?.name);
        data.totalProcessed += res.data.totalProcessed ?? res.data.count ?? rows.length;
        data.insertedCount += res.data.insertedCount ?? 0;
        data.updatedCount += res.data.updatedCount ?? 0;
        data.skippedCount += res.data.skippedCount ?? 0;
        processedRows += rows.length;
        setCommittedRows(processedRows);
      }
      setImportResult({
        ...data,
        mergeStrategy,
        message: `Processed ${data.totalProcessed} questions in ${batches.length} batch${batches.length === 1 ? "" : "es"}.`,
      });
    } catch (err: any) {
      setErrorMessage(
        `${importErrorMessage(err, "Failed to commit questions into database.")}${processedRows > 0 ? " Some earlier batches may have succeeded; retry with Skip to avoid duplicates." : ""}`
      );
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDownloadSampleTemplate = () => {
    const content = [
        "title,url_slug,question,question_type,topic,subtopic,difficulty,marks,negative_marks,option_a,option_b,option_c,option_d,correct_answer,explanation,code_snippet,language,tags",
        '"Balanced BST Search Complexity",balanced-bst-search-complexity,"What is the worst-case time complexity of searching for an element in a balanced Binary Search Tree (AVL Tree)?",single_choice,Data Structures,Trees,easy,1,0.25,"O(1)","O(log n)","O(n)","O(n log n)",B,"In a balanced Binary Search Tree like an AVL tree, the height is strictly bounded by O(log n), ensuring worst-case search time of O(log n).",,general,"trees,bst,time-complexity"',
        '"In-Place Sorting",in-place-sorting,"Which of the following sorting algorithms is NOT an in-place sorting algorithm?",single_choice,Algorithms,Sorting,medium,1,0.25,"Quick Sort","Heap Sort","Merge Sort","Insertion Sort",C,"Standard Merge Sort requires O(n) auxiliary space to merge sub-arrays, making it not an in-place sorting algorithm.",,general,"algorithms,sorting,space-complexity"',
        '"Deadlock Conditions",deadlock-conditions,"Which condition(s) must hold simultaneously for a deadlock to occur in an operating system?",multiple_choice,Operating Systems,Deadlocks,medium,2,0.5,"Mutual Exclusion","Hold and Wait","No Preemption","Circular Wait","A,B,C,D","All four Coffman conditions must hold simultaneously for a deadlock to occur.",,general,"os,deadlock,coffman"',
        '"Generative AI Capability",generative-ai-capability,"What capability is an AI tool demonstrating when it turns a short product description into a complete product announcement?",single_choice,AI Foundations & Generative AI,Generative AI,easy,1,0.25,"Database indexing","Generating new content from learned patterns","Sorting existing records","Network monitoring",B,"The AI generates new text based on instructions and learned patterns.",,general,"ai,generative-ai,llm"',
      ].join("\n");
    const filename = "chandigarh_university_mcq_scenario_questions_template.csv";
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(content);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadErrorReport = () => {
    if (!previewData || previewData.errors.length === 0) return;

    const headers = ["Row", "Question", "Error Details"];
    const rows = previewData.errors.map((err) => [
      err.row,
      `"${(err.question || "").replace(/"/g, '""')}"`,
      `"${err.error.replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `question-import-errors-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPreviewRows = () => {
    if (!previewData) return [];
    if (activeTab === "all") return previewData.validRows;
    if (activeTab === "new") return previewData.validRows.filter((r) => r.matchStatus === "new");
    if (activeTab === "duplicates") return previewData.validRows.filter((r) => r.matchStatus === "exact_duplicate");
    if (activeTab === "conflicts") return previewData.validRows.filter((r) => r.matchStatus === "conflict");
    return previewData.validRows;
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Product of Chandigarh University Branding Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-card border border-red-500/20 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-white shrink-0 shadow-sm border border-border p-0.5 flex items-center justify-center">
            <img
              src="/cu-seal.png"
              alt="Chandigarh University"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/product-of-logo.jpg";
              }}
            />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>This is a product of</span>
              <span className="text-red-500 font-extrabold">Chandigarh University</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              Institutional Technical Assessment & Algorithmic Question Bank
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            Duplicate Detection & Merge Protection Active
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Bulk Import & Upsert Questions
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              CSV / XLSX Sheets
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Import MCQs and complete coding questions. Coding rows need a URL slug, C++, Java and Python code, two sample examples, two test cases, and solution complexity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/templates/chandigarh_university_coding_questions_template.csv"
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold transition-colors shadow-sm"
          >
            <FileCode className="w-3.5 h-3.5" />
            Coding Questions (.CSV)
          </a>
          <a
            href="/templates/chandigarh_university_coding_questions_template.xlsx"
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold transition-colors shadow-sm"
          >
            <FileCode className="w-3.5 h-3.5" />
            Coding Questions (.XLSX)
          </a>
          <button
            type="button"
            onClick={handleDownloadSampleTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 text-xs font-bold transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            MCQ Template (.CSV)
          </button>
          <Link
            href="/admin/questions"
            className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold transition-colors"
          >
            ← Question Bank
          </Link>
        </div>
      </div>

      {/* Merge Strategy Config Card */}
      <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Duplicate Handling & Merge Strategy</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={instantPush}
              onChange={(e) => setInstantPush(e.target.checked)}
              className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
            />
            Auto-commit upon file upload
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <label
            className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              mergeStrategy === "skip"
                ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                : "border-border hover:border-muted-foreground/30 bg-muted/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="mergeStrategy"
                value="skip"
                checked={mergeStrategy === "skip"}
                onChange={() => setMergeStrategy("skip")}
                className="accent-emerald-500"
              />
              <span className="text-xs font-bold text-foreground">Skip Duplicates (Safe)</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Preserves existing questions in the bank untouched. Only brand-new questions are added.
            </p>
          </label>

          <label
            className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              mergeStrategy === "update"
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-muted-foreground/30 bg-muted/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="mergeStrategy"
                value="update"
                checked={mergeStrategy === "update"}
                onChange={() => setMergeStrategy("update")}
                className="accent-primary"
              />
              <span className="text-xs font-bold text-foreground">Update Existing (Upsert)</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Updates matching question content while strictly preserving question IDs and assessment links.
            </p>
          </label>

          <label
            className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              mergeStrategy === "merge"
                ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                : "border-border hover:border-muted-foreground/30 bg-muted/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="radio"
                name="mergeStrategy"
                value="merge"
                checked={mergeStrategy === "merge"}
                onChange={() => setMergeStrategy("merge")}
                className="accent-amber-500"
              />
              <span className="text-xs font-bold text-foreground">Merge Missing Details</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Preserves answers and options, fills missing details, and refreshes explicitly uploaded coding starter templates.
            </p>
          </label>
        </div>
      </div>

      {/* Success View */}
      {importResult && (
        <div className="p-8 rounded-2xl bg-card border border-emerald-500/30 text-center space-y-4 shadow-sm animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Questions Import Completed!
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {importResult.message || `Processed ${importResult.totalProcessed} questions using '${importResult.mergeStrategy}' strategy.`}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 py-2 flex-wrap">
            <div className="text-center px-4 py-2 rounded-xl bg-muted/40 border border-border">
              <p className="text-xs text-muted-foreground font-medium">Total Processed</p>
              <p className="text-xl font-black text-foreground font-mono">{importResult.totalProcessed}</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-500 font-medium">Newly Created</p>
              <p className="text-xl font-black text-emerald-500 font-mono">+{importResult.insertedCount}</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary font-medium">Updated</p>
              <p className="text-xl font-black text-primary font-mono">{importResult.updatedCount}</p>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-500 font-medium">Skipped Duplicates</p>
              <p className="text-xl font-black text-amber-500 font-mono">{importResult.skippedCount ?? 0}</p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setFile(null);
                setPreviewData(null);
                setSelectedSheet("");
                setImportResult(null);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Upload Another Spreadsheet
            </button>
            <Link
              href="/admin/questions"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-md hover:bg-primary/90 transition-colors"
            >
              View Question Bank
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Upload Drop Zone */}
      {!importResult && (
        <div className="space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer bg-card/60 backdrop-blur-sm ${
              isDragging
                ? "border-primary bg-primary/5 scale-[0.99]"
                : "border-border/80 hover:border-primary/50 hover:bg-muted/20"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-foreground">
              {file ? file.name : "Drop your Questions CSV or Excel File Here"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Supports scenario-based MCQs, AI literacy questions, and algorithmic DSA questions with test cases.
            </p>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="px-2.5 py-1 rounded-lg bg-muted border border-border">.CSV</span>
              <span className="px-2.5 py-1 rounded-lg bg-muted border border-border">.XLSX</span>
              <span className="px-2.5 py-1 rounded-lg bg-muted border border-border">.XLS</span>
              <span className="text-muted-foreground/60">• Up to 15MB</span>
            </div>

            {(isValidating || isCommitting) && (
              <div className="mt-6 flex flex-col items-center justify-center gap-2">
                <Spinner className="w-7 h-7 text-primary animate-spin" />
                <p className="text-xs font-bold text-primary animate-pulse">
                  {isCommitting
                    ? `Executing ${mergeStrategy} import in database transaction...`
                    : "Analyzing spreadsheet & detecting duplicates..."}
                </p>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3 text-sm">
              <XCircle className="w-5 h-5 shrink-0" />
              <p className="flex-1">{errorMessage}</p>
            </div>
          )}

          {previewData && previewData.sheetNames.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <label htmlFor="question-import-sheet" className="block text-sm font-semibold text-foreground">
                Worksheet to import
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a worksheet and review its questions before importing. One-click import applies to single-sheet files.
              </p>
              <select
                id="question-import-sheet"
                value={selectedSheet}
                onChange={(event) => {
                  const sheet = event.target.value;
                  setSelectedSheet(sheet);
                  if (file && sheet) void processPreview(file, sheet);
                }}
                className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:max-w-sm"
              >
                <option value="">Select a worksheet</option>
                {previewData.sheetNames.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
              </select>
            </div>
          )}

          {/* Preview Results */}
          {previewData?.selectedSheet && !importResult && (
            <div className="space-y-6">
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-card border border-border">
                  <p className="text-xs text-muted-foreground font-medium">Total Rows</p>
                  <p className="text-2xl font-black text-foreground font-mono mt-1">
                    {previewData.summary.totalRows}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-emerald-500/20 bg-emerald-500/5">
                  <p className="text-xs text-emerald-500 font-semibold">New Questions</p>
                  <p className="text-2xl font-black text-emerald-500 font-mono mt-1">
                    {previewData.summary.newCount ?? previewData.summary.toInsertCount ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-primary/20 bg-primary/5">
                  <p className="text-xs text-primary font-semibold">Exact Duplicates</p>
                  <p className="text-2xl font-black text-primary font-mono mt-1">
                    {previewData.summary.exactDuplicateCount ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-card border border-amber-500/20 bg-amber-500/5">
                  <p className="text-xs text-amber-500 font-semibold">Option / Answer Conflicts</p>
                  <p className="text-2xl font-black text-amber-500 font-mono mt-1">
                    {previewData.summary.conflictCount ?? 0}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-4 flex-wrap bg-card border border-border p-4 rounded-2xl">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {previewData.validRows.length} questions validated & ready to process
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Selected strategy: <strong className="text-foreground capitalize">{mergeStrategy}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {previewData.errors.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="px-3.5 py-2 rounded-xl border border-destructive/30 text-destructive text-xs font-semibold hover:bg-destructive/10"
                    >
                      Download Error Report ({previewData.errors.length})
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isCommitting || previewData.summary.totalRows === 0}
                    onClick={handleConfirmImport}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isCommitting ? (
                      <>
                        <Spinner className="w-4 h-4 animate-spin" />
                        Executing Import… {committedRows > 0 ? `${committedRows}/${previewData.validRows.length}` : ""}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Confirm & Process ({previewData.validRows.length} valid, {previewData.summary.invalidCount} failed)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 border-b border-border pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Valid ({previewData.validRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("new")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === "new" ? "bg-emerald-500/10 text-emerald-600" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  New ({previewData.summary.newCount ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("duplicates")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === "duplicates" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Exact Duplicates ({previewData.summary.exactDuplicateCount ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("conflicts")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === "conflicts" ? "bg-amber-500/10 text-amber-600" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Conflicts ({previewData.summary.conflictCount ?? 0})
                </button>
              </div>

              {/* Valid Questions Preview Table */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {filteredPreviewRows().slice(0, 50).map((row, idx) => (
                    <div key={idx} className="p-4 hover:bg-muted/20 transition-colors flex items-start gap-3">
                      <span className="text-xs font-mono font-bold text-muted-foreground mt-0.5">
                        #{row.rowNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{row.question}</p>
                          {row.matchStatus === "new" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              NEW
                            </span>
                          )}
                          {row.matchStatus === "exact_duplicate" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              EXACT DUPLICATE
                            </span>
                          )}
                          {row.matchStatus === "conflict" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20" title={row.conflictReason}>
                              CONFLICT: {row.conflictReason}
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                            {row.questionType}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                          <span className="font-medium text-foreground">{row.topic}</span>
                          {row.subtopic && <span>· {row.subtopic}</span>}
                          <span>· Level: <span className="capitalize font-semibold text-primary">{row.difficulty}</span></span>
                          <span>· {row.marks} mark{row.marks > 1 ? "s" : ""}</span>
                          {row.testCases?.length > 0 && (
                            <span className="text-primary font-medium">
                              · {row.testCases.length} Test Cases
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
