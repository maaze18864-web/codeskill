import {
  createQuestionStore,
  type QuestionState,
} from "@/app/admin/questions/create/_store/useQuestionStore";
import { getTopicCategories } from "@/lib/question-types";

interface CodeEntry {
  language: string;
  code?: string;
  sourceCode?: string;
}
type CodeMap = Record<string, string> | CodeEntry[];
interface CaseRecord {
  id?: string;
  input?: string;
  output?: string;
  expectedOutput?: string;
  isHidden?: boolean;
  explanation?: string;
  weight?: number;
}

export interface PracticeAuthoringRecord {
  id?: string;
  _id?: string;
  title?: string;
  question?: string;
  slug?: string;
  questionType?: string;
  difficulty?: string;
  visibility?: string;
  categories?: string[];
  topic?: string;
  tags?: string[];
  metadata?: { categories?: string[]; visibility?: string };
  problemStatement?: string;
  description?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string | string[];
  statement?: {
    description?: string;
    inputFormat?: string;
    outputFormat?: string;
    constraints?: string;
    samples?: CaseRecord[];
  };
  supportedLanguages?: string[];
  language?: string;
  timeLimit?: number;
  memoryLimit?: number;
  starterCode?: CodeMap;
  referenceSolutions?: CodeMap;
  referenceSolution?: CodeMap;
  functionSignature?: unknown;
  config?: {
    supportedLanguages?: string[];
    defaultLanguage?: string;
    timeLimit?: number;
    memoryLimit?: number;
    starterCode?: CodeMap;
    referenceSolution?: CodeMap;
    executionMode?: string;
    functionSignature?: unknown;
    exactOutput?: boolean;
  };
  testCases?: CaseRecord[] | { cases?: CaseRecord[] };
  examples?: CaseRecord[];
}

function codeMap(value?: CodeMap): Record<string, string> {
  if (Array.isArray(value))
    return Object.fromEntries(
      value.map((entry) => [
        entry.language,
        entry.code ?? entry.sourceCode ?? "",
      ]),
    );
  return { ...value };
}

/** Copy author-only content into a fresh draft, never into the bank's shared store. */
export function practiceDraft(
  record: PracticeAuthoringRecord,
  imported = false,
): Partial<QuestionState> {
  if (
    imported &&
    !["dsa", "coding", "algorithmic"].includes(
      String(record.questionType).toLowerCase(),
    )
  ) {
    throw new Error("Only coding questions can be imported into practice.");
  }
  const defaults = createQuestionStore().getState();
  const supported =
    record.config?.supportedLanguages ??
    record.supportedLanguages ??
    defaults.languages.supported;
  const preferred = record.config?.defaultLanguage ?? record.language ?? "";
  const visibility = String(
    record.visibility ?? record.metadata?.visibility ?? "Draft",
  ).toLowerCase();
  const rawCases = Array.isArray(record.testCases)
    ? record.testCases
    : (record.testCases?.cases ?? []);
  const testCases = rawCases.map((tc, index) => ({
    id: `case-${index}`,
    input: tc.input ?? "",
    output: tc.expectedOutput ?? tc.output ?? "",
    isHidden: tc.isHidden === true,
    explanation: tc.explanation ?? "",
    weight: tc.weight ?? 1,
  }));
  // Legacy examples become public cases, but an explicitly hidden case stays hidden.
  for (const example of record.examples ?? record.statement?.samples ?? []) {
    const existing = testCases.find(
      (tc) =>
        tc.input === (example.input ?? "") &&
        (tc.isHidden || tc.output === (example.output ?? "")),
    );
    if (existing) {
      if (!existing.isHidden && !existing.explanation)
        existing.explanation = example.explanation ?? "";
      continue;
    }
    testCases.push({
      id: `sample-${testCases.length}`,
      input: example.input ?? "",
      output: example.output ?? "",
      isHidden: false,
      explanation: example.explanation ?? "",
      weight: 1,
    });
  }
  const title = record.title ?? record.question ?? "";
  const slug =
    record.slug ||
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const constraints = record.statement?.constraints ?? record.constraints ?? "";
  const difficulties: Record<string, "Easy" | "Medium" | "Hard"> = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
  };
  return {
    metadata: {
      ...defaults.metadata,
      title,
      slug: imported ? `${slug}-practice` : slug,
      difficulty:
        difficulties[String(record.difficulty).toLowerCase()] ?? "Easy",
      categories: [...getTopicCategories(record)],
      tags: [...(record.tags ?? [])],
      visibility: imported
        ? "Draft"
        : ["published", "public"].includes(visibility)
          ? "Published"
          : visibility === "private"
            ? "Private"
            : "Draft",
      questionType: "DSA",
    },
    statement: {
      description:
        record.statement?.description ??
        record.problemStatement ??
        record.description ??
        record.question ??
        "",
      inputFormat: record.statement?.inputFormat ?? record.inputFormat ?? "",
      outputFormat: record.statement?.outputFormat ?? record.outputFormat ?? "",
      constraints: Array.isArray(constraints)
        ? constraints.join("\n")
        : constraints,
    },
    languages: {
      ...defaults.languages,
      supported: [...supported],
      default: supported.includes(preferred) ? preferred : (supported[0] ?? ""),
    },
    execution: {
      ...defaults.execution,
      timeLimit: record.config?.timeLimit ?? record.timeLimit ?? 2000,
      memoryLimit: record.config?.memoryLimit ?? record.memoryLimit ?? 256,
    },
    starterCode: codeMap(record.config?.starterCode ?? record.starterCode),
    referenceSolution: codeMap(
      record.config?.referenceSolution ??
        record.referenceSolutions ??
        record.referenceSolution,
    ),
    testCases,
  };
}

