"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus2,
  Folder,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { projectDirectories, projectParent } from "@/lib/project-explorer";
import type { ProjectFile } from "@/lib/project-workspace";

export interface ExplorerEntry {
  path: string;
  folder: boolean;
}
export type ExplorerAction = "new-file" | "new-folder" | "rename" | "delete";
interface Props {
  name: string;
  files: ProjectFile[];
  directories: string[];
  activePath: string;
  ready: boolean;
  onOpen: (path: string) => void;
  onAction: (action: ExplorerAction, entry: ExplorerEntry) => void;
  onMove: (source: string, directory: string) => void;
  onRefresh: () => void;
  editing?: {
    action: Exclude<ExplorerAction, "delete">;
    entry: ExplorerEntry;
    value: string;
    error: string;
  } | null;
  onEditChange?: (value: string) => void;
  onEditCommit?: () => void;
  onEditCancel?: () => void;
}
const icon =
  "inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground";
const root: ExplorerEntry = { path: "", folder: true };
export function ProjectExplorer({
  name,
  files,
  directories,
  activePath,
  ready,
  onOpen,
  onAction,
  onMove,
  onRefresh,
  editing,
  onEditChange,
  onEditCommit,
  onEditCancel,
}: Props) {
  const [collapsed, setCollapsed] = useState(new Set<string>()),
    [selected, setSelected] = useState<ExplorerEntry>(root);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    entry: ExplorerEntry;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null),
    [dragging, setDragging] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null),
    origin = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        origin.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [menu]);
  const openMenu = (
    event: React.MouseEvent<HTMLElement>,
    entry: ExplorerEntry,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    origin.current = event.currentTarget;
    setSelected(entry);
    setMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 210)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 190)),
      entry,
    });
  };
  const selectedEntry =
    selected.path &&
    !files.some((file) => file.path === selected.path) &&
    !projectDirectories(files, directories).includes(selected.path)
      ? root
      : selected;
  const action = (kind: ExplorerAction, entry = selectedEntry) => {
    setMenu(null);
    if (kind === "new-file" || kind === "new-folder") {
      const parent = entry.folder ? entry.path : projectParent(entry.path);
      setCollapsed(
        (current) =>
          new Set(
            [...current].filter(
              (path) => !(parent === path || parent.startsWith(path + "/")),
            ),
          ),
      );
    }
    onAction(kind, entry);
  };
  const targetFolder = (entry: ExplorerEntry) =>
    entry.folder ? entry.path : projectParent(entry.path);
  const editingParent = editing
    ? editing.action === "rename"
      ? projectParent(editing.entry.path)
      : targetFolder(editing.entry)
    : null;
  const viewCollapsed = new Set(
    [...collapsed].filter(
      (path) =>
        editingParent === null ||
        !(editingParent === path || editingParent.startsWith(path + "/")),
    ),
  );
  const dropHandlers = (entry: ExplorerEntry) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();
      if (
        dragging === entry.path ||
        targetFolder(entry) === dragging ||
        targetFolder(entry).startsWith(dragging + "/")
      ) {
        event.dataTransfer.dropEffect = "none";
        setDropTarget(null);
        return;
      }
      event.dataTransfer.dropEffect = "move";
      setDropTarget(targetFolder(entry));
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const directory = targetFolder(entry);
      if (dragging) {
        onMove(dragging, directory);
        setCollapsed(
          (current) =>
            new Set(
              [...current].filter(
                (path) =>
                  !(directory === path || directory.startsWith(path + "/")),
              ),
            ),
        );
      }
      setDragging(null);
      setDropTarget(null);
    },
  });
  const tree = [
    ...projectDirectories(files, directories).map((path) => ({
      path,
      folder: true,
    })),
    ...files.map((file) => ({ path: file.path, folder: false })),
  ]
    .sort((a, b) => {
      const aa = a.path.split("/"),
        bb = b.path.split("/");
      for (let i = 0; i < Math.min(aa.length, bb.length); i++)
        if (aa[i] !== bb[i]) {
          const af = i < aa.length - 1 || a.folder,
            bf = i < bb.length - 1 || b.folder;
          return af !== bf ? (af ? -1 : 1) : aa[i].localeCompare(bb[i]);
        }
      return aa.length - bb.length;
    })
    .filter(
      (entry) =>
        ![...viewCollapsed].some((path) => entry.path.startsWith(path + "/")),
    );
  const rows: (ExplorerEntry & { create?: boolean })[] = [...tree];
  if (editing && editing.action !== "rename") {
    const parent = targetFolder(editing.entry);
    const index = parent
      ? rows.findIndex((entry) => entry.path === parent) + 1
      : 0;
    rows.splice(Math.max(0, index), 0, {
      path: parent ? parent + "/__new_entry" : "__new_entry",
      folder: editing.action === "new-folder",
      create: true,
    });
  }
  const editRow = (entry: ExplorerEntry) => {
    if (!editing) return null;
    const parent =
      editing.action === "rename"
        ? projectParent(editing.entry.path)
        : targetFolder(editing.entry);
    const prefix = parent ? parent + "/" : "";
    const value = editing.value.startsWith(prefix)
      ? editing.value.slice(prefix.length)
      : editing.value;
    return (
      <div
        key={entry.path}
        className="pr-2"
        style={{
          paddingLeft: `${12 + (entry.path.split("/").length - 1) * 12}px`,
        }}
      >
        <div className="flex h-8 items-center gap-1.5">
          {entry.folder ? (
            <>
              <ChevronRight className="size-3 shrink-0" />
              <Folder className="size-3.5 shrink-0 text-amber-500/80" />
            </>
          ) : (
            <FileCode2 className="ml-3 size-3.5 shrink-0 text-muted-foreground" />
          )}
          <input
            autoFocus
            aria-label={entry.folder ? "Folder name" : "File name"}
            title="Enter to confirm · Escape to cancel"
            value={value}
            placeholder={entry.folder ? "Folder name" : "File name"}
            aria-invalid={Boolean(editing.error)}
            className={`h-6 min-w-0 flex-1 rounded-sm border bg-background px-1.5 text-xs text-foreground outline-none ${editing.error ? "border-destructive" : "border-primary ring-1 ring-primary/15"}`}
            onFocus={(event) => {
              const end =
                editing.action === "rename" &&
                !entry.folder &&
                value.lastIndexOf(".") > 0
                  ? value.lastIndexOf(".")
                  : value.length;
              event.currentTarget.setSelectionRange(0, end);
            }}
            onChange={(event) => onEditChange?.(prefix + event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                onEditCommit?.();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onEditCancel?.();
              }
            }}
            onBlur={() => onEditCancel?.()}
          />
        </div>
        {editing.error && (
          <p
            role="alert"
            className="pb-2 pl-5 text-[10px] leading-4 text-destructive"
          >
            {editing.error}
          </p>
        )}
      </div>
    );
  };
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onContextMenu={(event) => openMenu(event, root)}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Explorer
        </h2>
        <div className="flex gap-0.5">
          {ready && (
            <button
              type="button"
              aria-label="Refresh explorer"
              title="Refresh explorer"
              className={icon}
              onClick={onRefresh}
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label="New file"
            title="New file"
            className={icon}
            onClick={() => action("new-file")}
          >
            <FilePlus2 className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="New folder"
            title="New folder"
            className={icon}
            onClick={() => action("new-folder")}
          >
            <FolderPlus className="size-3.5" />
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Project root"
        className={`flex items-center gap-1 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide ${dropTarget === "" ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : ""}`}
        onClick={() => setSelected(root)}
        onContextMenu={(event) => openMenu(event, root)}
        {...dropHandlers(root)}
      >
        <ChevronDown className="size-3.5 shrink-0" />
        <span className="truncate">{name}</span>
      </button>
      <div
        aria-label="Project files and folders"
        className="min-h-0 flex-1 overflow-auto"
        {...dropHandlers(root)}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDropTarget(null);
        }}
      >
        {rows.map((entry) =>
          entry.create ||
          (editing?.action === "rename" &&
            editing.entry.path === entry.path) ? (
            editRow(entry)
          ) : (
            <button
              key={entry.path}
              type="button"
              title={entry.path}
              aria-label={`${entry.folder ? "Folder" : "File"} ${entry.path}`}
              aria-expanded={
                entry.folder ? !viewCollapsed.has(entry.path) : undefined
              }
              draggable
              onClick={() => {
                setSelected(entry);
                if (entry.folder)
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(entry.path)) next.delete(entry.path);
                    else next.add(entry.path);
                    return next;
                  });
                else onOpen(entry.path);
              }}
              onContextMenu={(event) => openMenu(event, entry)}
              onKeyDown={(event) => {
                if (event.key === "F2") {
                  event.preventDefault();
                  action("rename", entry);
                }
                if (event.key === "Delete") {
                  event.preventDefault();
                  action("delete", entry);
                }
                if (
                  event.key === "ContextMenu" ||
                  (event.shiftKey && event.key === "F10")
                ) {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  origin.current = event.currentTarget;
                  setSelected(entry);
                  setMenu({
                    x: rect.left + 20,
                    y: Math.min(rect.bottom, window.innerHeight - 190),
                    entry,
                  });
                }
              }}
              onDragStart={(event) => {
                event.stopPropagation();
                setMenu(null);
                setDragging(entry.path);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(
                  "application/x-codeskill-project-path",
                  entry.path,
                );
              }}
              onDragEnd={() => {
                setDragging(null);
                setDropTarget(null);
              }}
              {...dropHandlers(entry)}
              style={{
                paddingLeft: `${12 + (entry.path.split("/").length - 1) * 12}px`,
              }}
              className={`flex h-8 w-full items-center gap-1.5 pr-2 text-left text-xs outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/50 ${dropTarget === entry.path && entry.folder ? "bg-primary/15 ring-1 ring-inset ring-primary/40" : activePath === entry.path && !entry.folder ? "bg-primary/10 text-primary" : selected.path === entry.path ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"} ${dragging === entry.path ? "opacity-50" : ""}`}
            >
              {entry.folder ? (
                <>
                  <ChevronRight
                    className={`size-3 shrink-0 ${!viewCollapsed.has(entry.path) ? "rotate-90" : ""}`}
                  />
                  <Folder className="size-3.5 shrink-0 text-amber-500/80" />
                </>
              ) : (
                <FileCode2 className="ml-3 size-3.5 shrink-0" />
              )}
              <span className="truncate">{entry.path.split("/").pop()}</span>
            </button>
          ),
        )}
      </div>
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Explorer actions"
          className="fixed z-[70] w-[200px] rounded-lg border border-border bg-popover p-1 text-xs text-popover-foreground shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (
              !["ArrowDown", "ArrowUp", "Home", "End", "Tab"].includes(
                event.key,
              )
            )
              return;
            if (event.key === "Tab") {
              setMenu(null);
              return;
            }
            event.preventDefault();
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
            );
            const at = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            items[
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                    items.length
            ]?.focus();
          }}
        >
          <button
            role="menuitem"
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
            onClick={() => action("new-file", menu.entry)}
          >
            <FilePlus2 className="size-3.5" />
            New file
          </button>
          <button
            role="menuitem"
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
            onClick={() => action("new-folder", menu.entry)}
          >
            <FolderPlus className="size-3.5" />
            New folder
          </button>
          {menu.entry.path && (
            <>
              <div role="separator" className="my-1 border-t border-border" />
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
                onClick={() => action("rename", menu.entry)}
              >
                <Pencil className="size-3.5" />
                Rename
                <span className="ml-auto text-[10px] text-muted-foreground">
                  F2
                </span>
              </button>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none"
                onClick={() => action("delete", menu.entry)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
