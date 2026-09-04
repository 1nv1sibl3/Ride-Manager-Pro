import { prisma } from "@/lib/db";
import { toCSV, csvResponse } from "@/lib/csv";
import { getSession } from "@/lib/session";

export async function GET() {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const vehicles = await prisma.vehicle.findMany({
    include: { bookings: { where: { status: { in: ["handed_over", "active", "returned", "closed"] } } } },
    orderBy: { plate: "asc" },
  });
  const rows = vehicles.map((v) => {
    const revenue = v.bookings.reduce((s, b) => s + b.quotedAmount + b.damageCharges, 0);
    const rentedDays = v.bookings.reduce((s, b) => {
      const e = b.actualReturnAt ?? b.endAt;
      const ms = new Date(e).getTime() - new Date(b.startAt).getTime();
      return s + Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }, 0);
    return { plate: v.plate, model: v.model, status: v.status, bookings: v.bookings.length, rented_days: rentedDays, revenue };
  });
  return csvResponse(`utilization-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
}
