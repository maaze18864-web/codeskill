import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { ProjectCodeEditor } from "@/components/projects/ProjectCodeEditor";
import { formatProjectCode } from "@/lib/project-format";

jest.mock("@/lib/project-format", () => ({
  projectFormatter: (path: string) => (path.endsWith(".py") ? null : "babel"),
  formatProjectCode: jest.fn(),
}));
let mockModel: ReturnType<typeof makeModel>;
let mockEditorProps: { onChange: (value: string) => void };
let mockPaste: () => void;
let mockAction: { run: () => Promise<void>; keybindings: number[] };
const mockDisposed = jest.fn();
const mockEditor = {
  getModel: jest.fn(),
  getPosition: jest.fn(() => ({ lineNumber: 1, column: 1 })),
  pushUndoStop: jest.fn(),
  setPosition: jest.fn(),
  executeEdits: jest.fn((_source: string, edits: { text: string }[]) => {
    mockModel.value = edits[0].text;
    mockModel.version++;
    mockEditorProps.onChange(mockModel.value);
  }),
  addAction: jest.fn((action) => {
    mockAction = action;
    return { dispose: mockDisposed };
  }),
  onDidChangeModel: jest.fn(() => ({ dispose: mockDisposed })),
  onDidPaste: jest.fn((callback) => {
    mockPaste = callback;
    return { dispose: mockDisposed };
  }),
};
function makeModel(path = "/project/main.jsx") {
  return {
    uri: { path, toString: () => path },
    value: "const x={a:1}",
    version: 1,
    getVersionId() {
      return this.version;
    },
    getValue() {
      return this.value;
    },
    isDisposed: () => false,
    getOffsetAt: () => 0,
    getPositionAt: () => ({ lineNumber: 1, column: 1 }),
    getFullModelRange: () => ({}),
  };
}
jest.mock(
  "next/dynamic",
  () => () =>
    function MockEditor(props: {
      value: string;
      onChange: (value: string) => void;
      onMount: (editor: unknown, monaco: unknown) => void;
    }) {
      const React = jest.requireActual<typeof import("react")>("react");
      mockEditorProps = props;
  const { onMount } = props;
  React.useEffect(() => {
    onMount(mockEditor, {
          KeyMod: { Shift: 1, Alt: 2 },
          KeyCode: { KeyF: 4 },
        });
  }, [onMount]);
      return (
        <textarea
          aria-label="Project source"
          value={props.value}
          onChange={(event) => {
            mockModel.value = event.target.value;
            mockModel.version++;
            props.onChange(event.target.value);
          }}
        />
      );
    },
);

function Harness({ path = "project/main.jsx" }: { path?: string }) {
  const [value, setValue] = useState("const x={a:1}");
  return (
    <ProjectCodeEditor
      path={path}
      value={value}
      onChange={(next) => setValue(next || "")}
      theme="light"
      onRename={jest.fn()}
      onDelete={jest.fn()}
    />
  );
}
describe("Project code formatting controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModel = makeModel();
    mockEditor.getModel.mockReturnValue(mockModel);
    (formatProjectCode as jest.Mock).mockResolvedValue({
      formatted: "const x = { a: 1 };\n",
      cursorOffset: 0,
    });
  });
  it("formats first-open code as an undoable edit and registers Shift+Alt+F", async () => {
    const view = render(<Harness />);
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Project source" }),
      ).toHaveValue("const x = { a: 1 };\n"),
    );
    expect(mockEditor.executeEdits).toHaveBeenCalledWith(
      "prettier",
      expect.any(Array),
    );
    expect(mockEditor.pushUndoStop).toHaveBeenCalledTimes(2);
    expect(mockAction.keybindings).toEqual([7]);
    await act(async () => {
      await mockAction.run();
    });
    expect(formatProjectCode).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(mockDisposed).toHaveBeenCalledTimes(3);
  });
  it("keeps text typed while an asynchronous format is in flight", async () => {
    let finish!: (result: { formatted: string; cursorOffset: number }) => void;
    (formatProjectCode as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<Harness />);
    await waitFor(() => expect(formatProjectCode).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("textbox", { name: "Project source" }), {
      target: { value: "newer user edits" },
    });
    await act(async () => {
      finish({ formatted: "stale result", cursorOffset: 0 });
    });
    expect(screen.getByRole("textbox", { name: "Project source" })).toHaveValue(
      "newer user edits",
    );
    expect(mockEditor.executeEdits).not.toHaveBeenCalled();
  });
  it("does not apply an old file's formatting to a newly selected model", async () => {
    let finish!: (result: { formatted: string; cursorOffset: number }) => void;
    (formatProjectCode as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<Harness />);
    await waitFor(() => expect(formatProjectCode).toHaveBeenCalled());
    mockEditor.getModel.mockReturnValue(makeModel("/project/other.jsx"));
    await act(async () => {
      finish({ formatted: "old file", cursorOffset: 0 });
    });
    expect(mockEditor.executeEdits).not.toHaveBeenCalled();
  });
  it("leaves malformed code intact and explains a manual formatting failure", async () => {
    (formatProjectCode as jest.Mock).mockRejectedValue(
      new Error("syntax error"),
    );
    render(<Harness />);
    const button = screen.getByRole("button", { name: "Format code" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check its syntax",
    );
    expect(mockEditor.executeEdits).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Project source" })).toHaveValue(
      "const x={a:1}",
    );
  });
  it("formats pasted source and disables unsupported file types", async () => {
    const view = render(<Harness />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Format code" })).toBeEnabled(),
    );
    await act(async () => {
      mockPaste();
    });
    await waitFor(() => expect(formatProjectCode).toHaveBeenCalledTimes(2));
    view.unmount();
    mockModel = makeModel("/project/main.py");
    mockEditor.getModel.mockReturnValue(mockModel);
    render(<Harness path="project/main.py" />);
    expect(screen.getByRole("button", { name: "Format code" })).toBeDisabled();
  });
});
