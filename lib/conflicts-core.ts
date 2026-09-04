// Pure overlap logic — no database access. Extracted so the conflict rules
// can be unit-tested (lib/conflicts-core.test.ts) and reused.
// A "conflict" = two non-cancelled bookings on the same vehicle whose date
// ranges share open interior. Touching ranges (b.end == a.start) are OK.

export type Range = { startAt: Date; endAt: Date };

/** Open-interior overlap. Touching ranges (end == start) do NOT overlap. */
export function overlaps(a: Range, b: Range): boolean {
  return a.startAt.getTime() < b.endAt.getTime() && a.endAt.getTime() > b.startAt.getTime();
}

/**
 * Conflicts for one booking among a set of candidates: same vehicle, open
 * interior overlap, excluding itself. Cancelled bookings are expected to be
 * filtered out by the caller before this runs. The returned elements are the
 * matching candidates (with their full type preserved).
 */
export function findConflictsAmong<
  B extends Range & { id: string; vehicleId: number },
  T extends B,
>(booking: B, candidates: readonly T[]): T[] {
  const sMs = booking.startAt.getTime();
  const eMs = booking.endAt.getTime();
  return candidates.filter(
    (c) => c.id !== booking.id && c.vehicleId === booking.vehicleId && c.startAt.getTime() < eMs && c.endAt.getTime() > sMs,
  );
}
