/**
 * Seeds a demo Labs hierarchy for local development:
 * Section 24-BDVT-701 [A], subject lab, two experiments.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/seeds/seed-labs-demo.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { practiceSubmissionMigrationOptions } from '../database/run-practice-submission-source';
import { applyLabsSchemaMigration } from '../database/migrations/labs-schema';

async function main() {
  const source = new DataSource(practiceSubmissionMigrationOptions());
  await source.initialize();
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    await applyLabsSchemaMigration(runner);

    const existing = await runner.query(
      `SELECT id FROM lab_sections WHERE code = $1 LIMIT 1`,
      ['24-BDVT-701'],
    );
    let sectionId = existing[0]?.id as string | undefined;
    if (!sectionId) {
      const inserted = await runner.query(
        `INSERT INTO lab_sections (code, name, department, semester, "academicYear", "isActive")
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id`,
        [
          '24-BDVT-701',
          'Big Data Visualization Techniques',
          'CSE',
          7,
          '2024-25',
        ],
      );
      sectionId = inserted[0].id;
      await runner.query(
        `INSERT INTO lab_subgroups (lab_section_id, code, name) VALUES ($1, 'A', 'Subgroup A')`,
        [sectionId],
      );
      console.log('Created section 24-BDVT-701 with subgroup A');
    }

    const labExisting = await runner.query(
      `SELECT id FROM labs WHERE slug = $1 LIMIT 1`,
      ['dsa-lab'],
    );
    let labId = labExisting[0]?.id as string | undefined;
    if (!labId) {
      const inserted = await runner.query(
        `INSERT INTO labs (title, slug, description, status, subject)
         VALUES ($1, $2, $3, 'published', $4)
         RETURNING id`,
        [
          'Basic - DSA',
          'dsa-lab',
          'Data Structures and Algorithms lab',
          'DSA',
        ],
      );
      labId = inserted[0].id;
      await runner.query(
        `INSERT INTO lab_section_assignments (lab_id, lab_section_id) VALUES ($1, $2)
         ON CONFLICT (lab_id, lab_section_id) DO NOTHING`,
        [labId, sectionId],
      );
      const experiments = [
        ['Sliding Window', 'Labs', 0],
        ['Two pointer technique', 'Labs', 1],
      ];
      for (const [title, description, sortOrder] of experiments) {
        await runner.query(
          `INSERT INTO lab_experiments (lab_id, title, description, "sortOrder", "isPublished")
           VALUES ($1, $2, $3, $4, true)`,
          [labId, title, description, sortOrder],
        );
      }
      console.log('Created published DSA lab with 2 experiments');
    } else {
      console.log('Demo lab already exists');
    }

    console.log('Labs demo seed complete.');
  } finally {
    await runner.release();
    await source.destroy();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
