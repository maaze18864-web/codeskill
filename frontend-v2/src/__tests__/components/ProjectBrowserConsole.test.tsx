import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProjectBrowserConsole } from "@/components/projects/ProjectBrowserConsole";

describe("Project browser console", () => {
  it("keeps large response details collapsed behind a useful HTTP summary", () => {
    render(
      <ProjectBrowserConsole
        ready
        onClear={() => {}}
        entries={[
          {
            id: 1,
            level: "log",
            text: JSON.stringify(
              {
                type: "Response",
                status: 200,
                ok: true,
                headers: { "content-type": "application/json" },
              },
              null,
              2,
            ),
            time: 1,
          },
        ]}
      />,
    );
    const details = screen
      .getByText("Response { status: 200, ok: true }")
      .closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent("application/json");
  });
  it("shows levels and object text, filters messages, and clears the console", () => {
    const clear = jest.fn();
    render(
      <ProjectBrowserConsole
        ready
        onClear={clear}
        entries={[
          { id: 1, level: "log", text: 'Response { "status": 200 }', time: 1 },
          { id: 2, level: "error", text: "API request failed", time: 2 },
          { id: 3, level: "warn", text: "Missing title", time: 3 },
        ]}
      />,
    );
    expect(screen.getByRole("log")).toHaveTextContent(
      'Response { "status": 200 }',
    );
    fireEvent.change(screen.getByLabelText("Console level"), {
      target: { value: "error" },
    });
    expect(screen.getByRole("log")).toHaveTextContent("API request failed");
    expect(screen.getByRole("log")).not.toHaveTextContent("Missing title");
    fireEvent.change(screen.getByLabelText("Filter console output"), {
      target: { value: "not found" },
    });
    expect(screen.getByRole("log")).toHaveTextContent("No messages match");
    fireEvent.click(screen.getByRole("button", { name: "Clear console" }));
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it("renders messages as text and explains how to start an inactive preview", () => {
    const { rerender } = render(
      <ProjectBrowserConsole
        ready
        entries={[
          {
            id: 1,
            level: "log",
            text: '<img src=x onerror="alert(1)">',
            time: 1,
          },
        ]}
        onClear={() => {}}
      />,
    );
    expect(screen.getByRole("log").querySelector("img")).toBeNull();
    rerender(
      <ProjectBrowserConsole ready={false} entries={[]} onClear={() => {}} />,
    );
    expect(screen.getByRole("log")).toHaveTextContent("Run the project");
  });
});
