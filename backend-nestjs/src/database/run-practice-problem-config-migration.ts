import 'dotenv/config';
import { DataSource } from 'typeorm';
import { practiceSubmissionMigrationOptions } from './run-practice-submission-source';
import { applyPracticeProblemConfigMigration } from './migrations/practice-problem-config';

/** This command changes only problem_configs; it never runs the broader migrations. */
export async function runPracticeProblemConfigMigration(): Promise<void> {
  const dataSource = new DataSource(practiceSubmissionMigrationOptions());
  try {
    await dataSource.initialize();
    const runner = dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query("SET LOCAL lock_timeout = '5s'");
        await runner.query("SET LOCAL statement_timeout = '30s'");
        await runner.query('SELECT pg_advisory_xact_lock(1902230159)');
        await applyPracticeProblemConfigMigration(runner);
        await runner.commitTransaction();
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      }
    } finally {
      await runner.release();
    }
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (require.main === module) {
  void runPracticeProblemConfigMigration()
    .then(() => console.log('Practice problem configuration migration completed.'))
    .catch((error: unknown) => {
      console.error(
        'Practice problem configuration migration failed:',
        error instanceof Error ? error.message : error,
      );
      process.exitCode = 1;
    });
}
