export function canonicalEditorLanguage(value: string): string {
  const language = value.trim().toLowerCase();
  return (
    (
      {
        "c++": "cpp",
        python3: "python",
        py: "python",
        js: "javascript",
        node: "javascript",
        ts: "typescript",
      } as Record<string, string>
    )[language] || language
  );
}

export function questionStarterCode(
  source: string | Array<{ language: string; code: string }> | Record<string, string> | undefined,
  language: string,
  questionLanguage?: string,
): string | undefined {
  if (typeof source === "string") {
    return !questionLanguage || canonicalEditorLanguage(questionLanguage) === canonicalEditorLanguage(language)
      ? source
      : undefined;
  }
  if (Array.isArray(source)) {
    return source.find((entry) => canonicalEditorLanguage(entry.language) === canonicalEditorLanguage(language))?.code;
  }
  return Object.entries(source ?? {}).find(
    ([key, code]) => canonicalEditorLanguage(key) === canonicalEditorLanguage(language) && typeof code === "string",
  )?.[1];
}

/** Imported Python templates use python3; Monaco uses python. */
export function editorStarterCode(value: Record<string, unknown> | undefined, language: string): string | undefined {
  const entry = Object.entries(value ?? {}).find(
    ([key, code]) => canonicalEditorLanguage(key) === canonicalEditorLanguage(language) && typeof code === "string",
  );
  return entry?.[1] as string | undefined;
}

export function editorLanguages<T extends { id: string }>(
  choices: T[],
  supported?: string[],
  runtimes: Array<{ language: string; enabled: boolean }> = [],
): T[] {
  return choices.filter(
    (choice) =>
      (!supported?.length ||
        supported.some(
          (value) => canonicalEditorLanguage(value) === choice.id,
        )) &&
      (!runtimes.length ||
        runtimes.some(
          (runtime) =>
            canonicalEditorLanguage(runtime.language) === choice.id &&
            runtime.enabled,
        )),
  );
}
