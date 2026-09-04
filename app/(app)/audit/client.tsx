"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

type Log = {
  id: string;
  when: string;
  actor: string | null;
  action: "insert" | "update" | "delete" | string;
  tableName: string;
  rowId: string;
  before: unknown;
  after: unknown;
};

const ACTION_TONE: Record<string, string> = {
  insert: "badge-success",
  update: "badge-info",
  delete: "badge-danger",
};

export function AuditTable({ logs }: { logs: Log[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="card overflow-x-auto p-0">
      <table className="t">
        <thead>
          <tr><th></th><th>When</th><th>Actor</th><th>Action</th><th>Table</th><th>Row</th></tr>
        </thead>
        <tbody>
          {logs.map((l) => {
            const hasDiff = l.before != null || l.after != null;
            const expanded = open === l.id;
            return (
              <Fragment key={l.id}>
                <tr
                  className={cn(hasDiff && "cursor-pointer")}
                  onClick={() => hasDiff && setOpen(expanded ? null : l.id)}
                >
                  <td className="w-8 text-muted">
                    {hasDiff && (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                  </td>
                  <td className="text-xs">{fmtDate(l.when)}</td>
                  <td>@{l.actor || "—"}</td>
                  <td><span className={`badge ${ACTION_TONE[l.action] ?? ""}`}>{l.action}</span></td>
                  <td>{l.tableName}</td>
                  <td className="max-w-40 truncate font-mono text-xs" title={l.rowId}>{l.rowId}</td>
                </tr>
                {expanded && hasDiff && (
                  <tr className="bg-surface-2/50">
                    <td colSpan={6} className="p-0">
                      <Diff before={l.before} after={l.after} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {logs.length === 0 && (
            <tr>
              <td colSpan={6}>
                <EmptyState icon={ScrollText} title="No audit entries" hint="Adjust the filters, or make some changes first." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Shallow key diff of the stored before/after JSON. Unchanged keys stay quiet;
// changed keys are highlighted so the actual edit is scannable.
function Diff({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();

  const fmt = (v: unknown): string => {
    if (v === undefined) return "—";
    if (v === null) return "null";
    if (typeof v === "object") {
      const s = JSON.stringify(v);
      return s.length > 120 ? `${s.slice(0, 117)}…` : s;
    }
    return String(v);
  };

  const same = (k: string) =>
    Object.hasOwn(b, k) && Object.hasOwn(a, k) && JSON.stringify(b[k]) === JSON.stringify(a[k]);

  return (
    <div className="px-6 py-3">
      <div className="mb-2 text-xs font-medium text-muted">Recorded state</div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="t">
          <thead>
            <tr><th className="w-48">Field</th><th>Before</th><th>After</th></tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const changed = !same(k);
              return (
                <tr key={k} className={changed ? "bg-warn-soft" : undefined}>
                  <td className="font-mono text-xs">{k}</td>
                  <td className={cn("font-mono text-xs", changed && "line-through opacity-60")}>{fmt(b[k])}</td>
                  <td className="font-mono text-xs">{fmt(a[k])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-2">
        Highlighted rows changed; struck-through values are what they were before the edit.
      </p>
    </div>
  );
}
