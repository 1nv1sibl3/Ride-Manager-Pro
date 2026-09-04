"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { createVehicle, updateVehicle, deleteVehicle } from "./actions";
import { inr } from "@/lib/pricing";
import { Plus, Pencil } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { toastResult } from "@/components/ui/toast";

type V = {
  srNo: number; plate: string; model: string; color: string | null; year: number | null;
  category: string | null; series: string | null;
  odometer: number; status: string; notes: string | null;
  dailyRate: number; monthlyRate: number; deposit: number;
};

const STATUSES = ["available", "rented", "maintenance", "retired"] as const;

export function VehiclesClient({ vehicles }: { vehicles: V[] }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<V | null>(null);

  const categories = Array.from(new Set(vehicles.map((v) => v.category).filter(Boolean))) as string[];
  const allSeries = Array.from(new Set(vehicles.map((v) => v.series).filter(Boolean))) as string[];

  const filtered = vehicles.filter((v) => {
    if (statusFilter && v.status !== statusFilter) return false;
    if (categoryFilter && v.category !== categoryFilter) return false;
    if (q && !`${v.plate} ${v.model} ${v.series ?? ""} ${v.category ?? ""} ${v.year ?? ""} ${v.srNo ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">Vehicles <span className="text-sm font-normal text-muted">({vehicles.length})</span></h1>
        <Button variant="primary" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={14} /> Add vehicle</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input className="max-w-xs" placeholder="Search plate / model / series" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="max-w-xs" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      <div className="card p-0 overflow-x-auto">
        <table className="t">
          <thead><tr><th>Sr</th><th>Plate</th><th>Model</th><th>Series</th><th>Category</th><th>Year</th><th className="text-right">₹/day</th><th className="text-right">₹/mo</th><th className="text-right">Deposit</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.srNo}>
                <td className="text-xs text-muted">{v.srNo ?? "—"}</td>
                <td className="font-mono text-xs">
                  <Link href={`/vehicles/${v.srNo}`} className="hover:text-primary">{v.plate}</Link>
                </td>
                <td>{v.model}{v.color ? ` · ${v.color}` : ""}</td>
                <td className="text-xs">{v.series ?? "—"}</td>
                <td className="text-xs">{v.category ?? "—"}</td>
                <td className="text-xs">{v.year ?? "—"}</td>
                <td className="text-right num">{inr(v.dailyRate)}</td>
                <td className="text-right num text-xs">{inr(v.monthlyRate)}</td>
                <td className="text-right num text-xs">{inr(v.deposit)}</td>
                <td><span className={`badge ${v.status === "available" ? "badge-success" : v.status === "rented" ? "badge-warn" : v.status === "maintenance" ? "badge-danger" : "badge-neutral"}`}>{v.status}</span></td>
                <td>
                  <div className="flex gap-1">
                    <Link href={`/vehicles/${v.srNo}`} className="btn btn-ghost btn-sm">History</Link>
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(v); setShowForm(true); }}><Pencil size={12} /> Edit</Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={11} className="text-center py-8 text-muted">No vehicles</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <VehicleForm initial={editing} categories={categories} allSeries={allSeries} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function VehicleForm({ initial, categories, allSeries, onClose }: { initial: V | null; categories: string[]; allSeries: string[]; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = initial ? await updateVehicle(initial.srNo, fd) : await createVehicle(fd);
      if (res?.error) setErr(res.error);
      else {
        toastResult(res, initial ? "Vehicle updated" : "Vehicle added");
        onClose();
      }
    });
  }

  function onDelete() {
    if (!initial) return;
    start(async () => {
      const res = await deleteVehicle(initial.srNo);
      if (res?.error) setErr(res.error);
      else {
        toastResult(res, "Vehicle deleted");
        onClose();
      }
    });
  }

  return (
    <>
      <Dialog open onClose={onClose} title={initial ? "Edit vehicle" : "Add vehicle"}>
        <form onSubmit={onSubmit} className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sr. no." required>
              {initial ? (
                <Input type="number" className="opacity-60" value={initial.srNo} disabled />
              ) : (
                <Input name="srNo" type="number" min={1} required />
              )}
              {initial && <p className="mt-1 text-xs text-muted">Sr. no. is the vehicle&apos;s identity — can&apos;t be changed.</p>}
            </Field>
            <Field label="Plate" required>
              <Input name="plate" defaultValue={initial?.plate} required />
            </Field>
            <div className="col-span-2">
              <Field label="Model" required>
                <Input name="model" defaultValue={initial?.model} placeholder="e.g. Bullet Hunter 350" required />
              </Field>
            </div>
            <Field label="Category">
              <Input name="category" defaultValue={initial?.category ?? ""} placeholder="Scooter / Cruiser 350 / Commuter Bike" list="category-list" />
              <datalist id="category-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Series">
              <Input name="series" defaultValue={initial?.series ?? ""} placeholder="Activa / Hunter 350" list="series-list" />
              <datalist id="series-list">{allSeries.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="Color">
              <Input name="color" defaultValue={initial?.color ?? ""} />
            </Field>
            <Field label="Year">
              <Input name="year" type="number" defaultValue={initial?.year ?? ""} />
            </Field>
            <Field label="Odometer (km)">
              <Input name="odometer" type="number" defaultValue={initial?.odometer ?? 0} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={initial?.status ?? "available"}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <div className="text-sm font-medium">Default pricing for this vehicle</div>
            <p className="text-xs text-muted">Each bike sets its own price. These defaults are pre-filled at booking but staff can adjust per booking.</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="₹ / day" required>
                <Input name="dailyRate" type="number" defaultValue={initial?.dailyRate ?? 0} required />
              </Field>
              <Field label="₹ / month">
                <Input name="monthlyRate" type="number" defaultValue={initial?.monthlyRate ?? 0} />
              </Field>
              <Field label="Deposit ₹">
                <Input name="deposit" type="number" defaultValue={initial?.deposit ?? 0} />
              </Field>
            </div>
          </div>

          <Field label="Notes">
            <Textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} />
          </Field>
          {err && <p className="text-sm text-danger">{err}</p>}
          <div className="flex justify-between gap-2">
            {initial ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={pending}>Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" loading={pending}>Save</Button>
            </div>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title={`Delete vehicle ${initial?.plate ?? ""}?`}
        description="This removes the vehicle from the fleet. Bookings that reference it keep their history but lose the link."
        confirmLabel="Delete vehicle"
        pending={pending}
      />
    </>
  );
}
