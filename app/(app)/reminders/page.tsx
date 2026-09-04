import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { istDayKey, istDayStart } from "@/lib/reminder-scan";
import { RemindersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  await requireSession();

  const now = new Date();
  const todayStart = istDayStart(istDayKey(now));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [overdue, today, upcoming, done, vehicles, bookings] = await Promise.all([
    prisma.reminder.findMany({
      where: { doneAt: null, dueAt: { lt: todayStart } },
      orderBy: { dueAt: "asc" },
      include: { vehicle: true, booking: true },
    }),
    prisma.reminder.findMany({
      where: { doneAt: null, dueAt: { gte: todayStart, lt: tomorrowStart } },
      orderBy: { dueAt: "asc" },
      include: { vehicle: true, booking: true },
    }),
    prisma.reminder.findMany({
      where: { doneAt: null, dueAt: { gte: tomorrowStart } },
      orderBy: { dueAt: "asc" },
      take: 25,
      include: { vehicle: true, booking: true },
    }),
    prisma.reminder.findMany({
      where: { doneAt: { not: null } },
      orderBy: { doneAt: "desc" },
      take: 10,
      include: { vehicle: true, booking: true },
    }),
    prisma.vehicle.findMany({
      where: { status: { not: "retired" } },
      select: { srNo: true, plate: true, model: true },
      orderBy: { srNo: "asc" },
    }),
    prisma.booking.findMany({
      where: { status: { in: ["booked", "handed_over", "active"] } },
      select: { id: true, refNumber: true, customerName: true, endAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const serialize = (rows: typeof overdue) =>
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      notes: r.notes,
      dueAt: r.dueAt.toISOString(),
      doneAt: r.doneAt?.toISOString() ?? null,
      systemKey: r.systemKey,
      vehicle: r.vehicle ? { srNo: r.vehicle.srNo, plate: r.vehicle.plate, model: r.vehicle.model } : null,
      booking: r.booking ? { id: r.booking.id, refNumber: r.booking.refNumber, customerName: r.booking.customerName } : null,
    }));

  return (
    <RemindersClient
      overdue={serialize(overdue)}
      today={serialize(today)}
      upcoming={serialize(upcoming)}
      done={serialize(done)}
      vehicles={vehicles}
      bookings={bookings.map((b) => ({ ...b, endAt: b.endAt.toISOString() }))}
    />
  );
}
