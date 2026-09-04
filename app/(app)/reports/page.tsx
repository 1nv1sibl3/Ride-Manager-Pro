import { prisma } from "@/lib/db";
import { inr } from "@/lib/pricing";
import { fmtDateShort } from "@/lib/utils";

export const dynamic = "force-dynamic";

function dayBounds(dateStr?: string) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  const next = new Date(d); next.setDate(next.getDate() + 1);
  return { start: d, end: next };
}

type GroupBy = "vehicle" | "series" | "category";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string; group?: string }> }) {
  const sp = await searchParams;
  const { start, end } = dayBounds(sp.date);
  const group: GroupBy = (sp.group === "series" || sp.group === "category" ? sp.group : "vehicle");

  const [payments, utilization] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: start, lt: end } },
      include: { booking: { select: { refNumber: true, customerName: true } }, recordedBy: { select: { username: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.vehicle.findMany({
      include: {
        bookings: { where: { status: { in: ["handed_over", "active", "returned", "closed"] } } },
      },
      orderBy: [{ category: "asc" }, { series: "asc" }, { plate: "asc" }],
    }),
  ]);

  const byMode: Record<string, number> = {};
  let cashIn = 0, refunds = 0, deposits = 0;
  for (const p of payments) {
    byMode[p.mode] = (byMode[p.mode] || 0) + (p.kind === "refund" ? -p.amount : p.amount);
    if (p.kind === "refund") refunds += p.amount;
    else if (p.kind === "deposit") deposits += p.amount;
    else cashIn += p.amount;
  }

  type Row = { key: string; label: string; sub?: string; bookings: number; rentedDays: number; revenue: number };
  const perVehicle: Row[] = utilization.map((v) => {
    const revenue = v.bookings.reduce((s, b) => s + b.quotedAmount + b.damageCharges, 0);
    const rentedDays = v.bookings.reduce((s, b) => {
      const e = b.actualReturnAt ?? b.endAt;
      const ms = new Date(e).getTime() - new Date(b.startAt).getTime();
      return s + Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }, 0);
    return { key: String(v.srNo), label: `${v.model}`, sub: `${v.plate}${v.series ? ` · ${v.series}` : ""}`, bookings: v.bookings.length, rentedDays, revenue };
  });

  let rows: Row[] = perVehicle;
  if (group !== "vehicle") {
    const map = new Map<string, Row>();
    for (const v of utilization) {
      const k = (group === "series" ? v.series : v.category) || "—";
      const existing = map.get(k) || { key: k, label: k, bookings: 0, rentedDays: 0, revenue: 0 };
      const revenue = v.bookings.reduce((s, b) => s + b.quotedAmount + b.damageCharges, 0);
      const rentedDays = v.bookings.reduce((s, b) => {
        const e = b.actualReturnAt ?? b.endAt;
        const ms = new Date(e).getTime() - new Date(b.startAt).getTime();
        return s + Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
      }, 0);
      existing.bookings += v.bookings.length;
      existing.rentedDays += rentedDays;
      existing.revenue += revenue;
      map.set(k, existing);
    }
    rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }

  const dateInput = (sp.date ?? new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <div className="card space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium">Daily reconciliation</h2>
          <form className="flex gap-2 items-center" method="get">
            <input name="date" type="date" className="input" defaultValue={dateInput} />
            <input type="hidden" name="group" value={group} />
            <button className="btn">Go</button>
            <a className="btn" href={`/api/exports/payments?date=${dateInput}`}>CSV</a>
          </form>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MiniStat label="Cash in" value={inr(cashIn)} />
          <MiniStat label="Refunds" value={inr(refunds)} />
          <MiniStat label="Deposits taken" value={inr(deposits)} />
          <MiniStat label="Net" value={inr(cashIn + deposits - refunds)} />
        </div>
        <div className="text-sm text-muted">By mode: {Object.entries(byMode).map(([m, a]) => `${m}: ${inr(a)}`).join(" · ") || "—"}</div>
        <div className="overflow-x-auto">
          <table className="t">
            <thead><tr><th>Time</th><th>Booking</th><th>Customer</th><th>Kind</th><th>Mode</th><th className="text-right">Amount</th><th>By</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-xs">{fmtDateShort(p.createdAt)}</td>
                  <td className="font-mono text-xs">#{p.booking.refNumber}</td>
                  <td>{p.booking.customerName}</td>
                  <td><span className="badge">{p.kind}</span></td>
                  <td className="text-xs">{p.mode}</td>
                  <td className="text-right num">{p.kind === "refund" ? "−" : ""}{inr(p.amount)}</td>
                  <td className="text-xs">@{p.recordedBy.username}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-muted">No payments on this date</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium">Utilisation (all-time)</h2>
          <div className="flex gap-1.5">
            {(["vehicle", "series", "category"] as const).map((g) => (
              <a key={g} href={`/reports?date=${dateInput}&group=${g}`} className={`btn btn-sm ${group === g ? "btn-primary" : ""}`}>{g}</a>
            ))}
            <a className="btn btn-sm" href="/api/exports/utilization">CSV</a>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="t">
            <thead><tr><th>{group === "vehicle" ? "Vehicle" : group}</th><th>Bookings</th><th>Rented days</th><th className="text-right">Revenue</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    <div>{r.label}</div>
                    {r.sub && <div className="text-xs font-mono text-muted">{r.sub}</div>}
                  </td>
                  <td className="num">{r.bookings}</td>
                  <td className="num">{r.rentedDays}</td>
                  <td className="text-right num">{inr(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold mt-1 num">{value}</div>
    </div>
  );
}
