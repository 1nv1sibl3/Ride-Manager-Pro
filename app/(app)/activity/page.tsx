import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDateShort } from "@/lib/utils";
import { StatusPill } from "@/components/status-pill";
import { CalendarCheck, Bike } from "lucide-react";

export const dynamic = "force-dynamic";

function parseLocalDay(s: string | undefined): Date {
  if (s) {
    const [y, m, d] = s.split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ACTIVE_STATUSES = ["booked", "handed_over", "active"] as const;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const dayStart = parseLocalDay(sp.date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  const nowDate = new Date();
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0);

  const prevDay = new Date(dayStart);
  prevDay.setDate(dayStart.getDate() - 1);
  const nextDay = new Date(dayStart);
  nextDay.setDate(dayStart.getDate() + 1);
  const todayStr = toLocalISO(new Date());
  const selectedStr = toLocalISO(dayStart);
  const isToday = selectedStr === todayStr;

  const [returning, onRent, overdue] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        endAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { endAt: "asc" },
      include: { vehicle: true },
    }),
    prisma.booking.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      orderBy: { endAt: "asc" },
      include: { vehicle: true },
    }),
    // Pending drops: scheduled return was before today but booking is still active
    prisma.booking.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        endAt: { lt: todayStart },
      },
      orderBy: { endAt: "asc" },
      include: { vehicle: true },
    }),
  ]);

  const nowMs = Date.now();

  const renderBooking = (b: (typeof returning)[number], opts?: { overdue?: boolean }) => (
    <Link
      key={b.id}
      href={`/bookings/${b.id}`}
      className="block px-4 py-3 transition hover:bg-surface-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">#{b.refNumber}</span>
            <span className="truncate font-medium">{b.vehicle.model}</span>
          </div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {b.customerName} · <span className="font-mono">{b.vehicle.plate}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-xs num">{fmtDateShort(b.endAt)}</div>
          <div className="mt-1 flex justify-end">
            <StatusPill status={b.status} overdue={opts?.overdue ?? b.endAt.getTime() < nowMs} />
          </div>
        </div>
      </div>
    </Link>
  );

  const Section = ({
    icon: Icon,
    title,
    count,
    children,
  }: {
    icon: typeof CalendarCheck;
    title: string;
    count: number;
    children: React.ReactNode;
  }) => (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <h2 className="font-medium">{title}</h2>
        </div>
        <span className="text-xs num text-muted">{count}</span>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Daily activity</h1>
          <p className="text-sm text-muted">
            {isToday ? "Today" : fmtDateShort(dayStart)} · {returning.length} returning · {onRent.length} on rent
            {overdue.length > 0 && <span className="ml-2 text-warn">· {overdue.length} pending drop</span>}
          </p>
        </div>
      </div>

      <form className="card flex flex-wrap items-end gap-2 p-3" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="date">Date</label>
          <input id="date" type="date" name="date" defaultValue={selectedStr} className="input" />
        </div>
        <button className="btn btn-primary">Show</button>
        <a href={`/activity?date=${toLocalISO(prevDay)}`} className="btn btn-sm">← Prev</a>
        <a href="/activity" className="btn btn-sm">Today</a>
        <a href={`/activity?date=${toLocalISO(nextDay)}`} className="btn btn-sm">Next →</a>
      </form>

      {overdue.length > 0 && (
        <div className="card overflow-hidden border-warn/60 p-0">
          <div className="flex items-center justify-between border-b border-warn/30 bg-warn-soft px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="text-warn" />
              <h2 className="font-medium">Pending drops (overdue)</h2>
            </div>
            <span className="text-xs num text-muted">{overdue.length}</span>
          </div>
          <div className="divide-y divide-border">
            {overdue.map((b) => renderBooking(b, { overdue: true }))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={CalendarCheck} title="Returning" count={returning.length}>
          {returning.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted">No vehicles scheduled to return.</div>
          )}
          {returning.map((b) => renderBooking(b))}
        </Section>

        <Section icon={Bike} title="On rent" count={onRent.length}>
          {onRent.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted">No vehicles on rent.</div>
          )}
          {onRent.map((b) => renderBooking(b))}
        </Section>
      </div>
    </div>
  );
}
