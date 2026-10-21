import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProblemTablePreview } from "@/components/landing/ProblemTablePreview";
import { problemsAPI } from "@/config/api";

jest.mock("@/config/api", () => ({ problemsAPI: { getAll: jest.fn() } }));
const getAll = jest.mocked(problemsAPI.getAll);
type Response = Awaited<ReturnType<typeof problemsAPI.getAll>>;

beforeEach(() => {
  jest.clearAllMocks();
  getAll.mockResolvedValue({ data: { data: [{ id: "coding-1", slug: "array-pair", title: "Array Pair", difficulty: "easy", stats: { acceptanceRate: 36 } }] } } as Response);
});

it("shows only problems returned by the public coding catalog", async () => {
  render(<ProblemTablePreview />);
  expect(await screen.findByRole("link", { name: "Array Pair" })).toHaveAttribute("href", "/problems/array-pair");
  expect(screen.getByText("36%")).toBeInTheDocument();
  expect(screen.queryByText("Two Sum")).not.toBeInTheDocument();
  expect(getAll).toHaveBeenCalledWith(1, 5, "", "All Topics", expect.any(AbortSignal), "All");

  fireEvent.click(screen.getByRole("button", { name: "Hard" }));
  await waitFor(() => expect(getAll).toHaveBeenLastCalledWith(1, 5, "", "All Topics", expect.any(AbortSignal), "Hard"));
});

it("keeps the table empty when the database has no published coding problems", async () => {
  getAll.mockResolvedValueOnce({ data: { data: [], total: 0 } } as Response);
  render(<ProblemTablePreview />);
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  expect(screen.queryAllByRole("link", { name: "Solve" })).toHaveLength(0);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("offers retry after a loading failure without inserting sample rows", async () => {
  getAll.mockRejectedValueOnce(new Error("Unavailable"));
  render(<ProblemTablePreview />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Problems could not be loaded");
  expect(screen.queryByText("Two Sum")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("link", { name: "Array Pair" })).toBeInTheDocument();
});

it("ignores an old response when the difficulty changes", async () => {
  let resolveOld!: (response: Response) => void;
  getAll.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  render(<ProblemTablePreview />);
  fireEvent.click(screen.getByRole("button", { name: "Hard" }));
  expect(await screen.findByRole("link", { name: "Array Pair" })).toBeInTheDocument();
  await act(async () => resolveOld({ data: { data: [{ id: "old", title: "Stale result", slug: "stale" }] } } as Response));
  expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Array Pair" })).toBeInTheDocument();
});

it("searches the database after typing instead of filtering placeholder rows", async () => {
  render(<ProblemTablePreview />);
  await screen.findByRole("link", { name: "Array Pair" });
  fireEvent.change(screen.getByRole("textbox", { name: "Search problems" }), { target: { value: "  graph  " } });
  await waitFor(() => expect(getAll).toHaveBeenLastCalledWith(1, 5, "graph", "All Topics", expect.any(AbortSignal), "All"));
});
