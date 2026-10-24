import {
  canonicalEditorLanguage,
  editorLanguages,
  editorStarterCode,
} from "./editor-languages";
import { publicProblemRunCases } from "./problem-run-cases";

export const LAB_LANGUAGES = [
  { id: "c", name: "C", file: "Main.c" },
  { id: "cpp", name: "C++", file: "Main.cpp" },
  { id: "java", name: "Java", file: "Main.java" },
  { id: "python", name: "Python", file: "main.py" },
  { id: "javascript", name: "JavaScript", file: "main.js" },
  { id: "typescript", name: "TypeScript", file: "main.ts" },
];

export interface LabWorkspaceProblem {
  id: string;
  title: string;
  maxScore: number;
  difficulty: string;
  problemMetadataId?: string;
  kind?: "coding" | "project" | "sql";
  sql?: import("./sql-workspace").SqlPublicProblem;
  project?: {
    instructions: string;
    frontendStack?: string;
    backendStack?: string;
    fileCount: number;
  };
  statement?: {
    description?: string;
    inputFormat?: string;
    outputFormat?: string;
    constraints?: string;
    samples?: Array<{ input?: string; output?: string; explanation?: string }>;
  };
  config?: {
    supportedLanguages?: string[];
    defaultLanguage?: string;
    starterCode?: Record<string, string>;
    timeLimit?: number;
    memoryLimit?: number;
    executionMode?: string;
    functionSignature?: unknown;
    exactOutput?: boolean;
  };
  progress?: { status?: string; score?: number; lastCode?: string } | null;
}

export function labLanguages(
  problem: LabWorkspaceProblem | null,
  runtimes: Array<{ language: string; enabled: boolean }> = [],
) {
  return editorLanguages(
    LAB_LANGUAGES,
    problem?.config?.supportedLanguages,
    runtimes,
  );
}

export function labDefaultLanguage(problem: LabWorkspaceProblem) {
  const supported = labLanguages(problem);
  const preferred = canonicalEditorLanguage(
    problem.config?.defaultLanguage || "",
  );
  return (
    supported.find((choice) => choice.id === preferred)?.id ||
    supported[0]?.id ||
    "c"
  );
}

export function labStarterCode(problem: LabWorkspaceProblem, language: string) {
  return (
    editorStarterCode(problem.config?.starterCode, language) ??
    (language === "python"
      ? "# Write your solution here.\n"
      : "// Write your solution here.\n")
  );
}

export function labRunRequest(
  problem: LabWorkspaceProblem,
  code: string,
  language: string,
) {
  const testCases = publicProblemRunCases(problem);
  if (!testCases.length)
    throw new Error(
      "No sample tests are configured for this problem. Ask your instructor to add examples.",
    );
  const config = problem.config;
  return {
    code,
    language: canonicalEditorLanguage(language),
    testCases,
    // The run API accepts only execution settings, not the full stored config.
    config: {
      timeLimit: config?.timeLimit,
      memoryLimit: config?.memoryLimit,
      executionMode: config?.executionMode,
      functionSignature: config?.functionSignature,
      exactOutput: config?.exactOutput,
    },
  };
}
