import { describe, expect, it } from "vitest";
import { overlaps, findConflictsAmong } from "./conflicts-core";

const H = 60 * 60 * 1000;
const D = 24 * H;

type B = { id: string; vehicleId: number; startAt: Date; endAt: Date };

const booking = (id: string, vehicleId: number, start: Date, end: Date): B => ({
  id,
  vehicleId,
  startAt: start,
  endAt: end,
});

describe("overlaps", () => {
  it("partial overlap", () => {
    const a = { startAt: new Date(0), endAt: new Date(D) };
    const b = { startAt: new Date(D / 2), endAt: new Date(2 * D) };
    expect(overlaps(a, b)).toBe(true);
  });

  it("contained", () => {
    const a = { startAt: new Date(0), endAt: new Date(3 * D) };
    const b = { startAt: new Date(D), endAt: new Date(2 * D) };
    expect(overlaps(a, b)).toBe(true);
  });

  it("touching (end == start) is NOT a conflict — back-to-back is fine", () => {
    const a = { startAt: new Date(0), endAt: new Date(D) };
    const b = { startAt: new Date(D), endAt: new Date(2 * D) };
    expect(overlaps(a, b)).toBe(false);
  });

  it("fully disjoint", () => {
    const a = { startAt: new Date(0), endAt: new Date(D) };
    const b = { startAt: new Date(5 * D), endAt: new Date(6 * D) };
    expect(overlaps(a, b)).toBe(false);
  });

  it("symmetric", () => {
    const a = { startAt: new Date(0), endAt: new Date(D) };
    const b = { startAt: new Date(D / 2), endAt: new Date(2 * D) };
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });
});

describe("findConflictsAmong", () => {
  const base = booking("a", 1, new Date(0), new Date(D));

  it("finds same-vehicle overlaps", () => {
    const others = [booking("b", 1, new Date(D / 2), new Date(2 * D))];
    expect(findConflictsAmong(base, others).map((c) => c.id)).toEqual(["b"]);
  });

  it("ignores other vehicles", () => {
    const others = [booking("b", 2, new Date(D / 2), new Date(2 * D))];
    expect(findConflictsAmong(base, others)).toEqual([]);
  });

  it("excludes itself", () => {
    expect(findConflictsAmong(base, [base])).toEqual([]);
  });

  it("excludes touching bookings on the same vehicle", () => {
    const others = [booking("b", 1, new Date(D), new Date(2 * D))];
    expect(findConflictsAmong(base, others)).toEqual([]);
  });

  it("returns multiple conflicts in candidate order", () => {
    const others = [
      booking("b", 1, new Date(D / 2), new Date(2 * D)),
      booking("c", 2, new Date(0), new Date(D)),
      booking("d", 1, new Date(-D), new Date(D / 2)),
    ];
    expect(findConflictsAmong(base, others).map((c) => c.id)).toEqual(["b", "d"]);
  });
});
