"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { enterDocumentFullscreen, fullscreenEvents, isDocumentFullscreen } from "@/lib/fullscreen";
interface UseFullscreenOptions {
  enabled: boolean;
  onViolation: () => void;
}
export function useFullscreen({ enabled, onViolation }: UseFullscreenOptions) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const previous = useRef(false);
  const callback = useRef(onViolation);
  useEffect(() => {
    callback.current = onViolation;
  }, [onViolation]);
  const requestFullscreen = useCallback(async () => {
    await enterDocumentFullscreen();
    previous.current = true;
    setIsFullscreen(true);
    setHasRequested(true);
  }, []);
  useEffect(() => {
    const sync = () => {
      const active = isDocumentFullscreen();
      const exited = previous.current && !active;
      previous.current = active;
      setIsFullscreen(active);
      if (active) setHasRequested(true);
      if (enabled && exited) callback.current();
    };
    // Includes fullscreen inherited from the briefing or a route transition.
    sync();
    for (const event of fullscreenEvents) document.addEventListener(event, sync);
    return () => { for (const event of fullscreenEvents) document.removeEventListener(event, sync); };
  }, [enabled]);
  return { isFullscreen, requestFullscreen, hasRequested };
}
