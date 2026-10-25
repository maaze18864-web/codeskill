"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

export type ProjectConsoleLevel = "log" | "info" | "debug" | "warn" | "error";
export interface ProjectConsoleEntry {
  id: number;
  level: ProjectConsoleLevel;
  text: string;
  time: number;
}

export function useProjectConsole(
  frame: RefObject<HTMLIFrameElement | null>,
  previewUrl: string | null,
  generation: number,
) {
  const scope = `${previewUrl || ""}:${generation}`;
  const [output, setOutput] = useState<{
    scope: string;
    entries: ProjectConsoleEntry[];
  }>({ scope, entries: [] });
  const clear = useCallback(() => setOutput({ scope, entries: [] }), [scope]);

  useEffect(() => {
    if (!previewUrl) return;
    const origin = new URL(previewUrl).origin;
    let sequence = 0,
      rateStart = Date.now(),
      count = 0;
    const receive = (event: MessageEvent) => {
      // Preview code is untrusted. Accept only this iframe, its exact origin,
      // and a small text-only message; never render HTML or execute expressions.
      if (
        !frame.current?.contentWindow ||
        event.source !== frame.current.contentWindow ||
        event.origin !== origin
      )
        return;
      const data = event.data;
      if (
        !data ||
        data.channel !== "codeskill:project-console" ||
        !["log", "info", "debug", "warn", "error", "clear"].includes(
          data.level,
        ) ||
        !Array.isArray(data.args) ||
        data.args.length > 10 ||
        !data.args.every(
          (arg: unknown) => typeof arg === "string" && arg.length <= 4000,
        ) ||
        data.args.join("").length > 16000
      )
        return;
      if (Date.now() - rateStart >= 1000) {
        rateStart = Date.now();
        count = 0;
      }
      if (++count > 50) return;
      if (data.level === "clear") {
        clear();
        return;
      }
      const entry: ProjectConsoleEntry = {
        id: ++sequence,
        level: data.level,
        text: data.args.join(" "),
        time: Date.now(),
      };
      setOutput((previous) => ({
        scope,
        entries: [
          ...(previous.scope === scope ? previous.entries.slice(-199) : []),
          entry,
        ],
      }));
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [frame, previewUrl, scope, clear]);

  return { entries: output.scope === scope ? output.entries : [], clear };
}
