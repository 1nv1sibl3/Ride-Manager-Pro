"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import {
  getRecentForBell,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type BellNotification,
} from "@/app/(app)/notifications/actions";
import { cn } from "@/lib/utils";

// Header bell. Takes the server-rendered unread count, then re-fetches on
// navigation — the Next router cache doesn't re-render the shared layout on
// client navigations, so the count has to be refreshed client-side.

const TYPE_ICON: Record<string, string> = {
  booking_created: "🆕",
  booking_handed_over: "🔑",
  booking_returned: "🔄",
  booking_closed: "✅",
  booking_cancelled: "🚫",
  booking_amended: "✏️",
  conflict_detected: "⚠️",
  payment_recorded: "💰",
  payment_edited: "✏️",
  payment_deleted: "🗑️",
  user_created: "👤",
  user_updated: "👤",
  reminder_due: "⏰",
  service_due: "🔧",
  low_stock: "📦",
  email_failed: "📧",
};

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BellNotification[] | null>(null);
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  // Refresh the badge whenever the page changes.
  useEffect(() => {
    getUnreadCount().then(setCount).catch(() => {});
  }, [pathname]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(null);
      setItems(await getRecentForBell().catch(() => []));
    }
  }

  async function onItem(n: BellNotification) {
    setOpen(false);
    if (!n.readAt) {
      markNotificationRead(n.id).catch(() => {});
      setCount((c) => Math.max(0, c - 1));
    }
    if (n.link) router.push(n.link);
    else router.push("/notifications");
  }

  async function onMarkAll() {
    setBusy(true);
    await markAllNotificationsRead().catch(() => {});
    setCount(0);
    setItems(await getRecentForBell().catch(() => []));
    setBusy(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-surface-2"
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="card absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] p-0 shadow-md">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-medium">Notifications</span>
            {count > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                disabled={busy}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null && <div className="px-4 py-6 text-center text-sm text-muted">Loading…</div>}
            {items?.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted">You&apos;re all caught up.</div>
            )}
            {items?.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onItem(n)}
                className={cn(
                  "block w-full px-4 py-2.5 text-left transition hover:bg-surface-2",
                  !n.readAt && "bg-primary-soft/50",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-0.5 text-sm">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm", !n.readAt && "font-medium")}>{n.title}</div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</div>}
                    <div className="mt-0.5 text-[10px] text-muted-2">{timeAgo(n.createdAt)}</div>
                  </div>
                  {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-border px-4 py-2 text-center">
            <Link href="/notifications" onClick={() => setOpen(false)} className="link text-xs">
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });
}
