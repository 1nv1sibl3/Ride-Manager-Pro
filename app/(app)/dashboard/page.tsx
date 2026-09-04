import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { inr } from "@/lib/pricing";
import { StatusPill } from "@/components/status-pill";
import { RevenueChart, type RevenuePoint } from "@/components/dashboard/revenue-chart";
import { FleetStatus, type FleetCounts } from "@/components/dashboard/fleet-status";
import { maybeRunDailyDigest, istDayKey, istDayStart } from "@/lib/reminder-scan";
import { CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, fmtDateShort } from "@/lib/utils";
import { Plus, Activity, Bike, IndianRupee, Undo2, CalendarClock, AlarmClock, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const ACTIVE = ["booked", "handed_over", "active"] as const;

export default async function Dashboard() {
  const session = await getSession();
  const isOwner = session?.role === "owner";
  const now = new Date();
  const todayStart = istDayStart(istDayKey(now));
  const tomorrowStart = new Date(todayStart.getTime() + DAY);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY);

  // Lazy daily digest (no-cron fallback). Runs at most once per ~20h.
  await maybeRunDailyDigest();

  const [activeBookings, availableVehicles, totalVehicles, overdueCount, payments, vehicleStatus, upcoming, overdue, remindersDue, recent, bookingsThisWeek, bookingsLastWeek] =
    await Promise.all([
      prisma.booking.count({ where: { status: { in: ["handed_over", "active"] } } }),
      prisma.vehicle.count({ where: { status: "available" } }),
      prisma.vehicle.count(),
      prisma.booking.count({ where: { status: { in: ["handed_over", "active"] }, endAt: { lt: now } } }),
      prisma.payment.findMany({
        where: { createdAt: { gte: new Date(now.getTime() - 90 * DAY) } },
        select: { amount: true, kind: true, createdAt: true },
      }),
      prisma.vehicle.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.booking.findMany({
        where: { status: { in: [...ACTIVE] }, endAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY) } },
        orderBy: { endAt: "asc" },
        take: 8,
        include: { vehicle: true },
      }),
      prisma.booking.findMany({
        where: { status: { in: ["handed_over", "active"] }, endAt: { lt: now } },
        orderBy: { endAt: "asc" },
        take: 8,
        include: { vehicle: true },
      }),
      prisma.reminder.findMany({
        where: { doneAt: null, dueAt: { lt: tomorrowStart } },
        orderBy: { dueAt: "asc" },
        take: 8,
        include: { vehicle: true },
      }),
      prisma.booking.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { vehicle: true },
      }),
      prisma.booking.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.booking.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    ]);

  // Bucket payments by IST day for the revenue chart.
  const isCashIn = (kind: string) => kind !== "refund" && kind !== "deposit";
  const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
  const dayLabelFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
  const byDay = new Map<string, number>();
  for (const p of payments) {
    const key = dayKeyFmt.format(p.createdAt);
    if (isCashIn(p.kind)) byDay.set(key, (byDay.get(key) ?? 0) + p.amount);
  }
  const series: RevenuePoint[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    const key = dayKeyFmt.format(d);
    series.push({ date: key, label: dayLabelFmt.format(d), revenue: byDay.get(key) ?? 0 });
  }

  // Rolling 7-day sums for the KPI deltas.
  const revenueThisWeek = payments.filter((p) => p.createdAt >= weekAgo && isCashIn(p.kind)).reduce((s, p) => s + p.amount, 0);
  const revenueLastWeek = payments.filter((p) => p.createdAt >= twoWeeksAgo && p.createdAt < weekAgo && isCashIn(p.kind)).reduce((s, p) => s + p.amount, 0);
  const refundsThisWeek = payments.filter((p) => p.createdAt >= weekAgo && p.kind === "refund").reduce((s, p) => s + p.amount, 0);

  const fleet: FleetCounts = { available: 0, rented: 0, maintenance: 0, retired: 0 };
  for (const g of vehicleStatus) fleet[g.status as keyof FleetCounts] = g._count._all;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link href="/bookings/new" className="btn btn-primary gap-1"><Plus size={14} /> New booking</Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Active rentals" value={String(activeBookings)} icon={Activity} />
        <Stat label="Available vehicles" value={`${availableVehicles}/${totalVehicles}`} icon={Bike} />
        <Stat label="New bookings (7d)" value={String(bookingsThisWeek)} icon={CalendarClock}
          delta={delta(bookingsThisWeek, bookingsLastWeek)} />
        {isOwner && (
          <Stat label="Revenue (7d)" value={inr(revenueThisWeek)} icon={IndianRupee}
            delta={delta(revenueThisWeek, revenueLastWeek)} />
        )}
        {isOwner && <Stat label="Refunds (7d)" value={inr(refundsThisWeek)} icon={Undo2} />}
      </div>

      {/* Chart + fleet */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueChart data={series} className="lg:col-span-2" />
        <FleetStatus counts={fleet} />
      </div>

      {/* Operational lists */}
      <div className="grid gap-4 md:grid-cols-3">
        <ListCard title="Upcoming returns" icon={CalendarClock} href="/activity" count={upcoming.length}>
          {upcoming.map((b) => (
            <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition hover:bg-surface-2">
              <div className="min-w-0">
                <div className="truncate"><span className="font-mono text-xs text-muted">#{b.refNumber}</span> {b.customerName}</div>
                <div className="text-xs text-muted font-mono">{b.vehicle.plate}</div>
              </div>
              <span className="shrink-0 text-xs text-muted">{fmtDateShort(b.endAt)}</span>
            </Link>
          ))}
          {upcoming.length === 0 && <EmptyState title="Nothing due in the next 7 days" />}
        </ListCard>

        <ListCard title={`Overdue${overdueCount > 0 ? ` (${overdueCount})` : ""}`} icon={TrendingDown} href="/bookings?status=overdue" tone={overdueCount > 0 ? "danger" : undefined}>
          {overdue.map((b) => (
            <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition hover:bg-surface-2">
              <div className="min-w-0">
                <div className="truncate"><span className="font-mono text-xs text-muted">#{b.refNumber}</span> {b.customerName}</div>
                <div className="text-xs text-muted font-mono">{b.vehicle.plate}</div>
              </div>
              <span className="shrink-0 text-xs text-danger">{fmtDateShort(b.endAt)}</span>
            </Link>
          ))}
          {overdue.length === 0 && <EmptyState title="No overdue rentals" />}
        </ListCard>

        <ListCard title="Reminders due" icon={AlarmClock} href="/reminders" count={remindersDue.length}>
          {remindersDue.map((r) => (
            <Link key={r.id} href="/reminders" className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition hover:bg-surface-2">
              <div className="min-w-0">
                <div className="truncate">{r.title}</div>
                {r.vehicle && <div className="text-xs text-muted font-mono">{r.vehicle.plate}</div>}
              </div>
              <span className={cn("shrink-0 text-xs", r.dueAt < todayStart ? "text-danger" : "text-muted")}>
                {fmtDateShort(r.dueAt)}
              </span>
            </Link>
          ))}
          {remindersDue.length === 0 && <EmptyState title="No reminders due" />}
        </ListCard>
      </div>

      {/* Recent bookings */}
      <div className="card p-0">
        <CardHeader title="Recent bookings" action={<Link href="/bookings" className="link inline-flex items-center gap-0.5 text-xs">View all <ChevronRight size={12} /></Link>} />
        <div className="overflow-x-auto">
          <table className="t">
            <thead><tr><th>Ref</th><th>Customer</th><th>Vehicle</th><th>Status</th><th className="text-right">Amount</th><th></th></tr></thead>
            <tbody>
              {recent.map((b) => {
                const isOverdue = (b.status === "handed_over" || b.status === "active") && b.endAt.getTime() < now.getTime();
                return (
                  <tr key={b.id}>
                    <td className="font-mono text-xs">#{b.refNumber}</td>
                    <td>{b.customerName}</td>
                    <td>{b.vehicle.model}<div className="text-xs font-mono text-muted">{b.vehicle.plate}</div></td>
                    <td><StatusPill status={b.status} overdue={isOverdue} /></td>
                    <td className="text-right num">{inr(b.quotedAmount)}</td>
                    <td><Link className="link" href={`/bookings/${b.id}`}>open</Link></td>
                  </tr>
                );
              })}
              {recent.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted">No bookings yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function delta(current: number, previous: number): { pct: number | null; up: boolean } | null {
  if (previous === 0 && current === 0) return null;
  const pct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return { pct, up: current >= previous };
}

function Stat({
  label, value, icon: Icon, delta,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  delta?: { pct: number | null; up: boolean } | null;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">{label}</div>
        <Icon size={14} className="text-muted-2" />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {delta && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          {delta.up ? <TrendingUp size={12} className="text-success" /> : <TrendingDown size={12} className="text-danger" />}
          <span className={delta.up ? "font-medium text-success" : "font-medium text-danger"}>
            {delta.pct != null ? `${delta.up ? "+" : ""}${delta.pct}%` : delta.up ? "+" : "—"}
          </span>
          <span className="text-muted-2">vs last week</span>
        </div>
      )}
    </div>
  );
}

function ListCard({
  title, icon: Icon, href, count, tone, children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href: string;
  count?: number;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("card p-0", tone === "danger" && "border-danger/50")}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon size={14} className={tone === "danger" ? "text-danger" : "text-muted"} />
          {title}
        </div>
        <Link href={href} className="text-xs text-muted hover:text-fg">view</Link>
      </div>
      <div className="divide-y divide-border">
        {children}
        {count != null && count > 8 && (
          <Link href={href} className="block px-4 py-2 text-center text-xs text-muted hover:text-fg">
            +{count - 8} more
          </Link>
        )}
      </div>
    </div>
  );
}
