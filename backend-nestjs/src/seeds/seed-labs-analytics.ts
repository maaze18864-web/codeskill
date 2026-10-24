/** Local-only, additive, idempotent analytics fixtures. Does not run migrations,
 * send email, enqueue executions, or insert fabricated judge submissions.
 * NODE_ENV=development npx ts-node src/seeds/seed-labs-analytics.ts --apply
 */
import * as dotenv from 'dotenv';
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
dotenv.config({ quiet: true });

interface SeedClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}
const { Client } = createRequire(__filename)('pg') as {
  Client: new (options: { connectionString: string }) => SeedClient;
};

export function demoId(key: string) {
  const hex = createHash('sha256')
    .update(`codeskill-labs-analytics-v1:${key}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const problemSpecs = [
  {
    title: 'Sum of Two Numbers',
    description: 'Read two integers and print their sum.',
    input: '2 3',
    output: '5',
    hiddenInput: '-4 9',
    hiddenOutput: '5',
  },
  {
    title: 'Maximum Value',
    description: 'Read two integers and print the larger value.',
    input: '2 8',
    output: '8',
    hiddenInput: '-4 -9',
    hiddenOutput: '-4',
  },
  {
    title: 'Even or Odd',
    description:
      'Read an integer. Print EVEN if it is even, otherwise print ODD.',
    input: '8',
    output: 'EVEN',
    hiddenInput: '7',
    hiddenOutput: 'ODD',
  },
  {
    title: 'String Length',
    description: 'Read one word and print its length.',
    input: 'hello',
    output: '5',
    hiddenInput: 'code',
    hiddenOutput: '4',
  },
  {
    title: 'Square a Number',
    description: 'Read an integer and print its square.',
    input: '6',
    output: '36',
    hiddenInput: '-3',
    hiddenOutput: '9',
  },
  {
    title: 'Reverse a Word',
    description: 'Read one word and print its characters in reverse order.',
    input: 'hello',
    output: 'olleh',
    hiddenInput: 'code',
    hiddenOutput: 'edoc',
  },
];

async function main() {
  if (!['development', 'test'].includes(process.env.NODE_ENV || ''))
    throw new Error(
      'Set NODE_ENV=development or test. Production seeding is prohibited.',
    );
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('This seed only permits a loopback PostgreSQL target.');
  if (!process.argv.includes('--apply'))
    throw new Error(
      'Review this additive seed, then pass --apply to populate local demo scenarios.',
    );
  const manifestPath = resolve(
    __dirname,
    '../../../.local-dev/labs-analytics-demo.json',
  );
  let previous: { password?: string } = {};
  try {
    const saved: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (
      !saved ||
      typeof saved !== 'object' ||
      !('password' in saved) ||
      typeof saved.password !== 'string'
    )
      throw new Error(
        'The existing local demo credentials file is invalid. Preserve or repair it before rerunning.',
      );
    previous = { password: saved.password };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const password =
    previous.password ||
    process.env.LABS_DEMO_PASSWORD ||
    `Labs-${randomBytes(12).toString('base64url')}!`;
  const hash = await bcrypt.hash(password, 12);
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  const counts: Record<string, number> = {};
  // Only fixed internal table/column identifiers are interpolated; values are parameters.
  const insert = async (
    table: string,
    columns: string[],
    rows: unknown[][],
  ) => {
    for (let offset = 0; offset < rows.length; offset += 300) {
      const batch = rows.slice(offset, offset + 300);
      const values: unknown[] = [];
      const tuples = batch.map(
        (row) =>
          `(${row
            .map((v) => {
              values.push(v);
              return `$${values.length}`;
            })
            .join(',')})`,
      );
      const result = await db.query(
        `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES ${tuples.join(',')} ON CONFLICT (id) DO NOTHING`,
        values,
      );
      counts[table] = (counts[table] || 0) + (result.rowCount || 0);
    }
  };
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '5s'");
    const now = new Date(
      (await db.query<{ now: Date }>('SELECT CURRENT_TIMESTAMP AS now')).rows[0]
        .now,
    ).getTime();
    const teachers = [0, 1, 2].map((i) => ({
      id: demoId(`teacher:${i}`),
      email: `analytics-demo.teacher${i + 1}@codeskill.local`,
      name: `Demo Instructor ${i + 1}`,
    }));
    const students = Array.from({ length: 460 }, (_, i) => ({
      id: demoId(`student:${i}`),
      email: `analytics-demo.student${String(i + 1).padStart(3, '0')}@codeskill.local`,
      name: `Demo Student ${String(i + 1).padStart(3, '0')}`,
      uid: `DEMO-LABS-${String(i + 1).padStart(4, '0')}`,
    }));
    await insert(
      'users',
      ['id', 'name', 'email', 'password', 'role', 'uid', 'isActive'],
      [
        ...teachers.map((t) => [
          t.id,
          t.name,
          t.email,
          hash,
          'teacher',
          `DEMO-TEACHER-${t.id.slice(0, 8)}`,
          true,
        ]),
        ...students.map((s, i) => [
          s.id,
          s.name,
          s.email,
          hash,
          'student',
          s.uid,
          i !== 22,
        ]),
      ],
    );
    const labNames = [
      'Algorithms',
      'Python Foundations',
      'Problem Solving',
      'Awaiting Content',
      'Draft Curriculum',
      'Archived Curriculum',
    ];
    await insert(
      'labs',
      ['id', 'title', 'slug', 'description', 'status', 'subject'],
      labNames.map((name, i) => [
        demoId(`lab:${i}`),
        `[Demo] ${name}`,
        `analytics-demo-${i}`,
        'Synthetic local analytics scenario. No actual examination result is represented.',
        i === 4 ? 'draft' : i === 5 ? 'archived' : 'published',
        name,
      ]),
    );
    await insert(
      'problem_metadata',
      ['id', 'title', 'slug', 'difficulty', 'visibility', 'categories', 'tags'],
      problemSpecs.map((p, i) => [
        demoId(`problem:${i}`),
        `[Demo] ${p.title}`,
        `analytics-demo-problem-${i}`,
        i < 3 ? 'Easy' : 'Medium',
        'Draft',
        JSON.stringify(['Labs Demo']),
        JSON.stringify(['analytics-demo']),
      ]),
    );
    await insert(
      'problem_statements',
      [
        'id',
        'metadata_id',
        'description',
        'inputFormat',
        'outputFormat',
        'constraints',
        'samples',
      ],
      problemSpecs.map((p, i) => [
        demoId(`statement:${i}`),
        demoId(`problem:${i}`),
        `<p>${p.description}</p>`,
        'Read from standard input.',
        'Write only the requested answer to standard output.',
        'Integers fit within signed 32-bit bounds; words contain 1–100 ASCII letters.',
        JSON.stringify([
          {
            input: p.input,
            output: p.output,
            explanation: 'An independently authored example.',
          },
        ]),
      ]),
    );
    await insert(
      'problem_configs',
      [
        'id',
        'metadata_id',
        'supportedLanguages',
        'defaultLanguage',
        'starterCode',
      ],
      problemSpecs.map((_, i) => [
        demoId(`config:${i}`),
        demoId(`problem:${i}`),
        JSON.stringify(['python', 'cpp', 'javascript']),
        'python',
        JSON.stringify({
          python: '# Read input and write your answer.\n',
          cpp: '#include <iostream>\nint main() { return 0; }\n',
          javascript: '// Read input and write your answer.\n',
        }),
      ]),
    );
    await insert(
      'problem_testcases',
      ['id', 'metadata_id', 'cases'],
      problemSpecs.map((p, i) => [
        demoId(`tests:${i}`),
        demoId(`problem:${i}`),
        JSON.stringify([
          { input: p.input, output: p.output, isHidden: false, weight: 1 },
          {
            input: p.hiddenInput,
            output: p.hiddenOutput,
            isHidden: true,
            weight: 1,
          },
        ]),
      ]),
    );
    const experimentNames = [
      'Foundations',
      'Applied Practice',
      'Challenge Set',
      'Unpublished Preview',
    ];
    const experiments: unknown[][] = [],
      links: unknown[][] = [];
    for (let l = 0; l < 3; l++)
      for (let e = 0; e < 4; e++) {
        experiments.push([
          demoId(`experiment:${l}:${e}`),
          demoId(`lab:${l}`),
          experimentNames[e],
          'Synthetic analytics fixture.',
          e,
          e < 3,
        ]);
        for (let p = 0; p < 2; p++)
          links.push([
            demoId(`link:${l}:${e}:${p}`),
            demoId(`experiment:${l}:${e}`),
            demoId(`problem:${(e * 2 + p) % 6}`),
            p,
            5,
          ]);
      }
    experiments.push([
      demoId('empty-experiment'),
      demoId('lab:3'),
      'Content not attached',
      'An empty published experiment for readiness checks.',
      0,
      true,
    ]);
    await insert(
      'lab_experiments',
      ['id', 'lab_id', 'title', 'description', 'sortOrder', 'isPublished'],
      experiments,
    );
    await insert(
      'lab_experiment_problems',
      [
        'id',
        'lab_experiment_id',
        'problem_metadata_id',
        'sortOrder',
        'maxScore',
      ],
      links,
    );
    const sectionScenario = (i: number) =>
      i < 4
        ? 'Strong progress'
        : i < 9
          ? 'Mixed progress'
          : i < 12
            ? 'Repeated attempts'
            : i < 14
              ? 'Inactive learners'
              : i < 16
                ? 'Not started'
                : i === 16
                  ? 'No teacher assigned'
                  : i === 17
                    ? 'No published problems'
                    : i === 18
                      ? 'Empty roster'
                      : 'Inactive section';
    await insert(
      'lab_sections',
      [
        'id',
        'code',
        'name',
        'department',
        'semester',
        'academicYear',
        'isActive',
      ],
      Array.from({ length: 20 }, (_, i) => [
        demoId(`section:${i}`),
        `DEMO-LABS-${String(i + 1).padStart(2, '0')}`,
        sectionScenario(i),
        'Demo Computing',
        3,
        '2026-27',
        i !== 19,
      ]),
    );
    await insert(
      'lab_subgroups',
      ['id', 'lab_section_id', 'code', 'name'],
      Array.from({ length: 40 }, (_, i) => [
        demoId(`subgroup:${i}`),
        demoId(`section:${Math.floor(i / 2)}`),
        i % 2 ? 'B' : 'A',
        i % 2 ? 'Demo group B' : 'Demo group A',
      ]),
    );
    const assignments: unknown[][] = [],
      teaching: unknown[][] = [],
      enrollments: unknown[][] = [],
      progress: unknown[][] = [];
    let studentIndex = 0;
    for (let section = 0; section < 20; section++) {
      const labs =
        section === 17
          ? [3]
          : section % 3 === 0
            ? [0, 1, 2]
            : section % 3 === 1
              ? [0, 1]
              : [0, 2];
      for (const l of labs) {
        assignments.push([
          demoId(`assignment:${section}:${l}`),
          demoId(`lab:${l}`),
          demoId(`section:${section}`),
        ]);
        if (section !== 16)
          teaching.push([
            demoId(`teaching:${section}:${l}`),
            demoId(`lab:${l}`),
            demoId(`section:${section}`),
            teachers[(section + l) % 3].id,
            'instructor',
          ]);
      }
      if (section === 18) continue;
      for (let j = 0; j < 24; j++) {
        const i = studentIndex++;
        enrollments.push([
          demoId(`enrollment:${section}:${i}`),
          demoId(`section:${section}`),
          demoId(`subgroup:${section * 2 + (j % 2)}`),
          students[i].id,
          j === 23 ? 'dropped' : 'active',
        ]);
        for (const l of labs.filter((l) => l < 3))
          for (let e = 0; e < 4; e++)
            for (let p = 0; p < 2; p++) {
              const roll = (i * 17 + e * 23 + p * 7 + l * 11) % 100;
              const threshold =
                j === 0 && section < 4
                  ? 100
                  : section < 4
                    ? 84
                    : section < 9
                      ? 52
                      : section < 12
                        ? 16
                        : section < 14
                          ? 35
                          : section < 16
                            ? 0
                            : 58;
              const solved = roll < threshold;
              const started =
                solved ||
                (threshold > 0 && roll < Math.min(95, threshold + 30));
              if (!started) continue; // Missing rows intentionally model untouched work.
              const status = solved
                ? 'solved'
                : roll % 2
                  ? 'failed'
                  : 'in_progress';
              const attempts = solved
                ? 1 + (roll % 4)
                : section >= 9 && section < 12
                  ? 5 + (roll % 6)
                  : roll % 3;
              const ageHours =
                section >= 12 && section < 14
                  ? 216 + (i % 11) * 24
                  : i % 4 === 0
                    ? 1 + (i % 18)
                    : 24 + (i % 120);
              const last = new Date(now - ageHours * 3600000);
              const first = solved
                ? new Date(now - (ageHours + 12 + (e * 5 + p * 3)) * 3600000)
                : null;
              progress.push([
                demoId(`progress:${i}:${l}:${e}:${p}`),
                demoId(`lab:${l}`),
                demoId(`link:${l}:${e}:${p}`),
                students[i].id,
                status,
                attempts,
                180 + roll * 21,
                solved ? 5 : 0,
                first,
                last,
              ]);
            }
      }
    }
    // A few learners share the same lab through two sections: overall totals deduplicate them.
    for (let i = 0; i < 6; i++)
      enrollments.push([
        demoId(`cross-enrollment:${i}`),
        demoId('section:1'),
        demoId('subgroup:2'),
        students[i].id,
        'active',
      ]);
    // Early starters make effort bands meaningful alongside established cohorts:
    // time recorded without a submission, one solve, and a few unsolved attempts.
    for (let i = 456; i < 460; i++) {
      enrollments.push([
        demoId(`early-enrollment:${i}`),
        demoId('section:0'),
        demoId('subgroup:0'),
        students[i].id,
        'active',
      ]);
      const solved = i === 457;
      progress.push([
        demoId(`early-progress:${i}`),
        demoId('lab:0'),
        demoId('link:0:0:0'),
        students[i].id,
        solved ? 'solved' : i === 459 ? 'failed' : 'in_progress',
        [0, 1, 2, 4][i - 456],
        120,
        solved ? 5 : 0,
        solved ? new Date(now - 2 * 3600000) : null,
        new Date(now - 3600000),
      ]);
    }
    // Draft and archived subject assignments must never enter learning metrics.
    for (const l of [4, 5])
      assignments.push([
        demoId(`excluded-assignment:${l}`),
        demoId(`lab:${l}`),
        demoId('section:0'),
      ]);
    await insert(
      'lab_section_assignments',
      ['id', 'lab_id', 'lab_section_id'],
      assignments,
    );
    await insert(
      'lab_teacher_assignments',
      ['id', 'lab_id', 'lab_section_id', 'teacher_id', 'role'],
      teaching,
    );
    await insert(
      'lab_section_enrollments',
      ['id', 'lab_section_id', 'lab_subgroup_id', 'student_id', 'status'],
      enrollments,
    );
    await insert(
      'lab_problem_progress',
      [
        'id',
        'lab_id',
        'lab_experiment_problem_id',
        'student_id',
        'status',
        'attemptsCount',
        'timeSpentSeconds',
        'score',
        'firstSolvedAt',
        'lastActivityAt',
      ],
      progress,
    );
    const beforeCommit = await db.query(
      "SELECT COUNT(*)::int AS sections FROM lab_sections WHERE code LIKE 'DEMO-LABS-%'",
    );
    if (beforeCommit.rows[0].sections !== 20)
      throw new Error(
        'Unexpected demo namespace collision; transaction rolled back.',
      );
    await mkdir(resolve(manifestPath, '..'), { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          seed: 'labs-analytics-v1',
          password,
          teachers,
          student: students[0],
          sections: Array.from({ length: 20 }, (_, i) => ({
            id: demoId(`section:${i}`),
            code: `DEMO-LABS-${String(i + 1).padStart(2, '0')}`,
            scenario: sectionScenario(i),
          })),
          createdAt: new Date(now).toISOString(),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    await db.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          database: decodeURIComponent(url.pathname.slice(1)),
          sections: 20,
          students: students.length,
          teachers: 3,
          inserted: counts,
          credentialsFile: manifestPath,
          scenarios:
            'strong, mixed, repeated-attempt, dormant, never-started, unstaffed, no-content, empty, inactive, dropped, shared-enrollment, unpublished, draft, archived',
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
if (require.main === module)
  main().catch((e: unknown) => {
    console.error(
      e instanceof Error ? e.message : 'Local analytics seed failed.',
    );
    process.exitCode = 1;
  });
