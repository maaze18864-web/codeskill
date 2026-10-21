import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CreateQuestion from "@/app/admin/questions/create/page";
import EditQuestion from "@/app/admin/questions/[id]/edit/page";
import { useQuestionStore } from "@/app/admin/questions/create/_store/useQuestionStore";
import { adminQuestionsAPI, adminProblemsAPI } from "@/config/api";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ id: "question-1" }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/config/api", () => ({
  adminQuestionsAPI: { create: jest.fn(), getById: jest.fn(), update: jest.fn() },
  adminProblemsAPI: { getById: jest.fn(), update: jest.fn() },
}));
jest.mock("@monaco-editor/react", () => ({ __esModule: true, default: () => <div /> }));

const create = jest.mocked(adminQuestionsAPI.create);
const update = jest.mocked(adminQuestionsAPI.update);
const getById = jest.mocked(adminQuestionsAPI.getById);
const existing = {
  id: "question-1", title: "Saved title", question: "Legacy title", slug: "saved-title", questionType: "DSA", status: "approved",
  difficulty: "easy", supportedLanguages: ["cpp"], starterCode: { cpp: "int main() {}" },
  testCases: [{ id: "case-1", input: "1", output: "2", isHidden: true, weight: 1 }],
  metadata: { categories: ["Arrays"], contestOnly: true },
};

beforeEach(() => {
  jest.clearAllMocks();
  useQuestionStore.getState().resetStore();
  create.mockResolvedValue({} as Awaited<ReturnType<typeof adminQuestionsAPI.create>>);
  update.mockResolvedValue({} as Awaited<ReturnType<typeof adminQuestionsAPI.update>>);
  getById.mockResolvedValue({ data: existing } as Awaited<ReturnType<typeof adminQuestionsAPI.getById>>);
  HTMLElement.prototype.scrollIntoView = jest.fn();
  window.scrollTo = jest.fn();
  global.IntersectionObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn(), unobserve: jest.fn() })) as unknown as typeof IntersectionObserver;
});

it.each(["Draft", "Published", "Private"] as const)("persists explicit %s visibility and canonical details when creating", async visibility => {
  act(() => {
    const store = useQuestionStore.getState();
    store.updateMetadata({ title: "New Problem", slug: "new-problem", visibility });
    store.updatePublishing({ contestOnly: true });
    store.updateLanguages({ supported: ["cpp"] });
    store.setStarterCode("cpp", "int main() {}");
    store.addTestCase();
    store.updateTestCase(useQuestionStore.getState().testCases[0].id, { input: "1", output: "2" });
  });
  render(<CreateQuestion />);
  fireEvent.click(screen.getByRole("button", { name: "Publish to Question Bank" }));
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
    title: "New Problem", question: "New Problem", slug: "new-problem", visibility, contestOnly: true,
    supportedLanguages: ["cpp"], starterCode: [{ language: "cpp", code: "int main() {}" }],
    testCases: [expect.objectContaining({ input: "1", output: "2", expectedOutput: "2" })],
  })));
});

it("keeps Code Output's language, snippet, and expected-output request shape", async () => {
  act(() => {
    useQuestionStore.getState().updateMetadata({ title: "Output", slug: "output", questionType: "CODE_OUTPUT", visibility: "Published" });
    useQuestionStore.getState().updateCodeOutput({ language: "python3", code: "print(42)", expectedOutput: "42" });
  });
  render(<CreateQuestion />);
  fireEvent.click(screen.getByRole("button", { name: "Publish to Question Bank" }));
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
    title: "Output", slug: "output", visibility: "Published", contestOnly: false,
    language: "python3", codeSnippet: "print(42)", expectedOutput: "42",
  })));
});

it.each(["approved", "active", "published"])("restores legacy %s without explicit publication as Draft", async status => {
  getById.mockResolvedValueOnce({ data: { ...existing, status } } as Awaited<ReturnType<typeof adminQuestionsAPI.getById>>);
  render(<EditQuestion />);
  await screen.findByDisplayValue("Saved title");
  expect(useQuestionStore.getState().metadata.visibility).toBe("Draft");
  expect(useQuestionStore.getState().publishing).toMatchObject({ publishImmediately: false, saveAsDraft: true, contestOnly: true });
  fireEvent.click(screen.getByRole("button", { name: "Update Question" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("question-1", expect.objectContaining({
    title: "Saved title", question: "Saved title", slug: "saved-title", visibility: "Draft", status: "draft", contestOnly: true,
    supportedLanguages: ["cpp"], starterCode: [{ language: "cpp", code: "int main() {}" }],
    testCases: [expect.objectContaining({ id: "case-1", input: "1", output: "2", expectedOutput: "2", isHidden: true, weight: 1 })],
  })));
  expect(adminProblemsAPI.update).not.toHaveBeenCalled();
});

it.each(["Public", "Published"])("restores explicit metadata %s publication and allows saving without changing it", async visibility => {
  getById.mockResolvedValueOnce({ data: { ...existing, metadata: { ...existing.metadata, visibility } } } as Awaited<ReturnType<typeof adminQuestionsAPI.getById>>);
  render(<EditQuestion />);
  await screen.findByDisplayValue("Saved title");
  expect(useQuestionStore.getState().metadata.visibility).toBe("Published");
  expect(useQuestionStore.getState().publishing.publishImmediately).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Update Question" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("question-1", expect.objectContaining({ visibility: "Published", status: "approved" })));
});

it("establishes public visibility only after the administrator selects Publish Immediately", async () => {
  render(<EditQuestion />);
  await screen.findByDisplayValue("Saved title");
  expect(useQuestionStore.getState().metadata.visibility).toBe("Draft");
  fireEvent.click(screen.getByRole("button", { name: /Publish Immediately Go live right now/ }));
  fireEvent.click(screen.getByRole("button", { name: "Update Question" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("question-1", expect.objectContaining({ visibility: "Published", status: "approved", slug: "saved-title" })));
});

it("preserves explicit private visibility despite stale Publish Immediately flags", async () => {
  getById.mockResolvedValueOnce({ data: { ...existing, visibility: "Published", contestOnly: false } } as Awaited<ReturnType<typeof adminQuestionsAPI.getById>>);
  render(<EditQuestion />);
  await screen.findByDisplayValue("Saved title");
  act(() => useQuestionStore.getState().updateMetadata({ visibility: "Private" }));
  expect(useQuestionStore.getState().publishing.publishImmediately).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Update Question" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("question-1", expect.objectContaining({ visibility: "Private", status: "draft", contestOnly: false })));
});

it("saves a hidden imported test as public without dropping its contents or editorial", async () => {
  getById.mockResolvedValueOnce({ data: { ...existing,
    metadata: { ...existing.metadata, visibility: "Published", solutionExplanation: "Greedy on bits." },
    referenceSolutions: [{ language: "cpp", sourceCode: "int main() {}" }],
  } } as Awaited<ReturnType<typeof adminQuestionsAPI.getById>>);
  render(<EditQuestion />);
  await screen.findByLabelText("Test case 1 input");
  fireEvent.click(screen.getByRole("button", { name: "Hidden", exact: true }));
  expect(screen.getByLabelText("Test case 1 expected output")).toHaveValue("2");
  fireEvent.click(screen.getByRole("button", { name: "Update Question" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith("question-1", expect.objectContaining({
    testCases: [expect.objectContaining({ input: "1", expectedOutput: "2", isHidden: false })],
    referenceSolutions: [{ language: "cpp", sourceCode: "int main() {}" }],
    explanation: "Greedy on bits.",
  })));
});
