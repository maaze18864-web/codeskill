import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LabProjectExercises } from "@/components/labs/LabProjectExercises";
import { studentLabsAPI } from "@/config/api";
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/config/api", () => ({
  studentLabsAPI: { openProject: jest.fn() },
}));
const props = {
  labId: "lab",
  experimentId: "experiment",
  title: "Task board integration",
  labTitle: "Fullstack Lab",
  backHref: "/labs/lab",
  onOpenCoding: jest.fn(),
  problems: [
    {
      id: "task",
      kind: "project" as const,
      title: "Finish task API",
      difficulty: "Medium",
      maxScore: 10,
      project: {
        instructions: "Implement the TODO handlers.",
        frontendStack: "react",
        backendStack: "express",
        fileCount: 9,
      },
    },
  ],
};
beforeEach(() => jest.clearAllMocks());
it("shows authored instructions and opens the server-owned project instead of sending client starter files", async () => {
  jest
    .mocked(studentLabsAPI.openProject)
    .mockResolvedValue({ data: { project: { id: "draft" } } } as never);
  render(<LabProjectExercises {...props} />);
  expect(screen.getByText("Implement the TODO handlers.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Open project" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/projects/draft"));
  expect(studentLabsAPI.openProject).toHaveBeenCalledWith(
    "lab",
    "experiment",
    "task",
  );
});
it("keeps the student on the experiment and displays access/runtime errors", async () => {
  jest
    .mocked(studentLabsAPI.openProject)
    .mockRejectedValue({
      response: { data: { message: "Lab is not available for your section" } },
    });
  render(<LabProjectExercises {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Open project" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("not available");
  expect(push).not.toHaveBeenCalled();
});
it("supports mixed coding and project exercises", () => {
  render(
    <LabProjectExercises
      {...props}
      problems={[
        ...props.problems,
        {
          id: "coding",
          title: "Array sum",
          difficulty: "Easy",
          maxScore: 5,
          problemMetadataId: "metadata",
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open problem" }));
  expect(props.onOpenCoding).toHaveBeenCalledWith(
    expect.objectContaining({ id: "coding" }),
  );
});
