import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionComparison } from "@/components/labs/SectionComparison";
import { aggregateLabSections, type LabsCohort } from "@/lib/labs-dashboard";
import { dashboardFixture } from "@/test-fixtures/labs-dashboard";
jest.mock(
  "next/dynamic",
  () => () =>
    function Chart({
      sections,
    }: {
      sections: Array<{ id: string; code: string }>;
    }) {
      return (
        <div>
          {sections.map((s) => (
            <p key={s.id}>{s.code}</p>
          ))}
        </div>
      );
    },
);
const rows: LabsCohort[] = Array.from({ length: 19 }, (_, i) => ({
  ...dashboardFixture.cohorts[0],
  section_id: `s${i}`,
  section_code: `CS-${String(i + 1).padStart(2, "0")}`,
  section_name: `Section ${i + 1}`,
  assigned: 100,
  solved: i * 5,
}));
it("groups subjects under sections without multiplying enrolled students", () => {
  const [section] = aggregateLabSections([
    rows[0],
    { ...rows[0], lab_id: "another", assigned: 50, solved: 20 },
  ]);
  expect(section).toMatchObject({
    students: 2,
    labs: 2,
    assigned: 150,
    solved: 20,
  });
});
it("makes every section reachable with stable eight-row pagination", () => {
  render(<SectionComparison cohorts={rows} />);
  expect(
    screen.getByText("1–8 of 19 sections · grouped across subjects"),
  ).toBeInTheDocument();
  expect(screen.queryByText("CS-09")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next chart sections" }));
  expect(screen.getByText("CS-09")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next chart sections" }));
  expect(
    screen.getByText("17–19 of 19 sections · grouped across subjects"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Next chart sections" }),
  ).toBeDisabled();
});
it("searches the complete section list and resets the page when sorting or filtering", () => {
  render(<SectionComparison cohorts={rows} />);
  fireEvent.change(
    screen.getByRole("combobox", { name: "Sort section chart" }),
    { target: { value: "completion-desc" } },
  );
  expect(screen.getByText("CS-19")).toBeInTheDocument();
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search chart sections" }),
    { target: { value: "CS-18" } },
  );
  expect(screen.getByText("CS-18")).toBeInTheDocument();
  expect(
    screen.getByText("1–1 of 1 sections · grouped across subjects"),
  ).toBeInTheDocument();
});
