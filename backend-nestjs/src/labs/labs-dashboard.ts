/** One read-only snapshot. Never reads submissions, code, or private test data.
 * $1 is the authenticated teacher UUID (null only for administrators).
 * $2 optionally narrows the snapshot to one academic section.
 * $3 optionally narrows it to one subject lab without widening teacher access.
 */
export const LABS_DASHBOARD_SQL = `
WITH scope AS MATERIALIZED (
  SELECT a.lab_id, a.lab_section_id AS section_id, l.title AS lab_title,
         s.code AS section_code, s.name AS section_name
  FROM lab_section_assignments a
  JOIN labs l ON l.id = a.lab_id AND l.status = 'published'
  JOIN lab_sections s ON s.id = a.lab_section_id AND s."isActive" = true
  WHERE ($2::uuid IS NULL OR s.id = $2::uuid)
    AND ($3::uuid IS NULL OR l.id = $3::uuid)
    AND ($1::uuid IS NULL OR EXISTS (
      SELECT 1 FROM lab_teacher_assignments t
      WHERE t.teacher_id = $1::uuid AND t.lab_id = a.lab_id
        AND t.lab_section_id = a.lab_section_id
    ))
), roster AS MATERIALIZED (
  SELECT sc.*, en.student_id
  FROM scope sc JOIN lab_section_enrollments en
    ON en.lab_section_id = sc.section_id AND en.status = 'active'
  JOIN users u ON u.id = en.student_id AND u."isActive" = true
), links AS MATERIALIZED (
  SELECT e.lab_id, e.id AS experiment_id, e.title AS experiment_title, p.id AS link_id
  FROM lab_experiments e JOIN lab_experiment_problems p ON p.lab_experiment_id = e.id
  WHERE e."isPublished" = true AND EXISTS (SELECT 1 FROM scope sc WHERE sc.lab_id = e.lab_id)
), work AS MATERIALIZED (
  SELECT r.*, lk.experiment_id, lk.experiment_title, lk.link_id,
    COALESCE(pr.status, 'not_started') AS status,
    COALESCE(pr."attemptsCount", 0) AS attempts,
    COALESCE(pr."timeSpentSeconds", 0) AS seconds,
    pr."lastActivityAt" AS last_activity, pr."firstSolvedAt" AS first_solved,
    (COALESCE(pr.status, 'not_started') <> 'not_started'
      OR COALESCE(pr."attemptsCount", 0) > 0 OR COALESCE(pr."timeSpentSeconds", 0) > 0) AS started
  FROM roster r JOIN links lk ON lk.lab_id = r.lab_id
  LEFT JOIN lab_problem_progress pr ON pr.lab_experiment_problem_id = lk.link_id
    AND pr.student_id = r.student_id AND pr.lab_id = r.lab_id
), unique_work AS MATERIALIZED (
  -- A learner in two sections sharing a lab must not double the global totals.
  SELECT DISTINCT ON (student_id, link_id) * FROM work ORDER BY student_id, link_id, section_id
), cohort_stats AS (
  SELECT sc.*, (SELECT COUNT(DISTINCT student_id) FROM roster r
      WHERE r.lab_id = sc.lab_id AND r.section_id = sc.section_id)::int AS students,
    (SELECT COUNT(*) FROM links lk WHERE lk.lab_id = sc.lab_id)::int AS problems,
    (SELECT COUNT(*) FROM lab_experiments e WHERE e.lab_id = sc.lab_id AND e."isPublished")::int AS experiments,
    (SELECT COUNT(*) FROM lab_teacher_assignments t WHERE t.lab_id = sc.lab_id
      AND t.lab_section_id = sc.section_id)::int AS teachers,
    COUNT(w.link_id)::int AS assigned,
    COUNT(*) FILTER (WHERE w.status = 'solved')::int AS solved,
    COUNT(*) FILTER (WHERE w.started AND w.status <> 'solved')::int AS practicing,
    COUNT(DISTINCT w.student_id) FILTER (WHERE w.started)::int AS started_students
  FROM scope sc LEFT JOIN work w ON w.lab_id = sc.lab_id AND w.section_id = sc.section_id
  GROUP BY sc.lab_id, sc.section_id, sc.lab_title, sc.section_code, sc.section_name
), learner_stats AS (
  SELECT w.student_id AS id, u.name, u.uid,
    COUNT(*)::int AS assigned, COUNT(*) FILTER (WHERE w.status = 'solved')::int AS solved,
    BOOL_OR(w.started) AS started, SUM(w.attempts)::int AS attempts,
    COUNT(*) FILTER (WHERE w.started)::int AS started_problems,
    SUM(w.seconds)::int AS seconds,
    MAX(w.last_activity) AS last_activity,
    COUNT(*) FILTER (WHERE w.status <> 'solved' AND w.attempts >= 3)::int AS repeated_unsolved,
    (SELECT STRING_AGG(DISTINCT r.section_code, ', ' ORDER BY r.section_code)
      FROM roster r WHERE r.student_id = w.student_id) AS sections
  FROM unique_work w JOIN users u ON u.id = w.student_id GROUP BY w.student_id, u.name, u.uid
), experiment_stats AS (
  SELECT w.lab_id, w.lab_title, w.experiment_id AS id, w.experiment_title AS title,
    COUNT(DISTINCT w.link_id)::int AS problems, COUNT(DISTINCT w.student_id)::int AS students,
    COUNT(*)::int AS assigned, COUNT(*) FILTER (WHERE w.status = 'solved')::int AS solved,
    COUNT(*) FILTER (WHERE w.started AND w.status <> 'solved')::int AS practicing
  FROM unique_work w GROUP BY w.lab_id, w.lab_title, w.experiment_id, w.experiment_title
)
SELECT CURRENT_TIMESTAMP AS "generatedAt",
  COALESCE((SELECT JSON_AGG(c ORDER BY c.section_code, c.lab_title) FROM cohort_stats c), '[]') AS cohorts,
  COALESCE((SELECT JSON_AGG(st ORDER BY st.name, st.id) FROM learner_stats st), '[]') AS learners,
  COALESCE((SELECT JSON_AGG(e ORDER BY e.title, e.id) FROM experiment_stats e), '[]') AS experiments,
  (SELECT JSON_AGG(day_row ORDER BY day_row.date) FROM (
    SELECT TO_CHAR(d.day, 'YYYY-MM-DD') AS date, COUNT(w.link_id)::int AS solves
    FROM GENERATE_SERIES((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 13,
      (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date, INTERVAL '1 day') d(day)
    LEFT JOIN unique_work w ON (w.first_solved AT TIME ZONE 'UTC')::date = d.day::date
    GROUP BY d.day
  ) day_row) AS "firstSolves"
`;

