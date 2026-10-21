"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  KeyRound,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Building,
  GraduationCap,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  UploadCloud,
  Mail,
} from "lucide-react";
import { adminStudentsAPI } from "@/config/api";
import { Spinner } from "@/components/ui/spinner";
import { getStandardizedSectionOptions } from "@/lib/sections";

interface StudentProfile {
  university?: string;
  department?: string;
  course?: string;
  semester?: number;
  section?: string;
  group?: string;
  year?: number;
  batch?: string;
}

interface Student {
  _id: string;
  uid: string;
  name: string;
  email: string;
  isActive: boolean;
  forcePasswordChange: boolean;
  studentProfile?: StudentProfile;
  createdAt: string;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pendingPasswordChange: 0,
  });

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [resetModalData, setResetModalData] = useState<{
    student: Student;
    resetDone: boolean;
    loading: boolean;
  } | null>(null);

  // Form states for Create/Edit
  const [formData, setFormData] = useState({
    uid: "",
    name: "",
    email: "",
    password: "",
    university: "",
    department: "",
    course: "",
    semester: 1,
    section: "",
    group: "",
    batch: "",
    year: new Date().getFullYear(),
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminStudentsAPI.getAll({
        page,
        limit: 15,
        search,
        department: departmentFilter || undefined,
        batch: batchFilter || undefined,
        isActive: statusFilter || undefined,
      });

      setStudents(res.data?.students || []);
      setTotalPages(res.data?.pagination?.totalPages || 1);
      setTotalCount(res.data?.pagination?.total || 0);
      if (res.data?.stats) {
        setStats(res.data.stats);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load students.");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, departmentFilter, batchFilter, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleOpenCreate = () => {
    setFormData({
      uid: "",
      name: "",
      email: "",
      password: "",
      university: "",
      department: "",
      course: "",
      semester: 1,
      section: "",
      group: "",
      batch: "",
      year: new Date().getFullYear(),
    });
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      uid: student.uid || "",
      name: student.name || "",
      email: student.email || "",
      password: "",
      university: student.studentProfile?.university || "",
      department: student.studentProfile?.department || "",
      course: student.studentProfile?.course || "",
      semester: student.studentProfile?.semester || 1,
      section: student.studentProfile?.section || "",
      group: student.studentProfile?.group || "",
      batch: student.studentProfile?.batch || "",
      year: student.studentProfile?.year || new Date().getFullYear(),
    });
    setFormError(null);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const profile: any = {};
    if (formData.university?.trim()) profile.university = formData.university.trim();
    if (formData.department?.trim()) profile.department = formData.department.trim();
    if (formData.course?.trim()) profile.course = formData.course.trim();
    if (formData.semester) profile.semester = Number(formData.semester) || 1;
    if (formData.section?.trim()) profile.section = formData.section.trim();
    if (formData.group?.trim()) profile.group = formData.group.trim();
    if (formData.batch?.trim()) profile.batch = formData.batch.trim();
    if (formData.year) profile.year = Number(formData.year) || new Date().getFullYear();

    const payload: any = {
      uid: formData.uid.trim().toUpperCase(),
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      studentProfile: Object.keys(profile).length > 0 ? profile : undefined,
    };

    if (formData.password?.trim()) {
      payload.password = formData.password.trim();
    }

    try {
      if (editingStudent) {
        await adminStudentsAPI.update(editingStudent._id, payload);
        setEditingStudent(null);
      } else {
        const res = await adminStudentsAPI.create(payload);
        if (res.data?.generatedPassword) {
          alert(
            `Student created successfully!\nGenerated Password: ${res.data.generatedPassword}\nPlease convey this to the student.`,
          );
        }
        setIsCreateOpen(false);
      }
      fetchStudents();
    } catch (err: any) {
      const msg = Array.isArray(err.response?.data?.message)
        ? err.response.data.message.join(". ")
        : err.response?.data?.message || err.message || "Failed to save student.";
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (student: Student) => {
    const nextStatus = !student.isActive;
    if (
      !confirm(
        `Are you sure you want to ${
          nextStatus ? "activate" : "deactivate"
        } ${student.name} (${student.uid})?`,
      )
    ) {
      return;
    }

    try {
      await adminStudentsAPI.setStatus(student._id, nextStatus);
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update status.");
    }
  };

  const handleStartResetPassword = (student: Student) => {
    setResetModalData({
      student,
      resetDone: false,
      loading: false,
    });
  };

  const handleConfirmResetPassword = async () => {
    if (!resetModalData) return;
    setResetModalData((prev) => (prev ? { ...prev, loading: true } : null));

    try {
      await adminStudentsAPI.resetPassword(resetModalData.student._id);
      // AUD-037: The backend no longer returns the plaintext password.
      // The credential email is queued by the backend automatically.
      setResetModalData((prev) =>
        prev ? { ...prev, resetDone: true, loading: false } : null,
      );
      fetchStudents();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to reset password.");
      setResetModalData(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Assessment Students
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
              UID Auth
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage university examination candidates, UID credentials, and password resets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchStudents()}
            className="p-2.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <Link
            href="/admin/students/credentials"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-amber-500" />
            Credentials
          </Link>

          <Link
            href="/admin/students/import"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-500" />
            Import (XLSX)
          </Link>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Student
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.total.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Total Enrolled Students
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.active.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Active Assessment Accounts
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {stats.pendingPasswordChange.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Pending First-Time Password Set
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border flex flex-col md:flex-row items-stretch md:items-center gap-3 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by UID, Name, or Email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Department (e.g. CSE)"
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 rounded-xl border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          <input
            type="text"
            placeholder="Batch (e.g. 2026)"
            value={batchFilter}
            onChange={(e) => {
              setBatchFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 rounded-xl border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 w-28"
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Deactivated Only</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Spinner className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-sm">Loading student directory...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <div className="text-base font-semibold text-foreground">
              No students found
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search criteria or add new students.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground text-xs uppercase font-semibold">
                  <th className="py-3 px-4">UID</th>
                  <th className="py-3 px-4">Student Details</th>
                  <th className="py-3 px-4">Department &amp; Batch</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">First-Time Setup</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((student) => (
                  <tr
                    key={student._id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* UID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {student.uid || "N/A"}
                    </td>

                    {/* Name & Email */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground">
                        {student.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {student.email}
                      </div>
                    </td>

                    {/* Department & Batch */}
                    <td className="py-3.5 px-4 text-xs">
                      <div className="font-medium text-foreground">
                        {student.studentProfile?.department || "General"}
                      </div>
                      <div className="text-muted-foreground">
                        Batch: {student.studentProfile?.batch || "—"} • Sem:{" "}
                        {student.studentProfile?.semester || 1}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {student.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 border border-red-500/20">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>

                    {/* Force Password Change Flag */}
                    <td className="py-3.5 px-4 text-xs">
                      {student.forcePasswordChange ? (
                        <span className="text-amber-600 font-medium inline-flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5" /> Requires Change
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Completed</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Reset Password */}
                        <button
                          onClick={() => handleStartResetPassword(student)}
                          title="Reset Password"
                          className="p-1.5 rounded-lg border border-border hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600 transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleOpenEdit(student)}
                          title="Edit Details"
                          className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Toggle Active */}
                        <button
                          onClick={() => handleToggleStatus(student)}
                          title={student.isActive ? "Deactivate" : "Activate"}
                          className={`p-1.5 rounded-lg border border-border transition-colors ${
                            student.isActive
                              ? "hover:bg-red-500/10 text-muted-foreground hover:text-red-600"
                              : "hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600"
                          }`}
                        >
                          {student.isActive ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing {students.length} of {totalCount} students
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Create or Edit Student */}
      {(isCreateOpen || editingStudent) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsCreateOpen(false);
                setEditingStudent(null);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold tracking-tight text-foreground mb-1">
              {editingStudent ? "Edit Student Record" : "Add Assessment Student"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {editingStudent
                ? `Update institutional profile for UID ${editingStudent.uid}`
                : "Enroll a new student for university assessment delivery."}
            </p>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 text-xs mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    University UID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CU202600123"
                    value={formData.uid}
                    onChange={(e) =>
                      setFormData({ ...formData, uid: e.target.value.toUpperCase() })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-mono uppercase focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="student@university.edu"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                {!editingStudent && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Initial Password (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Leave blank to auto-generate"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Academic Profile
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Department
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Computer Science"
                      value={formData.department}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value })
                      }
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Course / Degree
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. B.Tech"
                      value={formData.course}
                      onChange={(e) =>
                        setFormData({ ...formData, course: e.target.value })
                      }
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Batch (Years)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2022-2026"
                      value={formData.batch}
                      onChange={(e) =>
                        setFormData({ ...formData, batch: e.target.value })
                      }
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Semester
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={formData.semester}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          semester: Number(e.target.value) || 1,
                        })
                      }
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Section
                    </label>
                    <select
                      id="student-form-section"
                      value={formData.section}
                      onChange={(e) =>
                        setFormData({ ...formData, section: e.target.value })
                      }
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    >
                      <option value="">Select Section (Optional)</option>
                      {getStandardizedSectionOptions(
                        formData.section ? [formData.section] : []
                      ).map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Group
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. G1"
                      value={formData.group}
                      onChange={(e) =>
                        setFormData({ ...formData, group: e.target.value })
                      }
                      className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {formSubmitting && <Spinner className="w-4 h-4 animate-spin" />}
                  {editingStudent ? "Save Changes" : "Create Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password with Temporary Password Display */}
      {resetModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setResetModalData(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold tracking-tight text-foreground mb-1">
              Reset Student Password
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Candidate: <strong>{resetModalData.student.name}</strong> (
              <span className="font-mono">{resetModalData.student.uid}</span>)
            </p>

            {resetModalData.resetDone ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="text-xs font-semibold text-emerald-400">
                    Password Reset Successfully
                  </div>
                  <p className="text-xs text-emerald-400/80 leading-relaxed">
                    ✓ A new secure temporary password has been set for{" "}
                    <strong>{resetModalData.student.name}</strong>.<br />
                    ✓ The student will be forced to change it on next login.<br />
                    ✓ Credential email has been queued for delivery.<br />
                    ✓ Action recorded in audit timeline.
                  </p>
                </div>

                <button
                  onClick={() => setResetModalData(null)}
                  className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Resetting the password will generate a new secure one-time password
                  and require the student to establish a new private password upon
                  sign-in. An audit trail entry will be recorded.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setResetModalData(null)}
                    className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmResetPassword}
                    disabled={resetModalData.loading}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {resetModalData.loading && (
                      <Spinner className="w-4 h-4 animate-spin" />
                    )}
                    Generate New Password
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
