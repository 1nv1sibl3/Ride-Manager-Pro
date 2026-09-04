import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseListParams, PAGE_SIZE } from "@/lib/pagination";
import { Pagination } from "@/components/ui/table";
import { AuditTable } from "./client";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; dir?: string; action?: string; table?: string; actor?: string; from?: string; to?: string }>;
}) {
  const s = await getSession();
  if (s?.role !== "owner") redirect("/dashboard");

  const sp = await searchParams;
  const list = parseListParams(sp, ["createdAt"], { field: "createdAt", dir: "desc" });

  const where: Record<string, unknown> = {};
  if (sp.action === "insert" || sp.action === "update" || sp.action === "delete") where.action = sp.action;
  if (sp.table) where.tableName = sp.table;
  if (sp.actor) where.actor = { username: { contains: sp.actor.trim(), mode: "insensitive" } };
  if (sp.from) where.createdAt = { ...(where.createdAt as object), gte: new Date(`${sp.from}T00:00:00+05:30`) };
  if (sp.to) where.createdAt = { ...(where.createdAt as object), lt: new Date(new Date(`${sp.to}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000) };

  const [logs, total, tables] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: list.orderBy,
      skip: list.skip,
      take: list.take,
      include: { actor: { select: { username: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["tableName"], _count: { _all: true }, orderBy: { tableName: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="text-sm text-muted">
        Every mutation, with actor and before/after state. Immutable — entries are never edited or deleted.
      </p>

      <form className="card flex flex-wrap items-end gap-2 p-3" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="actor">Actor</label>
          <input id="actor" name="actor" defaultValue={sp.actor ?? ""} className="input" placeholder="username" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="table">Table</label>
          <select id="table" name="table" defaultValue={sp.table ?? ""} className="select">
            <option value="">All</option>
            {tables.map((t) => <option key={t.tableName} value={t.tableName}>{t.tableName} ({t._count._all})</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="action">Action</label>
          <select id="action" name="action" defaultValue={sp.action ?? ""} className="select">
            <option value="">All</option>
            <option value="insert">insert</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="from">From</label>
          <input id="from" name="from" type="date" defaultValue={sp.from ?? ""} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted" htmlFor="to">To</label>
          <input id="to" name="to" type="date" defaultValue={sp.to ?? ""} className="input" />
        </div>
        <button className="btn btn-primary btn-sm">Filter</button>
        <a href="/audit" className="btn btn-sm">Clear</a>
      </form>

      <AuditTable
        logs={logs.map((l) => ({
          id: l.id,
          when: l.createdAt.toISOString(),
          actor: l.actor?.username ?? null,
          action: l.action,
          tableName: l.tableName,
          rowId: l.rowId,
          before: l.before,
          after: l.after,
        }))}
      />

      <Pagination page={list.page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
