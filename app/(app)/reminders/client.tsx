"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlarmClock, CheckCircle2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { createReminder, updateReminder, completeReminder, deleteReminder } from "./actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toast, toastResult } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { fmtDateShort, toIstInputValue } from "@/lib/utils";

type R = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string;
  doneAt: string | null;
  systemKey: string | null;
  vehicle: { srNo: number; plate: string; model: string } | null;
  booking: { id: string; refNumber: number; customerName: string } | null;
};

type VehicleOpt = { srNo: number; plate: string; model: string };
type BookingOpt = { id: string; refNumber: number; customerName: string; endAt: string };

export function RemindersClient({
  overdue, today, upcoming, done, vehicles, bookings,
}: {
  overdue: R[]; today: R[]; upcoming: R[]; done: R[];
  vehicles: VehicleOpt[]; bookings: BookingOpt[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<R | null>(null);
  const [pending, start] = useTransition();

  const complete = (r: R, value: boolean) =>
    start(async () => {
      const res = await completeReminder(r.id, value);
      toastResult(res, value ? "Reminder completed" : "Reminder reopened");
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Reminders</h1>
          <p className="text-sm text-muted">
            {overdue.length} overdue · {today.length} due today · {upcoming.length} upcoming
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New reminder
        </Button>
      </div>

      <Section title="Overdue" tone="danger" count={overdue.length}>
        {overdue.map((r) => (
          <ReminderRow key={r.id} r={r} pending={pending} onComplete={(v) => complete(r, v)} onEdit={() => setEditing(r)} />
        ))}
        {overdue.length === 0 && <EmptyState title="Nothing overdue" />}
      </Section>

      <Section title="Due today" tone="warn" count={today.length}>
        {today.map((r) => (
          <ReminderRow key={r.id} r={r} pending={pending} onComplete={(v) => complete(r, v)} onEdit={() => setEditing(r)} />
        ))}
        {today.length === 0 && <EmptyState title="Nothing due today" />}
      </Section>

      <Section title="Upcoming" tone="info" count={upcoming.length}>
        {upcoming.map((r) => (
          <ReminderRow key={r.id} r={r} pending={pending} onComplete={(v) => complete(r, v)} onEdit={() => setEditing(r)} />
        ))}
        {upcoming.length === 0 && <EmptyState title="No upcoming reminders" hint="Create one for insurance renewals, follow-ups, calls…" />}
      </Section>

      {done.length > 0 && (
        <Section title="Recently completed" tone="neutral" count={done.length}>
          {done.map((r) => (
            <ReminderRow key={r.id} r={r} pending={pending} done onComplete={(v) => complete(r, v)} onEdit={() => setEditing(r)} />
          ))}
        </Section>
      )}

      {showNew && (
        <ReminderForm vehicles={vehicles} bookings={bookings} onClose={() => setShowNew(false)} />
      )}
      {editing && (
        <ReminderForm initial={editing} vehicles={vehicles} bookings={bookings} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Section({
  title, tone, count, children,
}: {
  title: string; tone: "danger" | "warn" | "info" | "neutral"; count: number; children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">{title}</h2>
          <Badge tone={tone}>{count}</Badge>
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function ReminderRow({
  r, pending, done, onComplete, onEdit,
}: {
  r: R; pending: boolean; done?: boolean; onComplete: (v: boolean) => void; onEdit: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [, start] = useTransition();

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3", done && "opacity-60")}>
      <button
        type="button"
        aria-label={done ? "Reopen reminder" : "Complete reminder"}
        disabled={pending}
        onClick={() => onComplete(!done)}
        className={cn(
          "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
          done ? "border-success bg-success-soft text-success" : "border-border-strong hover:border-success hover:text-success",
        )}
      >
        {done ? <RotateCcw size={11} /> : <CheckCircle2 size={13} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className={cn("text-sm", done && "line-through")}>
          {r.booking ? (
            <Link href={`/bookings/${r.booking.id}`} className="link">#{r.booking.refNumber} {r.booking.customerName}</Link>
          ) : (
            r.title
          )}
          {r.systemKey && <span className="ml-2 align-middle"><Badge tone="neutral">system</Badge></span>}
        </div>
        {r.notes && <div className="mt-0.5 text-xs text-muted">{r.notes}</div>}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-2">
          <span className={done ? "" : r.dueAt < new Date().toISOString() ? "font-medium text-danger" : ""}>
            <AlarmClock size={11} className="mr-1 inline" />
            {fmtDateShort(r.dueAt)}
          </span>
          {r.vehicle && (
            <Link href={`/vehicles/${r.vehicle.srNo}`} className="font-mono hover:text-fg">
              {r.vehicle.plate} · {r.vehicle.model}
            </Link>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-1">
        {!done && (
          <Button variant="ghost" size="sm" className="px-1.5" title="Edit" onClick={onEdit} disabled={pending}>
            <Pencil size={12} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="px-1.5"
          title="Delete"
          disabled={pending}
          onClick={() => setConfirmDel(true)}
        >
          <Trash2 size={12} />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={() => {
          setConfirmDel(false);
          start(async () => {
            const res = await deleteReminder(r.id);
            if (res?.error) toast.error(res.error);
            else toast.success("Reminder deleted");
          });
        }}
        title="Delete this reminder?"
        description={r.systemKey ? "This is a system reminder — it will be recreated by the next scan if the condition still holds." : undefined}
        confirmLabel="Delete"
        pending={pending}
      />
    </div>
  );
}

function ReminderForm({
  initial, vehicles, bookings, onClose,
}: {
  initial?: R; vehicles: VehicleOpt[]; bookings: BookingOpt[]; onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const defaultDue = initial
    ? toIstInputValue(new Date(initial.dueAt))
    : toIstInputValue(new Date(Date.now() + 60 * 60 * 1000));

  return (
    <Dialog open onClose={onClose} title={initial ? "Edit reminder" : "New reminder"}>
      <form
        className="space-y-3"
        action={(fd) => {
          setErr(null);
          start(async () => {
            const res = initial ? await updateReminder(fd) : await createReminder(fd);
            if (res?.error) setErr(res.error);
            else {
              toastResult(res, initial ? "Reminder updated" : "Reminder created");
              onClose();
            }
          });
        }}
      >
        {initial && <input type="hidden" name="id" value={initial.id} />}

        <Field label="Title" required>
          <Input name="title" required maxLength={160} defaultValue={initial?.title ?? ""} placeholder="e.g. RC renewal — Activa 5G" />
        </Field>

        <Field label="Due (IST)" required>
          <Input name="dueAt" type="datetime-local" defaultValue={defaultDue} required />
        </Field>

        <Field label="Notes">
          <Textarea name="notes" rows={2} maxLength={500} defaultValue={initial?.notes ?? ""} placeholder="Optional context" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Vehicle (optional)">
            <Select name="vehicleId" defaultValue={initial?.vehicle ? String(initial.vehicle.srNo) : ""}>
              <option value="">—</option>
              {vehicles.map((v) => (
                <option key={v.srNo} value={v.srNo}>{v.plate} · {v.model}</option>
              ))}
            </Select>
          </Field>
          <Field label="Booking (optional)">
            <Select name="bookingId" defaultValue={initial?.booking ? initial.booking.id : ""}>
              <option value="">—</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>#{b.refNumber} · {b.customerName}</option>
              ))}
            </Select>
          </Field>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>
            {initial ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
