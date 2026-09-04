// Pure settlement math for a booking's payment ledger. Extracted so it can be
// unit-tested and reused (booking detail UI, reports, seed verification).

export type SettlementPayment = {
  kind: string;
  amount: number;
  note?: string | null;
};

export type Settlement = {
  totalDue: number;             // quoted rent + damage charges
  paid: number;                 // money in, excluding deposits and refunds
  otherRefunds: number;         // non-deposit refunds
  depositTaken: number;
  depositRefunded: number;
  depositHeld: number;
  netRentPaid: number;          // paid minus non-deposit refunds
  rentShortfall: number;        // rent still unpaid
  excessAdvance: number;        // customer overpaid rent
  depositCoversRent: number;    // deposit that would settle unpaid rent
  suggestedDepositRefund: number;
  balance: number;              // raw rent balance
  depositStatus: "none" | "held" | "partial" | "refunded";
};

// Deposit refunds are tagged via note "Deposit refund…" by the refundDeposit action.
const isDepositRefund = (p: SettlementPayment) =>
  p.kind === "refund" && (p.note ?? "").startsWith("Deposit refund");

export function computeSettlement(
  payments: SettlementPayment[],
  quotedAmount: number,
  damageCharges: number,
): Settlement {
  const totalDue = quotedAmount + damageCharges;
  const paid = payments
    .filter((p) => p.kind !== "deposit" && p.kind !== "refund")
    .reduce((s, p) => s + p.amount, 0);
  const otherRefunds = payments
    .filter((p) => p.kind === "refund" && !isDepositRefund(p))
    .reduce((s, p) => s + p.amount, 0);
  const depositTaken = payments
    .filter((p) => p.kind === "deposit")
    .reduce((s, p) => s + p.amount, 0);
  const depositRefunded = payments.filter(isDepositRefund).reduce((s, p) => s + p.amount, 0);
  const depositHeld = Math.max(0, depositTaken - depositRefunded);
  const netRentPaid = paid - otherRefunds;
  const rentShortfall = Math.max(0, totalDue - netRentPaid);
  const excessAdvance = Math.max(0, netRentPaid - totalDue);
  const depositCoversRent = Math.min(depositHeld, rentShortfall);
  const suggestedDepositRefund = Math.max(0, depositHeld - rentShortfall);
  const balance = totalDue - paid + otherRefunds;
  const depositStatus =
    depositTaken === 0
      ? "none"
      : depositRefunded === 0
        ? "held"
        : depositHeld === 0
          ? "refunded"
          : "partial";

  return {
    totalDue, paid, otherRefunds, depositTaken, depositRefunded, depositHeld,
    netRentPaid, rentShortfall, excessAdvance, depositCoversRent,
    suggestedDepositRefund, balance, depositStatus,
  };
}
