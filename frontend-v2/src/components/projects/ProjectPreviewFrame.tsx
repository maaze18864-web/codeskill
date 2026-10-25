"use client";

import type { RefObject } from "react";
import { Globe, Loader2 } from "lucide-react";

export function ProjectPreviewFrame({
  frameRef,
  url,
  generation,
  visible,
  busy,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  url: string | null;
  generation: number;
  visible: boolean;
  busy: boolean;
}) {
  return (
    <div
      hidden={!visible}
      className={visible ? "relative min-h-0 flex-1 bg-background" : "hidden"}
    >
      {url ? (
        <iframe
          ref={frameRef}
          key={`${generation}:${url}`}
          src={url}
          title="Project live preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads"
          referrerPolicy="no-referrer"
          className="h-full w-full border-0 bg-white"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="grid size-12 place-items-center rounded-2xl border border-border bg-card">
            {busy ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <Globe className="size-5 text-muted-foreground" />
            )}
          </div>
          <h2 className="text-sm font-semibold">
            {busy ? "Starting your workspace" : "Bring your project to life"}
          </h2>
          <p className="max-w-xs text-xs leading-6 text-muted-foreground">
            {busy
              ? "Preparing an isolated container and starting your selected stack."
              : "Choose Run project to start a live preview beside your code."}
          </p>
        </div>
      )}
    </div>
  );
}
