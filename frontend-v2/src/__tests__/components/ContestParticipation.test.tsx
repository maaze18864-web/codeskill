import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Page from "@/app/contests/[id]/attempt/page";
import api from "@/config/api";
import { useAntiCheatMaster } from "@/hooks/anti-cheat/useAntiCheatMaster";
const replace = jest.fn(); const router = { replace };
const mockAuth = { user: { id: "student-id", name: "Real Candidate", username: "candidate" }, loading: false };
jest.mock("next/navigation", () => ({ useParams: () => ({ id: "contest-id" }), useRouter: () => router }));
jest.mock("@/context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("@/config/api", () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn() } }));
jest.mock("@/hooks/anti-cheat/useAntiCheatMaster", () => ({ useAntiCheatMaster: jest.fn() }));
jest.mock("@/components/problems/ProblemWorkspace", () => function MockProblemWorkspace({ embedded }: { embedded?: boolean }) { return <div>Existing problem editor {embedded ? "embedded" : "standalone"}</div>; });
jest.mock("@/app/contests/[id]/attempt/_components/ContestStartGate", () => ({ ContestStartGate: ({ onAccept }: { onAccept: () => void }) => <button onClick={onAccept}>Start live contest</button> }));
jest.mock("@/app/contests/[id]/attempt/_components/AntiCheatWarningDialog", () => ({ AntiCheatWarningDialog: () => null }));
jest.mock("@/app/contests/[id]/attempt/_components/WatermarkOverlay", () => ({ WatermarkOverlay: () => null }));
const get = jest.mocked(api.get); const post = jest.mocked(api.post); const proctor = jest.mocked(useAntiCheatMaster);
const context = { contest: { id: "contest-id", slug: "real-contest", title: "Live Contest", startTime: new Date(Date.now() - 60000).toISOString(), endTime: new Date(Date.now() + 600000).toISOString() }, sessionId: "server-session", startedAt: new Date(Date.now() - 12000).toISOString(), problems: [{ id: "problem-id", slug: "published-problem", title: "Published problem" }], antiCheatConfig: { enableFullscreen: true, warningLimit: 3 } };
beforeEach(() => { jest.clearAllMocks(); get.mockResolvedValue({ data: { contest: context.contest, antiCheatConfig: context.antiCheatConfig } }); post.mockImplementation(async url => ({ data: String(url).endsWith("/start") ? context : { success: true } })); proctor.mockReturnValue({ warnings: 0, warningLimit: 3, lastViolation: null, isWarningDialogOpen: false, setIsWarningDialogOpen: jest.fn(), isFullscreen: true, requestFullscreen: jest.fn(), hasRequestedFullscreen: true }); });
it("uses real identity, session, canonical problems, metadata and existing editor", async () => {
  render(<Page />); const startButton = await screen.findByRole("button", { name: "Start live contest" }); await act(async () => { fireEvent.click(startButton); });
  expect(screen.getByRole("heading", { name: "Live Contest" })).toBeInTheDocument(); expect(screen.getByText(/Real Candidate/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "1. Published problem" })).toBeInTheDocument(); expect(screen.getByText("Existing problem editor embedded")).toBeInTheDocument();
  expect(post).toHaveBeenCalledWith("/contests/contest-id/start", {}, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(proctor).toHaveBeenLastCalledWith("contest-id", "student-id", "server-session", context.antiCheatConfig, expect.any(Function), true);
});
it("finalizes the persisted session and opens its actual contest rankings", async () => {
  render(<Page />); const startButton = await screen.findByRole("button", { name: "Start live contest" }); await act(async () => { fireEvent.click(startButton); });
  fireEvent.click(screen.getByRole("button", { name: "Finish Contest" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit Now" }));
  await waitFor(() => expect(post).toHaveBeenCalledWith("/contests/contest-id/submit", { sessionId: "server-session", answers: [] }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
  expect(replace).toHaveBeenCalledWith("/contests/leaderboard?contest=real-contest");
});
it("renders MCQ contest questions and submits selected indices without exposing answers", async () => {
  const mcqContext = {
    ...context,
    problems: [{ id: "mcq-id", slug: "question-mcq-id", title: "Choice question", question: "Which option is correct?", questionType: "MCQ", options: ["First", "Second"], marks: 2 }],
  };
  post.mockImplementation(async url => ({ data: String(url).endsWith("/start") ? mcqContext : { success: true } }));
  render(<Page />);
  const startButton = await screen.findByRole("button", { name: "Start live contest" });
  await act(async () => { fireEvent.click(startButton); });
  expect(await screen.findByText("Which option is correct?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /First/ }));
  expect(screen.getByRole("button", { name: /First/ })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Finish Contest" }));
  fireEvent.click(screen.getByRole("button", { name: "Submit Now" }));
  await waitFor(() => expect(post).toHaveBeenCalledWith("/contests/contest-id/submit", {
    sessionId: "server-session",
    answers: [{ questionId: "mcq-id", selectedAnswers: [0] }],
  }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
});
it("shows API failures and allows a manual retry instead of claiming success", async () => {
  render(<Page />); const startButton = await screen.findByRole("button", { name: "Start live contest" }); await act(async () => { fireEvent.click(startButton); });
  post.mockRejectedValueOnce(new Error("Offline"));
  fireEvent.click(screen.getByRole("button", { name: "Finish Contest" })); fireEvent.click(screen.getByRole("button", { name: "Submit Now" }));
  await screen.findByRole("alert"); expect(replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Finish Contest" })); fireEvent.click(screen.getByRole("button", { name: "Submit Now" }));
  await waitFor(() => expect(replace).toHaveBeenCalled());
});
it("cleans up the session fetch when navigating away", () => {
  get.mockImplementationOnce(() => new Promise(() => {})); const { unmount } = render(<Page />);
  const signal = get.mock.calls[0][1]?.signal as AbortSignal; unmount(); expect(signal.aborted).toBe(true);
});
it("handles server access denial without mounting the editor", async () => {
  get.mockRejectedValueOnce({ response: { data: { message: "Register for this contest first" } } }); render(<Page />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Register for this contest first"); expect(screen.queryByText("Existing problem editor embedded")).toBeNull();
});
it("forces completion and disables active proctoring without duplicate requests", async () => {
  render(<Page />); const startButton = await screen.findByRole("button", { name: "Start live contest" }); await act(async () => { fireEvent.click(startButton); });
  const force = proctor.mock.calls.at(-1)![4]; await act(async () => { force(); force(); });
  expect(post.mock.calls.filter(call => String(call[0]).endsWith("/submit"))).toHaveLength(1);
  expect(screen.getByText("This contest session has ended.")).toBeInTheDocument();
});

it('auto-finalizes at the configured end time and unmounts the editor', async () => {
  jest.useFakeTimers();
  post.mockImplementation(async url => ({ data: String(url).endsWith('/start') ? { ...context, contest: { ...context.contest, endTime: new Date(Date.now() + 1000).toISOString() } } : { success: true } }));
  try {
    render(<Page />); await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start live contest' })); });
    await act(async () => jest.advanceTimersByTime(1000));
    expect(post.mock.calls.filter(call => String(call[0]).endsWith('/submit'))).toHaveLength(1);
    expect(screen.queryByText('Existing problem editor embedded')).toBeNull();
  } finally { jest.useRealTimers(); }
});

it("does not create a contest attempt before the student accepts the start gate", async () => {
  render(<Page />);
  await screen.findByRole("button", { name: "Start live contest" });
  expect(get).toHaveBeenCalledWith("/contests/contest-id/start-context", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(post).not.toHaveBeenCalled();
});
it("blocks the editor independently of dismissible warnings when fullscreen is lost", async () => {
  const { rerender } = render(<Page />);
  const startButton = await screen.findByRole("button", { name: "Start live contest" }); await act(async () => { fireEvent.click(startButton); });
  const state = proctor.mock.results.at(-1)!.value;
  proctor.mockReturnValue({ ...state, isFullscreen: false, isWarningDialogOpen: false });
  rerender(<Page />);
  expect(screen.getByText("Existing problem editor embedded").closest('[inert]')).not.toBeNull();
  proctor.mockReturnValue({ ...state, isFullscreen: true }); rerender(<Page />);
  expect(screen.getByText("Existing problem editor embedded").closest('[inert]')).toBeNull();
});
