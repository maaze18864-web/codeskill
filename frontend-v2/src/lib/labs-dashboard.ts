export interface LabsCohort {
  lab_id: string;
  section_id: string;
  lab_title: string;
  section_code: string;
  section_name: string;
  students: number;
  problems: number;
  experiments: number;
  teachers: number;
  assigned: number;
  solved: number;
  practicing: number;
  started_students: number;
}
export interface LabsLearner {
  id: string;
  name: string;
  uid: string | null;
  sections: string;
  assigned: number;
  solved: number;
  started: boolean;
  attempts: number;
  last_activity: string | null;
  repeated_unsolved: number;
  reason?: string;
}
export interface LabsDashboardData {
  generatedAt: string;
  summary: {
    students: number;
    started: number;
    completed: number;
    notStarted: number;
    needsReview: number;
    assigned: number;
    solved: number;
    completionPercent: number;
    participationPercent: number;
    attempts: number;
    active7d: number;
    timeSpentSeconds?: number;
  };
  cohorts: LabsCohort[];
  experiments: Array<{
    id: string;
    title: string;
    lab_id: string;
    lab_title: string;
    problems: number;
    students: number;
    assigned: number;
    solved: number;
    practicing: number;
  }>;
  attention: LabsLearner[];
  notStartedLearners: LabsLearner[];
  recentActivity: LabsLearner[];
  distributions?: {
    completion: LabsDistribution[];
    activity: LabsDistribution[];
    attempts: LabsDistribution[];
  };
  firstSolves?: Array<{ date: string; solves: number }>;
}
export interface LabsDistribution {
  label: string;
  count: number;
}
export interface LabsSectionChartRow {
  id: string;
  code: string;
  name: string;
  students: number;
  labs: number;
  assigned: number;
  solved: number;
  practicing: number;
}
export function aggregateLabSections(
  cohorts: LabsCohort[],
): LabsSectionChartRow[] {
  const sections = new Map<string, LabsSectionChartRow>();
  for (const c of cohorts) {
    const row = sections.get(c.section_id) || {
      id: c.section_id,
      code: c.section_code,
      name: c.section_name,
      students: 0,
      labs: 0,
      assigned: 0,
      solved: 0,
      practicing: 0,
    };
    row.students = Math.max(row.students, c.students);
    row.labs++;
    row.assigned += c.assigned;
    row.solved += c.solved;
    row.practicing += c.practicing;
    sections.set(row.id, row);
  }
  return [...sections.values()];
}
export const labChartColors = {
  solved: "#15976b",
  practicing: "#d59638",
  pending: "#94a3b8",
};
export const labPercent = (solved: number, assigned: number) =>
  assigned ? Math.round((100 * solved) / assigned) : 0;
export function labActivityDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "No recorded activity";
}
