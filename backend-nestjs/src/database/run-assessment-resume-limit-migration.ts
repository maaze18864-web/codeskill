import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { practiceSubmissionMigrationOptions } from './run-practice-submission-source';
import { applyAssessmentResumeLimitMigration } from './migrations/assessment-resume-limit';

async function run(): Promise<void> {
  const dataSource = new DataSource(practiceSubmissionMigrationOptions());
  try {
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await queryRunner.query("SET LOCAL lock_timeout = '5s'");
        await queryRunner.query("SET LOCAL statement_timeout = '30s'");
        await queryRunner.query('SELECT pg_advisory_xact_lock(1902230159)');
        await applyAssessmentResumeLimitMigration(queryRunner);
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      }
    } finally {
      await queryRunner.release();
    }
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void run()
  .then(() => console.log('Assessment resume-limit schema migration completed.'))
  .catch((error) => {
    console.error('Assessment resume-limit schema migration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
