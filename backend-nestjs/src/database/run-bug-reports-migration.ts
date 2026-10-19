import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { practiceSubmissionMigrationOptions } from './run-practice-submission-source';
import { applyBugReportsMigration } from './migrations/bug-reports';

async function run(): Promise<void> {
  const dataSource = new DataSource(practiceSubmissionMigrationOptions());
  try {
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        await applyBugReportsMigration(queryRunner);
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
  .then(() => console.log('Bug reports migration completed.'))
  .catch((error) => {
    console.error(
      'Bug reports migration failed:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
