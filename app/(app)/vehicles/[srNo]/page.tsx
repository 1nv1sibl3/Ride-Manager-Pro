import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { inr } from "@/lib/pricing";
import { fmtDate, fmtDateShort } from "@/lib/utils";
import { StatusPill } from "@/components/status-pill";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Wrench, Bike, ArrowLeft } from "lucide-react";
import { ServiceForm } from "./service-form";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ srNo: string }>;
}) {
  await requireSession();
  const { srNo } = await params;
  const sr = Number(srNo);
  if (!Number.isInteger(sr) || sr <= 0) notFound();

  const vehicle = await prisma.vehicle.findUnique({
    where: { srNo: sr },
    include: { services: { orderBy: { servicedAt: "desc" }, include: { createdBy: { select: { username: true } } } } },
  });
  if (!vehicle) notFound();

  const [bookings, totalBookings, spent] = await Promise.all([
    prisma.booking.findMany({
      where: { vehicleId: sr },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, refNumber: true, customerName: true, status: true,
        startAt: true, endAt: true, quotedAmount: true,
      },
    }),
    prisma.booking.count({ where: { vehicleId: sr } }),
    prisma.serviceRecord.aggregate({ where: { vehicleId: sr }, _sum: { cost: true } }),
  ]);

  const now = new Date();
  const latestService = vehicle.services[0];
  const serviceDueSoon =
    latestService?.nextDueDate != null && latestService.nextDueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const serviceDueOdo =
    latestService?.nextDueOdometer != null && vehicle.odometer >= latestService.nextDueOdometer;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Link href="/vehicles" className="link inline-flex items-center gap-1 text-xs">
        <ArrowLeft size={12} /> All vehicles
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono text-muted">
            #{vehicle.srNo}{vehicle.category ? ` · ${vehicle.category}` : ""}{vehicle.series ? ` · ${vehicle.series}` : ""}
          </div>
          <h1 className="text-2xl font-semibold mt-1">
            {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}{vehicle.color ? ` · ${vehicle.color}` : ""}
          </h1>
          <div className="text-sm font-mono text-muted">{vehicle.plate}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={vehicle.status} />
          {(serviceDueSoon || serviceDueOdo) && (
            <span className="badge badge-warn">service due</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Odometer" value={`${vehicle.odometer.toLocaleString("en-IN")} km`} />
        <Stat label="Bookings" value={String(totalBookings)} />
        <Stat label="₹ / day" value={inr(vehicle.dailyRate)} />
        <Stat label="₹ / month" value={inr(vehicle.monthlyRate)} />
        <Stat label="Deposit" value={inr(vehicle.deposit)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Service history */}
        <div className="space-y-4">
          <Card className="p-0">
            <CardHeader title={<span className="flex items-center gap-2"><Wrench size={14} /> Service history</span>} action={<ServiceForm srNo={vehicle.srNo} />} />
            {vehicle.services.length > 0 ? (
              <div className="divide-y divide-border">
                {vehicle.services.map((s) => (
                  <div key={s.id} className="px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{s.description}</div>
                      <div className="num shrink-0 text-xs">{s.cost > 0 ? inr(s.cost) : "—"}</div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                      <span>{fmtDateShort(s.servicedAt)}</span>
                      {s.odometer != null && <span>{s.odometer.toLocaleString("en-IN")} km</span>}
                      {s.nextDueDate && <span>next: {fmtDateShort(s.nextDueDate)}</span>}
                      {s.nextDueOdometer != null && <span>next: {s.nextDueOdometer.toLocaleString("en-IN")} km</span>}
                      <span>@{s.createdBy.username}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Wrench} title="No service records" hint="Record oil changes, repairs and inspections here." />
            )}
            {spent._sum.cost != null && spent._sum.cost > 0 && (
              <div className="border-t border-border px-4 py-2 text-xs text-muted">
                Total spent on maintenance: <span className="num text-fg">{inr(spent._sum.cost)}</span>
              </div>
            )}
          </Card>

          {vehicle.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="text-sm text-muted">{vehicle.notes}</p>
            </Card>
          )}
        </div>

        {/* Recent bookings */}
        <Card className="p-0">
          <CardHeader title={<span className="flex items-center gap-2"><Bike size={14} /> Recent bookings</span>} />
          {bookings.length > 0 ? (
            <div className="divide-y divide-border">
              {bookings.map((b) => {
                const overdue = (b.status === "handed_over" || b.status === "active") && b.endAt < now;
                return (
                  <Link key={b.id} href={`/bookings/${b.id}`} className="block px-4 py-3 text-sm transition hover:bg-surface-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs text-muted">#{b.refNumber}</span> {b.customerName}
                        <div className="text-xs text-muted">{fmtDate(b.startAt)} → {fmtDate(b.endAt)}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusPill status={b.status} overdue={overdue} />
                        <span className="num text-xs">{inr(b.quotedAmount)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Bike} title="No bookings yet" />
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1.5 text-lg font-semibold num">{value}</div>
    </div>
  );
}
