import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import QuestionsAdminPage from "@/app/admin/questions/page";
import { adminProblemsAPI, adminQuestionsAPI } from "@/config/api";

const mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));
jest.mock("@gsap/react", () => ({ useGSAP: () => {} }));
jest.mock("@/config/api", () => ({
  adminQuestionsAPI: { getAll: jest.fn(), getTopics: jest.fn(), getBulkUploadBatches: jest.fn(), delete: jest.fn() },
  adminProblemsAPI: { getAll: jest.fn(), delete: jest.fn() },
  adminQuestionBanksAPI: { getAll: jest.fn() },
}));

const question = { id: "bank-1", question: "Bank delete check", questionType: "DSA", difficulty: "easy", status: "approved" };
const practice = { id: "practice-1", title: "Practice delete check", slug: "practice-delete-check", difficulty: "easy", createdAt: "2026-10-19" };
const questionList = (questions = [question], totalPages = 1) => ({ data: { questions, pagination: { total: questions.length, totalPages } } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, "confirm").mockReturnValue(true);
  jest.mocked(adminQuestionsAPI.getAll).mockResolvedValue(questionList() as never);
  jest.mocked(adminQuestionsAPI.getTopics).mockResolvedValue({ data: { topics: [] } } as never);
  jest.mocked(adminQuestionsAPI.getBulkUploadBatches).mockResolvedValue({ data: { batches: [] } } as never);
  jest.mocked(adminQuestionsAPI.delete).mockResolvedValue({ data: { success: true } } as never);
  jest.mocked(adminProblemsAPI.getAll).mockResolvedValue({ data: { problems: [practice] } } as never);
  jest.mocked(adminProblemsAPI.delete).mockResolvedValue({ data: { success: true } } as never);
});
afterEach(() => jest.restoreAllMocks());

it("exposes a visible question delete action and removes the archived row after success", async () => {
  render(<QuestionsAdminPage />);
  const button = await screen.findByRole("button", { name: "Delete Bank delete check" });
  expect(button).toBeVisible();
  jest.mocked(adminQuestionsAPI.getAll).mockResolvedValue(questionList([]) as never);
  fireEvent.click(button);
  const dialog = screen.getByRole("alertdialog");
  expect(dialog).toHaveTextContent("archived");
  expect(adminQuestionsAPI.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete", exact: true }));
  await waitFor(() => expect(adminQuestionsAPI.delete).toHaveBeenCalledWith("bank-1"));
  await waitFor(() => expect(adminQuestionsAPI.getAll).toHaveBeenCalledTimes(2));
  expect(window.confirm).not.toHaveBeenCalled();
  expect(screen.queryByText("Bank delete check")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Question archived");
  expect(adminProblemsAPI.delete).not.toHaveBeenCalled();
});

it("does not delete a question when confirmation is cancelled", async () => {
  render(<QuestionsAdminPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete Bank delete check" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(adminQuestionsAPI.delete).not.toHaveBeenCalled();
  expect(screen.getByText("Bank delete check")).toBeVisible();
});

it("retains the question and permits a retry when the API rejects deletion", async () => {
  jest.mocked(adminQuestionsAPI.delete).mockRejectedValueOnce(new Error("Denied"));
  render(<QuestionsAdminPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete Bank delete check" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete this question.");
  expect(screen.getByText("Bank delete check")).toBeVisible();
  expect(screen.getByRole("button", { name: "Delete Bank delete check" })).toBeEnabled();
});

it("disables repeated question deletion while its request is pending", async () => {
  let finish!: (value: never) => void;
  jest.mocked(adminQuestionsAPI.delete).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<QuestionsAdminPage />);
  const button = await screen.findByRole("button", { name: "Delete Bank delete check" });
  jest.mocked(adminQuestionsAPI.getAll).mockResolvedValue(questionList([]) as never);
  fireEvent.click(button);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete", exact: true }));
  await waitFor(() => expect(button).toBeDisabled());
  fireEvent.click(button);
  expect(adminQuestionsAPI.delete).toHaveBeenCalledTimes(1);
  await act(async () => finish({ data: { success: true } } as never));
  await waitFor(() => expect(screen.queryByText("Bank delete check")).not.toBeInTheDocument());
});

it("deletes practice problems in the Algorithmic Challenges tab through the practice API", async () => {
  render(<QuestionsAdminPage />);
  await screen.findByText("Bank delete check");
  fireEvent.click(screen.getByRole("button", { name: /Algorithmic Challenges/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete Practice delete check" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Permanently delete");
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete", exact: true }));
  await waitFor(() => expect(adminProblemsAPI.delete).toHaveBeenCalledWith("practice-1"));
  expect(window.confirm).not.toHaveBeenCalled();
  expect(await screen.findByRole("status")).toHaveTextContent("Practice problem deleted.");
  expect(screen.queryByText("Practice delete check")).not.toBeInTheDocument();
  expect(adminQuestionsAPI.delete).not.toHaveBeenCalled();
});

it("moves back a page when the last question on a later page is deleted", async () => {
  const secondQuestion = { ...question, id: "bank-2", question: "Last page question" };
  jest.mocked(adminQuestionsAPI.getAll).mockImplementation(async params => questionList(
    params?.page === 2 ? [secondQuestion] : [question], 2,
  ) as never);
  render(<QuestionsAdminPage />);
  await screen.findByText("Bank delete check");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete Last page question" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete", exact: true }));
  await screen.findByRole("status");
  await waitFor(() => expect(adminQuestionsAPI.getAll).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
  expect(await screen.findByText("Bank delete check")).toBeVisible();
  expect(screen.queryByText("Last page question")).not.toBeInTheDocument();
});

it("uses the in-app dialog for bulk deletion and supports cancellation", async () => {
  render(<QuestionsAdminPage />);
  await screen.findByText("Bank delete check");
  fireEvent.click(screen.getByRole("button", { name: "Select", exact: true }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Bank delete check" }));
  fireEvent.click(screen.getByRole("button", { name: /Delete selected/ }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Archive 1 selected question");
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(adminQuestionsAPI.delete).not.toHaveBeenCalled();
  expect(window.confirm).not.toHaveBeenCalled();
});
