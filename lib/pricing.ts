export function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function monthsBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil(daysBetween(start, end) / 30));
}

// Quote = rate * units. Days for "daily", months for "monthly".
export function calcQuote(plan: "daily" | "monthly", start: Date, end: Date, rate: number): { units: number; total: number } {
  const units = plan === "monthly" ? monthsBetween(start, end) : daysBetween(start, end);
  return { units, total: units * rate };
}

export function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
