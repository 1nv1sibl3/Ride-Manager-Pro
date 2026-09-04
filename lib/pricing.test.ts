import { describe, expect, it } from "vitest";
import { daysBetween, monthsBetween, calcQuote, inr } from "./pricing";

const H = 60 * 60 * 1000;
const D = 24 * H;

describe("daysBetween", () => {
  it("same-day rentals count as 1 day (not 0)", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    expect(daysBetween(start, new Date(start.getTime() + 4 * H))).toBe(1);
  });

  it("exactly 24h counts as 1 day", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    expect(daysBetween(start, new Date(start.getTime() + D))).toBe(1);
  });

  it("25h rounds up to 2 days", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    expect(daysBetween(start, new Date(start.getTime() + D + H))).toBe(2);
  });

  it("inverted ranges clamp to 1 (never zero/negative)", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    expect(daysBetween(start, new Date(start.getTime() - D))).toBe(1);
  });
});

describe("monthsBetween", () => {
  it("30 days = 1 month", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(monthsBetween(start, new Date(start.getTime() + 30 * D))).toBe(1);
  });

  it("31 days rounds up to 2 months", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    expect(monthsBetween(start, new Date(start.getTime() + 31 * D))).toBe(2);
  });
});

describe("calcQuote", () => {
  it("daily: rate × days", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end = new Date("2026-06-04T10:00:00Z"); // 3 days
    expect(calcQuote("daily", start, end, 500)).toEqual({ units: 3, total: 1500 });
  });

  it("monthly: rate × months", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end = new Date("2026-07-01T10:00:00Z"); // 30 days
    expect(calcQuote("monthly", start, end, 9000)).toEqual({ units: 1, total: 9000 });
  });
});

describe("inr", () => {
  it("formats with the rupee sign and en-IN grouping", () => {
    expect(inr(1234)).toContain("1,234");
    expect(inr(150000)).toContain("1,50,000"); // lakh grouping
  });

  it("drops decimals", () => {
    expect(inr(500.9)).not.toContain(".");
  });
});
