const SOURCE_CHECK_NAME = 'CHK_submissions_problem_source';

export interface PracticeSubmissionQueryRunner {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

interface SubmissionTable {
  schema_name: string;
  table_name: string;
}

interface ExistingCheck {
  constraint_type: string;
  definition?: string;
}

interface ForeignKey {
  constraint_name: string;
  source_columns: string[];
  target_columns: string[];
  targets_problems: boolean;
}

function quoteIdentifier(identifier: string): string {
  return '"' + identifier.replace(/"/g, '""') + '"';
}

/**
 * Apply inside a transaction. Only the submission source column, its check,
 * and the legacy single-column problem FK are changed.
 */
export async function applyPracticeSubmissionSourceMigration(
  queryRunner: PracticeSubmissionQueryRunner,
): Promise<{ droppedForeignKeys: string[] }> {
  const tables = (await queryRunner.query(
    `SELECT namespace.nspname AS schema_name, relation.relname AS table_name
     FROM pg_class relation
     JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE relation.oid = to_regclass('submissions')
       AND relation.relkind IN ('r', 'p')`,
  )) as SubmissionTable[];

  const table = tables[0];
  if (!table) {
    throw new Error('The submissions table must exist before this migration.');
  }

  const qualifiedTable =
    quoteIdentifier(table.schema_name) +
    '.' +
    quoteIdentifier(table.table_name);
  const quotedCheck = quoteIdentifier(SOURCE_CHECK_NAME);

  // ALTER TABLE retains its lock until commit, serializing concurrent runs.
  await queryRunner.query(
    'ALTER TABLE ' +
      qualifiedTable +
      ' ADD COLUMN IF NOT EXISTS "problemSource" varchar(20) NOT NULL DEFAULT \'problem\'',
  );
  await queryRunner.query(
    'ALTER TABLE ' +
      qualifiedTable +
      ' ALTER COLUMN "problemSource" SET DEFAULT \'problem\'',
  );
  await queryRunner.query(
    'UPDATE ' +
      qualifiedTable +
      ' SET "problemSource" = \'problem\' WHERE "problemSource" IS NULL',
  );
  await queryRunner.query(
    'ALTER TABLE ' +
      qualifiedTable +
      ' ALTER COLUMN "problemSource" SET NOT NULL',
  );

  const existingChecks = (await queryRunner.query(
    `SELECT constraint_record.contype AS constraint_type, pg_get_constraintdef(constraint_record.oid) AS definition
     FROM pg_constraint constraint_record
     WHERE constraint_record.conrelid = $1::regclass
       AND constraint_record.conname = $2`,
    [qualifiedTable, SOURCE_CHECK_NAME],
  )) as ExistingCheck[];

  const existing = existingChecks[0];
  if (
    existing &&
    (existing.constraint_type !== 'c' ||
      (existing.definition && !existing.definition.includes('problemSource')))
  ) {
    throw new Error('The submission source check name is already in use.');
  }
  if (
    existing &&
    (!existing.definition?.includes("'question'") ||
      !existing.definition?.includes("'contest-question'"))
  ) {
    await queryRunner.query(
      'ALTER TABLE ' + qualifiedTable + ' DROP CONSTRAINT ' + quotedCheck,
    );
  }
  if (
    !existing ||
    !existing.definition?.includes("'question'") ||
    !existing.definition?.includes("'contest-question'")
  ) {
    await queryRunner.query(
      'ALTER TABLE ' +
        qualifiedTable +
        ' ADD CONSTRAINT ' +
        quotedCheck +
        " CHECK (\"problemSource\" IN ('problem', 'metadata', 'question', 'contest-question'))",
    );
  }
  await queryRunner.query(
    'ALTER TABLE ' + qualifiedTable + ' VALIDATE CONSTRAINT ' + quotedCheck,
  );

  const foreignKeys = (await queryRunner.query(
    `SELECT constraint_record.conname AS constraint_name,
       ARRAY(
         SELECT attribute.attname::text
         FROM unnest(constraint_record.conkey)
           WITH ORDINALITY AS key_column(column_number, ordinal_position)
         JOIN pg_attribute attribute
           ON attribute.attrelid = constraint_record.conrelid
          AND attribute.attnum = key_column.column_number
         ORDER BY key_column.ordinal_position
       ) AS source_columns,
       ARRAY(
         SELECT attribute.attname::text
         FROM unnest(constraint_record.confkey)
           WITH ORDINALITY AS key_column(column_number, ordinal_position)
         JOIN pg_attribute attribute
           ON attribute.attrelid = constraint_record.confrelid
          AND attribute.attnum = key_column.column_number
         ORDER BY key_column.ordinal_position
       ) AS target_columns,
       constraint_record.confrelid = to_regclass('problems') AS targets_problems
     FROM pg_constraint constraint_record
     WHERE constraint_record.contype = 'f'
       AND constraint_record.conrelid = $1::regclass`,
    [qualifiedTable],
  )) as ForeignKey[];

  const legacyProblemKeys = foreignKeys.filter(
    (foreignKey) =>
      foreignKey.targets_problems &&
      foreignKey.source_columns.length === 1 &&
      foreignKey.source_columns[0] === 'problemId' &&
      foreignKey.target_columns.length === 1 &&
      foreignKey.target_columns[0] === 'id',
  );

  for (const foreignKey of legacyProblemKeys) {
    await queryRunner.query(
      'ALTER TABLE ' +
        qualifiedTable +
        ' DROP CONSTRAINT ' +
        quoteIdentifier(foreignKey.constraint_name),
    );
  }

  return {
    droppedForeignKeys: legacyProblemKeys.map(
      (foreignKey) => foreignKey.constraint_name,
    ),
  };
}
