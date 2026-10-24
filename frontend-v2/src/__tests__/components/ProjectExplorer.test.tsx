import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProjectExplorer } from "@/components/projects/ProjectExplorer";
const props = {
  name: "Demo",
  files: [
    { path: "README.md", content: "" },
    { path: "src/App.jsx", content: "app" },
  ],
  directories: ["src/empty", "assets"],
  activePath: "src/App.jsx",
  ready: true,
  onOpen: jest.fn(),
  onAction: jest.fn(),
  onMove: jest.fn(),
  onRefresh: jest.fn(),
};
describe("Project explorer UI", () => {
  it("creates names inline with Enter and cancels with Escape, without a dialog", () => {
    const onEditChange = jest.fn(),
      onEditCommit = jest.fn(),
      onEditCancel = jest.fn();
    render(
      <ProjectExplorer
        {...props}
        editing={{
          action: "new-file",
          entry: { path: "src", folder: true },
          value: "src/",
          error: "",
        }}
        onEditChange={onEditChange}
        onEditCommit={onEditCommit}
        onEditCancel={onEditCancel}
      />,
    );
    const input = screen.getByRole("textbox", { name: "File name" });
    expect(input).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Button.jsx" } });
    expect(onEditChange).toHaveBeenCalledWith("src/Button.jsx");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEditCommit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onEditCancel).toHaveBeenCalledTimes(1);
  });
  it("renames inline with the basename selected and displays inline validation errors", () => {
    render(
      <ProjectExplorer
        {...props}
        editing={{
          action: "rename",
          entry: { path: "src/App.jsx", folder: false },
          value: "src/App.jsx",
          error: "A file already exists.",
        }}
      />,
    );
    const input = screen.getByRole("textbox", {
      name: "File name",
    }) as HTMLInputElement;
    expect(input.value).toBe("App.jsx");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(3);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
  });
  it("uses an inline folder input for new empty folders", () => {
    render(
      <ProjectExplorer
        {...props}
        editing={{
          action: "new-folder",
          entry: { path: "", folder: true },
          value: "",
          error: "",
        }}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Folder name" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  beforeEach(() => jest.clearAllMocks());
  it("shows empty folders and creates entries relative to the selected folder", () => {
    render(<ProjectExplorer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Folder assets" }));
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    expect(props.onAction).toHaveBeenCalledWith("new-folder", {
      path: "assets",
      folder: true,
    });
    expect(
      screen.getByRole("button", { name: "Folder src/empty" }),
    ).toBeVisible();
  });
  it("opens a custom context menu with keyboard navigation and folder actions", async () => {
    render(<ProjectExplorer {...props} />);
    const folder = screen.getByRole("button", { name: "Folder src" });
    fireEvent.contextMenu(folder, { clientX: 150, clientY: 170 });
    expect(
      screen.getByRole("menu", { name: "Explorer actions" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(props.onAction).toHaveBeenCalledWith("delete", {
      path: "src",
      folder: true,
    });
    fireEvent.keyDown(folder, { key: "F10", shiftKey: true });
    expect(screen.getByRole("menuitem", { name: "New file" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "New folder" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
    expect(folder).toHaveFocus();
  });
  it("supports F2 and Delete on file rows", () => {
    render(<ProjectExplorer {...props} />);
    const file = screen.getByRole("button", { name: "File src/App.jsx" });
    fireEvent.keyDown(file, { key: "F2" });
    fireEvent.keyDown(file, { key: "Delete" });
    expect(props.onAction).toHaveBeenNthCalledWith(1, "rename", {
      path: "src/App.jsx",
      folder: false,
    });
    expect(props.onAction).toHaveBeenNthCalledWith(2, "delete", {
      path: "src/App.jsx",
      folder: false,
    });
  });
  test.each([
    ["File src/App.jsx", "src/App.jsx"],
    ["Folder src", "src"],
  ])("drags %s into another folder", (label, path) => {
    render(<ProjectExplorer {...props} />);
    const dataTransfer = {
      setData: jest.fn(),
      effectAllowed: "",
      dropEffect: "",
    };
    fireEvent.dragStart(screen.getByRole("button", { name: label }), {
      dataTransfer,
    });
    const target = screen.getByRole("button", { name: "Folder assets" });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(props.onMove).toHaveBeenCalledWith(path, "assets");
  });
  it("allows dropping onto the root", () => {
    render(<ProjectExplorer {...props} />);
    const dataTransfer = {
      setData: jest.fn(),
      effectAllowed: "",
      dropEffect: "",
    };
    fireEvent.dragStart(
      screen.getByRole("button", { name: "File src/App.jsx" }),
      { dataTransfer },
    );
    const root = screen.getByRole("button", { name: "Project root" });
    fireEvent.dragOver(root, { dataTransfer });
    fireEvent.drop(root, { dataTransfer });
    expect(props.onMove).toHaveBeenCalledWith("src/App.jsx", "");
  });
});
