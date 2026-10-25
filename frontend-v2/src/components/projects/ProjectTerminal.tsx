"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { RotateCcw } from "lucide-react";
import { projectsAPI } from "@/config/api";
import { useTheme } from "@/context/ThemeContext";
import { labsError } from "@/components/labs/LabsUI";

export default function ProjectTerminal({ id, ready }: { id: string; ready: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Terminal | null>(null);
  const sessionId = useRef<string | null>(null);
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState("Connecting…");
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!ready || !container.current) return;
    let disposed = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "'SFMono-Regular', Consolas, monospace",
      lineHeight: 1.35,
      scrollback: 2000,
      screenReaderMode: true,
      allowProposedApi: false,
      disableStdin: true,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container.current);
    instance.current = terminal;
    fit.fit();
    let connection: string | null = null;
    let inputQueue = "";
    let writing = false;
    const size = () => ({
      cols: Math.max(20, Math.min(400, terminal.cols)),
      rows: Math.max(4, Math.min(160, terminal.rows)),
    });
    const fail = (cause: unknown) => {
      if (disposed || abort.signal.aborted) return;
      terminal.options.disableStdin = true;
      setError(labsError(cause, "Terminal disconnected. Reconnect to continue."));
      setState("Disconnected");
      abort.abort();
    };
    const flushInput = async () => {
      if (writing || !connection) return;
      writing = true;
      try {
        while (inputQueue && !disposed) {
          // Slice by code points so pasted Unicode is never split mid-character.
          const chars = Array.from(inputQueue);
          const chunk = chars.slice(0, 1024).join("");
          inputQueue = chars.slice(1024).join("");
          await projectsAPI.writeTerminal(id, connection, chunk, abort.signal);
        }
      } catch (cause) { fail(cause); }
      finally { writing = false; }
    };
    const input = terminal.onData((data) => {
      if (!connection || disposed || abort.signal.aborted) return;
      if (inputQueue.length + data.length > 32768) {
        terminal.write("\r\n[Paste is too large; use smaller chunks.]\r\n");
        return;
      }
      inputQueue += data;
      void flushInput();
    });
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (disposed) return;
        fit.fit();
        if (connection && !abort.signal.aborted)
          void projectsAPI.resizeTerminal(id, connection, size(), abort.signal).catch(fail);
      }, 100);
    });
    observer.observe(container.current);
    void (async () => {
      try {
        const { data: session } = await projectsAPI.startTerminal(id, size(), abort.signal);
        if (disposed) return;
        connection = session.terminalId;
        sessionId.current = connection;
        setError("");
        setState("Bash");
        terminal.options.disableStdin = false;
        terminal.focus();
        let cursor = 0;
        while (!disposed && !abort.signal.aborted) {
          const { data } = await projectsAPI.readTerminal(id, connection, cursor, abort.signal);
          if (disposed) return;
          if (data.truncated) terminal.write("\r\n[Earlier output was trimmed.]\r\n");
          const bytes = Uint8Array.from(atob(data.data), (char) => char.charCodeAt(0));
          if (bytes.length) await new Promise<void>((resolve) => terminal.write(bytes, resolve));
          cursor = data.cursor;
          if (!data.alive) {
            connection = null;
            terminal.options.disableStdin = true;
            terminal.write(`\r\n[Shell exited${data.exitCode === null ? "" : `: ${data.exitCode}`} — use Reconnect for a new shell.]\r\n`);
            setState("Exited");
            abort.abort();
            break;
          }
        }
      } catch (cause) { fail(cause); }
    })();
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(resizeTimer);
      observer.disconnect();
      input.dispose();
      terminal.dispose();
      instance.current = null;
      sessionId.current = null;
    };
  }, [id, ready, generation]);

  useEffect(() => {
    const terminal = instance.current;
    if (!terminal) return;
    terminal.options.theme = resolvedTheme === "dark"
      ? { background: "#1e1f20", foreground: "#e3e3e3", cursor: "#e3e3e3", selectionBackground: "#345840" }
      : { background: "#ffffff", foreground: "#172033", cursor: "#172033", selectionBackground: "#d5eddf" };
  }, [resolvedTheme, ready, generation]);

  async function reconnect() {
    const terminalId = sessionId.current;
    if (terminalId) {
      try { await projectsAPI.closeTerminal(id, terminalId); }
      catch (cause) { setError(labsError(cause, "Could not reconnect the terminal.")); return; }
    }
    setError("");
    setState("Connecting…");
    setGeneration((value) => value + 1);
  }

  if (!ready) return (
    <div className="flex flex-1 items-center justify-center px-4 text-xs text-muted-foreground">
      Run the project to open its Bash terminal.
    </div>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={container} aria-label="Project Bash terminal" className="min-h-0 flex-1 overflow-hidden px-3 pt-2 [&_.xterm]:h-full" />
      {error && <p role="alert" className="px-3 py-1 text-[11px] text-destructive">{error}</p>}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 py-1 text-[10px] text-muted-foreground">
        <span>{state} · Linux <span className="ml-2 hidden sm:inline">Files sync with Explorer.</span></span>
        <button onClick={() => void reconnect()} className="inline-flex items-center gap-1 hover:text-foreground" aria-label="Reconnect Bash terminal">
          <RotateCcw className="size-3" /> Reconnect
        </button>
      </div>
    </div>
  );
}
