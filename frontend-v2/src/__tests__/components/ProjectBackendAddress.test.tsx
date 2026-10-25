import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProjectBackendAddress } from "@/components/projects/ProjectBackendAddress";

describe("Project backend address", () => {
  const url = "http://localhost:5083/p/test/__backend/";
  it("shows a copyable gateway URL, health link, and durable frontend example", async () => {
    const copy = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copy },
    });
    render(<ProjectBackendAddress url={url} frontendStack="react" />);
    expect(screen.getByLabelText("Backend URL")).toHaveValue(url);
    expect(
      screen.getByRole("link", { name: "Open backend health check" }),
    ).toHaveAttribute("href", `${url}health`);
    expect(
      screen.getByText("fetch(import.meta.env.BASE_URL + 'api/tasks')"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy backend URL" }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(url));
  });
  it("disables inactive URLs and uses Next.js routing for built-in APIs", () => {
    const { rerender } = render(<ProjectBackendAddress url={null} />);
    expect(
      screen.getByRole("button", { name: "Copy backend URL" }),
    ).toBeDisabled();
    expect(screen.queryByRole("link")).toBeNull();
    rerender(
      <ProjectBackendAddress
        url={url}
        frontendStack="nextjs"
        healthPath="api/hello"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", `${url}api/hello`);
    expect(
      screen.getByText(
        "fetch(process.env.NEXT_PUBLIC_PROJECT_BASE + 'api/tasks')",
      ),
    ).toBeInTheDocument();
  });
});
