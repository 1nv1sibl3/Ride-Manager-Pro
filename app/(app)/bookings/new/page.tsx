import { prisma } from "@/lib/db";
import { NewBookingClient } from "./client";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  const [vehicles, bookings] = await Promise.all([
    prisma.vehicle.findMany({
      where: { status: { not: "retired" } },
      orderBy: [{ srNo: "asc" }, { plate: "asc" }],
    }),
    // Load every booking that could still block a vehicle window.
    // Cancelled bookings free the vehicle. Closed/returned ones are in the past
    // but cheap to ship — overlap check on the client is just (start<end && end>start).
    prisma.booking.findMany({
      where: { status: { notIn: ["cancelled"] } },
      select: { id: true, vehicleId: true, startAt: true, endAt: true, refNumber: true, customerName: true },
    }),
  ]);
  return (
    <NewBookingClient
      vehicles={vehicles.map((v) => ({
        srNo: v.srNo, plate: v.plate, model: v.model, year: v.year, status: v.status,
        category: v.category, series: v.series,
        dailyRate: v.dailyRate, monthlyRate: v.monthlyRate, deposit: v.deposit,
      }))}
      bookings={bookings.map((b) => ({
        id: b.id, vehicleId: b.vehicleId,
        startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString(),
        refNumber: b.refNumber, customerName: b.customerName,
      }))}
    />
  );
}
