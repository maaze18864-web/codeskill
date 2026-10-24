"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Users, Trash2 } from "lucide-react";
import { adminLabsAPI, adminStudentsAPI } from "@/config/api";
import { Spinner } from "@/components/ui/spinner";
import {
  LabsHeader,
  LabsNotice,
  LabsPicker,
  LabsModal,
  LabsTable,
  LabsBadge,
  LabsEmpty,
  labsPage,
  labsPanel,
  labsAction,
  labsPrimary,
  labsControl,
  labsList,
  labsError,
} from "@/components/labs/LabsUI";
import type { LabSummary, LabSectionSummary } from "@/lib/labs-types";
interface SectionDetail extends LabSectionSummary {
  labs?: LabSummary[];
}
interface StudentOption {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  uid?: string;
}
interface Enrollment {
  id: string;
  student?: StudentOption;
  subgroup?: { id: string; code: string };
  status: string;
}
const emptyForm = {
  code: "",
  name: "",
  department: "",
  semester: "",
  academicYear: "",
  subgroupCodes: "A",
};
export default function AdminLabSectionsPage() {
  const [sections, setSections] = useState<LabSectionSummary[]>([]);
  const [subjectLabs, setSubjectLabs] = useState<LabSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = useRef<string | null>(null);
  const [detail, setDetail] = useState<SectionDetail | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignLabId, setAssignLabId] = useState("");
  const [subgroupCode, setSubgroupCode] = useState("");
  const [query, setQuery] = useState("");
  const [sectionSearch, setSectionSearch] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [enrollSubgroupId, setEnrollSubgroupId] = useState("");
  const loadLists = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        adminLabsAPI.listSections(),
        adminLabsAPI.listLabs(),
      ]);
      if (results[0].status === "rejected") throw results[0].reason;
      const list = labsList<LabSectionSummary>(results[0].value.data);
      setSections(list);
      setSelectedId((current) =>
        current && list.some((section) => section.id === current)
          ? current
          : list[0]?.id || null,
      );
      if (results[1].status === "fulfilled")
        setSubjectLabs(labsList(results[1].value.data));
      else
        setError("Subject lab options could not be loaded. Refresh to retry.");
    } catch (error) {
      setError(labsError(error, "Could not load academic sections."));
    } finally {
      setLoading(false);
    }
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    try {
      const [section, enrolled] = await Promise.all([
        adminLabsAPI.getSection(id),
        adminLabsAPI.listEnrollments(id),
      ]);
      if (activeId.current !== id) return;
      setDetail(section.data);
      setEnrollments(labsList(enrolled.data));
    } catch (error) {
      if (activeId.current === id)
        setError(labsError(error, "Could not load this section."));
    }
  }, []);
  useEffect(() => {
    loadLists();
  }, [loadLists]);
  useEffect(() => {
    activeId.current = selectedId;
    setDetail(null);
    setAssignLabId("");
    setSubgroupCode("");
    setQuery("");
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
  async function searchStudents() {
    setStudentsLoading(true);
    try {
      const { data } = await adminStudentsAPI.getAll({
        page: 1,
        limit: 50,
        search: studentSearch,
      });
      setStudentOptions(labsList(data.students || data));
    } catch (error) {
      setError(labsError(error, "Students could not be loaded."));
    } finally {
      setStudentsLoading(false);
    }
  }
  const availableLabs = subjectLabs.filter(
    (lab) =>
      lab.status !== "archived" &&
      !detail?.labs?.some((assigned) => assigned.id === lab.id),
  );
  const visibleEnrollments = enrollments.filter((row) =>
    `${row.student?.name || ""} ${row.student?.uid || ""} ${row.student?.email || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  return (
    <div className={labsPage}>
      <LabsHeader
        title="Academic Sections"
        backHref="/admin/labs"
        description="Manage student enrollments, subgroups, and subject labs for each section."
      >
        <button
          onClick={() => {
            setError(null);
            setCreateOpen(true);
          }}
          className={labsPrimary}
        >
          <Plus className="size-4" />
          Create section
        </button>
      </LabsHeader>
      {error && <LabsNotice>{error}</LabsNotice>}
      {success && <LabsNotice success>{success}</LabsNotice>}
      <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className={labsPanel}>
          <div className="space-y-3 border-b border-border p-4">
            <h2 className="text-sm font-semibold">
              Sections{" "}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {sections.length}
              </span>
            </h2>
            <input
              aria-label="Search sections"
              type="search"
              placeholder="Search code or name…"
              className={`${labsControl} w-full`}
              value={sectionSearch}
              onChange={(event) => setSectionSearch(event.target.value)}
            />
          </div>
          <ul className="max-h-[65vh] space-y-1 overflow-y-auto p-2">
            {sections
              .filter((section) =>
                `${section.code} ${section.name}`
                  .toLowerCase()
                  .includes(sectionSearch.toLowerCase()),
              )
              .map((section) => (
                <li key={section.id}>
                  <button
                    disabled={busy}
                    aria-current={
                      selectedId === section.id ? "true" : undefined
                    }
                    onClick={() => setSelectedId(section.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors disabled:opacity-60 ${selectedId === section.id ? "border-primary/20 bg-primary/5" : "border-transparent hover:bg-muted/50"}`}
                  >
                    <p className="text-sm font-semibold">{section.code}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {section.name}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {section.enrollmentCount || 0}{" "}
                      {section.enrollmentCount === 1 ? "student" : "students"} ·{" "}
                      {(section.subgroups || [])
                        .map((subgroup) => subgroup.code)
                        .join(", ") || "No subgroups"}
                    </p>
                  </button>
                </li>
              ))}
          </ul>
          {!sections.length && (
            <LabsEmpty
              title="No sections yet"
              description="Create your first academic section."
            />
          )}
        </aside>
        <div className="min-w-0 space-y-5">
          {!detail ? (
            <LabsEmpty
              title={
                selectedId ? "Loading section…" : "Select an academic section"
              }
              description={
                selectedId
                  ? undefined
                  : "Enrollments and subject assignments will appear here."
              }
            />
          ) : (
            <>
              <section className={`${labsPanel} p-5 space-y-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      {detail.code}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {detail.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        detail.department,
                        detail.semester ? `Semester ${detail.semester}` : null,
                        detail.academicYear,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setError(null);
                      setDeleteId(detail.id);
                    }}
                    className={`${labsAction} text-destructive`}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.subgroups?.map((subgroup) => (
                    <LabsBadge key={subgroup.id}>
                      Subgroup {subgroup.code}
                    </LabsBadge>
                  ))}
                </div>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!subgroupCode.trim()) return;
                    mutate(async () => {
                      await adminLabsAPI.addSubgroup(detail.id, {
                        code: subgroupCode.trim(),
                      });
                      setSubgroupCode("");
                      await loadDetail(detail.id);
                      await loadLists();
                    }, "Subgroup added.");
                  }}
                >
                  <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                    New subgroup code
                    <input
                      aria-label="New subgroup code"
                      placeholder="e.g. B"
                      value={subgroupCode}
                      onChange={(event) => setSubgroupCode(event.target.value)}
                      className={`${labsControl} mt-1.5 w-full`}
                    />
                  </label>
                  <button
                    disabled={busy || !subgroupCode.trim()}
                    className={labsAction}
                  >
                    Add subgroup
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      setSelectedStudents([]);
                      setEnrollSubgroupId("");
                      setEnrollOpen(true);
                      searchStudents();
                    }}
                    className={labsPrimary}
                  >
                    <Users className="size-3.5" />
                    Enroll students
                  </button>
                </form>
              </section>
              <section className={`${labsPanel} p-5 space-y-4`}>
                <div>
                  <h3 className="text-sm font-semibold">Subject labs</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Choose the subjects students in this section should be able
                    to access.
                  </p>
                </div>
                {detail.labs?.length ? (
                  <LabsTable label="Section subject labs">
                    <thead>
                      <tr>
                        <th>Subject lab</th>
                        <th>Subject</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.labs.map((lab) => (
                        <tr key={lab.id}>
                          <td className="font-medium">{lab.title}</td>
                          <td className="text-xs text-muted-foreground">
                            {lab.subject || "—"}
                          </td>
                          <td>
                            <LabsBadge active={lab.status === "published"}>
                              {lab.status || "draft"}
                            </LabsBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </LabsTable>
                ) : (
                  <p className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                    No subject labs are assigned to this section.
                  </p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <LabsPicker
                    key={detail.id}
                    label="Subject lab"
                    options={availableLabs.map((lab) => ({
                      id: lab.id,
                      label: lab.title,
                      description: lab.subject || "General",
                    }))}
                    value={assignLabId}
                    onChange={setAssignLabId}
                    disabled={busy || !availableLabs.length}
                    placeholder={
                      !availableLabs.length
                        ? "No unassigned subject labs"
                        : "Search subject labs…"
                    }
                  />
                  <button
                    disabled={busy || !assignLabId}
                    className={labsPrimary}
                    onClick={() => {
                      if (!assignLabId) return;
                      mutate(async () => {
                        await adminLabsAPI.assignSections(assignLabId, [
                          detail.id,
                        ]);
                        setAssignLabId("");
                        await loadDetail(detail.id);
                      }, "Subject lab assigned to this section.");
                    }}
                  >
                    Assign subject lab
                  </button>
                </div>
                {!availableLabs.length && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {subjectLabs.length
                      ? "All available subject labs are already assigned to this section."
                      : "No subject labs have been created yet."}{" "}
                    <Link
                      href="/admin/labs/catalog"
                      className="font-medium text-primary hover:underline"
                    >
                      Manage lab catalog
                    </Link>
                  </p>
                )}
              </section>
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    Enrolled students{" "}
                    <span className="ml-1 font-normal text-muted-foreground">
                      {enrollments.length}
                    </span>
                  </h3>
                  <input
                    aria-label="Search enrolled students"
                    type="search"
                    placeholder="Search name, UID, or email…"
                    className={`${labsControl} w-full sm:w-64`}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <LabsTable label="Enrolled students">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>UID / email</th>
                      <th>Subgroup</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEnrollments.map((row) => (
                      <tr key={row.id}>
                        <td className="font-medium">
                          {row.student?.name || "—"}
                        </td>
                        <td>
                          <p className="text-xs">{row.student?.uid || "—"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.student?.email}
                          </p>
                        </td>
                        <td className="text-xs">
                          {row.subgroup
                            ? `${detail.code} [${row.subgroup.code}]`
                            : "No subgroup"}
                        </td>
                        <td className="text-right">
                          <button
                            disabled={busy}
                            className="text-xs text-destructive hover:underline"
                            onClick={() =>
                              mutate(async () => {
                                await adminLabsAPI.removeEnrollment(
                                  detail.id,
                                  row.id,
                                );
                                await loadDetail(detail.id);
                                await loadLists();
                              }, "Student enrollment removed.")
                            }
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!visibleEnrollments.length && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-10 text-center text-muted-foreground"
                        >
                          {query
                            ? "No students match your search."
                            : "No students enrolled in this section."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </LabsTable>
              </section>
            </>
          )}
        </div>
      </div>
      <LabsModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create academic section"
        description="Group students by department, semester, and academic year."
        busy={busy}
      >
        {error && <LabsNotice>{error}</LabsNotice>}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.code.trim() || !form.name.trim()) return;
            mutate(async () => {
              const { data } = await adminLabsAPI.createSection({
                code: form.code.trim(),
                name: form.name.trim(),
                department: form.department || undefined,
                semester: form.semester ? Number(form.semester) : undefined,
                academicYear: form.academicYear || undefined,
                subgroupCodes: form.subgroupCodes
                  .split(",")
                  .map((code) => code.trim())
                  .filter(Boolean),
              });
              setCreateOpen(false);
              setForm(emptyForm);
              await loadLists();
              setSelectedId(data.id);
            }, "Academic section created.");
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["code", "Section code"],
                ["name", "Section name"],
                ["department", "Department"],
                ["semester", "Semester"],
                ["academicYear", "Academic year"],
                ["subgroupCodes", "Subgroups (comma-separated)"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="text-xs font-medium text-muted-foreground"
              >
                {label}
                {key === "code" || key === "name" ? " *" : ""}
                <input
                  aria-label={label}
                  type={key === "semester" ? "number" : "text"}
                  required={key === "code" || key === "name"}
                  value={form[key]}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                  className={`${labsControl} mt-1.5 w-full`}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              className={labsAction}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              disabled={busy || !form.code.trim() || !form.name.trim()}
              className={labsPrimary}
            >
              {busy ? "Creating…" : "Create section"}
            </button>
          </div>
        </form>
      </LabsModal>
      <LabsModal
        open={enrollOpen && !!detail}
        onClose={() => setEnrollOpen(false)}
        title={`Enroll students in ${detail?.code || "section"}`}
        description="Choose existing student accounts and an optional subgroup."
        busy={busy}
      >
        {error && <LabsNotice>{error}</LabsNotice>}
        <div className="space-y-4">
          <label className="block text-xs font-medium text-muted-foreground">
            Subgroup
            <select
              aria-label="Enrollment subgroup"
              className={`${labsControl} mt-1.5 w-full`}
              value={enrollSubgroupId}
              onChange={(event) => setEnrollSubgroupId(event.target.value)}
            >
              <option value="">No subgroup</option>
              {detail?.subgroups?.map((subgroup) => (
                <option key={subgroup.id} value={subgroup.id}>
                  {detail.code} [{subgroup.code}]
                </option>
              ))}
            </select>
          </label>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              searchStudents();
            }}
          >
            <input
              aria-label="Search existing students"
              className={`${labsControl} flex-1`}
              placeholder="Search name, UID, or email…"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
            />
            <button className={labsAction}>Search</button>
          </form>
          {studentsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {studentOptions.map((student) => {
                const id = student.id || student._id || "";
                return (
                  <li key={id}>
                    <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/30">
                      <input
                        type="checkbox"
                        className="mt-1 accent-primary"
                        checked={selectedStudents.includes(id)}
                        disabled={!id || busy}
                        onChange={(event) =>
                          setSelectedStudents((selected) =>
                            event.target.checked
                              ? [...selected, id]
                              : selected.filter((value) => value !== id),
                          )
                        }
                      />
                      <span>
                        <span className="block text-sm font-medium">
                          {student.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {student.uid || student.email}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
              {!studentOptions.length && (
                <li className="p-6 text-center text-xs text-muted-foreground">
                  No students match this search.
                </li>
              )}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {selectedStudents.length} selected
            </span>
            <div className="flex gap-2">
              <button
                disabled={busy}
                className={labsAction}
                onClick={() => setEnrollOpen(false)}
              >
                Cancel
              </button>
              <button
                disabled={busy || !selectedStudents.length}
                className={labsPrimary}
                onClick={() => {
                  if (!detail) return;
                  mutate(async () => {
                    await adminLabsAPI.enrollStudents(detail.id, {
                      studentIds: selectedStudents,
                      subgroupId: enrollSubgroupId || undefined,
                    });
                    setEnrollOpen(false);
                    setSelectedStudents([]);
                    await loadDetail(detail.id);
                    await loadLists();
                  }, "Students enrolled successfully.");
                }}
              >
                Enroll students
              </button>
            </div>
          </div>
        </div>
      </LabsModal>
      <LabsModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete academic section?"
        description="This removes the section, enrollments, and lab assignments. Student accounts and original practice problems are preserved."
        busy={busy}
      >
        {error && <LabsNotice>{error}</LabsNotice>}
        <div className="flex justify-end gap-2">
          <button
            disabled={busy}
            className={labsAction}
            onClick={() => setDeleteId(null)}
          >
            Cancel
          </button>
          <button
            disabled={busy}
            className={`${labsAction} border-destructive/30 text-destructive`}
            onClick={() => {
              if (!deleteId) return;
              mutate(async () => {
                await adminLabsAPI.deleteSection(deleteId);
                setDeleteId(null);
                setSelectedId(null);
                setDetail(null);
                await loadLists();
              }, "Academic section deleted.");
            }}
          >
            Delete section
          </button>
        </div>
      </LabsModal>
    </div>
  );
}
