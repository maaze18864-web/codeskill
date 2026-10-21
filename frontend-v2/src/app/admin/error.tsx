"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/errors/ErrorFallback";
import { logger } from "@/lib/logger";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error("Admin route rendering failed", {
      name: error?.name || "Error",
      digest: error?.digest,
      message: process.env.NODE_ENV === "development" ? error?.message : undefined,
    }, "ErrorBoundary");
  }, [error]);

  return <ErrorFallback error={error} reset={reset} homeHref="/admin/dashboard" homeLabel="Admin Dashboard" />;
}
