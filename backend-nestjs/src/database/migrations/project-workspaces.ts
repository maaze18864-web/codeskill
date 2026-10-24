import type { QueryRunner } from 'typeorm';

export async function applyProjectWorkspacesMigration(runner: QueryRunner) {
  await runner.query(`CREATE TABLE IF NOT EXISTS project_workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(100) NOT NULL, mode varchar(20) NOT NULL CHECK (mode IN ('frontend','backend','fullstack')),
    frontend_stack varchar(30), backend_stack varchar(30), files jsonb NOT NULL,
    revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await runner.query(
    "ALTER TABLE project_workspaces ADD COLUMN IF NOT EXISTS directories jsonb NOT NULL DEFAULT '[]'::jsonb",
  );
  await runner.query(
    'CREATE INDEX IF NOT EXISTS project_workspaces_owner_updated_idx ON project_workspaces(owner_id, updated_at DESC)',
  );
  await runner.query(`ALTER TABLE project_workspaces
    ADD COLUMN IF NOT EXISTS lab_problem_id uuid,
    ADD COLUMN IF NOT EXISTS lab_assignment jsonb`);
  await runner.query(`CREATE UNIQUE INDEX IF NOT EXISTS project_workspaces_owner_lab_problem_idx
    ON project_workspaces(owner_id, lab_problem_id) WHERE lab_problem_id IS NOT NULL`);
}
