# Labs pilot access

Labs is available only to the student account `vk@student.in` and accounts already authorized by the existing Labs admin guard (`isAdmin`, or roles `admin`, `super_admin`, `student_admin`, `assessment_admin`). Teachers/faculty/instructors and other students do not receive access in this rollout. Existing section enrollment and ownership checks still apply; access does not enroll a student in a lab or grant administrator privileges.

The backend returns `user.features.labs` on login, refresh, profile updates and `/api/auth/me`. Navigation and route layouts use that capability. The backend independently enforces the policy on student/admin/teacher Labs routes, project routes and experiment assessments. Regular practice problems and regular assessments are unaffected.

No schema migration is required. The existing `users.profile` JSONB object holds an optional, server-managed `labsAccessDisabled` boolean. Students cannot change it through the profile API. The pilot is enabled when the key is absent or `false`; `true` revokes pilot access. Admin access is preserved. The policy uses the authenticated account, never the password or client-supplied capability.

## Disable the pilot in a production database later

Deploy the application changes first. Run these commands from `backend-nestjs/` on the backend host, with the intended production database environment loaded. The CLI reads the same `DATABASE_URL` or `DATABASE_HOST/PORT/USER/PASSWORD/NAME/SSL` configuration as the existing migration tools and loads `.env` from the current directory. Exported variables take precedence. For remote databases use verified TLS (`sslmode=verify-full` in `DATABASE_URL`, or `DATABASE_SSL=true` with individual connection settings) and the required trusted CA. Do not put database credentials in shell arguments or Git.

Preview (does not update any row):

```bash
NODE_ENV=production node dist/database/manage-labs-access.js --disable
```

Check the database name in the output, then save the change:

```bash
NODE_ENV=production node dist/database/manage-labs-access.js --disable --apply
```

Restore access for the same pilot student:

```bash
NODE_ENV=production node dist/database/manage-labs-access.js --restore
NODE_ENV=production node dist/database/manage-labs-access.js --restore --apply
```

When running from source, the equivalent command is `npm run labs:access -- --disable` (append `--apply` to save). Use `--restore` to reverse it.

The script locks and changes only the existing pilot student's row in one transaction. It is repeatable, preserves other profile keys, and does not change passwords, roles, enrollments, submissions, other users, schema or infrastructure. A missing/ambiguous account or a nonstudent account causes an error without creating or promoting an account. Logs contain no credentials.

Every authenticated API request reloads the account, so revocation takes effect on the next Labs/project/experiment-assessment request, including sessions signed in before the change. Refresh the browser to update visible navigation. Existing project preview links/runtimes retain their normal expiry; this script does not stop containers or delete student files. This switch does not turn Labs off for administrators or remove the pilot restriction for other students.

After deployment verify that the pilot and an admin can open Labs, another student and a teacher cannot see Labs, and direct `/api/labs`, `/api/teacher/labs`, `/api/projects` and lab-assessment requests from denied accounts return `403`. Existing login credentials are unchanged.
