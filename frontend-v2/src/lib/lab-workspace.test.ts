import {
  labDefaultLanguage,
  labLanguages,
  labRunRequest,
  labStarterCode,
  type LabWorkspaceProblem,
} from "./lab-workspace";

const problem: LabWorkspaceProblem = {
  id: "link",
  problemMetadataId: "problem",
  title: "Add",
  maxScore: 5,
  difficulty: "Easy",
  statement: { samples: [{ input: "1 2", output: "3" }] },
  config: {
    supportedLanguages: ["c++", "python3"],
    defaultLanguage: "python3",
    starterCode: { "c++": "int main() {}", python3: "print(3)" },
    timeLimit: 2000,
    memoryLimit: 256,
  },
};

it("uses supported languages and canonical starter-code aliases", () => {
  expect(labLanguages(problem).map((choice) => choice.id)).toEqual([
    "cpp",
    "python",
  ]);
  expect(labDefaultLanguage(problem)).toBe("python");
  expect(labStarterCode(problem, "cpp")).toBe("int main() {}");
  expect(
    labLanguages(problem, [
      { language: "python", enabled: true },
      { language: "cpp", enabled: false },
    ]).map((choice) => choice.id),
  ).toEqual(["python"]);
});

it("sends only accepted execution settings and the expected sample-test schema", () => {
  const request = labRunRequest(
    {
      ...problem,
      config: {
        ...problem.config,
        referenceSolution: { cpp: "secret" },
        metadata_id: "private",
      } as LabWorkspaceProblem["config"],
    },
    "code",
    "c++",
  );
  expect(request.language).toBe("cpp");
  expect(request.testCases).toEqual([{ id: 1, input: "1 2", expected: "3" }]);
  expect(Object.keys(request.config)).toEqual([
    "timeLimit",
    "memoryLimit",
    "executionMode",
    "functionSignature",
    "exactOutput",
  ]);
  expect(JSON.stringify(request)).not.toContain("secret");
});

it("does not invent empty tests when no examples were authored", () => {
  expect(() =>
    labRunRequest({ ...problem, statement: { samples: [] } }, "code", "cpp"),
  ).toThrow("No sample tests");
});
