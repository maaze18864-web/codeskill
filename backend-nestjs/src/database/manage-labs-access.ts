import { DataSource } from 'typeorm';
import { practiceSubmissionMigrationOptions } from './run-practice-submission-source';
import { LABS_PILOT_EMAIL } from '../common/access/labs-access';
import { ADMIN_ROLES } from '../common/guards/admin.guard';

export function parseLabsAccessArgs(args: string[]) {
  if (
    args.some((arg) => !['--disable', '--restore', '--apply'].includes(arg)) ||
    args.includes('--disable') === args.includes('--restore')
  ) {
    throw new Error(
      'Usage: manage-labs-access (--disable | --restore) [--apply]. Without --apply, changes are rolled back.',
    );
  }
  return {
    disabled: args.includes('--disable'),
    apply: args.includes('--apply'),
  };
}

/** Changes only the pilot account's Labs switch; no schema or account changes. */
export async function manageLabsAccess(
  source: DataSource,
  options: ReturnType<typeof parseLabsAccessArgs>,
) {
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    await runner.startTransaction();
    try {
      await runner.query("SET LOCAL lock_timeout = '5s'");
      await runner.query("SET LOCAL statement_timeout = '15s'");
      const accounts = await runner.query(
        `SELECT id, role, "isAdmin", profile
         FROM users WHERE lower(trim(email)) = $1 FOR UPDATE`,
        [LABS_PILOT_EMAIL],
      );
      if (accounts.length !== 1) {
        throw new Error(
          'Expected exactly one existing pilot student account. No account was created.',
        );
      }
      const account = accounts[0];
      if (
        account.isAdmin ||
        ADMIN_ROLES.includes(account.role) ||
        account.role !== 'student'
      ) {
        throw new Error(
          'The pilot must be a student. Administrator access is never modified.',
        );
      }
      if (
        account.profile !== null &&
        (typeof account.profile !== 'object' || Array.isArray(account.profile))
      ) {
        throw new Error('Unexpected account profile format. No changes saved.');
      }
      const [target] = await runner.query(
        'SELECT current_database() AS database',
      );
      const result = {
        database: target.database,
        email: LABS_PILOT_EMAIL,
        previouslyDisabled: account.profile?.labsAccessDisabled === true,
        disabled: options.disabled,
        applied: options.apply,
      };
      if (options.apply) {
        await runner.query(
          `UPDATE users
           SET profile = jsonb_set(COALESCE(profile, '{}'::jsonb), '{labsAccessDisabled}', to_jsonb($2::boolean), true),
               "updatedAt" = now()
           WHERE id = $1`,
          [account.id, options.disabled],
        );
        await runner.commitTransaction();
      } else {
        await runner.rollbackTransaction();
      }
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    }
  } finally {
    await runner.release();
  }
}

if (require.main === module) {
  void (async () => {
    const options = parseLabsAccessArgs(process.argv.slice(2));
    // Reuse connection/TLS settings only. This does not execute any migrations.
    const source = new DataSource(practiceSubmissionMigrationOptions());
    try {
      await source.initialize();
      console.log(
        JSON.stringify(await manageLabsAccess(source, options), null, 2),
      );
      if (!options.apply)
        console.log('Dry run only. Add --apply to save this change.');
    } finally {
      if (source.isInitialized) await source.destroy();
    }
  })().catch((error: unknown) => {
    console.error(
      'Labs access update failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    process.exitCode = 1;
  });
}
