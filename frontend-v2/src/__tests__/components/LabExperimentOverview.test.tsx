import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { LabExperimentOverview } from "@/components/labs/LabExperimentOverview";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/config/api", () => ({
  studentLabsAPI: { openProject: jest.fn() },
}));
it("separates practice and assessments and routes to the existing assessment briefing", async () => {
  const loadWorkspace = jest
    .fn()
    .mockResolvedValue({
      data: {
        lab: { title: "DBMS" },
        experiment: { title: "Aggregation" },
        problems: [
          { id: "practice", title: "Credit totals", kind: "sql", maxScore: 10 },
        ],
        assessments: [
          {
            id: "assessment",
            title: "Aggregation exam",
            durationMinutes: 30,
            questionCount: 2,
            totalMarks: 20,
            maxScore: 30,
            earnedScore: 10.5,
          },
        ],
      },
    });
  render(
    <LabExperimentOverview
      labId="lab"
      experimentId="experiment"
      loadWorkspace={loadWorkspace}
    />,
  );
  expect(
    await screen.findByRole("heading", { name: "Aggregation", exact: true }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Practice" })).toHaveAttribute(
    "href",
    "/labs/lab/experiments/experiment/practice/practice",
  );
  expect(screen.getByRole("link", { name: "Open assessment" })).toHaveAttribute(
    "href",
    "/assessments/assessment",
  );
  expect(screen.getByText("10.5 / 30")).toBeVisible();
  expect(
    screen.getByRole("table", { name: "Experiment practice questions" }),
  ).toBeVisible();
  expect(
    screen.getByRole("table", { name: "Experiment assessments" }),
  ).toBeVisible();
});
