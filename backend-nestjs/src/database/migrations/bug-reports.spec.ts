import { applyBugReportsMigration } from './bug-reports';

describe('bug reports migration', () => {
  it('creates the issue, image, comment, and activity tables idempotently', async () => {
    const query = jest.fn().mockResolvedValue(undefined);

    await applyBugReportsMigration({ query });

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    expect(statements.filter((sql) => sql.includes('CREATE TABLE IF NOT EXISTS'))).toHaveLength(4);
    expect(statements.join('\n')).toContain("'new', 'in_process', 'fixed'");
    expect(statements.join('\n')).toContain("'low', 'medium', 'high', 'critical'");
    expect(statements.join('\n')).toContain('ON DELETE CASCADE');
    expect(statements.filter((sql) => sql.includes('CREATE INDEX IF NOT EXISTS'))).toHaveLength(4);
  });
});
