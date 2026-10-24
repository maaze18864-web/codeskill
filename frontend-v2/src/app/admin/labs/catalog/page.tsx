"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Link2, UserPlus, FlaskConical } from "lucide-react";
import { adminLabsAPI, adminProblemsAPI } from "@/config/api";
import { Spinner } from "@/components/ui/spinner";
import { LabProjectAuthor } from "@/components/labs/LabProjectAuthor";
import { LabSqlAuthor, LabMarksEditor } from "@/components/labs/LabSqlAuthor";
import type { SqlProblemInput } from "@/lib/sql-workspace";
import type { LabProjectTemplate } from "@/lib/labs-types";
import {
  LabsHeader,
  LabsNotice,
  LabsEmpty,
  LabsTable,
  LabsBadge,
  LabsPicker,
  LabsModal,
  labsPage,
  labsPanel,
  labsAction,
  labsPrimary,
  labsControl,
  labsList,
  labsError,
} from "@/components/labs/LabsUI";
import type {
  LabSummary,
  LabSectionSummary,
  LabExperimentSummary,
} from "@/lib/labs-types";
interface Teacher {
  id: string;
  name: string;
  role: string;
  email?: string;
  isActive?: boolean;
}
interface LabDetail extends LabSummary {
  sections: LabSectionSummary[];
  experiments: LabExperimentSummary[];
  teachers: Array<{
    id: string;
    role: string;
    teacher?: Teacher;
    section?: LabSectionSummary;
  }>;
}
interface PracticeOption {
  id: string;
  title: string;
  difficulty?: string;
}
export default function AdminLabsCatalogPage() {
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [sections, setSections] = useState<LabSectionSummary[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LabDetail | null>(null);
  const activeId = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subject: "",
    description: "",
    status: "draft",
  });
  const [experimentForm, setExperimentForm] = useState({
    title: "",
    description: "",
  });
  const [assignSectionId, setAssignSectionId] = useState("");
  const [teacherForm, setTeacherForm] = useState({
    sectionId: "",
    teacherId: "",
  });
  const [problemSearch, setProblemSearch] = useState("");
  const [problems, setProblems] = useState<PracticeOption[]>([]);
  const [problemLoading, setProblemLoading] = useState(false);
  const [attachExperimentId, setAttachExperimentId] = useState<string | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<LabExperimentSummary | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [sqlExercise, setSqlExercise] = useState<{
    experimentId: string;
    problemId?: string;
    initial?: SqlProblemInput;
    maxScore?: number;
  } | null>(null);
  const [projectExercise, setProjectExercise] = useState<{
    experimentId: string;
    problemId?: string;
    initial?: LabProjectTemplate;
  } | null>(null);
  const loadLists = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        adminLabsAPI.listLabs(),
        adminLabsAPI.listSections(),
        adminLabsAPI.listTeachers(),
      ]);
      if (results[0].status === "rejected") throw results[0].reason;
      const list = labsList<LabSummary>(results[0].value.data);
      setLabs(list);
      const requestedLab = new URLSearchParams(window.location.search).get(
        "labId",
      );
      setSelectedId((current) =>
        current && list.some((lab) => lab.id === current)
          ? current
          : list.find((lab) => lab.id === requestedLab)?.id ||
            list[0]?.id ||
            null,
      );
      if (results[1].status === "fulfilled")
        setSections(labsList(results[1].value.data));
      else
        setError(
          "Sections could not be loaded. Refresh to retry before assigning a lab.",
        );
      if (results[2].status === "fulfilled")
        setTeachers(labsList(results[2].value.data));
      else
        setError(
          "Teacher options could not be loaded. Refresh to retry. Section assignments remain available.",
        );
    } catch (error) {
      setError(labsError(error, "Could not load the lab catalog."));
    } finally {
      setLoading(false);
    }
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const { data } = await adminLabsAPI.getLab(id);
      if (activeId.current === id) setDetail(data);
    } catch (error) {
      if (activeId.current === id)
        setError(labsError(error, "Could not load this lab."));
    } finally {
      if (activeId.current === id) setDetailLoading(false);
    }
  }, []);
  useEffect(() => {
    loadLists();
  }, [loadLists]);
  useEffect(() => {
    activeId.current = selectedId;
    setDetail(null);
    setAssignSectionId("");
    setTeacherForm({ sectionId: "", teacherId: "" });
    setSuccess(null);
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);
  async function mutate(action: () => Promise<void>, message: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(message);
    } catch (error) {
      setError(
        labsError(error, "The change could not be saved. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  }
  const availableSections = sections.filter(
    (section) =>
      section.isActive !== false &&
      !detail?.sections.some((assigned) => assigned.id === section.id),
  );
  async function assignSection() {
    if (
      !selectedId ||
      !assignSectionId ||
      !availableSections.some((section) => section.id === assignSectionId)
    )
      return;
    const id = selectedId;
    await mutate(async () => {
      await adminLabsAPI.assignSections(id, [assignSectionId]);
      setAssignSectionId("");
      await loadDetail(id);
    }, "Subject lab assigned to the selected section.");
  }
  async function assignTeacher() {
    if (!selectedId || !teacherForm.sectionId || !teacherForm.teacherId) return;
    const id = selectedId;
    await mutate(async () => {
      await adminLabsAPI.assignTeacher(id, teacherForm);
      setTeacherForm({ sectionId: "", teacherId: "" });
      await loadDetail(id);
    }, "Teacher assignment saved.");
  }
  async function searchProblems() {
    setProblemLoading(true);
    try {
      const { data } = await adminProblemsAPI.getAll({
        page: 1,
        limit: 30,
        search: problemSearch,
      });
      setProblems(labsList<PracticeOption>(data.problems || data.data || data));
    } catch (error) {
      setError(labsError(error, "Practice problems could not be loaded."));
    } finally {
      setProblemLoading(false);
    }
  }
  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  return (
    <div className={labsPage}>
      <LabsHeader
        title="Subject Lab Catalog"
        backHref="/admin/labs"
        description="Organize experiments, then assign each subject lab to its sections and teachers."
      >
        <button className={labsPrimary} onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create lab
        </button>
      </LabsHeader>
      {error && <LabsNotice>{error}</LabsNotice>}
      {success && <LabsNotice success>{success}</LabsNotice>}
      <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className={labsPanel}>
          <div className="space-y-3 border-b border-border p-4">
            <h2 className="text-sm font-semibold">
              Subject labs{" "}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {labs.length}
              </span>
            </h2>
            <input
              type="search"
              aria-label="Search subject labs"
              placeholder="Search labs…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${labsControl} w-full`}
            />
          </div>
          <ul className="max-h-[65vh] space-y-1 overflow-y-auto p-2">
            {labs
              .filter((lab) =>
                `${lab.title} ${lab.subject || ""}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((lab) => (
                <li key={lab.id}>
                  <button
                    disabled={busy}
                    onClick={() => setSelectedId(lab.id)}
                    aria-current={selectedId === lab.id ? "true" : undefined}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors disabled:opacity-60 ${selectedId === lab.id ? "border-primary/20 bg-primary/5" : "border-transparent hover:bg-muted/50"}`}
                  >
                    <span className="flex items-start gap-2">
                      <FlaskConical
                        className={`mt-0.5 size-4 shrink-0 ${selectedId === lab.id ? "text-primary" : "text-muted-foreground"}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {lab.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {lab.subject || "General"} ·{" "}
                          {lab.experimentCount || 0} experiments
                        </span>
                      </span>
                    </span>
                    <span className="mt-2 inline-block">
                      <LabsBadge active={lab.status === "published"}>
                        {lab.status || "draft"}
                      </LabsBadge>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          {!labs.length && (
            <LabsEmpty
              title="No subject labs yet"
              description="Create your first lab to get started."
            />
          )}
        </aside>
        <div className="min-w-0 space-y-5">
          {detailLoading && !detail ? (
            <div className="flex min-h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : !detail ? (
            <LabsEmpty
              title="Select a subject lab"
              description="Its experiments and assignments will appear here."
            />
          ) : (
            <>
              <section className={`${labsPanel} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      {detail.title}
                    </h2>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                      {detail.description ||
                        "Manage this lab's sections, teaching team, and experiments below."}
                    </p>
                  </div>
                  <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                    <span className="block">Publication status</span>
                    <select
                      aria-label="Lab publication status"
                      value={detail.status}
                      disabled={busy}
                      onChange={(event) => {
                        const status = event.target.value;
                        mutate(async () => {
                          await adminLabsAPI.updateLab(detail.id, { status });
                          await loadDetail(detail.id);
                          await loadLists();
                        }, "Lab status updated.");
                      }}
                      className={labsControl}
                    >
                      {["draft", "published", "archived"].map((status) => (
                        <option key={status} value={status}>
                          {status[0].toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section className={`${labsPanel} p-5 space-y-4`}>
                <div>
                  <h3 className="text-sm font-semibold">Section assignments</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Students enrolled in these sections can access this lab when
                    it is published.
                  </p>
                </div>
                {detail.sections.length ? (
                  <div className="flex flex-wrap gap-2">
                    {detail.sections.map((section) => (
                      <span
                        key={section.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"
                      >
                        <CheckSection />{" "}
                        <span className="font-semibold">{section.code}</span>
                        <span className="text-muted-foreground">
                          {section.name}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                    This lab has no assigned sections yet.
                  </p>
                )}
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
                  <LabsPicker
                    key={`${detail.id}:sections`}
                    label="Assign to section"
                    options={availableSections.map((section) => ({
                      id: section.id,
                      label: section.code,
                      description: `${section.name}${section.department ? ` · ${section.department}` : ""}`,
                    }))}
                    value={assignSectionId}
                    onChange={setAssignSectionId}
                    disabled={busy || !availableSections.length}
                    placeholder={
                      !sections.length
                        ? "No sections available"
                        : !availableSections.length
                          ? "All active sections already assigned"
                          : "Search section code or name…"
                    }
                  />
                  <button
                    disabled={busy || !assignSectionId}
                    onClick={assignSection}
                    className={labsPrimary}
                  >
                    <Link2 className="size-3.5" />
                    {busy ? "Saving…" : "Assign section"}
                  </button>
                </div>
                {!availableSections.length && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {sections.length
                      ? "All active sections are already assigned to this lab."
                      : "Create an academic section before assigning a lab."}{" "}
                    <Link
                      href="/admin/labs/sections"
                      className="font-medium text-primary hover:underline"
                    >
                      Manage sections
                    </Link>
                  </p>
                )}
              </section>
              <section className={`${labsPanel} p-5 space-y-4`}>
                <div>
                  <h3 className="text-sm font-semibold">Teaching team</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assign a teacher to a section already linked to this lab.
                  </p>
                </div>
                {detail.teachers.length > 0 && (
                  <LabsTable label="Assigned teachers">
                    <thead>
                      <tr>
                        <th>Teacher</th>
                        <th>Section</th>
                        <th>Role</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.teachers.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <p className="font-medium">
                              {row.teacher?.name || "—"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.teacher?.email}
                            </p>
                          </td>
                          <td className="text-xs">{row.section?.code}</td>
                          <td>
                            <LabsBadge>{row.role}</LabsBadge>
                          </td>
                          <td className="text-right">
                            <button
                              disabled={busy}
                              className="text-xs text-destructive hover:underline"
                              onClick={() =>
                                mutate(async () => {
                                  await adminLabsAPI.removeTeacher(
                                    detail.id,
                                    row.id,
                                  );
                                  await loadDetail(detail.id);
                                }, "Teacher assignment removed.")
                              }
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </LabsTable>
                )}
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <LabsPicker
                    key={`${detail.id}:teacher-section`}
                    label="Teaching section"
                    options={detail.sections.map((section) => ({
                      id: section.id,
                      label: section.code,
                      description: section.name,
                    }))}
                    value={teacherForm.sectionId}
                    onChange={(sectionId) =>
                      setTeacherForm((form) => ({ ...form, sectionId }))
                    }
                    disabled={busy || !detail.sections.length}
                    placeholder="Choose an assigned section…"
                  />
                  <LabsPicker
                    key={`${detail.id}:teacher`}
                    label="Teacher"
                    options={teachers
                      .filter((teacher) => teacher.isActive !== false)
                      .map((teacher) => ({
                        id: teacher.id,
                        label: teacher.name,
                        description: teacher.email || teacher.role,
                      }))}
                    value={teacherForm.teacherId}
                    onChange={(teacherId) =>
                      setTeacherForm((form) => ({ ...form, teacherId }))
                    }
                    disabled={busy || !teachers.length}
                    placeholder={
                      teachers.length
                        ? "Search teacher…"
                        : "No teacher accounts available"
                    }
                  />
                  <button
                    disabled={
                      busy || !teacherForm.sectionId || !teacherForm.teacherId
                    }
                    onClick={assignTeacher}
                    className={labsAction}
                  >
                    <UserPlus className="size-3.5" />
                    Assign teacher
                  </button>
                </div>
                {!teachers.length && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    No teacher accounts are available. A user with the teacher,
                    faculty, or instructor role is required.
                  </p>
                )}
              </section>
              <section className={`${labsPanel} p-5 space-y-5`}>
                <div>
                  <h3 className="text-sm font-semibold">
                    Experiments{" "}
                    <span className="ml-1 font-normal text-muted-foreground">
                      {detail.experiments.length}
                    </span>
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Keep related practice problems together in an experiment.
                  </p>
                </div>
                <form
                  className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (experimentForm.title.trim())
                      mutate(async () => {
                        await adminLabsAPI.createExperiment(
                          detail.id,
                          experimentForm,
                        );
                        setExperimentForm({ title: "", description: "" });
                        await loadDetail(detail.id);
                      }, "Experiment added.");
                  }}
                >
                  <label className="text-xs font-medium text-muted-foreground">
                    Experiment title
                    <input
                      aria-label="Experiment title"
                      className={`${labsControl} mt-1.5 w-full`}
                      value={experimentForm.title}
                      onChange={(event) =>
                        setExperimentForm({
                          ...experimentForm,
                          title: event.target.value,
                        })
                      }
                      placeholder="e.g. Sliding window"
                    />
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Description <span className="font-normal">(optional)</span>
                    <input
                      aria-label="Experiment description"
                      className={`${labsControl} mt-1.5 w-full`}
                      value={experimentForm.description}
                      onChange={(event) =>
                        setExperimentForm({
                          ...experimentForm,
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    disabled={busy || !experimentForm.title.trim()}
                    className={labsAction}
                  >
                    <Plus className="size-3.5" />
                    Add experiment
                  </button>
                </form>
                {detail.experiments.map((experiment, index) => (
                  <div
                    key={experiment.id}
                    className="space-y-3 border-t border-border pt-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          <span className="mr-2 text-xs font-normal tabular-nums text-muted-foreground">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {experiment.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {experiment.problems?.length || 0}{" "}
                          {experiment.problems?.length === 1
                            ? "problem"
                            : "problems"}
                          {experiment.description &&
                          experiment.description !== "Labs"
                            ? ` · ${experiment.description}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={labsAction}
                          onClick={() =>
                            setSqlExercise({ experimentId: experiment.id })
                          }
                        >
                          Add SQL question
                        </button>
                        <Link
                          className={labsAction}
                          href={`/admin/assessments/create?labId=${detail.id}&experimentId=${experiment.id}`}
                        >
                          Create assessment
                        </Link>
                        <button
                          disabled={busy}
                          className={labsAction}
                          onClick={() =>
                            setProjectExercise({ experimentId: experiment.id })
                          }
                        >
                          Add project exercise
                        </button>
                        <button
                          disabled={busy}
                          className={labsAction}
                          onClick={() => {
                            setAttachExperimentId(experiment.id);
                            searchProblems();
                          }}
                        >
                          Attach problem
                        </button>
                        <button
                          disabled={busy}
                          aria-label={`Delete ${experiment.title}`}
                          className={`${labsAction} px-2 text-destructive`}
                          onClick={() => setDeleteTarget(experiment)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    {experiment.problems?.length ? (
                      <LabsTable label={`${experiment.title} problems`}>
                        <thead>
                          <tr>
                            <th>Problem</th>
                            <th>Difficulty</th>
                            <th>Points</th>
                            <th>
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {experiment.problems.map((problem) => (
                            <tr key={problem.id}>
                              <td className="font-medium">
                                {problem.sqlProblem?.title ||
                                  problem.projectTemplate?.name ||
                                  problem.problemMetadata?.title ||
                                  "Practice problem"}
                                {problem.kind === "project" && (
                                  <span className="ml-2 text-[10px] text-primary">
                                    Project
                                  </span>
                                )}
                              </td>
                              <td className="text-xs text-muted-foreground">
                                {problem.difficulty || "—"}
                              </td>
                              <td className="tabular-nums">
                                <LabMarksEditor
                                  key={`${problem.id}:${problem.maxScore}`}
                                  value={problem.maxScore}
                                  label={`Practice marks for ${problem.sqlProblem?.title || problem.projectTemplate?.name || problem.problemMetadata?.title || "question"}`}
                                  onSave={async (marks) => {
                                    await adminLabsAPI.practiceMarks(
                                      detail.id,
                                      experiment.id,
                                      problem.id,
                                      marks,
                                    );
                                    await loadDetail(detail.id);
                                  }}
                                />
                              </td>
                              <td className="text-right">
                                {problem.kind === "sql" && (
                                  <button
                                    className="mr-3 text-xs text-primary"
                                    onClick={() =>
                                      setSqlExercise({
                                        experimentId: experiment.id,
                                        problemId: problem.id,
                                        initial: problem.sqlProblem,
                                        maxScore: problem.maxScore,
                                      })
                                    }
                                  >
                                    Edit SQL
                                  </button>
                                )}
                                {problem.kind === "project" && (
                                  <button
                                    className="mr-3 text-xs text-primary hover:underline"
                                    onClick={() =>
                                      setProjectExercise({
                                        experimentId: experiment.id,
                                        problemId: problem.id,
                                        initial: {
                                          ...problem.projectTemplate!,
                                          maxScore: problem.maxScore,
                                          difficulty: problem.difficulty,
                                        },
                                      })
                                    }
                                  >
                                    Edit starter
                                  </button>
                                )}
                                <button
                                  disabled={busy}
                                  className="text-xs text-destructive hover:underline"
                                  onClick={() =>
                                    mutate(async () => {
                                      await adminLabsAPI.detachProblem(
                                        detail.id,
                                        experiment.id,
                                        problem.id,
                                      );
                                      await loadDetail(detail.id);
                                    }, "Problem detached from the experiment.")
                                  }
                                >
                                  Detach
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </LabsTable>
                    ) : (
                      <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
                        Attach a practice problem or add a project exercise with
                        starter files.
                      </p>
                    )}
                    {!!experiment.assessments?.length && (
                      <LabsTable label={`${experiment.title} assessments`}>
                        <thead>
                          <tr>
                            <th>Assessment</th>
                            <th>Questions</th>
                            <th>Exam marks</th>
                            <th>Lab contribution</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {experiment.assessments.map((item) => (
                            <tr key={item.id}>
                              <td>{item.title}</td>
                              <td>{item.questionCount}</td>
                              <td>{item.totalMarks}</td>
                              <td>
                                <LabMarksEditor
                                  key={`${item.id}:${item.maxScore}`}
                                  value={item.maxScore}
                                  label={`Lab marks for ${item.title}`}
                                  onSave={async (marks) => {
                                    await adminLabsAPI.assessmentMarks(
                                      detail.id,
                                      experiment.id,
                                      item.id,
                                      marks,
                                    );
                                    await loadDetail(detail.id);
                                  }}
                                />
                              </td>
                              <td>
                                <Link
                                  className="text-xs text-primary"
                                  href={`/admin/assessments/create?id=${item.id}&labId=${detail.id}&experimentId=${experiment.id}`}
                                >
                                  Edit assessment & question marks
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </LabsTable>
                    )}
                  </div>
                ))}
                {!detail.experiments.length && (
                  <LabsEmpty
                    title="No experiments yet"
                    description="Add an experiment above, then attach practice problems."
                  />
                )}
              </section>
            </>
          )}
        </div>
      </div>
      {sqlExercise && detail && (
        <LabSqlAuthor
          initial={sqlExercise.initial}
          maxScore={sqlExercise.maxScore}
          onClose={() => setSqlExercise(null)}
          onSave={async (data) => {
            await adminLabsAPI.saveSqlProblem(
              detail.id,
              sqlExercise.experimentId,
              data,
              sqlExercise.problemId,
            );
            setSqlExercise(null);
            await loadDetail(detail.id);
          }}
        />
      )}
      {projectExercise && detail && (
        <LabProjectAuthor
          initial={projectExercise.initial}
          onClose={() => setProjectExercise(null)}
          onSave={async (template) => {
            await adminLabsAPI.saveProjectProblem(
              detail.id,
              projectExercise.experimentId,
              template,
              projectExercise.problemId,
            );
            setProjectExercise(null);
            await loadDetail(detail.id);
            setSuccess(
              "Project exercise saved. Students can open their own copy from the experiment.",
            );
          }}
        />
      )}
      <LabsModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create subject lab"
        description="Start with a draft. You can publish it after adding experiments and section assignments."
        busy={busy}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.title.trim()) return;
            mutate(async () => {
              const { data } = await adminLabsAPI.createLab(form);
              setCreateOpen(false);
              setForm({
                title: "",
                subject: "",
                description: "",
                status: "draft",
              });
              await loadLists();
              setSelectedId(data.id);
            }, "Subject lab created.");
          }}
        >
          {(
            [
              ["title", "Lab title"],
              ["subject", "Subject"],
              ["description", "Description"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="block text-xs font-medium text-muted-foreground"
            >
              {label}
              {key === "title" ? " *" : ""}
              <input
                required={key === "title"}
                className={`${labsControl} mt-1.5 w-full`}
                value={form[key]}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setCreateOpen(false)}
              className={labsAction}
            >
              Cancel
            </button>
            <button
              disabled={busy || !form.title.trim()}
              className={labsPrimary}
            >
              {busy ? "Creating…" : "Create lab"}
            </button>
          </div>
        </form>
      </LabsModal>
      <LabsModal
        open={!!attachExperimentId}
        onClose={() => setAttachExperimentId(null)}
        title="Attach practice problem"
        description="Search your practice library. The original problem remains unchanged."
        busy={busy}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            searchProblems();
          }}
          className="mb-4 flex gap-2"
        >
          <input
            aria-label="Search practice problems"
            className={`${labsControl} flex-1`}
            value={problemSearch}
            onChange={(event) => setProblemSearch(event.target.value)}
            placeholder="Problem title…"
          />
          <button className={labsAction}>Search</button>
        </form>
        {problemLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {problems.map((problem) => (
              <li
                key={problem.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div>
                  <p className="text-sm font-medium">{problem.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {problem.difficulty}
                  </p>
                </div>
                <button
                  disabled={busy}
                  className={labsAction}
                  onClick={() => {
                    if (!selectedId || !attachExperimentId) return;
                    const id = selectedId;
                    mutate(async () => {
                      await adminLabsAPI.attachProblem(id, attachExperimentId, {
                        problemMetadataId: problem.id,
                      });
                      setAttachExperimentId(null);
                      await loadDetail(id);
                    }, "Practice problem attached.");
                  }}
                >
                  Attach
                </button>
              </li>
            ))}
            {!problems.length && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                No practice problems match this search.
              </li>
            )}
          </ul>
        )}
      </LabsModal>
      <LabsModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete experiment?"
        description={`This removes ${deleteTarget?.title || "this experiment"} and its lab progress. The original practice problems are preserved.`}
        busy={busy}
      >
        <div className="flex justify-end gap-2">
          <button
            disabled={busy}
            className={labsAction}
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className={`${labsAction} border-destructive/30 text-destructive`}
            onClick={() => {
              if (!selectedId || !deleteTarget) return;
              const id = selectedId;
              mutate(async () => {
                await adminLabsAPI.deleteExperiment(id, deleteTarget.id);
                setDeleteTarget(null);
                await loadDetail(id);
              }, "Experiment deleted.");
            }}
          >
            Delete experiment
          </button>
        </div>
      </LabsModal>
    </div>
  );
}
function CheckSection() {
  return (
    <span
      className="size-1.5 shrink-0 rounded-full bg-primary"
      aria-hidden="true"
    />
  );
}
