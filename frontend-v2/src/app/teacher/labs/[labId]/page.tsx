"use client";
import { useParams, useSearchParams } from "next/navigation";
import { LabExperiments } from "@/components/labs/LabExperiments";
export default function TeacherLabExperimentsPage() {
  const params = useParams();
  const search = useSearchParams();
  return (
    <LabExperiments
      key={String(params.labId)}
      labId={String(params.labId || "")}
      teacher
      sectionId={search.get("sectionId") || ""}
    />
  );
}
