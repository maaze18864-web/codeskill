# Practice problem creation and slug lookup repair

The production `problem_configs` table predates the entity's nullable
`defaultLanguage` column. TypeORM selects that column when loading a problem
by slug and writes it when an administrator creates a problem. Both operations
fail until the schema is updated.

After building the backend, run this command from `backend-nestjs/` using the
target environment's normal database configuration:

```bash
NODE_ENV=production node dist/database/run-practice-problem-config-migration.js
```

For the existing Docker deployment, run the same command inside the backend
container after deploying an image containing this runner. It adds only
`problem_configs."defaultLanguage" varchar(50)` if absent. Existing values,
reference solutions, test cases, and other tables are preserved. Lock waits
are limited to five seconds; retry during a quieter period if the lock times
out. No service restart is required after a successful schema repair.

The broader migration runner also includes this additive step for future
deployments. Use the targeted command above to repair this issue without
running unrelated migrations or enabling TypeORM schema synchronization.

Creation now commits metadata, statement, execution configuration, and tests
in one transaction. Failed writes leave no partial problem or occupied slug.
Existing partial records from earlier failed requests are preserved: inspect
and complete them through the administrator editor rather than deleting
author content automatically.

Verify that an existing published problem loads through `/api/problems/:slug`,
that a new practice draft saves and reopens with its preferred language, and
that public responses contain neither hidden tests nor reference solutions.
Rolling back application code does not require dropping the nullable column.
