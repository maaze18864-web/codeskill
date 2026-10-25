import "@testing-library/jest-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import ProjectTerminal from "@/components/projects/ProjectTerminal";
import { projectsAPI } from "@/config/api";

let mockInput: (data: string) => void;
const mockDisposeInput = jest.fn();
const mockTerminal = {
  cols: 80, rows: 24, options: {},
  loadAddon: jest.fn(), open: jest.fn(), focus: jest.fn(), dispose: jest.fn(),
  write: jest.fn((_data: unknown, done?: () => void) => done?.()),
  onData: jest.fn((callback: (data: string) => void) => {
    mockInput = callback;
    return { dispose: mockDisposeInput };
  }),
};
jest.mock("@xterm/xterm", () => ({ Terminal: jest.fn(() => mockTerminal) }));
jest.mock("@xterm/addon-fit", () => ({ FitAddon: jest.fn(() => ({ fit: jest.fn() })) }));
jest.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
jest.mock("@/components/labs/LabsUI", () => ({ labsError: (_error: unknown, fallback: string) => fallback }));
jest.mock("@/config/api", () => ({ projectsAPI: {
  startTerminal: jest.fn(), readTerminal: jest.fn(), writeTerminal: jest.fn(),
  resizeTerminal: jest.fn(), closeTerminal: jest.fn(),
} }));

describe("Project Bash terminal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.ResizeObserver = class {
      observe() {} unobserve() {} disconnect() {}
    };
    (projectsAPI.startTerminal as jest.Mock).mockResolvedValue({ data: { terminalId: "shell", alive: true } });
    (projectsAPI.readTerminal as jest.Mock).mockImplementation(() => new Promise(() => {}));
    (projectsAPI.writeTerminal as jest.Mock).mockResolvedValue({ data: { accepted: true } });
  });
  it("does not open a shell before the project is running", () => {
    render(<ProjectTerminal id="p" ready={false} />);
    expect(screen.getByText(/Run the project/)).toBeInTheDocument();
    expect(projectsAPI.startTerminal).not.toHaveBeenCalled();
  });
  it("forwards real terminal input and aborts polling/disposes the renderer on unmount", async () => {
    const view = render(<ProjectTerminal id="p" ready />);
    await waitFor(() => expect(projectsAPI.readTerminal).toHaveBeenCalled());
    act(() => mockInput("cd frontend\r\x03"));
    await waitFor(() => expect(projectsAPI.writeTerminal).toHaveBeenCalledWith("p", "shell", "cd frontend\r\x03", expect.any(AbortSignal)));
    const signal = (projectsAPI.readTerminal as jest.Mock).mock.calls[0][3] as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    expect(mockTerminal.dispose).toHaveBeenCalledTimes(1);
    expect(mockDisposeInput).toHaveBeenCalledTimes(1);
    expect(projectsAPI.closeTerminal).not.toHaveBeenCalled();
  });
  it("does not start reading output when the component unmounts during connection", async () => {
    let resolve!: (value: unknown) => void;
    (projectsAPI.startTerminal as jest.Mock).mockImplementation(() => new Promise((done) => { resolve = done; }));
    const view = render(<ProjectTerminal id="p" ready />);
    view.unmount();
    await act(async () => resolve({ data: { terminalId: "late-shell", alive: true } }));
    expect(projectsAPI.readTerminal).not.toHaveBeenCalled();
  });
  it("stops input and pending resize requests when Bash exits", async () => {
    (projectsAPI.readTerminal as jest.Mock).mockResolvedValue({ data: { alive: false, exitCode: 0, cursor: 0, data: "" } });
    render(<ProjectTerminal id="p" ready />);
    await waitFor(() => expect(screen.getByText(/Exited/)).toBeInTheDocument());
    const signal = (projectsAPI.readTerminal as jest.Mock).mock.calls[0][3] as AbortSignal;
    expect(signal.aborted).toBe(true);
    expect(mockTerminal.options).toMatchObject({ disableStdin: true });
    act(() => mockInput("pwd\r"));
    expect(projectsAPI.writeTerminal).not.toHaveBeenCalled();
    expect(projectsAPI.resizeTerminal).not.toHaveBeenCalled();
  });
});
