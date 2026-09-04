import { describe, expect, it } from "vitest";
import { computeSettlement, type SettlementPayment } from "./settlement";

const pay = (kind: string, amount: number, note?: string): SettlementPayment => ({ kind, amount, note });

describe("computeSettlement", () => {
  it("no payments: everything is shortfall", () => {
    const s = computeSettlement([], 1000, 0);
    expect(s.totalDue).toBe(1000);
    expect(s.paid).toBe(0);
    expect(s.rentShortfall).toBe(1000);
    expect(s.balance).toBe(1000);
    expect(s.depositStatus).toBe("none");
  });

  it("fully paid, no deposit", () => {
    const s = computeSettlement([pay("advance", 400), pay("balance", 600)], 1000, 0);
    expect(s.paid).toBe(1000);
    expect(s.balance).toBe(0);
    expect(s.rentShortfall).toBe(0);
    expect(s.excessAdvance).toBe(0);
  });

  it("damage charges add to what is due", () => {
    const s = computeSettlement([pay("advance", 1000)], 1000, 500);
    expect(s.totalDue).toBe(1500);
    expect(s.rentShortfall).toBe(500);
  });

  it("excess advance is flagged for refund", () => {
    const s = computeSettlement([pay("advance", 1500)], 1000, 0);
    expect(s.excessAdvance).toBe(500);
    expect(s.rentShortfall).toBe(0);
  });

  it("deposit held: full, partial and refunded states", () => {
    const held = computeSettlement([pay("deposit", 2000), pay("advance", 1000)], 1000, 0);
    expect(held.depositTaken).toBe(2000);
    expect(held.depositHeld).toBe(2000);
    expect(held.depositStatus).toBe("held");

    const partial = computeSettlement(
      [pay("deposit", 2000), pay("advance", 1000), pay("refund", 500, "Deposit refund — minor scratch")],
      1000,
      0,
    );
    expect(partial.depositHeld).toBe(1500);
    expect(partial.depositStatus).toBe("partial");

    const refunded = computeSettlement(
      [pay("deposit", 2000), pay("advance", 1000), pay("refund", 2000, "Deposit refund")],
      1000,
      0,
    );
    expect(refunded.depositHeld).toBe(0);
    expect(refunded.depositStatus).toBe("refunded");
  });

  it("non-deposit refunds are not mistaken for deposit refunds", () => {
    const s = computeSettlement(
      [pay("deposit", 2000), pay("advance", 1200), pay("refund", 200, "Excess advance returned")],
      1000,
      0,
    );
    expect(s.otherRefunds).toBe(200);
    expect(s.depositHeld).toBe(2000); // untouched by the non-deposit refund
    expect(s.netRentPaid).toBe(1000);
    expect(s.excessAdvance).toBe(0);
  });

  it("deposit can cover unpaid rent, remainder is refundable", () => {
    // Quote 1000, paid 400, deposit 2000 → shortfall 600 comes out of deposit.
    const s = computeSettlement([pay("deposit", 2000), pay("advance", 400)], 1000, 0);
    expect(s.rentShortfall).toBe(600);
    expect(s.depositCoversRent).toBe(600);
    expect(s.suggestedDepositRefund).toBe(1400);
  });

  it("deposit fully absorbed by rent + damage", () => {
    const s = computeSettlement([pay("deposit", 2000), pay("advance", 400)], 1000, 1500);
    expect(s.rentShortfall).toBe(2100);
    expect(s.depositCoversRent).toBe(2000);
    expect(s.suggestedDepositRefund).toBe(0);
  });
});
