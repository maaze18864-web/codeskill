import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Catalog from "@/app/admin/labs/catalog/page";
import Sections from "@/app/admin/labs/sections/page";
import { adminLabsAPI } from "@/config/api";
jest.mock("@/config/api", () => ({
  adminLabsAPI: {
    listLabs: jest.fn(),
    listSections: jest.fn(),
    listTeachers: jest.fn(),
    getLab: jest.fn(),
    getSection: jest.fn(),
    listEnrollments: jest.fn(),
    assignSections: jest.fn(),
  },
  adminProblemsAPI: { getAll: jest.fn() },
  adminStudentsAPI: { getAll: jest.fn() },
}));
const sections = [
  {
    id: "section-a",
    code: "CS-A",
    name: "Computer Science A",
    isActive: true,
    enrollmentCount: 12,
  },
  { id: "section-b", code: "CS-B", name: "Computer Science B", isActive: true },
];
const labs = [
  {
    id: "lab-dsa",
    title: "DSA Lab",
    subject: "Algorithms",
    status: "published",
  },
  { id: "lab-dbms", title: "DBMS Lab", subject: "Databases", status: "draft" },
];
let detail: Record<string, unknown>;
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = jest.fn();
});
beforeEach(() => {
  jest.clearAllMocks();
  detail = {
    ...labs[0],
    sections: [sections[0]],
    teachers: [],
    experiments: [],
  };
  jest
    .mocked(adminLabsAPI.listLabs)
    .mockResolvedValue({ data: { data: labs } } as never);
  jest
    .mocked(adminLabsAPI.listSections)
    .mockResolvedValue({ data: { data: sections } } as never);
  jest
    .mocked(adminLabsAPI.listTeachers)
    .mockResolvedValue({ data: { data: [] } } as never);
  jest
    .mocked(adminLabsAPI.getLab)
    .mockImplementation(async () => ({ data: detail }) as never);
  jest.mocked(adminLabsAPI.getSection).mockResolvedValue({
    data: { ...sections[0], subgroups: [], labs: [labs[0]] },
  } as never);
  jest
    .mocked(adminLabsAPI.listEnrollments)
    .mockResolvedValue({ data: { data: [] } } as never);
  jest.mocked(adminLabsAPI.assignSections).mockImplementation(async () => {
    detail = { ...detail, sections };
    return { data: { assigned: 1 } } as never;
  });
});

it("searches unassigned sections, selects a UUID, and persists the section assignment", async () => {
  render(<Catalog />);
  const input = await screen.findByRole("combobox", {
    name: "Assign to section",
  });
  expect(screen.getByRole("button", { name: "Assign section" })).toBeDisabled();
  fireEvent.change(input, { target: { value: "CS-B" } });
  const option = await screen.findByRole("option", { name: /CS-B/ });
  expect(
    screen.queryByRole("option", { name: /CS-A/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(option);
  fireEvent.click(screen.getByRole("button", { name: "Assign section" }));
  await waitFor(() =>
    expect(adminLabsAPI.assignSections).toHaveBeenCalledWith("lab-dsa", [
      "section-b",
    ]),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Subject lab assigned",
  );
  expect(
    screen.getByText("All active sections are already assigned to this lab."),
  ).toBeInTheDocument();
});
it("keeps section choices working when teacher discovery fails", async () => {
  jest
    .mocked(adminLabsAPI.listTeachers)
    .mockRejectedValueOnce(new Error("unavailable"));
  render(<Catalog />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Teacher options could not be loaded",
  );
  const input = await screen.findByRole("combobox", {
    name: "Assign to section",
  });
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.change(input, { target: { value: "Science B" } });
  expect(
    await screen.findByRole("option", { name: /CS-B/ }),
  ).toBeInTheDocument();
});
it("supports assigning a subject lab from the academic section view", async () => {
  render(<Sections />);
  const input = await screen.findByRole("combobox", { name: "Subject lab" });
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.change(input, { target: { value: "Databases" } });
  fireEvent.click(await screen.findByRole("option", { name: /DBMS Lab/ }));
  fireEvent.click(screen.getByRole("button", { name: "Assign subject lab" }));
  await waitFor(() =>
    expect(adminLabsAPI.assignSections).toHaveBeenCalledWith("lab-dbms", [
      "section-a",
    ]),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Subject lab assigned to this section",
  );
});
it("shows API assignment errors and keeps the selection available for retry", async () => {
  jest.mocked(adminLabsAPI.assignSections).mockRejectedValueOnce({
    response: { data: { message: "Section is no longer active" } },
  });
  render(<Catalog />);
  const input = await screen.findByRole("combobox", {
    name: "Assign to section",
  });
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.change(input, { target: { value: "CS-B" } });
  fireEvent.click(await screen.findByRole("option", { name: /CS-B/ }));
  fireEvent.click(screen.getByRole("button", { name: "Assign section" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Section is no longer active",
  );
  expect(screen.getByRole("button", { name: "Assign section" })).toBeEnabled();
});

it("invalidates the selected UUID when the user types a different search", async () => {
  render(<Catalog />);
  const input = await screen.findByRole("combobox", {
    name: "Assign to section",
  });
  fireEvent.change(input, { target: { value: "CS-B" } });
  fireEvent.click(await screen.findByRole("option", { name: /CS-B/ }));
  const assignButton = screen.getByRole("button", { name: "Assign section" });
  expect(assignButton).toBeEnabled();
  fireEvent.change(input, { target: { value: "unknown section" } });
  expect(assignButton).toBeDisabled();
  expect(adminLabsAPI.assignSections).not.toHaveBeenCalled();
});
