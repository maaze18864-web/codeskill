"use client";

import { useParams } from "next/navigation";
import { LabExperimentOverview } from "@/components/labs/LabExperimentOverview";
import { teacherLabsAPI } from "@/config/api";

export default function TeacherLabExperimentPage() {
  const params = useParams();
  const labId = String(params.labId || "");
  const experimentId = String(params.experimentId || "");

  return (
    <LabExperimentOverview
      teacher
      key={`${labId}:${experimentId}`}
      labId={labId}
      experimentId={experimentId}
      loadWorkspace={teacherLabsAPI.workspace}
    />
  );
}
