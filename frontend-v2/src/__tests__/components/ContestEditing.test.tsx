import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ContestForm from "@/app/admin/contests/_components/ContestForm";
import ContestList from "@/app/admin/contests/page";
import EditContest from "@/app/admin/contests/[id]/edit/page";
import { adminContestsAPI, adminProblemsAPI } from "@/config/api";
import { useParams } from "next/navigation";

const push = jest.fn();
const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }), useParams: jest.fn() }));
jest.mock("@/config/api", () => ({
  adminContestsAPI: { getById: jest.fn(), getAll: jest.fn(), update: jest.fn(), create: jest.fn(), delete: jest.fn() },
  adminProblemsAPI: { getAll: jest.fn() },
}));

const id = "00000000-0000-4000-8000-000000000001";
const original = { id, _id: id, title: "Existing Contest", slug: "existing-contest", description: "Original description", startTime: "2026-11-01T04:30:00.000Z", endTime: "2026-11-01T06:30:00.000Z", isPrivate: true, password: "access-code", isPublished: true, contestFormat: "coding" as const, problems: ["p1"] };
let saved = { ...original };

beforeEach(() => {
  jest.clearAllMocks();
  saved = { ...original };
  jest.mocked(useParams).mockReturnValue({ id });
  jest.mocked(adminProblemsAPI.getAll).mockResolvedValue({ data: { problems: [{ _id: "p1", title: "Two Sum", slug: "two-sum", difficulty: "easy", questionType: "coding" }, { _id: "p2", title: "Trees", slug: "trees", difficulty: "medium", questionType: "DSA" }, { _id: "p3", title: "Published MCQ", slug: "published-mcq", difficulty: "easy", questionType: "single_choice" }] } });
  jest.mocked(adminContestsAPI.getById).mockImplementation(async () => ({ data: { ...saved } }));
  jest.mocked(adminContestsAPI.getAll).mockImplementation(async () => ({ data: { contests: [{ ...saved }] } }));
  jest.mocked(adminContestsAPI.update).mockImplementation(async (_id, payload) => { saved = { ...saved, ...payload }; return { data: { contest: saved } }; });
  jest.mocked(adminContestsAPI.create).mockResolvedValue({ data: { success: true } });
  jest.mocked(adminContestsAPI.delete).mockResolvedValue({ data: { success: true } });
});

it("loads, edits, saves the intended ID, and reloads persisted values without a timezone shift", async () => {
  const { unmount } = render(<ContestForm contestId={id} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  const title = await screen.findByLabelText(/Contest Title/);
  expect(title).toHaveValue(original.title);
  expect(screen.getByLabelText(/URL Slug/)).toHaveValue(original.slug);
  expect(screen.getByLabelText("Private Contest")).toBeChecked();
  expect(screen.getByLabelText("Publish Contest")).toBeChecked();
  expect(screen.getByLabelText("Contest Password")).toHaveValue("access-code");
  expect(screen.getByLabelText("Contest Format")).toHaveValue("coding");
  expect(screen.queryByText("Published MCQ", { exact: true })).not.toBeInTheDocument();
  const start = screen.getByLabelText(/Start Time/) as HTMLInputElement;
  expect(new Date(start.value).toISOString()).toBe(original.startTime);
  expect(screen.getByText("1 Selected")).toBeInTheDocument();
  fireEvent.change(title, { target: { value: "Updated Contest" } });
  expect(screen.getByLabelText(/URL Slug/)).toHaveValue(original.slug);
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Updated description" } });
  fireEvent.click(screen.getByText("Trees", { exact: true }));
  fireEvent.click(screen.getByLabelText("Private Contest"));
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/contests?updated=existing-contest"));
  expect(adminContestsAPI.update).toHaveBeenCalledWith(id, expect.objectContaining({ title: "Updated Contest", description: "Updated description", startTime: original.startTime, endTime: original.endTime, isPrivate: false, isPublished: true, problems: ["p1", "p2"] }));
  expect(adminContestsAPI.create).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalled();
  unmount();
  render(<ContestForm contestId={id} />);
  expect(await screen.findByLabelText(/Contest Title/)).toHaveValue("Updated Contest");
  expect(screen.getByLabelText(/Description/)).toHaveValue("Updated description");
  expect(screen.getByText("2 Selected")).toBeInTheDocument();
});

it("preserves saved seconds and milliseconds when editing other fields", async () => {
  saved.startTime = "2026-11-01T04:30:17.045Z";
  render(<ContestForm contestId={id} />);
  await screen.findByLabelText(/Contest Title/);
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(adminContestsAPI.update).toHaveBeenCalledWith(id, expect.objectContaining({ startTime: "2026-11-01T04:30:17.045Z" })));
});

