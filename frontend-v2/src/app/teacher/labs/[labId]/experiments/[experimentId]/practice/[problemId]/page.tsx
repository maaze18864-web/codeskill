"use client";
import { useParams } from "next/navigation";
import { LabExperimentWorkspace } from "@/components/labs/LabExperimentWorkspace";
import { teacherLabsAPI } from "@/config/api";
export default function PracticePage() {
  const params = useParams<{
    labId: string;
    experimentId: string;
    problemId: string;
  }>();
  return (
    <LabExperimentWorkspace
      labId={params.labId}
      experimentId={params.experimentId}
      initialProblemId={params.problemId}
      backHref={`/teacher/labs/${params.labId}/experiments/${params.experimentId}`}
      loadWorkspace={teacherLabsAPI.workspace}
    />
  );
}
