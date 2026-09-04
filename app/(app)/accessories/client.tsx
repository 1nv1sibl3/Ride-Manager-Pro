"use client";

import { useState, useTransition } from "react";
import { Package, PackageX, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createAccessory,
  updateAccessory,
  adjustAccessoryStock,
  deleteAccessory,
} from "./actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toast, toastResult } from "@/components/ui/toast";
import { inr } from "@/lib/pricing";
import { fmtDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type A = {
  id: string;
  name: string;
  category: string | null;
  stock: number;
  unitPrice: number | null;
  lowStockThreshold: number;
};

type Log = {
  id: string;
  accessoryName: string;
  quantity: number;
  kind: string;
  bookingRef: string | null;
  note: string | null;
  by: string;
  at: string;
};

const KINDS = ["restock", "issue", "return", "damaged", "adjust"] as const;

export function AccessoriesClient({
  role,
  accessories,
  logs,
  bookingRefs,
}: {
  role: string;
  accessories: A[];
  logs: Log[];
  bookingRefs: string[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<A | null>(null);
  const [adjusting, setAdjusting] = useState<A | null>(null);

  const lowStock = accessories.filter((a) => a.stock <= a.lowStockThreshold);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Accessories</h1>
          <p className="text-sm text-muted">
            {accessories.length} item{accessories.length === 1 ? "" : "s"}
            {lowStock.length > 0 && <span className="text-warn"> · {lowStock.length} low on stock</span>}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          <Plus size={14} /> Add accessory
        </Button>
      </div>

      {lowStock.length > 0 && (
        <div className="card flex items-center gap-3 border-warn/60 bg-warn-soft text-sm">
          <PackageX size={16} className="shrink-0 text-warn" />
          <div>
            <span className="font-medium text-warn">Low stock:</span>{" "}
            {lowStock.map((a) => `${a.name} (${a.stock})`).join(", ")}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-0 overflow-x-auto lg:col-span-2">
          <table className="t">
            <thead>
              <tr>
                <th>Name</th><th>Category</th><th className="text-right">Stock</th>
                <th className="text-right">Unit price</th><th className="text-right">Threshold</th><th></th>
              </tr>
            </thead>
            <tbody>
              {accessories.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">{a.name}</td>
                  <td className="text-xs text-muted">{a.category ?? "—"}</td>
                  <td className="text-right">
                    <span className={cn("num font-medium", a.stock <= a.lowStockThreshold && "text-danger")}>
                      {a.stock}
                    </span>
                    {a.stock <= a.lowStockThreshold && (
                      <span className="ml-2"><Badge tone="danger">low</Badge></span>
                    )}
                  </td>
                  <td className="text-right num text-xs">{a.unitPrice != null ? inr(a.unitPrice) : "—"}</td>
                  <td className="text-right num text-xs text-muted">{a.lowStockThreshold}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setAdjusting(a)}>Adjust</Button>
                      <Button variant="ghost" size="sm" className="px-1.5" title="Edit" onClick={() => setEditing(a)}>
                        <Pencil size={12} />
                      </Button>
                      {role === "owner" && <DeleteAccessoryButton a={a} />}
                    </div>
                  </td>
                </tr>
              ))}
              {accessories.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Package}
                      title="No accessories yet"
                      hint="Track helmets, locks and other rentable extras with stock counts."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card p-0">
          <div className="border-b border-border px-4 py-2.5 text-sm font-medium">Recent activity</div>
          <div className="max-h-[28rem] divide-y divide-border overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="px-4 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{l.accessoryName}</span>
                  <span className={cn("num font-medium", l.quantity < 0 ? "text-danger" : "text-success")}>
                    {l.quantity > 0 ? "+" : ""}{l.quantity}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {l.kind}{l.bookingRef ? ` · ${l.bookingRef}` : ""}{l.note ? ` · ${l.note}` : ""} · @{l.by}
                </div>
                <div className="text-[11px] text-muted-2">{fmtDate(l.at)}</div>
              </div>
            ))}
            {logs.length === 0 && (
              <EmptyState title="No stock activity yet" hint="Restocks, issues and returns appear here." />
            )}
          </div>
        </div>
      </div>

      {showNew && <AccessoryForm onClose={() => setShowNew(false)} />}
      {editing && <AccessoryForm initial={editing} onClose={() => setEditing(null)} />}
      {adjusting && (
        <AdjustStockForm accessory={adjusting} bookingRefs={bookingRefs} onClose={() => setAdjusting(null)} />
      )}
    </div>
  );
}

function DeleteAccessoryButton({ a }: { a: A }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="px-1.5"
        title="Delete"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={12} />
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          start(async () => {
            const res = await deleteAccessory(a.id);
            if (res?.error) toast.error(res.error);
            else toast.success("Accessory deleted");
          });
        }}
        title={`Delete ${a.name}?`}
        description="The item and its stock history are removed. Owner-only."
        confirmLabel="Delete"
        pending={pending}
      />
    </>
  );
}

function AccessoryForm({ initial, onClose }: { initial?: A; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog open onClose={onClose} title={initial ? `Edit ${initial.name}` : "Add accessory"}>
      <form
        className="space-y-3"
        action={(fd) => {
          setErr(null);
          start(async () => {
            const res = initial ? await updateAccessory(initial.id, fd) : await createAccessory(fd);
            if (res?.error) setErr(res.error);
            else {
              toastResult(res, initial ? "Accessory updated" : "Accessory added");
              onClose();
            }
          });
        }}
      >
        <Field label="Name" required>
          <Input name="name" required maxLength={80} defaultValue={initial?.name ?? ""} placeholder="e.g. Helmet (XL)" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Input name="category" maxLength={60} defaultValue={initial?.category ?? ""} placeholder="Safety / Storage" />
          </Field>
          <Field label="Unit price (₹)">
            <Input name="unitPrice" type="number" min={0} defaultValue={initial?.unitPrice ?? ""} />
          </Field>
          {!initial && (
            <Field label="Initial stock">
              <Input name="stock" type="number" min={0} defaultValue={0} />
            </Field>
          )}
          <Field label="Low-stock threshold">
            <Input name="lowStockThreshold" type="number" min={0} defaultValue={initial?.lowStockThreshold ?? 2} />
          </Field>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>{initial ? "Save" : "Add"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function AdjustStockForm({
  accessory, bookingRefs, onClose,
}: {
  accessory: A; bookingRefs: string[]; onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog open onClose={onClose} title={`Adjust stock — ${accessory.name}`}>
      <form
        className="space-y-3"
        action={(fd) => {
          setErr(null);
          start(async () => {
            const res = await adjustAccessoryStock(accessory.id, fd);
            if (res?.error) setErr(res.error);
            else {
              toastResult(res, "Stock updated");
              onClose();
            }
          });
        }}
      >
        <p className="text-sm text-muted">
          Current stock: <span className="num font-medium text-fg">{accessory.stock}</span>
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind" required>
            <Select name="kind" defaultValue="restock">
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Quantity" required hint="Sign is applied by the kind; 'adjust' uses your sign as entered">
            <Input name="quantity" type="number" required placeholder="e.g. 5" />
          </Field>
          <div className="col-span-2">
            <Field label="Booking ref (optional)">
              <Input name="bookingRef" maxLength={20} list="booking-refs" placeholder="#123 Rahul" />
              <datalist id="booking-refs">
                {bookingRefs.map((r) => <option key={r} value={r} />)}
              </datalist>
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Note">
              <Input name="note" maxLength={200} placeholder="e.g. scratched visor" />
            </Field>
          </div>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>Apply</Button>
        </div>
      </form>
    </Dialog>
  );
}
