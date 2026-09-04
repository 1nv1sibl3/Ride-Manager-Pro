import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { findConflicts } from "@/lib/conflicts";
import { BookingDetailClient } from "./client";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const [booking, vehicles, bookings] = await Promise.all([
    prisma.booking.findUnique({
      where: { id },
      include: {
        vehicle: true,
        payments: { orderBy: { createdAt: "desc" }, include: { recordedBy: { select: { username: true } } } },
        amendments: {
          orderBy: { createdAt: "desc" },
          include: {
            fromVehicle: { select: { plate: true, model: true } },
            toVehicle: { select: { plate: true, model: true } },
            createdBy: { select: { username: true, fullName: true } },
          },
        },
        createdBy: { select: { username: true, fullName: true } },
      },
    }),
    prisma.vehicle.findMany({ where: { status: { not: "retired" } }, orderBy: [{ srNo: "asc" }, { plate: "asc" }] }),
    prisma.booking.findMany({
      where: { status: { notIn: ["cancelled"] } },
      select: { id: true, vehicleId: true, startAt: true, endAt: true, refNumber: true, customerName: true },
    }),
  ]);
  if (!booking) notFound();

  // Live overlap check for this booking's current window — surfaces in the
  // Conflicts card on the detail page.
  const conflicts =
    booking.status === "cancelled"
      ? []
      : await findConflicts(booking.vehicleId, booking.startAt, booking.endAt, booking.id);

  return (
    <BookingDetailClient
      booking={JSON.parse(JSON.stringify(booking))}
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
      conflicts={conflicts}
      isOwner={session?.role === "owner"}
    />
  );
}
