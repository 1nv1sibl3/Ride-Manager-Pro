"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card mx-auto max-w-md text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={18} />
      </div>
      <h2 className="font-semibold">Something went wrong</h2>
      <p className="mt-1 text-sm text-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && <p className="mt-1 text-xs text-muted-2">Error ref: {error.digest}</p>}
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
