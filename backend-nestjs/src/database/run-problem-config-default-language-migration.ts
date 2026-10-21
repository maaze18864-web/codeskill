import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { databaseConfig } from '../config';
import { practiceSubmissionMigrationOptions } from './run-practice-submission-source';
import { applyProblemConfigDefaultLanguageMigration } from './migrations/problem-config-default-language';

async function run(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('This focused migration runner is restricted to development.');
  }
  const postgres = databaseConfig().postgres;
  const host = postgres.url ? new URL(postgres.url).hostname : postgres.host;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('This focused migration runner requires a loopback PostgreSQL host.');
  }

  const dataSource = new DataSource(practiceSubmissionMigrationOptions());
  try {
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      const [{ database }] = await queryRunner.query('SELECT current_database() AS database');
      if (database !== 'codeskill_local') {
        throw new Error('This focused migration runner only allows the codeskill_local database.');
      }
      await queryRunner.startTransaction();
      try {
        await queryRunner.query("SET LOCAL lock_timeout = '5s'");
        await queryRunner.query("SET LOCAL statement_timeout = '30s'");
        await queryRunner.query('SELECT pg_advisory_xact_lock(1902230159)');
        await applyProblemConfigDefaultLanguageMigration(queryRunner);
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
  .then(() => console.log('Problem config default language migration completed.'))
  .catch((error) => {
    console.error('Problem config default language migration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
