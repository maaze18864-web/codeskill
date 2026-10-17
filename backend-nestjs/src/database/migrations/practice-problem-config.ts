export interface PracticeProblemConfigQueryRunner {
  query(sql: string): Promise<unknown>;
}

/** Add the nullable preference without rewriting existing problem configuration. */
export async function applyPracticeProblemConfigMigration(
  queryRunner: PracticeProblemConfigQueryRunner,
): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE "problem_configs"
      ADD COLUMN IF NOT EXISTS "defaultLanguage" varchar(50);
  `);
}
