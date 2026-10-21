import { MigrationQueryRunner } from './declarative-partitioning';

/** Keep the ProblemConfig entity and existing PostgreSQL schema in sync. */
export async function applyProblemConfigDefaultLanguageMigration(
  queryRunner: MigrationQueryRunner,
): Promise<void> {
  await queryRunner.query(
    'ALTER TABLE "problem_configs" ADD COLUMN IF NOT EXISTS "defaultLanguage" varchar(50)',
  );
}
