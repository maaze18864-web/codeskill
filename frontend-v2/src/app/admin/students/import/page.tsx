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
  Mail,
  ShieldCheck,
  Building,
  Check,
  X,
  Layers,
  Filter,
} from "lucide-react";
import { adminStudentsAPI } from "@/config/api";
import { importErrorMessage } from "@/lib/import-error";
import { Spinner } from "@/components/ui/spinner";
import { SUPPORTED_SECTIONS } from "@/lib/sections";

interface PreviewData {
  sheetNames: string[];
  selectedSheet: string | null;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  previewRows: any[];
  validRows: any[];
  errors: { row: number; uid?: string; email?: string; error: string; isDuplicate?: boolean }[];
}

interface DefaultBatchOptions {
  defaultBatch: string;
  defaultDepartment: string;
  defaultCourse: string;
  defaultSemester: string;
  defaultSection: string;
  defaultYear: string;
}

export default function ImportStudentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [committedRows, setCommittedRows] = useState(0);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "valid" | "duplicates" | "errors">("all");
  const [defaultOptions, setDefaultOptions] = useState<DefaultBatchOptions>({
    defaultBatch: "",
    defaultDepartment: "",
    defaultCourse: "",
    defaultSemester: "",
    defaultSection: "",
    defaultYear: "",
  });
  const [showBatchDefaults, setShowBatchDefaults] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    skippedCount: number;
    skippedDuplicates?: any[];
    emailJobsCreated: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMessage("Student files must be 10 MiB or smaller.");
      return;
    }
    setFile(selectedFile);
    setErrorMessage(null);
    setPreviewData(null);
    setSelectedSheet("");
    setImportResult(null);
    setCommittedRows(0);

    setIsValidating(true);
    try {
      const res = await adminStudentsAPI.importPreview(selectedFile, defaultOptions);
      setPreviewData(res.data);
      setSelectedSheet(res.data.selectedSheet || "");
    } catch (err: any) {
      setErrorMessage(
        importErrorMessage(err, "Failed to parse and validate spreadsheet. Please verify file format."),
      );
    } finally {
      setIsValidating(false);
    }
  };

  const reValidateWithDefaults = async (sheetName = selectedSheet) => {
    if (!file) return;
    setIsValidating(true);
    setErrorMessage(null);
    setPreviewData(null);
    try {
      const res = await adminStudentsAPI.importPreview(file, { ...defaultOptions, sheetName });
      setPreviewData(res.data);
    } catch (err: any) {
      setErrorMessage(
        importErrorMessage(err, "Failed to re-validate spreadsheet with updated defaults."),
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || previewData.validRows.length === 0) return;

    setIsCommitting(true);
    setCommittedRows(0);
    setErrorMessage(null);
    try {
      const result = { importedCount: 0, skippedCount: 0, skippedDuplicates: [] as any[], emailJobsCreated: 0 };
      // Keep each request below the server's 500-row guard and typical proxy timeouts.
      for (let start = 0; start < previewData.validRows.length; start += 200) {
        const rows = previewData.validRows.slice(start, start + 200);
        const res = await adminStudentsAPI.confirmImport(rows, defaultOptions);
        result.importedCount += res.data.importedCount ?? 0;
        result.skippedCount += res.data.skippedCount ?? 0;
        result.skippedDuplicates.push(...(res.data.skippedDuplicates || []));
        result.emailJobsCreated += res.data.emailJobsCreated ?? 0;
        setCommittedRows(Math.min(start + rows.length, previewData.validRows.length));
      }
      setImportResult(result);
    } catch (err: any) {
      setErrorMessage(
        `${importErrorMessage(err, "Failed to commit student import into database.")} Some batches may have succeeded. Retry safely; existing students will be skipped.`,
      );
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!previewData || previewData.errors.length === 0) return;

    const headers = ["Row", "UID", "Email", "Error Description", "Is Duplicate"];
    const rows = previewData.errors.map((err) => [
      err.row,
      `"${err.uid || ""}"`,
      `"${err.email || ""}"`,
      `"${err.error.replace(/"/g, '""')}"`,
      err.isDuplicate ? "Yes" : "No",
    ]);

    const csvBody = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvBody);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `student-import-errors-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadImportSummaryReport = () => {
    if (!importResult) return;

    const headers = ["UID", "Name", "Email", "Import Status", "Details"];
    const rows: string[][] = [];

    if (importResult.skippedDuplicates && importResult.skippedDuplicates.length > 0) {
      importResult.skippedDuplicates.forEach((dup) => {
        rows.push([
          `"${dup.uid || ""}"`,
          `"${dup.name || ""}"`,
          `"${dup.email || ""}"`,
          "SKIPPED_DUPLICATE",
          `"${(dup.reason || "Duplicate student in database").replace(/"/g, '""')}"`,
        ]);
      });
    }

    const csvBody = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvBody);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `student-import-summary-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleTemplate = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent(
        `uid,name,email,mobile,university,department,course,semester,section,group,year,batch