export function validatePracticeDraft(
  state: QuestionState,
  visibility: string,
): string | null {
  if (
    !state.metadata.title.trim() ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(state.metadata.slug)
  )
    return "Enter a title and a URL slug using lowercase letters, numbers, and hyphens.";
  if (!state.statement.description.trim()) return "Write a problem statement.";
  if (!state.languages.supported.length)
    return "Select at least one programming language.";
  if (
    ![state.execution.timeLimit, state.execution.memoryLimit].every(
      (value) => Number.isFinite(value) && Number.isInteger(value) && value > 0,
    )
  )
    return "Time and memory limits must be positive whole numbers.";
  if (visibility === "Published" && !state.testCases.length)
    return "Add at least one test case before publishing.";
  if (
    state.testCases.some((tc) => !Number.isInteger(tc.weight) || tc.weight < 1)
  )
    return "Test case weights must be positive whole numbers.";
  return null;
}

export function practicePayload(
  state: QuestionState,
  visibility: string,
  source?: PracticeAuthoringRecord,
) {
  return {
    metadata: {
      title: state.metadata.title.trim(),
      slug: state.metadata.slug.trim(),
      difficulty: state.metadata.difficulty,
      categories: state.metadata.categories,
      tags: state.metadata.tags,
      visibility,
    },
    languages: state.languages.supported,
    defaultLanguage: state.languages.supported.includes(state.languages.default)
      ? state.languages.default
      : state.languages.supported[0],
    execution: {
      timeLimit: state.execution.timeLimit,
      memoryLimit: state.execution.memoryLimit,
      executionMode: source?.config?.executionMode,
      functionSignature:
        source?.config?.functionSignature ?? source?.functionSignature,
      exactOutput: source?.config?.exactOutput,
    },
    statement: { ...state.statement },
    starterCode: { ...state.starterCode },
    referenceSolution: { ...state.referenceSolution },
    sampleExamples: state.testCases
      .filter((tc) => !tc.isHidden)
      .map(({ input, output, explanation }) => ({
        input,
        output,
        explanation,
      })),
    testCases: {
      cases: state.testCases.map(
        ({ input, output, isHidden, explanation, weight }) => ({
          input,
          output,
          isHidden,
          explanation,
          weight,
        }),
      ),
    },
    publishing: { visibility },
  };
}
