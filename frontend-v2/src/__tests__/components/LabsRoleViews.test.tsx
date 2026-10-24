import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import StudentLabs from "@/app/labs/page";
import StudentProgress from "@/app/labs/progress/page";
import TeacherLabs from "@/app/teacher/labs/page";
import TeacherMetrics from "@/app/teacher/labs/[labId]/metrics/page";
import { LabExperiments } from "@/components/labs/LabExperiments";
import { studentLabsAPI, teacherLabsAPI } from "@/config/api";
import { dashboardFixture } from "@/test-fixtures/labs-dashboard";
jest.mock(
  "next/dynamic",
  () => () =>
    function ChartPlaceholder() {
      return <div />;
    },
);
jest.mock("@/config/api", () => ({
  studentLabsAPI: {
    list: jest.fn(),
    progress: jest.fn(),
    experiments: jest.fn(),
  },
  teacherLabsAPI: {
    dashboard: jest.fn(),
    list: jest.fn(),
    metrics: jest.fn(),
    experiments: jest.fn(),
  },
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ labId: "lab" }),
  useSearchParams: () => new URLSearchParams("sectionId=section"),
}));
const user = { id: "student" };
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user, loading: false }),
}));
const row = {
  lab: { id: "lab", title: "DSA Lab", subject: "Algorithms" },
  section: { id: "section", code: "CS-A" },
  sectionLabel: "CS-A",
  experimentCount: 2,
  totalProblems: 3,
  solvedCount: 2,
  totalAttempts: 4,
  timeSpentSeconds: 125,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(teacherLabsAPI.dashboard)
    .mockResolvedValue({ data: dashboardFixture } as never);
  jest
    .mocked(studentLabsAPI.list)
    .mockResolvedValue({ data: { data: [row] } } as never);
  jest
    .mocked(studentLabsAPI.progress)
    .mockResolvedValue({ data: { data: [row] } } as never);
  jest.mocked(teacherLabsAPI.list).mockResolvedValue({
    data: { data: [{ ...row, id: "assignment", role: "instructor" }] },
  } as never);
  jest.mocked(studentLabsAPI.experiments).mockResolvedValue({
    data: {
      lab: row.lab,
      experiments: [
        {
          id: "experiment",
          title: "Sliding Window",
          problemCount: 3,
          solvedCount: 2,
        },
      ],
    },
  } as never);
  jest.mocked(teacherLabsAPI.metrics).mockResolvedValue({
    data: {
      lab: row.lab,
      section: row.section,
      enrolledCount: 2,
      totalProblems: 3,
      experimentCount: 2,
      classCompletionPercent: 33,
      students: [
        {
          student: { id: "one", name: "Alice", uid: "A001" },
          sectionLabel: "CS-A",
          solvedCount: 2,
          totalProblems: 3,
          completionPercent: 67,
          attempts: 4,
        },
        {
          student: { id: "two", name: "Bob", uid: "B001" },
          sectionLabel: "CS-A",
          solvedCount: 0,
          totalProblems: 3,
          completionPercent: 0,
          attempts: 0,
        },
      ],
    },
  } as never);
});
it("shows student labs in a table and measures completion against problems, not experiments", async () => {
  render(<StudentLabs />);
  expect(
    await screen.findByRole("table", { name: "My assigned labs" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("progressbar", { name: "DSA Lab completion" }),
  ).toHaveAttribute("aria-valuenow", "67");
  expect(screen.getByRole("link", { name: "Open lab" })).toHaveAttribute(
    "href",
    "/labs/lab",
  );
});
it("renders progress as a scannable table with attempts and time", async () => {
  render(<StudentProgress />);
  expect(
    await screen.findByRole("table", { name: "Lab progress" }),
  ).toBeInTheDocument();
  expect(screen.getByText("2m")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "67",
  );
});
it("shows a progress-fetch error instead of a false empty result", async () => {
  jest
    .mocked(studentLabsAPI.progress)
    .mockRejectedValueOnce(new Error("offline"));
  render(<StudentProgress />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "could not be loaded",
  );
  expect(
    screen.queryByText("Your progress starts here"),
  ).not.toBeInTheDocument();
});
it("keeps teacher actions scoped to the selected lab and section and filters assignments", async () => {
  render(<TeacherLabs />);
  expect(
    await screen.findByRole("table", { name: "Teacher lab assignments" }),
  ).toBeInTheDocument();
  expect(
    screen.getAllByRole("link", { name: "Class metrics" })[0],
  ).toHaveAttribute("href", "/teacher/labs/lab/metrics?sectionId=section");
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search assigned labs" }),
    {
      target: { value: "missing" },
    },
  );
  expect(screen.getByText("No matching assignments")).toBeInTheDocument();
});
it("filters the class roster by student UID without changing its metrics request scope", async () => {
  render(<TeacherMetrics />);
  expect(
    await screen.findByRole("table", { name: "Class student metrics" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "A001" },
  });
  expect(screen.getByText("Alice")).toBeInTheDocument();
  expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  expect(teacherLabsAPI.metrics).toHaveBeenCalledWith("lab", "section");
});
it("shows the experiment problem count and green themed workspace action", async () => {
  render(<LabExperiments labId="lab" />);
  const open = await screen.findByRole("link", { name: "Open experiment" });
  expect(open).toHaveAttribute("href", "/labs/lab/experiments/experiment");
  expect(open).toHaveClass("text-primary");
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "67",
  );
});
