"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";

export type BellNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function getUnreadCount(): Promise<number> {
  try {
    const s = await requireSession();
    return await prisma.notification.count({ where: { userId: s.id, readAt: null } });
  } catch {
    return 0;
  }
}

export async function getRecentForBell(): Promise<BellNotification[]> {
  try {
    const s = await requireSession();
    const rows = await prisma.notification.findMany({
      where: { userId: s.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  const s = await requireSession();
  await prisma.notification.updateMany({
    where: { id, userId: s.id },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const s = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: s.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { ok: true };
}
