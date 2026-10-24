"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor, IDisposable } from "monaco-editor";
import { IndentIncrease, Loader2, Pencil, Trash2 } from "lucide-react";
import { projectFormatter } from "@/lib/project-format";
import { projectLanguage } from "@/lib/project-workspace";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-xs text-muted-foreground">
      Loading editor…
    </div>
  ),
});
const action =
  "inline-flex h-6 items-center justify-center gap-1.5 rounded px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40";
export interface ProjectCodeEditorHandle {
  format: () => Promise<boolean>;
}
interface Props {
  path: string;
  value: string;
  theme: string;
  onChange: (value?: string) => void;
  onRename: () => void;
  onDelete: () => void;
}

export const ProjectCodeEditor = forwardRef<ProjectCodeEditorHandle, Props>(
  function ProjectCodeEditor(
    { path, value, theme, onChange, onRename, onDelete },
    ref,
  ) {
    const editor = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
    const subscriptions = useRef<IDisposable[]>([]);
    const opened = useRef(new Set<string>());
    const pending = useRef(
      new Map<MonacoEditor.ITextModel, Promise<boolean>>(),
    );
    const mounted = useRef(true);
    const [formatting, setFormatting] = useState(false),
      [notice, setNotice] = useState("");
    useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
        subscriptions.current.forEach((item) => item.dispose());
        editor.current = null;
      };
    }, []);

    const format = useCallback(async (quiet = false): Promise<boolean> => {
      const instance = editor.current,
        model = instance?.getModel();
      if (!instance || !model || !projectFormatter(model.uri.path))
        return false;
      const existing = pending.current.get(model);
      if (existing) return existing;
      const version = model.getVersionId(),
        source = model.getValue();
      const position = instance.getPosition();
      const offset = position ? model.getOffsetAt(position) : 0;
      setFormatting(true);
      setNotice("");
      const request = (async () => {
        try {
          const { formatProjectCode } = await import("@/lib/project-format");
          const result = await formatProjectCode(
            model.uri.path,
            source,
            offset,
          );
          // Formatting must never replace text typed while the parser was loading,
          // nor a different file selected while formatting was in flight.
          if (
            !mounted.current ||
            model.isDisposed() ||
            editor.current !== instance ||
            instance.getModel() !== model ||
            model.getVersionId() !== version
          )
            return false;
          if (result.formatted !== source) {
            instance.pushUndoStop();
            instance.executeEdits("prettier", [
              { range: model.getFullModelRange(), text: result.formatted },
            ]);
            instance.pushUndoStop();
            instance.setPosition(model.getPositionAt(result.cursorOffset));
          }
          return true;
        } catch {
          if (!quiet && mounted.current && instance.getModel() === model)
            setNotice(
              "Could not format this file. Check its syntax and try again.",
            );
          return false;
        } finally {
          pending.current.delete(model);
          if (mounted.current) setFormatting(pending.current.size > 0);
        }
      })();
      pending.current.set(model, request);
      return request;
    }, []);
    useImperativeHandle(ref, () => ({ format: () => format() }), [format]);
    const onMount: OnMount = useCallback(
      (instance, monaco) => {
        subscriptions.current.forEach((item) => item.dispose());
        editor.current = instance;
        const formatFirstOpen = () => {
          setNotice("");
          const uri = instance.getModel()?.uri.toString();
          if (!uri || opened.current.has(uri)) return;
          opened.current.add(uri);
          void format(true);
        };
        subscriptions.current = [
          instance.addAction({
            id: "codeskill.formatDocument",
            label: "Format document with Prettier",
            keybindings: [
              monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
            ],
            contextMenuGroupId: "1_modification",
            run: () => format().then(() => {}),
          }),
          instance.onDidChangeModel(formatFirstOpen),
          instance.onDidPaste(() => {
            void format(true);
          }),
        ];
        formatFirstOpen();
      },
      [format],
    );
    const supported = Boolean(projectFormatter(path));
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-4 text-[11px] text-muted-foreground">
          <span className="truncate">
            {path.split("/").slice(1).join("  /  ")}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={action}
              aria-label="Format code"
              title={
                supported
                  ? "Format with Prettier (Shift+Alt+F)"
                  : "No formatter is available for this file type"
              }
              disabled={!supported || formatting}
              onClick={() => {
                void format();
              }}
            >
              {formatting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <IndentIncrease className="size-3" />
              )}
              <span>{formatting ? "Formatting…" : "Format"}</span>
            </button>
            <span
              aria-hidden="true"
              className="mx-1 h-3 border-l border-border"
            />
            <button
              type="button"
              className={action}
              title="Rename file"
              aria-label="Rename file"
              onClick={onRename}
            >
              <Pencil className="size-3" />
            </button>
            <button
              type="button"
              className={action}
              title="Delete file"
              aria-label="Delete file"
              onClick={onDelete}
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
        {notice && (
          <p
            role="status"
            className="border-b border-border bg-muted/30 px-4 py-1.5 text-[11px] text-muted-foreground"
          >
            {notice}
          </p>
        )}
        <div className="min-h-0 flex-1">
          <Editor
            height="100%"
            path={path}
            language={projectLanguage(path)}
            theme={theme}
            value={value}
            onChange={onChange}
            onMount={onMount}
            options={{
              fontSize: 13,
              fontFamily: "'SFMono-Regular', Consolas, monospace",
              minimap: { enabled: false },
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              autoIndent: "full",
              insertSpaces: true,
              detectIndentation: false,
              tabSize: /\.(py|java)$/.test(path) ? 4 : 2,
              wordWrap: "on",
              smoothScrolling: true,
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>
      </div>
    );
  },
);
