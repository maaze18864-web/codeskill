import { SqlProblem, validateSqlProblem } from '../sql/sql-problem';
const schemaSql =
  'CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT, department_id INTEGER, credits INTEGER);';
const publicSeed =
  "INSERT INTO departments VALUES (1,'Computing'),(2,'Electronics'),(3,'Mathematics');\nINSERT INTO students VALUES (1,'Ada',1,24),(2,'Grace',1,30),(3,'Linus',2,22),(4,'Ken',2,18),(5,'Edsger',3,16);";
const hiddenSeed =
  "INSERT INTO departments VALUES (1,'Computing'),(2,'Electronics'),(3,'Mathematics');\nINSERT INTO students VALUES (1,'HiddenAda',1,8),(2,'HiddenGrace',2,25),(3,'HiddenLinus',2,26);";
export function labSqlExamples(joins: boolean): SqlProblem[] {
  const definitions = joins
    ? [
        {
          title: 'Student department report',
          description:
            'Join students to departments. Return name, department (the department name), and credits for students with at least 20 credits. Sort by student name.',
          columns: ['name', 'department', 'credits'],
          rows: [
            ['Ada', 'Computing', 24],
            ['Grace', 'Computing', 30],
            ['Linus', 'Electronics', 22],
          ],
          hidden: [
            ['HiddenGrace', 'Electronics', 25],
            ['HiddenLinus', 'Electronics', 26],
          ],
        },
        {
          title: 'Departments including empty departments',
          description:
            'Use a LEFT JOIN to return department and student_count for every department, including departments without students. Sort by department name.',
          columns: ['department', 'student_count'],
          rows: [
            ['Computing', 2],
            ['Electronics', 2],
            ['Mathematics', 1],
          ],
          hidden: [
            ['Computing', 1],
            ['Electronics', 2],
            ['Mathematics', 0],
          ],
        },
      ]
    : [
        {
          title: 'Department credit totals',
          description:
            'Group students by department_id. Return department_id and total_credits for departments with at least 40 total credits. Sort by department_id.',
          columns: ['department_id', 'total_credits'],
          rows: [
            [1, 54],
            [2, 40],
          ],
          hidden: [[2, 51]],
        },
        {
          title: 'Count students above the credit threshold',
          description:
            'Return a single column qualifying_students containing the number of students with at least 20 credits.',
          columns: ['qualifying_students'],
          rows: [[3]],
          hidden: [[2]],
        },
      ];
  return definitions.map((definition) =>
    validateSqlProblem({
      title: definition.title,
      description: definition.description,
      schemaSql,
      starterCode:
        '-- Complete the SELECT query below.\nSELECT * FROM students WHERE 0;\n',
      orderMatters: true,
      datasets: [
        {
          seedSql: publicSeed,
          isHidden: false,
          expected: { columns: definition.columns, rows: definition.rows },
        },
        {
          seedSql: hiddenSeed,
          isHidden: true,
          expected: { columns: definition.columns, rows: definition.hidden },
        },
      ],
    }),
  );
}
