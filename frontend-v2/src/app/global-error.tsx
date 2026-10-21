"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/errors/ErrorFallback";
import { logger } from "@/lib/logger";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error("Root layout rendering failed", {
      name: error?.name || "Error",
      digest: error?.digest,
      message: process.env.NODE_ENV === "development" ? error?.message : undefined,
    }, "ErrorBoundary");
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <ErrorFallback error={error} reset={reset} reloadOnRetry />
      </body>
    </html>
  );
}
