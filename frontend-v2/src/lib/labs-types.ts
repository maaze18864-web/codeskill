export interface LabProjectTemplate {
  name: string;
  instructions: string;
  mode: "frontend" | "backend" | "fullstack";
  frontendStack?: string;
  backendStack?: string;
  files: import("./project-workspace").ProjectFile[];
  directories?: string[];
  maxScore?: number;
  difficulty?: string;
}
export interface LabSummary {
  id: string;
  title: string;
  subject?: string;
  description?: string;
  status?: string;
  experimentCount?: number;
}
export interface LabSectionSummary {
  id: string;
  code: string;
  name: string;
  department?: string;
  semester?: number;
  academicYear?: string;
  isActive?: boolean;
  enrollmentCount?: number;
  subgroups?: Array<{ id: string; code: string; name: string }>;
}
export interface StudentLabSummary {
  lab: LabSummary;
  section?: LabSectionSummary;
  sectionLabel?: string;
  experimentCount?: number;
  solvedCount?: number;
  totalProblems?: number;
  completedExperiments?: number;
  totalAttempts?: number;
  timeSpentSeconds?: number;
}
export interface TeacherLabSummary {
  id: string;
  lab: LabSummary;
  section?: LabSectionSummary;
  sectionLabel?: string;
  role?: string;
}
export interface LabExperimentSummary {
  id: string;
  title: string;
  description?: string;
  problemCount?: number;
  solvedCount?: number;
  assessments?: LabAssessmentSummary[];
  problems?: Array<{
    id: string;
    kind?: "coding" | "project" | "sql";
    sqlProblem?: import("./sql-workspace").SqlProblemInput;
    projectTemplate?: LabProjectTemplate;
    problem_metadata_id: string;
    maxScore: number;
    difficulty?: string;
    problemMetadata?: { title?: string };
  }>;
}
export interface LabAssessmentSummary {
  id: string;
  title: string;
  status: string;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
  maxScore: number;
  earnedScore: number | null;
}
