import { SqlEngineService } from './sql-engine.service';
import { publicSqlProblem, SqlProblem } from './sql-problem';
const problem: SqlProblem = {
  title: 'Names',
  description: 'List names sorted by name.',
  schemaSql: 'CREATE TABLE students(name TEXT);',
  starterCode: 'SELECT name FROM students ORDER BY name;',
  orderMatters: true,
  datasets: [
    {
      seedSql: "INSERT INTO students VALUES ('Ada');",
      expected: { columns: ['name'], rows: [['Ada']] },
      isHidden: false,
    },
    {
      seedSql: "INSERT INTO students VALUES ('HIDDEN_VALUE');",
      expected: { columns: ['name'], rows: [['HIDDEN_VALUE']] },
      isHidden: true,
    },
  ],
};
describe('Isolated SQL evaluation', () => {
  jest.setTimeout(15000);
  it('runs public samples and evaluates hidden datasets without exposing their values', async () => {
    const engine = new SqlEngineService();
    const run = await engine.evaluate(
      problem,
      problem.starterCode,
      false,
      'run',
    );
    expect(run.totalCount).toBe(1);
    expect(run.results[0].rows).toEqual([['Ada']]);
    const submit = await engine.evaluate(
      problem,
      problem.starterCode,
      true,
      'submit',
    );
    expect(submit.passedCount).toBe(2);
    expect(JSON.stringify(submit)).not.toContain('HIDDEN_VALUE');
    expect(publicSqlProblem(problem).samples).toHaveLength(1);
  });
  it('preserves duplicates and handles unordered rows only when configured', async () => {
    const engine = new SqlEngineService();
    const input: SqlProblem = {
      ...problem,
      orderMatters: false,
      datasets: [
        {
          ...problem.datasets[0],
          seedSql: "INSERT INTO students VALUES ('B'),('A'),('A');",
          expected: { columns: ['name'], rows: [['A'], ['A'], ['B']] },
        },
      ],
    };
    expect(
      (
        await engine.evaluate(
          input,
          'SELECT name FROM students ORDER BY name DESC',
          true,
          'order',
        )
      ).passedCount,
    ).toBe(1);
    expect(
      (
        await engine.evaluate(
          input,
          'SELECT DISTINCT name FROM students',
          true,
          'duplicates',
        )
      ).passedCount,
    ).toBe(0);
  });
  it('rejects writes, multiple statements, host-file functions and extension loading', async () => {
    const engine = new SqlEngineService();
    for (const query of [
      'DELETE FROM students',
      "SELECT 1; ATTACH DATABASE '/tmp/codeskill-escape' AS x",
      "SELECT readfile('/etc/passwd')",
      "SELECT load_extension('/tmp/code')",
      'PRAGMA query_only=OFF',
    ])
      expect(
        (await engine.evaluate(problem, query, true, query)).passedCount,
      ).toBe(0);
    expect(
      (await engine.evaluate(problem, problem.starterCode, true, 'still-clean'))
        .passedCount,
    ).toBe(2);
  });
  it('terminates unbounded queries and releases admission for the next request', async () => {
    const engine = new SqlEngineService();
    const heavy =
      'WITH RECURSIVE x(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM x) SELECT SUM(n) FROM x';
    const result = await engine.evaluate(problem, heavy, false, 'timeout');
    expect(result.passedCount).toBe(0);
    expect(
      (await engine.evaluate(problem, problem.starterCode, false, 'timeout'))
        .passedCount,
    ).toBe(1);
  });
});
