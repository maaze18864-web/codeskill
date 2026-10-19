export interface BugReportsQueryRunner {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

/** Idempotently creates the bug tracker tables on the primary PostgreSQL database. */
export async function applyBugReportsMigration(
  queryRunner: BugReportsQueryRunner,
): Promise<void> {
  await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS bug_reports (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "creatorName" varchar(80) NOT NULL,
      "creatorUserId" uuid NULL REFERENCES users("id") ON DELETE SET NULL,
      "title" varchar(180) NOT NULL,
      "description" text NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'new'
        CHECK ("status" IN ('new', 'in_process', 'fixed')),
      "priority" varchar(20) NOT NULL DEFAULT 'medium'
        CHECK ("priority" IN ('low', 'medium', 'high', 'critical')),
      "assigneeName" varchar(80) NULL,
      "assigneeUserId" uuid NULL REFERENCES users("id") ON DELETE SET NULL,
      "fixedAt" timestamptz NULL,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await queryRunner.query(
    'CREATE INDEX IF NOT EXISTS "IDX_bug_reports_status_created_at" ON bug_reports ("status", "createdAt")',
  );
  await queryRunner.query(
    'ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS "editedAt" timestamptz NULL',
  );

  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS bug_images (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "bugId" uuid NOT NULL REFERENCES bug_reports("id") ON DELETE CASCADE,
      "url" varchar(255) NOT NULL,
      "mimeType" varchar(80) NOT NULL,
      "uploadedByUserId" uuid NULL REFERENCES users("id") ON DELETE SET NULL,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await queryRunner.query(
    'CREATE INDEX IF NOT EXISTS "IDX_bug_images_bug_id_created_at" ON bug_images ("bugId", "createdAt")',
  );

  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS bug_comments (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "bugId" uuid NOT NULL REFERENCES bug_reports("id") ON DELETE CASCADE,
      "authorUserId" uuid NULL REFERENCES users("id") ON DELETE SET NULL,
      "authorName" varchar(80) NOT NULL,
      "body" varchar(3000) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await queryRunner.query(
    'CREATE INDEX IF NOT EXISTS "IDX_bug_comments_bug_id_created_at" ON bug_comments ("bugId", "createdAt")',
  );
  await queryRunner.query(
    'ALTER TABLE bug_comments ADD COLUMN IF NOT EXISTS "editedAt" timestamptz NULL',
  );

  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS bug_activities (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "bugId" uuid NOT NULL REFERENCES bug_reports("id") ON DELETE CASCADE,
      "actorUserId" uuid NULL REFERENCES users("id") ON DELETE SET NULL,
      "actorName" varchar(80) NOT NULL,
      "type" varchar(20) NOT NULL CHECK ("type" IN ('reported', 'assigned', 'fixed', 'reopened', 'edited')),
      "message" varchar(240) NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await queryRunner.query(
    'CREATE INDEX IF NOT EXISTS "IDX_bug_activities_bug_id_created_at" ON bug_activities ("bugId", "createdAt")',
  );
  await queryRunner.query(
    'ALTER TABLE bug_activities DROP CONSTRAINT IF EXISTS bug_activities_type_check',
  );
  await queryRunner.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'CHK_bug_activities_type'
          AND conrelid = 'bug_activities'::regclass
      ) THEN
        ALTER TABLE bug_activities
          ADD CONSTRAINT "CHK_bug_activities_type"
          CHECK ("type" IN ('reported', 'assigned', 'fixed', 'reopened', 'edited'));
      END IF;
    END $$
  `);
}
