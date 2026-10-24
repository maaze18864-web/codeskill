import { DataSource } from 'typeorm';
import { practiceSubmissionMigrationOptions } from './run-practice-submission-source';
import { applyLabsSchemaMigration } from './migrations/labs-schema';

export async function runLabsSchemaMigrations(): Promise<void> {
  const source = new DataSource(practiceSubmissionMigrationOptions());
  try {
    await source.initialize();
    const runner = source.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query('SELECT pg_advisory_xact_lock(1902230160)');
        await applyLabsSchemaMigration(runner);
        await runner.commitTransaction();
      } catch (error) {
        await runner.rollbackTransaction();
        throw error;
      }
    } finally {
      await runner.release();
    }
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}

if (require.main === module) {
  void runLabsSchemaMigrations()
    .then(() => {
      console.log('Labs schema migrations completed.');
    })
    .catch((error: unknown) => {
      console.error(
        'Labs schema migrations failed:',
        error instanceof Error ? error.message : error,
      );
      process.exitCode = 1;
    });
}
