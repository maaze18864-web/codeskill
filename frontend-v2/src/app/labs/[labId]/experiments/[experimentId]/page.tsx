"use client";

import { useParams } from "next/navigation";
import { LabExperimentOverview } from "@/components/labs/LabExperimentOverview";
import { studentLabsAPI } from "@/config/api";

export default function StudentLabExperimentPage() {
  const params = useParams();
  const labId = String(params.labId || "");
  const experimentId = String(params.experimentId || "");

  return (
    <LabExperimentOverview
      key={`${labId}:${experimentId}`}
      labId={labId}
      experimentId={experimentId}
      loadWorkspace={studentLabsAPI.workspace}
    />
  );
}
