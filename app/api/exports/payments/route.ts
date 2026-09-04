import { prisma } from "@/lib/db";
import { toCSV, csvResponse } from "@/lib/csv";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  // Financial data (full payment ledger with staff attribution) — owner only.
  if (session.role !== "owner") return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const start = new Date(dateStr); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { booking: { select: { refNumber: true, customerName: true } }, recordedBy: { select: { username: true } } },
    orderBy: { createdAt: "asc" },
  });
  const rows = payments.map((p) => ({
    time: p.createdAt.toISOString(),
    ref: p.booking.refNumber,
    customer: p.booking.customerName,
    kind: p.kind,
    amount: p.kind === "refund" ? -p.amount : p.amount,
    mode: p.mode,
    reference: p.reference ?? "",
    note: p.note ?? "",
    by: p.recordedBy.username,
  }));
  return csvResponse(`payments-${dateStr}.csv`, toCSV(rows));
}
