import { publicProblemRunCases } from "@/lib/problem-run-cases";

it("makes imported examples runnable when all additional judge tests are hidden", () => {
  expect(publicProblemRunCases({
    statement: { samples: [{ input: "4\n8 10 12 14", output: "12" }] },
    testCases: { cases: [{ input: "private", output: "secret", isHidden: true }] },
  })).toEqual([{ id: 1, input: "4\n8 10 12 14", expected: "12" }]);
});

it("keeps public tests, deduplicates examples, and supports expectedOutput", () => {
  expect(publicProblemRunCases({
    statement: { samples: [{ input: "1", output: "2" }] },
    testCases: { cases: [
      { input: "1", output: "2", isHidden: false },
      { input: "3", expectedOutput: "6", isHidden: false },
      [], null, {},
    ] },
  })).toEqual([{ id: 1, input: "1", expected: "2" }, { id: 2, input: "3", expected: "6" }]);
});

it("handles empty and missing test data without inventing cases", () => {
  expect(publicProblemRunCases(null)).toEqual([]);
  expect(publicProblemRunCases({ testCases: { cases: [[], []] } })).toEqual([]);
});
