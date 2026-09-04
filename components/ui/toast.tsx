"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Module-level pub/sub so any client component can call toast.success(...)
// without prop drilling or context.

export type ToastItem = {
  id: number;
  kind: "success" | "error";
  title: string;
  desc?: string;
};

let seq = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<(list: ToastItem[]) => void>();

function emit() {
  for (const l of listeners) l(toasts);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(kind: ToastItem["kind"], title: string, desc?: string) {
  const t = { id: ++seq, kind, title, desc };
  toasts = [...toasts, t].slice(-4); // never more than 4 on screen
  emit();
  setTimeout(() => dismiss(t.id), 4000);
}

export const toast = {
  success: (title: string, desc?: string) => push("success", title, desc),
  error: (title: string, desc?: string) => push("error", title, desc),
};

/**
 * Fires a toast for the `{ ok: true } | { error: string }` result shape
 * returned by the app's server actions. Call only after handling any
 * `{ conflicts }` branch yourself.
 */
export function toastResult(
  r: { ok?: boolean; error?: string } | null | undefined,
  success: string,
) {
  if (r && r.error) toast.error(r.error);
  else toast.success(success);
}

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  if (list.length === 0) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            "toast-in card flex items-start gap-2.5 p-3 shadow-md",
            t.kind === "error" && "border-danger",
          )}
        >
          {t.kind === "success" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
          ) : (
            <XCircle size={16} className="mt-0.5 shrink-0 text-danger" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{t.title}</div>
            {t.desc && <div className="mt-0.5 text-xs text-muted">{t.desc}</div>}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className="rounded-md p-0.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
