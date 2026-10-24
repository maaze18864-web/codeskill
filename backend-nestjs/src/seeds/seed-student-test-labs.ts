/** Local-only, additive test content for the existing student.test account. */
import { DataSource } from 'typeorm';
import { practiceSubmissionMigrationOptions } from '../database/run-practice-submission-source';
import { dbmsExercise, fullstackExercise } from './lab-project-examples';
import type { LabProjectTemplate } from '../projects/lab-project-template';

const email = 'student.test@codeskill.local';
async function main() {
  const options = practiceSubmissionMigrationOptions();
  const host =
    'url' in options && options.url
      ? new URL(options.url).hostname
      : 'host' in options
        ? options.host
        : '';
  if (
    !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host || '') ||
    process.env.NODE_ENV !== 'development'
  )
    throw new Error(
      'This seed requires NODE_ENV=development and a loopback PostgreSQL host.',
    );
  const db = new DataSource(options);
  await db.initialize();
  try {
    await db.transaction(async (manager) => {
      const query = <T = { id: string }>(
        sql: string,
        parameters: unknown[] = [],
      ) => manager.query<T[]>(sql, parameters);
      await query('SELECT pg_advisory_xact_lock(1902230171)');
      const [student] = await query<{
        id: string;
        role: string;
        isAdmin: boolean;
      }>('SELECT id, role, "isAdmin" FROM users WHERE lower(email) = $1', [
        email,
      ]);
      if (!student || student.isAdmin || student.role !== 'student')
        throw new Error(
          'Expected existing test student account. No user was created or modified.',
        );
      const [section] = await query(
        `INSERT INTO lab_sections(code, name, department, semester, "academicYear") VALUES('LOCAL-TEST-LABS','Local testing section','CSE',5,'2026-27') ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,
      );
      await query(
        `INSERT INTO lab_section_enrollments(lab_section_id,student_id,status) VALUES($1,$2,'active') ON CONFLICT(lab_section_id,student_id) DO UPDATE SET status='active'`,
        [section.id, student.id],
      );
      const admin = (
        await query(
          `SELECT id FROM users WHERE "isAdmin"=true OR role IN ('admin','super_admin') ORDER BY "createdAt" LIMIT 1`,
        )
      )[0];
      const definitions = [
        {
          title: 'DSA Lab',
          subject: 'DSA',
          slug: 'local-test-dsa',
          description:
            'Arrays, prefix sums, and two pointers with runnable coding exercises.',
        },
        {
          title: 'DBMS Lab',
          subject: 'DBMS',
          slug: 'local-test-dbms',
          description:
            'Complete SQL queries in isolated database reporting projects.',
        },
        {
          title: 'Fullstack Lab',
          subject: 'Fullstack',
          slug: 'local-test-fullstack',
          description:
            'Finish missing React and Express code in complete starter projects.',
        },
      ];
      const labs: string[] = [];
      for (const definition of definitions) {
        const [lab] = await query(
          `INSERT INTO labs(title,slug,subject,description,status,created_by_id) VALUES($1,$2,$3,$4,'published',$5) ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id`,
          [
            definition.title,
            definition.slug,
            definition.subject,
            definition.description,
            admin?.id || null,
          ],
        );
        labs.push(lab.id);
        await query(
          `INSERT INTO lab_section_assignments(lab_id,lab_section_id) VALUES($1,$2) ON CONFLICT(lab_id,lab_section_id) DO NOTHING`,
          [lab.id, section.id],
        );
      }
      async function experiment(
        labId: string,
        title: string,
        description: string,
        order: number,
      ) {
        const [existing] = await query(
          `SELECT id FROM lab_experiments WHERE lab_id=$1 AND title=$2`,
          [labId, title],
        );
        if (existing) return existing.id;
        return (
          await query(
            `INSERT INTO lab_experiments(lab_id,title,description,"sortOrder","isPublished") VALUES($1,$2,$3,$4,true) RETURNING id`,
            [labId, title, description, order],
          )
        )[0].id;
      }
      async function project(
        experimentId: string,
        template: LabProjectTemplate,
      ) {
        if (
          (
            await query(
              `SELECT id FROM lab_experiment_problems WHERE lab_experiment_id=$1 AND kind='sql' LIMIT 1`,
              [experimentId],
            )
          ).length
        )
          return;
        const [existing] = await query(
          `SELECT id FROM lab_experiment_problems WHERE lab_experiment_id=$1 AND kind='project' AND "projectTemplate"->>'name'=$2`,
          [experimentId, template.name],
        );
        if (!existing)
          await query(
            `INSERT INTO lab_experiment_problems(lab_experiment_id,problem_metadata_id,kind,"projectTemplate","maxScore",difficulty) VALUES($1,NULL,'project',$2::jsonb,10,'Medium')`,
            [experimentId, JSON.stringify(template)],
          );
      }
      const coding = [
        {
          title: 'Sum of an array',
          slug: 'local-test-array-sum',
          experiment: 'Arrays and prefix sums',
          description: 'Read n followed by n integers and print their sum.',
          samples: [
            {
              input: '4\n2 4 -1 5\n',
              output: '10\n',
              explanation: '2 + 4 - 1 + 5 = 10.',
            },
          ],
          cases: [
            ['4\n2 4 -1 5\n', '10\n'],
            ['1\n-7\n', '-7\n'],
            ['5\n0 0 0 0 0\n', '0\n'],
          ],
        },
        {
          title: 'Pair with target sum',
          slug: 'local-test-pair-sum',
          experiment: 'Two pointer technique',
          description:
            'Read n and target, then n integers sorted in ascending order. Print YES if two distinct array positions sum to target, otherwise NO.',
          samples: [
            {
              input: '5 9\n1 2 4 5 8\n',
              output: 'YES\n',
              explanation: '1 + 8 = 9.',
            },
          ],
          cases: [
            ['5 9\n1 2 4 5 8\n', 'YES\n'],
            ['3 10\n1 2 3\n', 'NO\n'],
            ['2 4\n2 2\n', 'YES\n'],
          ],
        },
      ];
      for (const [index, item] of coding.entries()) {
        const experimentId = await experiment(
          labs[0],
          item.experiment,
          'Implement the algorithm and verify public examples before submitting.',
          index,
        );
        const [meta] = await query(
          `INSERT INTO problem_metadata(title,slug,difficulty,visibility,author_id) VALUES($1,$2,'Easy','Draft',$3) ON CONFLICT(slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id`,
          [item.title, item.slug, admin?.id || null],
        );
        if (
          !(
            await query(
              'SELECT id FROM problem_statements WHERE metadata_id=$1',
              [meta.id],
            )
          ).length
        ) {
          await query(
            `INSERT INTO problem_statements(metadata_id,description,"inputFormat","outputFormat",constraints,samples) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
            [
              meta.id,
              `<p>${item.description}</p>`,
              'Integers separated by whitespace.',
              index ? 'Print YES or NO.' : 'Print one integer.',
              '1 <= n <= 100000; -1000000 <= values <= 1000000',
              JSON.stringify(item.samples),
            ],
          );
          const starters = {
            cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    // TODO: read input, solve the problem, print the result.\n    return 0;\n}\n',
            python:
              '# TODO: read input and implement the algorithm.\nimport sys\ndata = list(map(int, sys.stdin.read().split()))\n',
            javascript:
              "const fs = require('fs');\nconst data = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\n// TODO: implement the algorithm and print the result.\n",
          };
          await query(
            `INSERT INTO problem_configs(metadata_id,"supportedLanguages","defaultLanguage","starterCode") VALUES($1,$2::jsonb,'cpp',$3::jsonb)`,
            [
              meta.id,
              JSON.stringify(['cpp', 'python', 'javascript']),
              JSON.stringify(starters),
            ],
          );
          await query(
            `INSERT INTO problem_testcases(metadata_id,cases) VALUES($1,$2::jsonb)`,
            [
              meta.id,
              JSON.stringify(
                item.cases.map(([input, output], i) => ({
                  input,
                  output,
                  isHidden: i > 0,
                  weight: 1,
                })),
              ),
            ],
          );
        }
        await query(
          `INSERT INTO lab_experiment_problems(lab_experiment_id,problem_metadata_id,"maxScore",difficulty) VALUES($1,$2,5,'Easy') ON CONFLICT(lab_experiment_id,problem_metadata_id) DO NOTHING`,
          [experimentId, meta.id],
        );
      }
      await project(
        await experiment(
          labs[1],
          'Aggregation and GROUP BY',
          'Complete the missing SQL query and inspect its JSON report.',
          0,
        ),
        dbmsExercise(),
      );
      await project(
        await experiment(
          labs[1],
          'JOINs and filtering',
          'Join the supplied student and department tables.',
          1,
        ),
        dbmsExercise(true),
      );
      await project(
        await experiment(
          labs[2],
          'Task board API integration',
          'Connect the supplied frontend and complete task API handlers.',
          0,
        ),
        fullstackExercise('Complete the task board'),
      );
      await project(
        await experiment(
          labs[2],
          'Forms and server validation',
          'Complete form submission and validate feedback on the server.',
          1,
        ),
        fullstackExercise('Complete course feedback', true),
      );
      console.log(
        JSON.stringify(
          {
            student: email,
            section: section.id,
            labs: definitions.map((lab, index) => ({
              title: lab.title,
              id: labs[index],
            })),
            experiments: 6,
            codingExercises: 2,
            projectExercises: 4,
          },
          null,
          2,
        ),
      );
    });
  } finally {
    await db.destroy();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Local lab seed failed.',
  );
  process.exitCode = 1;
});
