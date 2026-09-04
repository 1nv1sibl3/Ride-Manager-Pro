// Conflict detection helpers.
// A "conflict" = two non-cancelled bookings on the same vehicle whose date
// ranges share open interior. Touching ranges (b.end == a.start) are OK.
// Conflicts are computed on read — never stored on the booking row.
// The pure overlap rules live in lib/conflicts-core.ts (unit-tested there).
import { prisma } from "@/lib/db";
import { findConflictsAmong } from "./conflicts-core";

export type Conflict = {
  id: string;
  refNumber: number;
  customerName: string;
  vehicleId: number;
  startAt: string;
  endAt: string;
  status: string;
};

export async function findConflicts(
  vehicleId: number,
  start: Date,
  end: Date,
  excludeBookingId?: string,
): Promise<Conflict[]> {
  const rows = await prisma.booking.findMany({
    where: {
      vehicleId,
      status: { notIn: ["cancelled"] },
      startAt: { lt: end },
      endAt: { gt: start },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: {
      id: true, refNumber: true, customerName: true,
      vehicleId: true, startAt: true, endAt: true, status: true,
    },
    orderBy: { startAt: "asc" },
  });
  return rows.map((r) => ({
    ...r,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
  }));
}

// Bulk variant: one query per page of bookings instead of N+1.
// Returns a map of bookingId → Conflict[] (excluding self).
export async function findConflictsForBookings(
  bookings: { id: string; vehicleId: number; startAt: Date; endAt: Date }[],
): Promise<Map<string, Conflict[]>> {
  const result = new Map<string, Conflict[]>();
  if (bookings.length === 0) return result;
  const vehicleIds = Array.from(new Set(bookings.map((b) => b.vehicleId)));
  const all = await prisma.booking.findMany({
    where: { vehicleId: { in: vehicleIds }, status: { notIn: ["cancelled"] } },
    select: {
      id: true, refNumber: true, customerName: true,
      vehicleId: true, startAt: true, endAt: true, status: true,
    },
  });
  const byVehicle = new Map<number, typeof all>();
  for (const b of all) {
    const arr = byVehicle.get(b.vehicleId) ?? [];
    arr.push(b);
    byVehicle.set(b.vehicleId, arr);
  }
  for (const b of bookings) {
    const candidates = byVehicle.get(b.vehicleId) ?? [];
    const conflicts = findConflictsAmong(b, candidates).map((c) => ({
      ...c,
      startAt: c.startAt.toISOString(),
      endAt: c.endAt.toISOString(),
    }));
    if (conflicts.length) result.set(b.id, conflicts);
  }
  return result;
}