CU202600101,Aarav Patel,aarav.patel@university.edu,+919876543210,Chandigarh University,Computer Science,B.Tech CSE,6,A1,Group-1,2026,2022-2026
CU202600102,Diya Sharma,diya.sharma@university.edu,+919876543211,Chandigarh University,Computer Science,B.Tech CSE,6,A1,Group-1,2026,2022-2026
CU202600103,Rohan Verma,rohan.verma@university.edu,+919876543212,Chandigarh University,Information Technology,B.Tech IT,6,B2,Group-2,2026,2022-2026`
      );
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "sample_students_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPreviewRows = () => {
    if (!previewData) return [];
    if (activeTab === "all") return previewData.previewRows;
    if (activeTab === "valid") {
      const errorRowNumbers = new Set(previewData.errors.map((e) => e.row));
      return previewData.previewRows.filter((r) => !errorRowNumbers.has(r.rowNumber));
    }
    if (activeTab === "duplicates") {
      const dupRowNumbers = new Set(previewData.errors.filter((e) => e.isDuplicate).map((e) => e.row));
      return previewData.previewRows.filter((r) => dupRowNumbers.has(r.rowNumber));
    }
    if (activeTab === "errors") {
      const invalidRowNumbers = new Set(previewData.errors.filter((e) => !e.isDuplicate).map((e) => e.row));
      return previewData.previewRows.filter((r) => invalidRowNumbers.has(r.rowNumber));
    }
    return previewData.previewRows;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Bulk Student Creation
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Idempotent & Duplicate Safe
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Upload student spreadsheets (XLSX, CSV) with automatic validation, batch assignment, duplicate detection, and credential dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSampleTemplate}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 text-xs font-semibold transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Download Sample Template (.CSV)
          </button>
          <Link
            href="/admin/students"
            className="px-3.5 py-2 rounded-xl border border-border hover:bg-muted text-sm font-medium transition-colors"
          >
            ← Back to Directory
          </Link>
        </div>
      </div>

      {/* Default Cohort Assignment Drawer */}
      <div className="bg-card border border-border rounded-2xl p-4 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Default Batch & Cohort Assignment</p>
              <p className="text-xs text-muted-foreground">
                Optional: Auto-fill batch, class, department, or semester for rows missing them in the file.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowBatchDefaults(!showBatchDefaults)}
            className="text-xs font-semibold text-primary hover:underline px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            {showBatchDefaults ? "Hide Options" : "Configure Defaults"}
          </button>
        </div>

        {showBatchDefaults && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Default Batch</label>
              <input
                type="text"
                placeholder="e.g. 2022-2026"
                value={defaultOptions.defaultBatch}
                onChange={(e) => setDefaultOptions({ ...defaultOptions, defaultBatch: e.target.value })}
                className="mt-1 w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Department</label>
              <input
                type="text"
                placeholder="e.g. Computer Science"
                value={defaultOptions.defaultDepartment}
                onChange={(e) => setDefaultOptions({ ...defaultOptions, defaultDepartment: e.target.value })}
                className="mt-1 w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Course</label>
              <input
                type="text"
                placeholder="e.g. B.Tech CSE"
                value={defaultOptions.defaultCourse}
                onChange={(e) => setDefaultOptions({ ...defaultOptions, defaultCourse: e.target.value })}
                className="mt-1 w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Semester</label>
              <input
                type="number"
                min={1}
                max={12}
                placeholder="e.g. 6"
                value={defaultOptions.defaultSemester}
                onChange={(e) => setDefaultOptions({ ...defaultOptions, defaultSemester: e.target.value })}
                className="mt-1 w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Section</label>
              <select
                id="import-default-section"
                value={defaultOptions.defaultSection}
                onChange={(e) => setDefaultOptions({ ...defaultOptions, defaultSection: e.target.value })}
                className="mt-1 w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
              >
                <option value="">None / From File</option>
                {SUPPORTED_SECTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Graduation Year</label>
              <div className="flex gap-2 items-center mt-1">
                <input
                  type="number"
                  placeholder="e.g. 2026"
                  value={defaultOptions.defaultYear}
                  onChange={(e) => setDefaultOptions({ ...defaultOptions, defaultYear: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs"
                />
                {file && (
                  <button
                    type="button"
                    onClick={() => reValidateWithDefaults()}
                    className="px-2.5 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:bg-primary/90 shrink-0"
                    title="Apply defaults to current file"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success View */}
      {importResult ? (
        <div className="p-8 rounded-2xl bg-card border border-emerald-500/30 text-center space-y-4 shadow-sm animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Import Completed Successfully!
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              <strong>{importResult.importedCount.toLocaleString()}</strong> new student accounts created.
              {importResult.skippedCount > 0 && (
                <> <strong>{importResult.skippedCount.toLocaleString()}</strong> duplicate records were safely skipped.</>
              )}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-left">
            <div className="p-3 bg-muted/40 rounded-xl border border-border text-center">
              <span className="text-[11px] text-muted-foreground block font-medium">Newly Imported</span>
              <span className="text-xl font-bold text-emerald-500">{importResult.importedCount}</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border text-center">
              <span className="text-[11px] text-muted-foreground block font-medium">Skipped Duplicates</span>
              <span className="text-xl font-bold text-amber-500">{importResult.skippedCount}</span>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border text-center">
              <span className="text-[11px] text-muted-foreground block font-medium">Emails Queued</span>
              <span className="text-xl font-bold text-foreground">{importResult.emailJobsCreated}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <Link
              href="/admin/students/credentials"
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center gap-2 transition-all"
            >
              <Mail className="w-4 h-4" /> Go to Credentials Dispatch →
            </Link>
            {importResult.skippedCount > 0 && (
              <button
                type="button"
                onClick={handleDownloadImportSummaryReport}
                className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download Import Log
              </button>
            )}
            <button
              onClick={() => {
                setFile(null);
                setPreviewData(null);
                setImportResult(null);
              }}
              className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-sm font-medium"
            >
              Upload Another Spreadsheet
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-3 text-red-700 dark:text-red-400 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Upload Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? "border-amber-500 bg-amber-500/10"
                : "border-border hover:border-amber-500/50 hover:bg-muted/30 bg-card"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center">
              {isValidating ? (
                <Spinner className="w-8 h-8 animate-spin" />
              ) : (
                <UploadCloud className="w-8 h-8" />
              )}
            </div>

            <div>
              <div className="text-base font-bold text-foreground">
                {file ? file.name : "Click to upload or drag and drop student spreadsheet"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Supports XLSX, XLS, and CSV files (up to 10MB and 1,000 rows per worksheet; imports in batches)
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground font-mono bg-muted/60 px-4 py-1.5 rounded-lg border border-border">
              <span>Required: UID, Name, Email</span>
              <span>•</span>
              <span>Batch Assignment: Batch, Year, Semester (or set above)</span>
              <span>•</span>
              <span>Optional: Mobile Phone, Department, Course, Section, Group</span>
            </div>
          </div>

          {previewData && previewData.sheetNames.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <label htmlFor="student-import-sheet" className="block text-sm font-semibold text-foreground">
                Worksheet to import
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose the worksheet you want to validate. Only that sheet will be imported.
              </p>
              <select
                id="student-import-sheet"
                value={selectedSheet}
                onChange={(event) => {
                  const sheet = event.target.value;
                  setSelectedSheet(sheet);
                  if (sheet) void reValidateWithDefaults(sheet);
                }}
                className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:max-w-sm"
              >
                <option value="">Select a worksheet</option>
                {previewData.sheetNames.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
              </select>
            </div>
          )}

          {/* Validation Preview Section */}
          {previewData?.selectedSheet && (
            <div className="space-y-4 animate-in fade-in">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-card border border-border">
                  <div className="text-xs text-muted-foreground font-medium">Total Rows In File</div>
                  <div className="text-2xl font-black text-foreground font-mono mt-1">
                    {previewData.total.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                    Valid for Import (New)
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-300 font-mono mt-1">
                    {previewData.valid.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                  <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                    Duplicates (Will Skip)
                  </div>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-300 font-mono mt-1">
                    {previewData.duplicates.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40">
                  <div className="text-xs text-red-700 dark:text-red-400 font-semibold">
                    Invalid Format Rows
                  </div>
                  <div className="text-2xl font-black text-red-600 dark:text-red-300 font-mono mt-1">
                    {previewData.invalid.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-card border border-border rounded-xl shadow-sm">
                <div>
                  <div className="text-sm font-bold text-foreground">
                    Validation Completed
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {previewData.valid} candidate accounts ready to be created. Existing duplicate records will be safely skipped.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {previewData.errors.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Error Report ({previewData.errors.length})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isCommitting || previewData.valid === 0}
                    className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    {isCommitting ? (
                      <>
                        <Spinner className="w-3.5 h-3.5 animate-spin" /> Importing {committedRows}/{previewData.valid}...
                      </>
                    ) : (
                      <>
                        Confirm Import ({previewData.valid} Students) <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tab Filters */}
              <div className="flex gap-2 border-b border-border pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Rows ({previewData.previewRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("valid")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === "valid" ? "bg-emerald-500/10 text-emerald-600" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Valid Candidates
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("duplicates")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === "duplicates" ? "bg-amber-500/10 text-amber-600" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Duplicates ({previewData.duplicates})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("errors")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === "errors" ? "bg-red-500/10 text-red-600" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Errors ({previewData.invalid})
                </button>
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 text-muted-foreground uppercase font-semibold">
                        <th className="py-2.5 px-3">Row</th>
                        <th className="py-2.5 px-3">UID</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Mobile</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Batch</th>
                        <th className="py-2.5 px-3">Section</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPreviewRows().map((row) => {
                        const rowError = previewData.errors.find(
                          (e) => e.row === row.rowNumber,
                        );

                        return (
                          <tr
                            key={row.rowNumber}
                            className={
                              rowError
                                ? rowError.isDuplicate
                                  ? "bg-amber-500/5 hover:bg-amber-500/10"
                                  : "bg-red-500/5 hover:bg-red-500/10"
                                : "hover:bg-muted/30"
                            }
                          >
                            <td className="py-2.5 px-3 text-muted-foreground font-mono">
                              #{row.rowNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                              {row.uid || "—"}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-foreground">
                              {row.name || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {row.email || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground font-mono">
                              {row.mobile || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {row.department || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {row.batch || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground font-mono font-semibold">
                              {row.section || "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              {rowError ? (
                                <span
                                  className={`inline-flex items-center gap-1 font-medium ${
                                    rowError.isDuplicate ? "text-amber-600" : "text-red-600"
                                  }`}
                                  title={rowError.error}
                                >
                                  {rowError.isDuplicate ? (
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5" />
                                  )}
                                  <span className="truncate max-w-[200px]">
                                    {rowError.error}
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                  <Check className="w-3.5 h-3.5" /> Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
