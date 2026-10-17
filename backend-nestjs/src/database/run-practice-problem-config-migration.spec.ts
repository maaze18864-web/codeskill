jest.mock('./run-practice-submission-source', () => ({
  practiceSubmissionMigrationOptions: () => ({ type: 'postgres' }),
}));
jest.mock('typeorm', () => ({ DataSource: jest.fn() }));

import { DataSource } from 'typeorm';
import { runPracticeProblemConfigMigration } from './run-practice-problem-config-migration';

describe('targeted practice configuration migration', () => {
  let runner: Record<string, jest.Mock>;
  let source: Record<string, jest.Mock | boolean>;

  beforeEach(() => {
    runner = Object.fromEntries([
      'connect', 'startTransaction', 'query', 'commitTransaction',
      'rollbackTransaction', 'release',
    ].map((name) => [name, jest.fn().mockResolvedValue(undefined)]));
    source = {
      initialize: jest.fn().mockResolvedValue(undefined),
      isInitialized: true,
      createQueryRunner: jest.fn().mockReturnValue(runner),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    jest.mocked(DataSource).mockImplementation(() => source as unknown as DataSource);
  });

  it('applies only the nullable preference with bounded lock waits and closes its connection', async () => {
    await runPracticeProblemConfigMigration();
    const sql = runner.query.mock.calls.map(([query]) => query).join('\n');
    expect(sql).toContain("SET LOCAL lock_timeout = '5s'");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "defaultLanguage" varchar(50)');
    expect(sql).not.toMatch(/DROP|DELETE|UPDATE|submissions|assessments/i);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(source.destroy).toHaveBeenCalledTimes(1);
  });

  it('rolls back and releases resources if the schema is locked', async () => {
    runner.query.mockRejectedValueOnce(new Error('lock timeout'));
    await expect(runPracticeProblemConfigMigration()).rejects.toThrow('lock timeout');
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(source.destroy).toHaveBeenCalledTimes(1);
  });

  it('releases the runner when the database cannot begin a transaction', async () => {
    runner.startTransaction.mockRejectedValueOnce(new Error('connection lost'));
    await expect(runPracticeProblemConfigMigration()).rejects.toThrow('connection lost');
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
    expect(source.destroy).toHaveBeenCalledTimes(1);
  });
});
