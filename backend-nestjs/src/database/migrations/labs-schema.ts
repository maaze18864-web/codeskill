import { MigrationQueryRunner } from './declarative-partitioning';

export async function applyLabsSchemaMigration(
  queryRunner: MigrationQueryRunner,
): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS "lab_sections" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "code" varchar(100) NOT NULL,
      "name" varchar(255) NOT NULL,
      "department" varchar(255),
      "semester" int,
      "academicYear" varchar(50),
      "isActive" boolean NOT NULL DEFAULT true,
      "created_by_id" uuid,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_lab_sections_code" UNIQUE ("code")
    );

    CREATE TABLE IF NOT EXISTS "lab_subgroups" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "lab_section_id" uuid NOT NULL REFERENCES "lab_sections"("id") ON DELETE CASCADE,
      "code" varchar(20) NOT NULL,
      "name" varchar(255) NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_lab_subgroups_section_code" UNIQUE ("lab_section_id", "code")
    );

    CREATE TABLE IF NOT EXISTS "lab_section_enrollments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "lab_section_id" uuid NOT NULL REFERENCES "lab_sections"("id") ON DELETE CASCADE,
      "lab_subgroup_id" uuid REFERENCES "lab_subgroups"("id") ON DELETE SET NULL,
      "student_id" uuid NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'active',
      "enrolledAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "completedAt" TIMESTAMPTZ,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_lab_section_enrollments_section_student" UNIQUE ("lab_section_id", "student_id")
    );
    CREATE INDEX IF NOT EXISTS "IDX_lab_section_enrollments_student"
      ON "lab_section_enrollments" ("student_id");

    CREATE TABLE IF NOT EXISTS "labs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "title" varchar(255) NOT NULL,
      "slug" varchar(255) NOT NULL,
      "description" text,
      "status" varchar(20) NOT NULL DEFAULT 'draft',
      "subject" varchar(100),
      "created_by_id" uuid,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_labs_slug" UNIQUE ("slug")
    );

    CREATE TABLE IF NOT EXISTS "lab_section_assignments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "lab_id" uuid NOT NULL REFERENCES "labs"("id") ON DELETE CASCADE,
      "lab_section_id" uuid NOT NULL REFERENCES "lab_sections"("id") ON DELETE CASCADE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_lab_section_assignments_lab_section" UNIQUE ("lab_id", "lab_section_id")
    );

    CREATE TABLE IF NOT EXISTS "lab_teacher_assignments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "lab_section_id" uuid NOT NULL REFERENCES "lab_sections"("id") ON DELETE CASCADE,
      "lab_id" uuid NOT NULL REFERENCES "labs"("id") ON DELETE CASCADE,
      "teacher_id" uuid NOT NULL,
      "role" varchar(20) NOT NULL DEFAULT 'instructor',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_lab_teacher_assignments_section_lab_teacher"
        UNIQUE ("lab_section_id", "lab_id", "teacher_id")
    );
    CREATE INDEX IF NOT EXISTS "IDX_lab_teacher_assignments_teacher"
      ON "lab_teacher_assignments" ("teacher_id");

    CREATE TABLE IF NOT EXISTS "lab_experiments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "lab_id" uuid NOT NULL REFERENCES "labs"("id") ON DELETE CASCADE,
      "title" varchar(255) NOT NULL,
      "description" text,
      "sortOrder" int NOT NULL DEFAULT 0,
      "isPublished" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS "IDX_lab_experiments_lab_order"
      ON "lab_experiments" ("lab_id", "sortOrder");

    CREATE TABLE IF NOT EXISTS "lab_experiment_problems" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "lab_experiment_id" uuid NOT NULL REFERENCES "lab_experiments"("id") ON DELETE CASCADE,
      "problem_metadata_id" uuid NOT NULL,
      "sortOrder" int NOT NULL DEFAULT 0,
      "maxScore" float NOT NULL DEFAULT 5,
      "difficulty" varchar(50),
      "isRequired" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_lab_experiment_problems_experiment_problem"
        UNIQUE ("lab_experiment_id", "problem_metadata_id")
    );
    CREATE INDEX IF NOT EXISTS "IDX_lab_experiment_problems_order"
      ON "lab_experiment_problems" ("lab_experiment_id", "sortOrder");

    CREATE TABLE IF NOT EXISTS "lab_problem_progress" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "lab_id" uuid NOT NULL REFERENCES "labs"("id") ON DELETE CASCADE,
      "lab_experiment_problem_id" uuid NOT NULL REFERENCES "lab_experiment_problems"("id") ON DELETE CASCADE,
      "student_id" uuid NOT NULL,
      "status" varchar(20) NOT NULL DEFAULT 'not_started',
      "best_submission_id" uuid,
      "attemptsCount" int NOT NULL DEFAULT 0,
      "score" float,
      "timeSpentSeconds" int NOT NULL DEFAULT 0,
      "firstSolvedAt" TIMESTAMPTZ,
      "lastActivityAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT "UQ_lab_problem_progress_problem_student"
        UNIQUE ("lab_experiment_problem_id", "student_id")
    );
    CREATE INDEX IF NOT EXISTS "IDX_lab_problem_progress_lab_student"
      ON "lab_problem_progress" ("lab_id", "student_id");
  `);
  await queryRunner.query(`
    ALTER TABLE lab_experiment_problems ALTER COLUMN problem_metadata_id DROP NOT NULL;
    ALTER TABLE lab_experiment_problems ADD COLUMN IF NOT EXISTS kind varchar(20) NOT NULL DEFAULT 'coding';
    ALTER TABLE lab_experiment_problems ADD COLUMN IF NOT EXISTS "projectTemplate" jsonb;
    ALTER TABLE lab_experiment_problems ADD COLUMN IF NOT EXISTS "sqlProblem" jsonb;
    ALTER TABLE lab_experiment_problems ADD COLUMN IF NOT EXISTS "sqlQuestionId" uuid;
    ALTER TABLE assessments ADD COLUMN IF NOT EXISTS "labExperimentId" uuid;
    ALTER TABLE assessments ADD COLUMN IF NOT EXISTS "labMaxScore" double precision;
    CREATE INDEX IF NOT EXISTS assessments_lab_experiment_idx ON assessments("labExperimentId");
    ALTER TABLE lab_problem_progress ADD COLUMN IF NOT EXISTS "lastCode" text;
  `);
}
