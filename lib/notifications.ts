import { prisma } from "@/lib/db";
import type { Role } from "@/lib/session";

// In-app notifications. Fan-out happens at event time: one row per matching
// active user. A shop has a handful of users, so this keeps read/unread
// queries trivial (WHERE userId AND readAt IS NULL) with no join state.
// A user created after an event simply doesn't see older notifications.

export type NotifyInput = {
  type: string;
  title: string;
  body?: string;
  link?: string;
  roles?: Role[]; // default: every active user
  exceptUserId?: string; // usually the actor — don't notify yourself
};

/** Best-effort: catches everything so a notification failure never breaks the mutation. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: {
        active: true,
        ...(input.roles ? { role: { in: input.roles } } : {}),
        ...(input.exceptUserId ? { id: { not: input.exceptUserId } } : {}),
      },
      select: { id: true },
    });
    if (users.length === 0) return;
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      })),
    });
  } catch (e) {
    console.error("[notify] failed:", e);
  }
}
