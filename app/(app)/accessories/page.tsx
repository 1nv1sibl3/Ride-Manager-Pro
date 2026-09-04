import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { AccessoriesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AccessoriesPage() {
  const session = await requireSession();

  const [accessories, logs, bookings] = await Promise.all([
    prisma.accessory.findMany({ orderBy: { name: "asc" } }),
    prisma.accessoryLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { accessory: { select: { name: true } }, createdBy: { select: { username: true } } },
    }),
    prisma.booking.findMany({
      where: { status: { in: ["booked", "handed_over", "active"] } },
      select: { refNumber: true, customerName: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <AccessoriesClient
      role={session.role}
      accessories={accessories}
      logs={logs.map((l) => ({
        id: l.id,
        accessoryName: l.accessory.name,
        quantity: l.quantity,
        kind: l.kind,
        bookingRef: l.bookingRef,
        note: l.note,
        by: l.createdBy.username,
        at: l.createdAt.toISOString(),
      }))}
      bookingRefs={bookings.map((b) => `#${b.refNumber} ${b.customerName}`)}
    />
  );
}
