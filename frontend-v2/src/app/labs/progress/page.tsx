"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { studentLabsAPI } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import {
  LabsHeader,
  LabsNotice,
  LabsEmpty,
  LabsTable,
  LabsProgress,
  labsPageWithNavigation,
  labsAction,
  labsList,
} from "@/components/labs/LabsUI";
import type { StudentLabSummary } from "@/lib/labs-types";
export default function StudentLabProgressPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<StudentLabSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    studentLabsAPI
      .progress()
      .then(({ data }) => {
        if (!cancelled) setRows(labsList(data));
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Your progress could not be loaded. Please refresh and try again.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);
  if (authLoading || loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  return (
    <div className={labsPageWithNavigation}>
      <LabsHeader
        title="My Lab Progress"
        backHref="/labs"
        description="Track completed problems, attempts, and time spent in each subject."
      />
      {error ? (
        <LabsNotice>{error}</LabsNotice>
      ) : rows.length ? (
        <LabsTable label="Lab progress">
          <thead>
            <tr>
              <th>Subject lab</th>
              <th>Section</th>
              <th>Solved</th>
              <th>Completion</th>
              <th>Attempts</th>
              <th>Time spent</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.lab.id}-${row.section?.id}`}>
                <td className="font-semibold">{row.lab.title}</td>
                <td className="text-xs text-muted-foreground">
                  {row.sectionLabel || "—"}
                </td>
                <td className="tabular-nums">
                  {row.solvedCount || 0} / {row.totalProblems || 0}
                </td>
                <td>
                  <LabsProgress
                    value={
                      row.totalProblems
                        ? Math.round(
                            ((row.solvedCount || 0) / row.totalProblems) * 100,
                          )
                        : 0
                    }
                    label={`${row.lab.title} progress`}
                  />
                </td>
                <td className="tabular-nums">{row.totalAttempts || 0}</td>
                <td className="whitespace-nowrap text-muted-foreground">
                  {Math.floor((row.timeSpentSeconds || 0) / 60)}m
                </td>
                <td className="text-right">
                  <Link href={`/labs/${row.lab.id}`} className={labsAction}>
                    Continue
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </LabsTable>
      ) : (
        <LabsEmpty
          title="Your progress starts here"
          description="Open a subject lab and submit your first solution."
        >
          <Link href="/labs" className={labsAction}>
            View my labs
          </Link>
        </LabsEmpty>
      )}
    </div>
  );
}
