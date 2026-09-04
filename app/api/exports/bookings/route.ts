import { prisma } from "@/lib/db";
import { toCSV, csvResponse } from "@/lib/csv";
import { getSession } from "@/lib/session";

export async function GET() {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" }, include: { vehicle: true, payments: true },
  });
  const rows = bookings.map((b) => ({
    ref: b.refNumber,
    source: b.source,
    status: b.status,
    customer: b.customerName,
    phone: b.customerPhone,
    alt_phone: b.altPhone ?? "",
    email: b.email ?? "",
    plate: b.vehicle.plate,
    model: b.vehicle.model,
    plan: b.plan,
    start: b.startAt.toISOString(),
    end: b.endAt.toISOString(),
    actual_return: b.actualReturnAt?.toISOString() ?? "",
    quoted: b.quotedAmount,
    deposit: b.depositAmount,
    damage: b.damageCharges,
    paid_total: b.payments.filter((p) => p.kind !== "deposit" && p.kind !== "refund").reduce((s, p) => s + p.amount, 0),
    refunds: b.payments.filter((p) => p.kind === "refund").reduce((s, p) => s + p.amount, 0),
    created_at: b.createdAt.toISOString(),
  }));
  return csvResponse(`bookings-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
}
