import { applyProblemConfigDefaultLanguageMigration } from './problem-config-default-language';

it('adds the nullable language preference column without changing problem data', async () => {
  const query = jest.fn().mockResolvedValue(undefined);

  await applyProblemConfigDefaultLanguageMigration({ query });

  expect(query).toHaveBeenCalledWith(
    'ALTER TABLE "problem_configs" ADD COLUMN IF NOT EXISTS "defaultLanguage" varchar(50)',
  );
});
