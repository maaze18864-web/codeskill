import { BadRequestException } from '@nestjs/common';
export type SqlCell = string | number | null;
export interface SqlTable {
  columns: string[];
  rows: SqlCell[][];
}
export interface SqlDataset {
  seedSql: string;
  expected: SqlTable;
  isHidden: boolean;
}
export interface SqlProblem {
  title: string;
  description: string;
  schemaSql: string;
  starterCode: string;
  orderMatters: boolean;
  datasets: SqlDataset[];
}
export function validateSqlProblem(input: SqlProblem): SqlProblem {
  if (
    !input ||
    !input.title?.trim() ||
    input.title.length > 100 ||
    !input.description?.trim() ||
    input.description.length > 12000 ||
    !input.schemaSql?.trim() ||
    input.schemaSql.length > 20000 ||
    typeof input.starterCode !== 'string' ||
    input.starterCode.length > 20000 ||
    typeof input.orderMatters !== 'boolean'
  )
    throw new BadRequestException(
      'Provide a title, instructions, schema, starter query and row-order setting.',
    );
  if (
    !Array.isArray(input.datasets) ||
    !input.datasets.length ||
    input.datasets.length > 8 ||
    !input.datasets.some((dataset) => dataset.isHidden === false)
  )
    throw new BadRequestException(
      'Use 1–8 datasets with at least one public example.',
    );
  for (const dataset of input.datasets) {
    const table = dataset.expected;
    if (
      typeof dataset.seedSql !== 'string' ||
      dataset.seedSql.length > 20000 ||
      typeof dataset.isHidden !== 'boolean' ||
      !table ||
      !Array.isArray(table.columns) ||
      !table.columns.length ||
      table.columns.length > 32 ||
      table.columns.some(
        (column) =>
          typeof column !== 'string' || !column || column.length > 100,
      ) ||
      !Array.isArray(table.rows) ||
      table.rows.length > 200 ||
      table.rows.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== table.columns.length ||
          row.some(
            (cell) =>
              cell !== null &&
              ((typeof cell !== 'string' && typeof cell !== 'number') ||
                (typeof cell === 'number' && !Number.isFinite(cell)) ||
                (typeof cell === 'string' && cell.length > 4096)),
          ),
      )
    )
      throw new BadRequestException(
        'Datasets require a valid expected table (up to 200 rows and 32 columns).',
      );
  }
  if (Buffer.byteLength(JSON.stringify(input)) > 200000)
    throw new BadRequestException('SQL exercise content is limited to 200 KB.');
  return {
    title: input.title.trim(),
    description: input.description.trim(),
    schemaSql: input.schemaSql,
    starterCode: input.starterCode,
    orderMatters: input.orderMatters,
    datasets: input.datasets.map(({ seedSql, expected, isHidden }) => ({
      seedSql,
      isHidden,
      expected: { columns: expected.columns, rows: expected.rows },
    })),
  };
}
export function publicSqlProblem(problem: SqlProblem) {
  return {
    title: problem.title,
    description: problem.description,
    schemaSql: problem.schemaSql,
    starterCode: problem.starterCode,
    orderMatters: problem.orderMatters,
    samples: problem.datasets
      .filter((dataset) => !dataset.isHidden)
      .map((dataset) => ({
        seedSql: dataset.seedSql,
        expected: dataset.expected,
      })),
  };
}
