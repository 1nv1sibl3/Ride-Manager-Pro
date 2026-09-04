import { prisma } from "./db";
import type { AuditAction } from "@prisma/client";

export async function logAudit(opts: {
  tableName: string;
  rowId: string;
  action: AuditAction;
  actorId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      tableName: opts.tableName,
      rowId: opts.rowId,
      action: opts.action,
      actorId: opts.actorId ?? null,
      before: (opts.before ?? undefined) as never,
      after: (opts.after ?? undefined) as never,
    },
  });
}

// Booking ref numbers are an auto-incrementing Postgres sequence on
// Booking.refNumber. Race-safe by design — no manual counting needed.
export function formatBookingRef(n: number): string {
  return `#${n}`;
}
