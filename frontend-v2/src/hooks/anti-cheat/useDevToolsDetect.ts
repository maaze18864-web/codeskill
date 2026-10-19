"use client";

import { useEffect } from "react";

interface UseDevToolsDetectOptions {
  enabled: boolean;
  onViolation: (type: string) => void;
}

export function useDevToolsDetect({ enabled, onViolation }: UseDevToolsDetectOptions) {
  useEffect(() => {
    if (!enabled) return;

    let devtoolsOpen = false;

    // Technique 1: Window size threshold check (crude but effective)
    const checkWindowSize = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;

      if (widthThreshold || heightThreshold) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          onViolation("DevTools_Resized");
        }
      } else {
        devtoolsOpen = false;
      }
    };

    window.addEventListener("resize", checkWindowSize);

    // Technique 2: Periodic dimension threshold check for undocked/docked DevTools
    const checkInterval = setInterval(() => {
      checkWindowSize();
    }, 2000);

    return () => {
      window.removeEventListener("resize", checkWindowSize);
      clearInterval(checkInterval);
    };
  }, [enabled, onViolation]);
}
