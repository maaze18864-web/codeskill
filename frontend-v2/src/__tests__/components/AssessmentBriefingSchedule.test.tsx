import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Page from "@/app/assessments/[id]/page";
import { studentAssessmentsAPI } from "@/config/api";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("react", () => ({ ...jest.requireActual("react"), use: () => ({ id: "exam" }) }));
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Candidate", uid: "STU1" } }) }));
jest.mock("@/config/api", () => ({ studentAssessmentsAPI: { getOverview: jest.fn() } }));
jest.mock("@/lib/assessment-face-verification", () => ({ clearAssessmentFaceReference: jest.fn() }));

const now = new Date("2026-10-19T10:00:00Z").getTime();
const overview = (start: number, end: number, isAvailable: boolean) => ({ data: { assessment: {
  title: "Scheduled assessment", code: "EXAM", durationMinutes: 60, questionCount: 5,
  totalMarks: 10, passingMarks: 4, allowedAttempts: 1, instructions: ["Work independently."],
  proctoring: { useCamera: false }, startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(), isAvailable,
} } });

beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); jest.setSystemTime(now); });
afterEach(() => jest.useRealTimers());

it("shows a retryable server failure instead of claiming an existing assessment is missing", async () => {
  jest.mocked(studentAssessmentsAPI.getOverview)
    .mockRejectedValueOnce({ response: { status: 500 } })
    .mockResolvedValue(overview(now - 60_000, now + 60_000, true));
  render(<Page params={Promise.resolve({ id: "exam" })} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole("heading", { name: "Assessment couldn’t be loaded" })).toBeInTheDocument();
  expect(screen.queryByText("Assessment Not Found")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByText("Scheduled assessment")).toBeInTheDocument();
});

it.each([[403, "Assessment not assigned"], [404, "Assessment Not Found"]])("distinguishes HTTP %s from server failures", async (status, title) => {
  jest.mocked(studentAssessmentsAPI.getOverview).mockRejectedValue({ response: { status } });
  render(<Page params={Promise.resolve({ id: "exam" })} />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
});

it("closes the Begin button at the scheduled end without submitting an attempt", async () => {
  jest.mocked(studentAssessmentsAPI.getOverview).mockResolvedValue(overview(now - 60_000, now + 2_000, true));
  render(<Page params={Promise.resolve({ id: "exam" })} />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Begin Assessment" })).toBeEnabled();
  expect(screen.getByText("Assessment closes in")).toBeInTheDocument();

  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(screen.getByRole("button", { name: "Assessment Closed" })).toBeDisabled();
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it("refreshes server eligibility and switches from opening to closing countdown", async () => {
  jest.mocked(studentAssessmentsAPI.getOverview)
    .mockResolvedValueOnce(overview(now + 2_000, now + 60_000, false))
    .mockResolvedValue(overview(now + 2_000, now + 60_000, true));
  render(<Page params={Promise.resolve({ id: "exam" })} />);
  await act(async () => { await Promise.resolve(); });
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Not Yet Available" })).toBeDisabled();
  expect(screen.getByText("Assessment opens in")).toBeInTheDocument();

  await act(async () => { jest.advanceTimersByTime(2_000); });
  expect(studentAssessmentsAPI.getOverview).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Assessment closes in")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Begin Assessment" })).toBeEnabled();
});
