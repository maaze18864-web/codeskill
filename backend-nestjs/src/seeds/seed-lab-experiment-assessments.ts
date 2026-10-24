/** Additive local-only upgrade of the test student's six existing experiments. */
import { DataSource } from 'typeorm';
import { practiceSubmissionMigrationOptions } from '../database/run-practice-submission-source';
import { labSqlExamples } from './lab-sql-examples';
async function main() {
  const options = practiceSubmissionMigrationOptions();
  const host =
    'url' in options && options.url
      ? new URL(options.url).hostname
      : 'host' in options
        ? options.host
        : '';
  if (
    process.env.NODE_ENV !== 'development' ||
    !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host || '')
  )
    throw new Error('Local development database required.');
  const db = new DataSource(options);
  await db.initialize();
  try {
    await db.transaction(async (manager) => {
      const query = <T = { id: string }>(
        sql: string,
        parameters: unknown[] = [],
      ) => manager.query<T[]>(sql, parameters);
      await query('SELECT pg_advisory_xact_lock(1902230172)');
      const [student] = await query('SELECT id FROM users WHERE email=$1', [
        'student.test@codeskill.local',
      ]);
      if (!student) throw new Error('Test student missing');
      const [admin] = await query(
        `SELECT id FROM users WHERE "isAdmin"=true OR role IN ('admin','super_admin') ORDER BY "createdAt" LIMIT 1`,
      );
      const labs = await query<{ id: string; subject: string; slug: string }>(
        `SELECT id,subject,slug FROM labs WHERE slug IN ('local-test-dsa','local-test-dbms','local-test-fullstack') ORDER BY slug`,
      );
      if (labs.length !== 3)
        throw new Error('Run the student test labs seed first.');
      let sqlPractice = 0,
        assessments = 0;
      for (const lab of labs) {
        const experiments = await query<{
          id: string;
          title: string;
          sortOrder: number;
        }>(
          'SELECT id,title,"sortOrder" FROM lab_experiments WHERE lab_id=$1 ORDER BY "sortOrder"',
          [lab.id],
        );
        for (const experiment of experiments) {
          let questionIds: string[] = [];
          if (lab.subject === 'DBMS') {
            await query(
              'UPDATE lab_experiments SET description=$2 WHERE id=$1',
              [
                experiment.id,
                'Practice SQL in the query editor, then complete the experiment assessment.',
              ],
            );
            await query('UPDATE labs SET description=$2 WHERE id=$1', [
              lab.id,
              'SQL queries, example datasets, result tables, and experiment assessments.',
            ]);
            const examples = labSqlExamples(experiment.sortOrder === 1);
            for (const [index, problem] of examples.entries()) {
              const [old] = await query<{
                id: string;
                sqlQuestionId: string | null;
              }>(
                `SELECT id,"sqlQuestionId" FROM lab_experiment_problems WHERE lab_experiment_id=$1 AND ((kind='sql' AND "sqlProblem"->>'title'=$2) OR (kind='project' AND $3::int=0)) ORDER BY "createdAt" LIMIT 1`,
                [experiment.id, problem.title, index],
              );
              if (old?.sqlQuestionId) {
                questionIds.push(old.sqlQuestionId);
                continue;
              }
              const [question] = await query(
                `INSERT INTO questions(question,title,topic,subtopic,difficulty,marks,"questionType",language,status,"supportedLanguages","starterCode",metadata,created_by_id) VALUES($1::text,$1::varchar,'DBMS','SQL lab','medium',$2,'coding','sql','approved',ARRAY['sql'],$3::jsonb,$4::jsonb,$5) RETURNING id`,
                [
                  problem.title,
                  index === 0 ? 10 : 15,
                  JSON.stringify([
                    { language: 'sql', code: problem.starterCode },
                  ]),
                  JSON.stringify({ sqlProblem: problem }),
                  admin?.id || null,
                ],
              );
              if (old)
                await query(
                  `UPDATE lab_experiment_problems SET kind='sql',"projectTemplate"=NULL,"sqlProblem"=$2::jsonb,"sqlQuestionId"=$3,"maxScore"=$4 WHERE id=$1`,
                  [
                    old.id,
                    JSON.stringify(problem),
                    question.id,
                    index === 0 ? 10 : 15,
                  ],
                );
              else
                await query(
                  `INSERT INTO lab_experiment_problems(lab_experiment_id,kind,"sqlProblem","sqlQuestionId","maxScore","sortOrder",difficulty) VALUES($1,'sql',$2::jsonb,$3,$4,$5,'Medium')`,
                  [
                    experiment.id,
                    JSON.stringify(problem),
                    question.id,
                    index === 0 ? 10 : 15,
                    index,
                  ],
                );
              questionIds.push(question.id);
              sqlPractice++;
            }
          } else {
            const definitions =
              lab.subject === 'DSA'
                ? [
                    {
                      question:
                        'Which structure supports O(1) access by index?',
                      options: [
                        'Array',
                        'Linked list',
                        'Binary search tree',
                        'Queue',
                      ],
                      correctAnswer: 0,
                    },
                    {
                      question:
                        'For two pointers on an ascending array, if the pair sum is too small, which pointer usually moves?',
                      options: [
                        'Left pointer moves right',
                        'Right pointer moves left',
                        'Both move left',
                        'Stop immediately',
                      ],
                      correctAnswer: 0,
                    },
                  ]
                : [
                    {
                      question:
                        'Which HTTP status indicates that a new task was created?',
                      options: ['201', '400', '404', '500'],
                      correctAnswer: 0,
                    },
                    {
                      question:
                        'Where should user input be validated for an Express endpoint?',
                      options: [
                        'On the server, even if the client validates',
                        'Only in the React form',
                        'Only in CSS',
                        'Never validate',
                      ],
                      correctAnswer: 0,
                    },
                  ];
            for (const [index, item] of definitions.entries()) {
              const key = `local-lab-assessment:${experiment.id}:${index}`;
              const [existing] = await query(
                `SELECT id FROM questions WHERE metadata->>'labSeedKey'=$1`,
                [key],
              );
              if (existing) {
                questionIds.push(existing.id);
                continue;
              }
              const [question] = await query(
                `INSERT INTO questions(question,options,"correctAnswer",topic,subtopic,difficulty,marks,"questionType",language,status,metadata,created_by_id) VALUES($1,$2::text[],$3,$4,'Experiment knowledge check','easy',1,'single_choice','general','approved',$5::jsonb,$6) RETURNING id`,
                [
                  item.question,
                  item.options,
                  item.correctAnswer,
                  lab.subject,
                  JSON.stringify({ labSeedKey: key }),
                  admin?.id || null,
                ],
              );
              questionIds.push(question.id);
            }
          }
          const code = `LOCAL-LAB-${experiment.id.slice(0, 8).toUpperCase()}`;
          const [existing] = await query(
            'SELECT id FROM assessments WHERE code=$1',
            [code],
          );
          if (existing) continue;
          const sections = [
            {
              title: experiment.title,
              description: 'Experiment assessment',
              order: 0,
              timeLimit: 0,
              questions: questionIds.map((questionId, index) => ({
                questionId,
                marks: index === 0 ? 7 : 13,
                negativeMarks: 0,
                order: index,
              })),
            },
          ];
          await query(
            `INSERT INTO assessments(title,code,description,type,category,"durationMinutes","totalMarks","passingMarks","negativeMarking",questions,sections,"allowedAttempts",mode,proctoring,status,"labExperimentId","labMaxScore",created_by_id,"shuffleQuestions","shuffleOptions") VALUES($1,$2,$3,$4,'exam',30,20,8,false,$5::text[],$6::jsonb,2,'non_proctored',$7::jsonb,'published',$8,30,$9,false,false)`,
            [
              `${experiment.title} — Assessment`,
              code,
              'Complete both questions. Question marks: 7 and 13. Assessment contributes 30 marks to this experiment.',
              lab.subject === 'DBMS' ? 'coding' : 'mcq',
              questionIds,
              JSON.stringify(sections),
              JSON.stringify({
                mode: 'non_proctored',
                useCamera: false,
                enforceFullscreen: false,
                blockCopyPaste: false,
                detectTabSwitch: false,
              }),
              experiment.id,
              admin?.id || null,
            ],
          );
          assessments++;
        }
      }
      console.log(
        JSON.stringify(
          {
            student: 'student.test@codeskill.local',
            sqlPracticeQuestionsAdded: sqlPractice,
            experimentAssessmentsAdded: assessments,
            questionsPerAssessment: 2,
            practiceMarks: [10, 15],
            assessmentQuestionMarks: [7, 13],
            assessmentLabContribution: 30,
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
    error instanceof Error ? error.message : 'Local lab upgrade failed',
  );
  process.exitCode = 1;
});