export interface DashboardCohort {
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
export interface DashboardLearner {
  id: string;
  name: string;
  uid: string | null;
  sections: string;
  assigned: number;
  solved: number;
  started: boolean;
  started_problems: number;
  attempts: number;
  last_activity: string | null;
  repeated_unsolved: number;
  seconds?: number;
}
export interface DashboardExperiment {
  id: string;
  title: string;
  lab_id: string;
  lab_title: string;
  problems: number;
  students: number;
  assigned: number;
  solved: number;
  practicing: number;
}
export interface DashboardSnapshot {
  generatedAt: Date | string;
  cohorts: DashboardCohort[];
  learners: DashboardLearner[];
  experiments: DashboardExperiment[];
  firstSolves?: Array<{ date: string; solves: number }>;
}

export function summarizeLabsDashboard(snapshot: DashboardSnapshot) {
  const now = new Date(snapshot.generatedAt).getTime();
  const learners = snapshot.learners;
  const completed = learners.filter(
    (s) => s.assigned > 0 && s.solved === s.assigned,
  ).length;
  const started = learners.filter((s) => s.started).length;
  const assigned = learners.reduce((sum, s) => sum + s.assigned, 0);
  const solved = learners.reduce((sum, s) => sum + s.solved, 0);
  const completionBands = [
    { label: '0%', min: 0, max: 0 },
    { label: '1–24%', min: 0, max: 25 },
    { label: '25–49%', min: 25, max: 50 },
    { label: '50–74%', min: 50, max: 75 },
    { label: '75–99%', min: 75, max: 100 },
    { label: '100%', min: 100, max: 100 },
  ].map((band, index) => ({
    label: band.label,
    count: learners.filter((st) => {
      const percent = st.assigned ? (100 * st.solved) / st.assigned : 0;
      return index === 0
        ? percent === 0
        : index === 5
          ? percent === 100
          : percent > 0 && percent >= band.min && percent < band.max;
    }).length,
  }));
  const activityBands = [
    { label: 'Last 24 hours', count: 0 },
    { label: '1–7 days ago', count: 0 },
    { label: '7+ days ago', count: 0 },
    { label: 'No recorded activity', count: 0 },
  ];
  for (const st of learners) {
    const age = st.last_activity ? now - Date.parse(st.last_activity) : NaN;
    activityBands[
      !st.started || !Number.isFinite(age)
        ? 3
        : age < 86400000
          ? 0
          : age < 7 * 86400000
            ? 1
            : 2
    ].count++;
  }
  const attemptBands = [
    { label: 'Not started', min: -1, max: 0 },
    { label: 'Under 1', min: 0, max: 1 },
    { label: '1–<2', min: 1, max: 2 },
    { label: '2–<3', min: 2, max: 3 },
    { label: '3–<5', min: 3, max: 5 },
    { label: '5+', min: 5, max: Infinity },
  ].map((band) => ({
    label: band.label,
    count: learners.filter((st) => {
      const ratio = st.started
        ? st.attempts / Math.max(1, st.started_problems)
        : -1;
      return ratio >= band.min && ratio < band.max;
    }).length,
  }));
  const attention = learners
    .flatMap((s) => {
      if (s.solved === s.assigned) return [];
      const inactive =
        s.started &&
        s.last_activity &&
        now - Date.parse(s.last_activity) >= 7 * 86400000;
      const reason =
        s.repeated_unsolved > 0
          ? 'Repeated attempts without a solve'
          : inactive
            ? 'No activity for 7+ days'
            : null;
      return reason ? [{ ...s, reason }] : [];
    })
    .sort(
      (a, b) =>
        b.repeated_unsolved - a.repeated_unsolved ||
        (a.last_activity || '').localeCompare(b.last_activity || '') ||
        a.id.localeCompare(b.id),
    );
  return {
    generatedAt: snapshot.generatedAt,
    summary: {
      students: learners.length,
      started,
      completed,
      notStarted: learners.length - started,
      needsReview: attention.length,
      assigned,
      solved,
      completionPercent: assigned ? Math.round((100 * solved) / assigned) : 0,
      participationPercent: learners.length
        ? Math.round((100 * started) / learners.length)
        : 0,
      attempts: learners.reduce((sum, s) => sum + s.attempts, 0),
      timeSpentSeconds: learners.reduce((sum, s) => sum + (s.seconds || 0), 0),
      active7d: learners.filter(
        (s) =>
          s.started &&
          s.last_activity &&
          now - Date.parse(s.last_activity) < 7 * 86400000,
      ).length,
    },
    cohorts: snapshot.cohorts,
    experiments: snapshot.experiments,
    distributions: {
      completion: completionBands,
      activity: activityBands,
      attempts: attemptBands,
    },
    firstSolves: snapshot.firstSolves || [],
    attention: attention.slice(0, 10),
    notStartedLearners: learners.filter((s) => !s.started).slice(0, 10),
    recentActivity: learners
      .filter((s) => s.started && s.last_activity)
      .sort(
        (a, b) =>
          b.last_activity!.localeCompare(a.last_activity!) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 6),
  };
}
