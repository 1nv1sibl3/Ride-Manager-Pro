import Link from "next/link";
import { prisma } from "@/lib/db";
import { inr } from "@/lib/pricing";
import { fmtDateShort } from "@/lib/utils";
import { StatusPill, ConflictPill } from "@/components/status-pill";
import { findConflictsForBookings } from "@/lib/conflicts";
import { parseListParams, PAGE_SIZE } from "@/lib/pagination";
import { Th, Pagination } from "@/components/ui/table";
import { Plus, Download } from "lucide-react";

export const dynamic = "force-dynamic";

const SORTABLE = ["refNumber", "customerName", "startAt", "endAt", "status", "quotedAmount", "createdAt"] as const;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const status = sp.status || "";
  const list = parseListParams(sp, SORTABLE, { field: "createdAt", dir: "desc" });

  const where: Record<string, unknown> = {};
  if (status === "overdue") {
    where.status = { in: ["handed_over", "active"] };
    where.endAt = { lt: new Date() };
  } else if (status) {
    where.status = status;
  }
  if (q) {
    const qNum = Number.parseInt(q.replace(/^#/, ""), 10);
    where.OR = [
      ...(Number.isFinite(qNum) ? [{ refNumber: qNum }] : []),
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
      { vehicle: { plate: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: list.orderBy,
      skip: list.skip,
      take: list.take,
      include: { vehicle: true },
    }),
    prisma.booking.count({ where }),
  ]);

  // Conflicts are computed for the visible page only.
  const conflictMap = await findConflictsForBookings(
    bookings
      .filter((b) => b.status !== "cancelled")
      .map((b) => ({ id: b.id, vehicleId: b.vehicleId, startAt: b.startAt, endAt: b.endAt })),
  );

  const now = Date.now();
  const filters = [
    { key: "", label: "All" },
    { key: "booked", label: "Booked" },
    { key: "handed_over", label: "Handed over" },
    { key: "overdue", label: "Overdue" },
    { key: "returned", label: "Returned" },
    { key: "closed", label: "Closed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <Link href="/bookings/new" className="btn btn-primary gap-1"><Plus size={14} /> New booking</Link>
      </div>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input name="q" defaultValue={q} className="input max-w-xs" placeholder="Ref / name / phone / plate" />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn">Search</button>
        <a href="/api/exports/bookings" className="btn gap-1"><Download size={14} /> CSV</a>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <a
            key={f.key}
            href={`/bookings?${new URLSearchParams({ ...(q && { q }), ...(f.key && { status: f.key }) })}`}
            className={`btn btn-sm ${status === f.key ? "btn-primary" : ""}`}
          >
            {f.label}
          </a>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="t">
          <thead>
            <tr>
              <Th field="refNumber" label="Ref" />
              <Th field="customerName" label="Customer" />
              <th>Vehicle</th>
              <Th field="startAt" label="From" />
              <Th field="endAt" label="To" />
              <th>Plan</th>
              <Th field="status" label="Status" />
              <Th field="quotedAmount" label="Amount" align="right" />
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const overdue = (b.status === "handed_over" || b.status === "active") && b.endAt.getTime() < now;
              return (
                <tr key={b.id}>
                  <td><Link className="link font-mono text-xs" href={`/bookings/${b.id}`}>#{b.refNumber}</Link></td>
                  <td>{b.customerName}<div className="text-xs text-muted">{b.customerPhone}</div></td>
                  <td>{b.vehicle.model}<div className="text-xs font-mono text-muted">{b.vehicle.plate}</div></td>
                  <td className="text-xs">{fmtDateShort(b.startAt)}</td>
                  <td className="text-xs">{fmtDateShort(b.endAt)}</td>
                  <td className="text-xs">{b.plan}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill status={b.status} overdue={overdue} />
                      <ConflictPill count={conflictMap.get(b.id)?.length ?? 0} />
                    </div>
                  </td>
                  <td className="text-right num">{inr(b.quotedAmount)}</td>
                </tr>
              );
            })}
            {bookings.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted">No bookings</td></tr>}
          </tbody>
        </table>
        <div className="px-4 pb-3">
          <Pagination page={list.page} pageSize={PAGE_SIZE} total={total} />
        </div>
      </div>
    </div>
  );
}
