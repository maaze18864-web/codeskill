import { DataSource } from 'typeorm';
import { practiceSubmissionMigrationOptions } from './run-practice-submission-source';
import { applyProjectWorkspacesMigration } from './migrations/project-workspaces';

export async function runProjectWorkspacesMigration() {
  const source = new DataSource(practiceSubmissionMigrationOptions());
  try {
    await source.initialize();
    await source.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(1902230161)');
      await applyProjectWorkspacesMigration(manager.queryRunner!);
    });
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
if (require.main === module)
  void runProjectWorkspacesMigration()
    .then(() => console.log('Project workspace schema ready.'))
    .catch(() => {
      console.error(
        'Project workspace migration failed. Check database access and schema.',
      );
      process.exitCode = 1;
    });
