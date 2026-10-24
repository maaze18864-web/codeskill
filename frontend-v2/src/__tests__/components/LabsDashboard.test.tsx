import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { LabsAnalytics } from "@/components/labs/LabsAnalytics";
import TeacherLabs from "@/app/teacher/labs/page";
import AdminLabs from "@/app/admin/labs/page";
import { dashboardFixture as data } from "@/test-fixtures/labs-dashboard";
import { teacherLabsAPI, adminLabsAPI } from "@/config/api";
jest.mock(
  "next/dynamic",
  () => () =>
    function ChartPlaceholder() {
      return <div data-testid="chart" />;
    },
);
jest.mock("@/config/api", () => ({
  teacherLabsAPI: { list: jest.fn(), dashboard: jest.fn() },
  adminLabsAPI: {
    dashboard: jest.fn(),
    listSections: jest.fn(),
    listLabs: jest.fn(),
  },
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(adminLabsAPI.listSections)
    .mockResolvedValue({
      data: { data: [{ id: "section", code: "CS-A", name: "Section A" }] },
    } as never);
  jest
    .mocked(adminLabsAPI.listLabs)
    .mockResolvedValue({
      data: { data: [{ id: "lab", title: "DSA", status: "published" }] },
    } as never);
  jest.mocked(teacherLabsAPI.list).mockResolvedValue({
    data: {
      data: [
        {
          id: "a",
          lab: { id: "lab", title: "DSA Lab" },
          section: {
            id: "section",
            code: "CS-A",
            name: "Computer Science A",
          },
        },
      ],
    },
  } as never);
  jest.mocked(teacherLabsAPI.dashboard).mockResolvedValue({ data } as never);
  jest.mocked(adminLabsAPI.dashboard).mockResolvedValue({
    data: { sections: 1, labs: 1, teacherAssignments: 1, analytics: data },
  } as never);
});
it("shows meaningful assigned-work denominators and distinct learner participation", () => {
  render(<LabsAnalytics data={data} role="admin" />);
  expect(
    screen.getByText("2 of 6 problem assignments solved"),
  ).toBeInTheDocument();
  expect(screen.getByText("1 of 2 students have started")).toBeInTheDocument();
  expect(
    screen.getByRole("table", { name: "Section lab performance" }),
  ).toHaveTextContent("2 / 6 problem assignments");
  const experiments = screen.getByRole("table", {
    name: "Experiment completion breakdown",
  });
  expect(experiments).toHaveTextContent("Sliding Window");
  expect(within(experiments).getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "33",
  );
});
it("provides an actionable not-started list separately from flagged students", () => {
  render(<LabsAnalytics data={data} role="teacher" />);
  expect(
    screen.getByText("Repeated attempts without a solve"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Not started · 1" }));
  expect(screen.getByText("Bob")).toBeInTheDocument();
  expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Class metrics" })).toHaveAttribute(
    "href",
    "/teacher/labs/lab/metrics?sectionId=section",
  );
});
it("does not render decorative zero-data charts", () => {
  render(
    <LabsAnalytics
      role="admin"
      data={{
        ...data,
        summary: {
          ...data.summary,
          assigned: 0,
          students: 0,
          started: 0,
          completed: 0,
          notStarted: 0,
        },
        cohorts: [],
        experiments: [],
      }}
    />,
  );
  expect(
    screen.getByText("No published problem work to measure yet"),
  ).toBeInTheDocument();
  expect(screen.queryByTestId("chart")).not.toBeInTheDocument();
});
it("requests teacher section filters from the backend rather than presenting global data", async () => {
  render(<TeacherLabs />);
  await screen.findByRole("table", { name: "Section lab performance" });
  expect(teacherLabsAPI.dashboard).toHaveBeenCalledWith(undefined, undefined);
  fireEvent.change(screen.getByRole("combobox", { name: "Your sections" }), {
    target: { value: "section" },
  });
  await waitFor(() =>
    expect(teacherLabsAPI.dashboard).toHaveBeenCalledWith("section", undefined),
  );
});
it("shows a fetch error, rather than presenting zero metrics as success", async () => {
  jest
    .mocked(adminLabsAPI.dashboard)
    .mockRejectedValueOnce(new Error("offline"));
  render(<AdminLabs />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not refresh",
  );
  expect(screen.queryByText("0%")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Refresh Labs overview" }),
  );
  await screen.findByRole("table", { name: "Section lab performance" });
  expect(adminLabsAPI.dashboard).toHaveBeenCalledTimes(2);
});
it("keeps section and subject filtering on the existing admin dashboard", async () => {
  render(<AdminLabs />);
  await screen.findByRole("table", { name: "Section lab performance" });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Filter dashboard section" }),
    { target: { value: "section" } },
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Filter dashboard subject" }),
    { target: { value: "lab" } },
  );
  await waitFor(() =>
    expect(adminLabsAPI.dashboard).toHaveBeenLastCalledWith({
      sectionId: "section",
      labId: "lab",
    }),
  );
  expect(
    screen.queryByRole("link", { name: "Explore analytics" }),
  ).not.toBeInTheDocument();
});
it("expands deeper visualizations inline without navigating to another page", () => {
  render(<LabsAnalytics data={data} role="admin" />);
  expect(
    screen.queryByRole("heading", { name: "First solves over time" }),
  ).not.toBeInTheDocument();
  const toggle = screen.getByRole("button", { name: /More learning insights/ });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(
    screen.getByRole("heading", { name: "Activity recency" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Attempts per started problem" }),
  ).toBeInTheDocument();
});
