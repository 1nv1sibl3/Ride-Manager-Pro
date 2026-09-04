import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { parseListParams, PAGE_SIZE } from "@/lib/pagination";
import { Pagination } from "@/components/ui/table";
import { NotificationsList } from "./client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const filter = sp.filter === "unread" ? "unread" : "all";
  const list = parseListParams(sp, ["createdAt"], { field: "createdAt", dir: "desc" });

  const where = { userId: session.id, ...(filter === "unread" ? { readAt: null } : {}) };

  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: list.skip,
      take: list.take,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: session.id, readAt: null } }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted">{unreadCount} unread</p>
        </div>
        <div className="flex gap-1">
          <Link
            href="/notifications"
            className={`btn btn-sm ${filter === "all" ? "btn-primary" : ""}`}
          >
            All
          </Link>
          <Link
            href="/notifications?filter=unread"
            className={`btn btn-sm ${filter === "unread" ? "btn-primary" : ""}`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Link>
        </div>
      </div>

      <NotificationsList
        items={rows.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        }))}
        hasUnread={unreadCount > 0}
      />

      <Pagination page={list.page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
