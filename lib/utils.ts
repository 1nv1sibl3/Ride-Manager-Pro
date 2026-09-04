import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// All display times are rendered in IST (Asia/Kolkata) regardless of server tz.
const IST_OPTS: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata", hour12: true };

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-IN", { ...IST_OPTS, dateStyle: "medium", timeStyle: "short" });
}

export function fmtDateShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-IN", { ...IST_OPTS, dateStyle: "medium" });
}

// Parse a <input type="datetime-local"> value (e.g. "2025-06-24T14:30") as IST wall-clock
// and return a UTC Date. Avoids server-tz drift when the Node process runs in UTC/etc.
export function parseIstLocal(value: string): Date {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return new Date(value);
  const [, y, mo, d, h, mi, s] = m;
  // IST = UTC+05:30 (no DST). Build an ISO string with the +05:30 offset.
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}+05:30`;
  return new Date(iso);
}

// Format a Date as IST `YYYY-MM-DDTHH:MM` for <input type="datetime-local"> defaults.
export function toIstInputValue(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((a, p) => (p.type !== "literal" ? (a[p.type] = p.value, a) : a), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
