import {
  applyPracticeSubmissionSourceMigration,
  PracticeSubmissionQueryRunner,
} from './practice-submission-source';

describe('practice submission source migration', () => {
  function setup({
    tables = [{ schema_name: 'public', table_name: 'submissions' }],
    checks = [] as Array<{ constraint_type: string; definition?: string }>,
    foreignKeys = [] as Array<{
      constraint_name: string;
      source_columns: string[];
      target_columns: string[];
      targets_problems: boolean;
    }>,
  } = {}) {
    const query = jest.fn<Promise<unknown>, [string, unknown[]?]>();
    query.mockImplementation((sql) => {
      if (sql.includes('FROM pg_class relation')) {
        return Promise.resolve(tables);
      }
      if (sql.includes('AS source_columns')) {
        return Promise.resolve(foreignKeys);
      }
      if (sql.includes('AS constraint_type')) {
        return Promise.resolve(checks);
      }
      return Promise.resolve([]);
    });
    const queryRunner: PracticeSubmissionQueryRunner = { query };
    return { query, queryRunner };
  }

  it('backfills the source and drops only the single-column legacy problem FK', async () => {
    const { query, queryRunner } = setup({
      foreignKeys: [
        {
          constraint_name: 'legacy_problem_fk',
          source_columns: ['problemId'],
          target_columns: ['id'],
          targets_problems: true,
        },
        {
          constraint_name: 'user_fk',
          source_columns: ['userId'],
          target_columns: ['id'],
          targets_problems: false,
        },
        {
          constraint_name: 'other_target_fk',
          source_columns: ['problemId'],
          target_columns: ['id'],
          targets_problems: false,
        },
        {
          constraint_name: 'composite_fk',
          source_columns: ['problemId', 'userId'],
          target_columns: ['id', 'otherId'],
          targets_problems: true,
        },
        {
          constraint_name: 'other_column_fk',
          source_columns: ['otherProblemId'],
          target_columns: ['id'],
          targets_problems: true,
        },
        {
          constraint_name: 'other_target_column_fk',
          source_columns: ['problemId'],
          target_columns: ['mongoId'],
          targets_problems: true,
        },
      ],
    });

    await expect(
      applyPracticeSubmissionSourceMigration(queryRunner),
    ).resolves.toEqual({ droppedForeignKeys: ['legacy_problem_fk'] });

    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements).toContain(
      'ALTER TABLE "public"."submissions" ADD COLUMN IF NOT EXISTS "problemSource" varchar(20) NOT NULL DEFAULT \'problem\'',
    );
    expect(statements).toContain(
      'UPDATE "public"."submissions" SET "problemSource" = \'problem\' WHERE "problemSource" IS NULL',
    );
    expect(statements).toContain(
      'ALTER TABLE "public"."submissions" ADD CONSTRAINT "CHK_submissions_problem_source" CHECK ("problemSource" IN (\'problem\', \'metadata\', \'question\', \'contest-question\'))',
    );
    expect(statements.filter((sql) => sql.includes('DROP CONSTRAINT'))).toEqual(
      [
        'ALTER TABLE "public"."submissions" DROP CONSTRAINT "legacy_problem_fk"',
      ],
    );
    expect(
      statements.some((sql) => /DROP (?:TABLE|COLUMN)|CASCADE/i.test(sql)),
    ).toBe(false);
    expect(statements.filter((sql) => sql.startsWith('UPDATE'))).toHaveLength(
      1,
    );
  });

  it('can be rerun when the source check exists and the FK is already removed', async () => {
    const { query, queryRunner } = setup({
      checks: [
        {
          constraint_type: 'c',
          definition: `CHECK ("problemSource" IN ('problem', 'metadata', 'question', 'contest-question'))`,
        },
      ],
    });
    await expect(
      applyPracticeSubmissionSourceMigration(queryRunner),
    ).resolves.toEqual({ droppedForeignKeys: [] });
    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements.some((sql) => sql.includes('ADD CONSTRAINT'))).toBe(
      false,
    );
    expect(statements.some((sql) => sql.includes('DROP CONSTRAINT'))).toBe(
      false,
    );
    expect(statements).toContain(
      'ALTER TABLE "public"."submissions" VALIDATE CONSTRAINT "CHK_submissions_problem_source"',
    );
  });

  it('resolves the existing table schema and safely quotes identifiers', async () => {
    const { query, queryRunner } = setup({
      tables: [{ schema_name: 'custom"schema', table_name: 'submissions' }],
      foreignKeys: [
        {
          constraint_name: 'problem"fk',
          source_columns: ['problemId'],
          target_columns: ['id'],
          targets_problems: true,
        },
      ],
    });
    await applyPracticeSubmissionSourceMigration(queryRunner);
    expect(query).toHaveBeenCalledWith(
      'ALTER TABLE "custom""schema"."submissions" DROP CONSTRAINT "problem""fk"',
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('AS source_columns'),
      ['"custom""schema"."submissions"'],
    );
  });

  it('does not mutate any schema if submissions is missing', async () => {
    const { query, queryRunner } = setup({ tables: [] });
    await expect(
      applyPracticeSubmissionSourceMigration(queryRunner),
    ).rejects.toThrow(
      'The submissions table must exist before this migration.',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('rejects a conflicting constraint name instead of removing it', async () => {
    const { query, queryRunner } = setup({
      checks: [{ constraint_type: 'f' }],
    });
    await expect(
      applyPracticeSubmissionSourceMigration(queryRunner),
    ).rejects.toThrow('The submission source check name is already in use.');
    expect(
      query.mock.calls.some(([sql]) => sql.includes('DROP CONSTRAINT')),
    ).toBe(false);
  });

  it('propagates invalid-source failures so the caller rolls back', async () => {
    const { query, queryRunner } = setup();
    query.mockImplementation((sql) => {
      if (sql.includes('FROM pg_class relation')) {
        return Promise.resolve([
          { schema_name: 'public', table_name: 'submissions' },
        ]);
      }
      if (sql.includes('AS constraint_type')) {
        return Promise.resolve([]);
      }
      if (sql.includes('ADD CONSTRAINT')) {
        return Promise.reject(new Error('Source check violation'));
      }
      return Promise.resolve([]);
    });
    await expect(
      applyPracticeSubmissionSourceMigration(queryRunner),
    ).rejects.toThrow('Source check violation');
    expect(
      query.mock.calls.some(([sql]) => sql.includes('DROP CONSTRAINT')),
    ).toBe(false);
  });

  it('casts PostgreSQL name arrays to text arrays for the pg driver', async () => {
    const { query, queryRunner } = setup();
    await applyPracticeSubmissionSourceMigration(queryRunner);
    const statement = query.mock.calls.find(([sql]) =>
      sql.includes('AS source_columns'),
    )?.[0];
    expect(statement?.match(/SELECT attribute\.attname::text/g)).toHaveLength(
      2,
    );
  });

  it('targets the current problems relation without assuming an FK name', async () => {
    const { query, queryRunner } = setup();
    await applyPracticeSubmissionSourceMigration(queryRunner);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "constraint_record.confrelid = to_regclass('problems') AS targets_problems",
      ),
      ['"public"."submissions"'],
    );
  });
});

it('upgrades the earlier two-source check without touching submission history', async () => {
  const query = jest.fn((sql: string) => {
    if (sql.includes('FROM pg_class relation'))
      return Promise.resolve([
        { schema_name: 'public', table_name: 'submissions' },
      ]);
    if (sql.includes('AS constraint_type'))
      return Promise.resolve([
        {
          constraint_type: 'c',
          definition: `CHECK ("problemSource" IN ('problem', 'metadata'))`,
        },
      ]);
    return Promise.resolve([]);
  });
  await applyPracticeSubmissionSourceMigration({ query });
  expect(query).toHaveBeenCalledWith(
    'ALTER TABLE "public"."submissions" DROP CONSTRAINT "CHK_submissions_problem_source"',
  );
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining("'problem', 'metadata', 'question'"),
  );
});
