"use client";

import { useState } from "react";
import { useQuestionEditorStore } from "../_store/QuestionEditorProvider";
import { getQuestionTypeLabel, type QuestionType } from "@/lib/question-types";
import SectionCard from "./SectionCard";
import { FileText, X, Plus, Lock, Globe, Link as LinkIcon } from "lucide-react";

const CATEGORY_OPTIONS = [
  "Arrays", "Strings", "Graph", "Dynamic Programming", "Trees",
  "Math", "Greedy", "Binary Search", "SQL", "Hash Table",
  "Stack", "Queue", "Linked List", "Sorting", "Recursion",
  "Backtracking", "Bit Manipulation", "Two Pointers", "Sliding Window",
];

const inputClass =
  "w-full px-3.5 py-2.5 bg-muted/50 dark:bg-card border border-border dark:border-border rounded-xl text-sm text-foreground dark:text-white placeholder:text-gray-400 dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:ring-indigo-400/20 dark:focus:border-indigo-400 transition-all";

const labelClass = "text-[13px] font-medium text-gray-700 dark:text-slate-300";

export default function BasicInfo({ practice = false }: { practice?: boolean }) {
  const { metadata, statement, updateMetadata, updateStatement, updatePublishing } = useQuestionEditorStore();
  const isMcq = ["MCQ", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(metadata.questionType);
  const [tagInput, setTagInput] = useState("");
  const [showCategories, setShowCategories] = useState(false);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    updateMetadata({ title, slug });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,$/, "");
      if (!metadata.tags.includes(tag)) {
        updateMetadata({ tags: [...metadata.tags, tag] });
      }
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput && metadata.tags.length > 0) {
      updateMetadata({ tags: metadata.tags.slice(0, -1) });
    }
  };

  const removeTag = (tag: string) => {
    updateMetadata({ tags: metadata.tags.filter((t) => t !== tag) });
  };

  const toggleCategory = (cat: string) => {
    const cats = metadata.categories.includes(cat)
      ? metadata.categories.filter((c) => c !== cat)
      : [...metadata.categories, cat];
    updateMetadata({ categories: cats });
  };

  return (
    <SectionCard
      id="basic-info"
      title="Basic Information"
      subtitle="Define the core properties of your coding problem."
      icon={FileText}
      delay={0}
    >
      <div className="space-y-5">
        {/* Row 1: Title + Slug */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className={labelClass}>
              {isMcq ? "Title" : "Question Title"} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              aria-label={isMcq ? "Title" : "Question Title"}
              value={metadata.title}
              onChange={handleTitleChange}
              placeholder="e.g. Two Sum"
              className={inputClass}
            />
            {!metadata.title.trim() && (
              <p className="text-[11px] text-red-500 mt-1">Title is required</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>
              URL Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              aria-label="URL Slug"
              value={metadata.slug}
              onChange={(e) => updateMetadata({ slug: e.target.value })}
              placeholder="e.g. two-sum"
              className={`${inputClass} font-mono text-xs`}
            />
            {metadata.slug && (
              <p className="text-[11px] text-gray-400 dark:text-muted-foreground">
                codeskill.novaserve.cloud/problems/<span className="text-indigo-500 font-medium">{metadata.slug}</span>
              </p>
            )}
          </div>
        </div>

        {isMcq && (
          <div className="space-y-1.5">
            <label className={labelClass}>Question <span className="text-red-500">*</span></label>
            <textarea
              value={statement.description}
              onChange={(e) => updateStatement({ description: e.target.value })}
              placeholder="Enter the question shown to students"
              rows={4}
              className={inputClass}
            />
          </div>
        )}

        {/* Row 2: Type, Difficulty + Visibility */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label className={labelClass}>
              Question Type <span className="text-red-500">*</span>
            </label>
            <select
              aria-label="Question Type"
              disabled={practice}
              value={metadata.questionType}
              onChange={(e) => updateMetadata({ questionType: e.target.value as QuestionType })}
              className={`${inputClass} appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%207l5%205%205-5%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_10px_center] pr-10`}
            >
              <option value="MCQ">Single Choice (MCQ)</option>
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="CODE_OUTPUT">Code Output</option>
              <option value="DSA">DSA / Coding Problem</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>
              Difficulty <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {(["Easy", "Medium", "Hard"] as const).map((diff) => {
                const isActive = metadata.difficulty === diff;
                const colors = {
                  Easy: isActive
                    ? "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-400"
                    : "bg-muted/50 border-border text-gray-500 dark:bg-card dark:border-border dark:text-muted-foreground",
                  Medium: isActive
                    ? "bg-primary/10 border-primary/20 text-primary dark:bg-primary/20 dark:border-primary/30 dark:text-primary"
                    : "bg-muted/50 border-border text-gray-500 dark:bg-card dark:border-border dark:text-muted-foreground",
                  Hard: isActive
                    ? "bg-red-100 border-red-300 text-red-700 dark:bg-red-500/20 dark:border-red-500/30 dark:text-red-400"
                    : "bg-muted/50 border-border text-gray-500 dark:bg-card dark:border-border dark:text-muted-foreground",
                };
                return (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => updateMetadata({ difficulty: diff })}
                    className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${colors[diff]}`}
                  >
                    {diff}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5 relative">
            <label className={labelClass}>Visibility</label>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('visibility-dropdown');
                if (el) el.classList.toggle('hidden');
              }}
              className={`${inputClass} text-left flex items-center justify-between cursor-pointer`}
            >
              <span className="flex items-center gap-2">
                {metadata.visibility === "Draft" && <Lock className="w-4 h-4 text-muted-foreground" />}
                {metadata.visibility === "Published" && <Globe className="w-4 h-4 text-emerald-500" />}
                {metadata.visibility === "Private" && <LinkIcon className="w-4 h-4 text-primary" />}
                {metadata.visibility === "Draft" ? "Draft (Hidden)" : metadata.visibility === "Published" ? "Published (Public)" : practice ? "Private (Hidden)" : "Private (Link Only)"}
              </span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            <div id="visibility-dropdown" className="hidden absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg shadow-black/5 overflow-hidden py-1">
              {[
                { value: "Draft", label: "Draft (Hidden)", icon: Lock, iconColor: "text-muted-foreground" },
                { value: "Published", label: "Published (Public)", icon: Globe, iconColor: "text-emerald-500" },
                { value: "Private", label: practice ? "Private (Hidden)" : "Private (Link Only)", icon: LinkIcon, iconColor: "text-primary" }
              ].filter(opt => !practice || opt.value !== "Private" || metadata.visibility === "Private").map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    updateMetadata({ visibility: opt.value as any });
                    if (opt.value === "Published") {
                      updatePublishing({ publishImmediately: true, saveAsDraft: false });
                    } else if (opt.value === "Draft") {
                      updatePublishing({ publishImmediately: false, saveAsDraft: true });
                    }
                    document.getElementById('visibility-dropdown')?.classList.add('hidden');
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                    metadata.visibility === opt.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <opt.icon className={`w-4 h-4 ${opt.iconColor}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Categories multi-select */}
        <div className="space-y-1.5">
          <label className={labelClass}>
            Categories <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap items-center gap-2 py-1">
            <span className="text-xs text-muted-foreground">Question type</span>
            <span role="status" aria-label="Automatic question type" className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-lg" title="Automatically set by Question Type">
              <Lock aria-hidden="true" className="w-3 h-3" />{getQuestionTypeLabel(metadata.questionType)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Topic categories</p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCategories(!showCategories)}
              className={`${inputClass} text-left flex items-center justify-between cursor-pointer`}
            >
              <span className={metadata.categories.length === 0 ? "text-gray-400 dark:text-muted-foreground" : ""}>
                {metadata.categories.length === 0
                  ? "Select categories..."
                  : `${metadata.categories.length} selected`}
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showCategories ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {showCategories && (
              <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white dark:bg-card border border-border dark:border-border rounded-xl shadow-xl p-3 max-h-60 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <label
                      key={cat}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                        metadata.categories.includes(cat)
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                          : "hover:bg-muted/50 text-muted-foreground dark:hover:bg-slate-700 dark:text-muted-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={metadata.categories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Selected chips */}
          {metadata.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {metadata.categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-lg"
                >
                  {cat}
                  <button type="button" onClick={() => toggleCategory(cat)} className="hover:text-indigo-900 dark:hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Row 4: Tags */}
        <div className="space-y-1.5">
          <label className={labelClass}>Tags</label>
          <div className={`${inputClass} flex flex-wrap items-center gap-1.5 min-h-[42px] !p-2`}>
            {metadata.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-medium rounded-lg"
              >
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder={metadata.tags.length === 0 ? "Type and press Enter to add tags..." : ""}
              className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground dark:text-white placeholder:text-gray-400 dark:placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        {/* Row 5: Author + Question ID + Solve Time + Points */}
        {!practice && <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
          <div className="space-y-1.5">
            <label className={labelClass}>Author</label>
            <input
              type="text"
              value={metadata.author}
              onChange={(e) => updateMetadata({ author: e.target.value })}
              placeholder="Author name"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Question ID</label>
            <input
              type="text"
              value={metadata.questionId}
              readOnly
              className={`${inputClass} bg-muted dark:bg-slate-700/50 cursor-not-allowed font-mono text-xs`}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Est. Solve Time</label>
            <div className="relative">
              <input
                type="number"
                value={metadata.estimatedSolveTime}
                onChange={(e) => updateMetadata({ estimatedSolveTime: Number(e.target.value) })}
                min={1}
                className={inputClass}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-muted-foreground">min</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Marks / Points</label>
            <input
              type="number"
              value={metadata.points}
              onChange={(e) => updateMetadata({ points: Number(e.target.value) })}
              min={0}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Negative Marks</label>
            <input
              type="number"
              step="0.25"
              value={metadata.negativeMarks ?? 0}
              onChange={(e) => updateMetadata({ negativeMarks: Number(e.target.value) })}
              min={0}
              placeholder="0.25, 0.5, 1"
              className={inputClass}
            />
            <span className="text-[10px] text-muted-foreground">Deducted on wrong answer</span>
          </div>
        </div>}
      </div>
    </SectionCard>
  );
}
