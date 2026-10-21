import { MigrationQueryRunner } from './declarative-partitioning';

export async function applyAssessmentResumeLimitMigration(
  queryRunner: MigrationQueryRunner,
): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE "assessment_attempts"
      ADD COLUMN IF NOT EXISTS "resumeCount" integer NOT NULL DEFAULT 0;
  `);
}
