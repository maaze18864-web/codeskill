export interface PublicRunCase {
  id: number;
  input: string;
  expected: string;
}

/** Statement examples can be run even when all additional judge tests are hidden. */
export function publicProblemRunCases(problem: {
  statement?: { samples?: unknown };
  testCases?: { cases?: unknown };
} | null): PublicRunCase[] {
  const samples = problem?.statement?.samples;
  const tests = problem?.testCases?.cases;
  const candidates = [
    ...(Array.isArray(samples) ? samples : []),
    ...(Array.isArray(tests) ? tests : []),
  ];
  const seen = new Set<string>();
  const result: PublicRunCase[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    if (candidate.isHidden === true || candidate.isHidden === "true") continue;
    const input = typeof candidate.input === "string" ? candidate.input : "";
    const output = candidate.output ?? candidate.expectedOutput ?? candidate.expected;
    const expected = typeof output === "string" ? output : "";
    if (!input.trim() && !expected.trim()) continue;
    const key = JSON.stringify([input, expected]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ id: result.length + 1, input, expected });
  }
  return result;
}
