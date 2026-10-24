"use client";
import { useParams } from "next/navigation";
import { LabExperiments } from "@/components/labs/LabExperiments";
export default function LabExperimentsPage() {
  const params = useParams();
  return (
    <LabExperiments
      key={String(params.labId)}
      labId={String(params.labId || "")}
    />
  );
}
