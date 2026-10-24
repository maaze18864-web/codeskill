import { MigrationQueryRunner } from './declarative-partitioning';

export async function applyQuestionBulkUploadBatchesMigration(queryRunner: MigrationQueryRunner): Promise<void> {
  await queryRunner.query(`CREATE TABLE IF NOT EXISTS "question_bulk_upload_batches" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "batchCode" varchar(100) NOT NULL,
    "batchName" varchar(100) NOT NULL DEFAULT '',
    "questionType" varchar(20) NOT NULL,
    "originalFilename" varchar(500) NOT NULL DEFAULT '',
    "totalQuestions" integer NOT NULL DEFAULT 0,
    "successfulQuestions" integer NOT NULL DEFAULT 0,
    "failedQuestions" integer NOT NULL DEFAULT 0,
    "status" varchar(30) NOT NULL DEFAULT 'PROCESSING',
    "uploaded_by_id" uuid,
    "failureDetails" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "question_bulk_upload_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_question_bulk_upload_batches_batchCode" UNIQUE ("batchCode"),
    CONSTRAINT "FK_question_bulk_upload_batches_uploaded_by" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL
  );`);
  await queryRunner.query(`ALTER TABLE "question_bulk_upload_batches" ADD COLUMN IF NOT EXISTS "batchName" varchar(100) NOT NULL DEFAULT '';`);
  await queryRunner.query(`ALTER TABLE "question_bulk_upload_batches" ADD COLUMN IF NOT EXISTS "failureDetails" jsonb NOT NULL DEFAULT '[]'::jsonb;`);
  await queryRunner.query(`ALTER TABLE "question_bulk_upload_batches" ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb;`);
  await queryRunner.query(`ALTER TABLE "question_bulk_upload_batches" ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now();`);
  await queryRunner.query(`ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "bulk_upload_batch_id" uuid;`);
  await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_questions_bulk_upload_batch_id" ON "questions" ("bulk_upload_batch_id");`);
  await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_question_bulk_upload_batches_type_created" ON "question_bulk_upload_batches" ("questionType", "createdAt");`);
  await queryRunner.query(`DO $$ BEGIN
    ALTER TABLE "questions" ADD CONSTRAINT "FK_questions_bulk_upload_batch" FOREIGN KEY ("bulk_upload_batch_id") REFERENCES "question_bulk_upload_batches"("id") ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;`);
}
