export interface SqlTable {
  columns: string[];
  rows: Array<Array<string | number | null>>;
}
export interface SqlPublicProblem {
  title: string;
  description: string;
  schemaSql: string;
  starterCode: string;
  orderMatters: boolean;
  samples: Array<{ seedSql: string; expected: SqlTable }>;
}
export interface SqlProblemInput extends Omit<SqlPublicProblem, "samples"> {
  datasets: Array<{ seedSql: string; expected: SqlTable; isHidden: boolean }>;
}
export interface SqlFeedback {
  status: string;
  passedCount: number;
  totalCount: number;
  time: number;
  awardedScore?: number;
  maxScore?: number;
  progress?: { status?: string; score?: number };
  results: Array<{
    id: number;
    passed: boolean;
    isHidden: boolean;
    columns?: string[];
    rows?: SqlTable["rows"];
    error?: string;
  }>;
}
