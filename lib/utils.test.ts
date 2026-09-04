import { describe, expect, it } from "vitest";
import { parseIstLocal, toIstInputValue } from "./utils";

describe("parseIstLocal", () => {
  it("parses an IST wall-clock datetime-local value into the correct UTC instant", () => {
    // 10:00 IST = 04:30 UTC (IST is UTC+05:30, no DST).
    const d = parseIstLocal("2026-06-24T10:00");
    expect(d.toISOString()).toBe("2026-06-24T04:30:00.000Z");
  });

  it("handles midnight IST (previous day in UTC)", () => {
    const d = parseIstLocal("2026-06-24T00:00");
    expect(d.toISOString()).toBe("2026-06-23T18:30:00.000Z");
  });

  it("accepts optional seconds", () => {
    const d = parseIstLocal("2026-06-24T10:00:30");
    expect(d.toISOString()).toBe("2026-06-24T04:30:30.000Z");
  });

  it("falls back to the Date constructor for other formats", () => {
    const d = parseIstLocal("2026-06-24T04:30:00.000Z");
    expect(d.toISOString()).toBe("2026-06-24T04:30:00.000Z");
  });
});

describe("toIstInputValue", () => {
  it("renders a UTC instant as an IST datetime-local string", () => {
    expect(toIstInputValue(new Date("2026-06-24T04:30:00.000Z"))).toBe("2026-06-24T10:00");
  });

  it("round-trips with parseIstLocal", () => {
    const original = "2027-01-15T18:45";
    const parsed = parseIstLocal(original);
    expect(toIstInputValue(parsed)).toBe(original);
  });
});
