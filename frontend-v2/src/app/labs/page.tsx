"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3 } from "lucide-react";
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
export default function StudentLabsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [labs, setLabs] = useState<StudentLabSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    studentLabsAPI
      .list()
      .then(({ data }) => {
        if (!cancelled) setLabs(labsList(data));
      })
      .catch(() => {
        if (!cancelled)
          setError("Could not load your labs. Please refresh and try again.");
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
        title="My Labs"
        description="Your assigned subjects, experiments, and progress in one place."
      >
        <Link href="/projects" className={labsAction}>
          Projects
        </Link>
        <Link href="/labs/progress" className={labsAction}>
          <BarChart3 className="size-4" />
          My progress
        </Link>
      </LabsHeader>
      {error ? (
        <LabsNotice>{error}</LabsNotice>
      ) : labs.length ? (
        <LabsTable label="My assigned labs">
          <thead>
            <tr>
              <th>Subject lab</th>
              <th>Section</th>
              <th>Experiments</th>
              <th>Problems solved</th>
              <th>Progress</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {labs.map((item) => (
              <tr key={`${item.lab.id}-${item.section?.id}`}>
                <td>
                  <Link
                    className="font-semibold hover:text-primary"
                    href={`/labs/${item.lab.id}`}
                  >
                    {item.lab.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.lab.subject || "General"}
                  </p>
                </td>
                <td className="text-xs text-muted-foreground">
                  {item.sectionLabel || item.section?.code || "—"}
                </td>
                <td className="tabular-nums">{item.experimentCount ?? 0}</td>
                <td className="tabular-nums">
                  {item.solvedCount ?? 0} / {item.totalProblems ?? 0}
                </td>
                <td>
                  <LabsProgress
                    value={
                      item.totalProblems
                        ? Math.round(
                            ((item.solvedCount || 0) / item.totalProblems) *
                              100,
                          )
                        : 0
                    }
                    label={`${item.lab.title} completion`}
                  />
                </td>
                <td className="text-right">
                  <Link href={`/labs/${item.lab.id}`} className={labsAction}>
                    Open lab
                    <ArrowRight className="size-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </LabsTable>
      ) : (
        <LabsEmpty
          title="No labs assigned yet"
          description="Once your administrator enrolls you in a section, its published subject labs will appear here."
        />
      )}
    </div>
  );
}
