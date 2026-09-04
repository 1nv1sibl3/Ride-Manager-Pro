"use client";

import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead, type BellNotification } from "./actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/utils";

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

export function NotificationsList({
  items,
  hasUnread,
}: {
  items: BellNotification[];
  hasUnread: boolean;
}) {
  const router = useRouter();

  async function onItem(n: BellNotification) {
    if (!n.readAt) await markNotificationRead(n.id).catch(() => {});
    router.push(n.link || "/dashboard");
  }

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await markAllNotificationsRead().catch(() => {});
              router.refresh();
            }}
          >
            <CheckCheck size={13} /> Mark all read
          </Button>
        </div>
      )}

      <div className="card divide-y divide-border p-0">
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onItem(n)}
            className={cn(
              "block w-full px-4 py-3 text-left transition hover:bg-surface-2",
              !n.readAt && "bg-primary-soft/50",
            )}
          >
            <div className="flex items-start gap-3">
              <span aria-hidden className="mt-0.5 text-base">{TYPE_ICON[n.type] ?? "🔔"}</span>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm", !n.readAt && "font-medium")}>{n.title}</div>
                {n.body && <div className="mt-0.5 text-xs text-muted">{n.body}</div>}
                <div className="mt-1 text-[11px] text-muted-2">
                  {fmtDate(n.createdAt)} · {n.type.replace(/_/g, " ")}
                </div>
              </div>
              {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <EmptyState
            icon={Bell}
            title="No notifications"
            hint="Booking, payment and reminder activity shows up here."
          />
        )}
      </div>
    </div>
  );
}
