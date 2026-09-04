"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={20} />
      </div>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <Link href="/dashboard" className="btn">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