it("preserves creation and slug generation using the same form", async () => {
  render(<ContestForm />);
  fireEvent.change(await screen.findByLabelText(/Contest Title/), { target: { value: "New Contest" } });
  expect(screen.getByLabelText(/URL Slug/)).toHaveValue("new-contest");
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Description" } });
  fireEvent.change(screen.getByLabelText(/Start Time/), { target: { value: "2026-11-01T10:00" } });
  fireEvent.change(screen.getByLabelText(/End Time/), { target: { value: "2026-11-01T12:00" } });
  fireEvent.click(screen.getByText("Two Sum"));
  fireEvent.click(screen.getByRole("button", { name: "Create Contest" }));
  await waitFor(() => expect(adminContestsAPI.create).toHaveBeenCalledWith(expect.objectContaining({ slug: "new-contest", problems: ["p1"] })));
  expect(adminContestsAPI.update).not.toHaveBeenCalled();
});

it("filters questions by format and removes incompatible selections when switched", async () => {
  render(<ContestForm />);
  const format = await screen.findByLabelText("Contest Format");
  await waitFor(() => expect(adminProblemsAPI.getAll).toHaveBeenCalledWith({ contestEligible: true }));
  expect(await screen.findByText("Two Sum", { exact: true })).toBeInTheDocument();
  expect(screen.queryByText("Published MCQ", { exact: true })).not.toBeInTheDocument();
  fireEvent.change(format, { target: { value: "mcq" } });
  expect(screen.getByText("Published MCQ", { exact: true })).toBeInTheDocument();
  expect(screen.queryByText("Two Sum", { exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Published MCQ", { exact: true }));
  fireEvent.change(format, { target: { value: "coding" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("1 incompatible selected question was removed");
  expect(screen.getByText("0 Selected")).toBeInTheDocument();
  fireEvent.change(format, { target: { value: "mixed" } });
  expect(screen.getByText("Published MCQ", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Two Sum", { exact: true })).toBeInTheDocument();
});

it("shows load failures and allows retry without submitting an empty edit", async () => {
  jest.mocked(adminContestsAPI.getById).mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: "Contest not found" } } });
  render(<ContestForm contestId={id} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Contest not found");
  expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByLabelText(/Contest Title/)).toHaveValue(original.title);
});

it("validates scheduling and retains form values after a failed save", async () => {
  render(<ContestForm contestId={id} />);
  await screen.findByLabelText(/Contest Title/);
  fireEvent.change(screen.getByLabelText(/End Time/), { target: { value: "2026-10-01T10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("End time must be after start time");
  expect(adminContestsAPI.update).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/End Time/), { target: { value: "2026-11-02T10:00" } });
  jest.mocked(adminContestsAPI.update).mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: "Slug already exists" } } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Slug already exists");
  expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
  expect(screen.getByLabelText(/Contest Title/)).toHaveValue(original.title);
});

it("wires Edit and View links and keeps Delete working on the selected contest", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  render(<ContestList />);
  const edit = await screen.findByRole("link", { name: "Edit Existing Contest" });
  expect(edit).toHaveAttribute("href", `/admin/contests/${id}/edit`);
  expect(screen.getByTitle("View Contest")).toHaveAttribute("href", "/contests/existing-contest");
  fireEvent.click(screen.getByTitle("Delete Contest"));
  await waitFor(() => expect(adminContestsAPI.delete).toHaveBeenCalledWith(id));
  expect(adminContestsAPI.getAll).toHaveBeenCalledTimes(2);
  confirm.mockRestore();
});

it("handles a missing contest ID without opening the create form", () => {
  jest.mocked(useParams).mockReturnValue({});
  render(<EditContest />);
  expect(screen.getByRole("alert")).toHaveTextContent("A contest ID is required");
  expect(adminContestsAPI.getById).not.toHaveBeenCalled();
});
