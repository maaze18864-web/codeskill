import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProjectApiClient } from "@/components/projects/ProjectApiClient";
import { projectsAPI } from "@/config/api";
jest.mock("@/config/api", () => ({ projectsAPI: { request: jest.fn() } }));
jest.mock("@/components/labs/LabsUI", () => ({
  labsError: (_e: unknown, fallback: string) => fallback,
}));
describe("Project API client", () => {
  beforeEach(() => jest.clearAllMocks());
  it("prevents requests before the runtime is ready", () => {
    render(<ProjectApiClient id="p" ready={false} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });
  it("sends relative paths and displays status, duration and JSON response", async () => {
    (projectsAPI.request as jest.Mock).mockResolvedValue({
      data: {
        status: 200,
        durationMs: 12,
        headers: { "content-type": "application/json" },
        body: '{"message":"Hello"}',
      },
    });
    render(<ProjectApiClient id="p" ready />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Status: 200");
    expect(projectsAPI.request).toHaveBeenCalledWith(
      "p",
      expect.objectContaining({ method: "GET", path: "/api/hello", body: "" }),
    );
    expect(screen.getByLabelText("API response")).toHaveTextContent("Hello");
  });
  it("rejects absolute URLs and malformed headers without making requests", async () => {
    render(<ProjectApiClient id="p" ready />);
    fireEvent.change(screen.getByLabelText("Request path"), {
      target: { value: "http://169.254.169.254/" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("relative path"),
    );
    expect(projectsAPI.request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Request path"), {
      target: { value: "/api/hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: /headers/i }));
    fireEvent.change(screen.getByLabelText("Request headers"), {
      target: { value: "{broken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("valid JSON"),
    );
    expect(projectsAPI.request).not.toHaveBeenCalled();
  });
});
