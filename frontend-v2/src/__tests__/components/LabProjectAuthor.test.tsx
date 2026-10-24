import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LabProjectAuthor } from "@/components/labs/LabProjectAuthor";
import { projectsAPI } from "@/config/api";
jest.mock("@/config/api", () => ({
  projectsAPI: {
    catalog: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    template: jest.fn(),
  },
}));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));
jest.mock("@/components/projects/ProjectCodeEditor", () => ({
  ProjectCodeEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Starter source code"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
jest.mock("@/components/projects/TechnologyPicker", () => ({
  TechnologyPicker: () => null,
}));
const template = {
  name: "Finish task API",
  instructions: "Complete the TODO handler.",
  mode: "fullstack" as const,
  frontendStack: "react",
  backendStack: "express",
  files: [{ path: "backend/server.js", content: "// TODO: implement" }],
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(projectsAPI.catalog)
    .mockResolvedValue({
      data: { catalog: { frontend: [], backend: [] } },
    } as never);
  jest
    .mocked(projectsAPI.list)
    .mockResolvedValue({ data: { projects: [] } } as never);
});
it("lets admins edit starter code and instructions and saves the authored project exercise", async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  render(
    <LabProjectAuthor initial={template} onClose={jest.fn()} onSave={onSave} />,
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Student instructions" }),
    { target: { value: "Implement POST /api/tasks; keep validation." } },
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Starter source code" }),
    { target: { value: "// TODO: validate a non-empty title" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save project exercise" }),
  );
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: "Implement POST /api/tasks; keep validation.",
        files: [
          {
            path: "backend/server.js",
            content: "// TODO: validate a non-empty title",
          },
        ],
      }),
    ),
  );
});
it("imports a private prepared project with its stack and files", async () => {
  jest
    .mocked(projectsAPI.list)
    .mockResolvedValue({
      data: { projects: [{ id: "prepared", name: "Prepared project" }] },
    } as never);
  jest
    .mocked(projectsAPI.get)
    .mockResolvedValue({
      data: {
        project: {
          mode: "backend",
          backendStack: "flask",
          files: [{ path: "backend/query.sql", content: "-- TODO" }],
          directories: ["backend/empty"],
        },
      },
    } as never);
  render(
    <LabProjectAuthor
      initial={template}
      onClose={jest.fn()}
      onSave={jest.fn()}
    />,
  );
  await screen.findByRole("option", { name: "Prepared project" });
  fireEvent.change(screen.getByRole("combobox", { name: "Starter source" }), {
    target: { value: "prepared" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Replace starter files" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("textbox", { name: "Starter source code" }),
    ).toHaveValue("-- TODO"),
  );
  expect(projectsAPI.get).toHaveBeenCalledWith("prepared");
  expect(screen.getByRole("combobox", { name: "Project type" })).toHaveValue(
    "backend",
  );
});
it("keeps the authored files after a save error", async () => {
  render(
    <LabProjectAuthor
      initial={template}
      onClose={jest.fn()}
      onSave={jest
        .fn()
        .mockRejectedValue({
          response: { data: { message: "Invalid starter path" } },
        })}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save project exercise" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Invalid starter path",
  );
  expect(
    screen.getByRole("textbox", { name: "Starter source code" }),
  ).toHaveValue("// TODO: implement");
});
