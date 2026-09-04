"use client";
import { useRef, useState, useTransition } from "react";
import { addPayment, handOver, markReturned, closeBooking, cancelBooking, amendBooking, editPayment, deletePayment, refundDeposit } from "../actions";
import { inr, calcQuote } from "@/lib/pricing";
import { fmtDate, toIstInputValue } from "@/lib/utils";
import { computeSettlement } from "@/lib/settlement";
import { StatusPill, ConflictPill } from "@/components/status-pill";
import { ConflictConfirmDialog } from "@/components/conflict-confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { toast, toastResult } from "@/components/ui/toast";
import type { Conflict } from "@/lib/conflicts";
import { VehiclePicker, type V, type BookingRange } from "../new/client";
import {
  ArrowRightCircle, Undo2, CheckCircle2, XCircle, Pencil, Plus, ReceiptText, Trash2, Undo, AlertTriangle,
} from "lucide-react";

type Amend = {
  id: string; reason: string; kind: string; createdAt: string;
  fromVehicle: { plate: string; model: string } | null;
  toVehicle: { plate: string; model: string } | null;
  fromStartAt: string | null; toStartAt: string | null;
  fromEndAt: string | null; toEndAt: string | null;
  fromRateUsed: number | null; toRateUsed: number | null;
  fromQuotedAmount: number; toQuotedAmount: number;
  deltaCharged: number;
  createdBy: { username: string; fullName: string };
};

type Pay = {
  id: string; kind: string; amount: number; mode: string;
  reference: string | null; note: string | null; createdAt: string;
  recordedBy: { username: string };
};

type B = {
  id: string; refNumber: number; source: string; externalRef: string | null; status: string;
  customerName: string; customerPhone: string; altPhone: string | null; email: string | null;
  address: string | null; altAddress: string | null; docsReceived: string[]; docsNote: string | null;
  otpCode: string | null; plan: "daily" | "monthly";
  startAt: string; endAt: string; handedOverAt: string | null; actualReturnAt: string | null; closedAt: string | null;
  rateUsed: number; quotedAmount: number; depositAmount: number;
  odometerOut: number | null; odometerIn: number | null; fuelOut: string | null; fuelIn: string | null;
  damageCharges: number; conditionOutNote: string | null; conditionInNote: string | null;
  vehicle: { srNo: number; plate: string; model: string; year: number | null; category: string | null; series: string | null };
  createdBy: { username: string; fullName: string };
  payments: Pay[];
  amendments: Amend[];
};

export function BookingDetailClient({ booking, vehicles, bookings, conflicts, isOwner }: { booking: B; vehicles: V[]; bookings: BookingRange[]; conflicts: Conflict[]; isOwner: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "handover" | "return" | "amend" | "payment" | "refundDeposit">(null);
  const [editingPay, setEditingPay] = useState<Pay | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const st = computeSettlement(booking.payments, booking.quotedAmount, booking.damageCharges);
  const {
    totalDue, paid, otherRefunds, depositTaken, depositHeld, depositStatus,
    rentShortfall, excessAdvance, depositCoversRent, suggestedDepositRefund, balance,
  } = st;

  const overdue = (booking.status === "handed_over" || booking.status === "active") && new Date(booking.endAt) < new Date();

  function run(fn: () => Promise<{ error?: string; ok?: boolean } | void>, success: string) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) setErr(r.error);
      else toast.success(success);
    });
  }

  const s = booking.status;
  const canHandOver = s === "booked" || s === "reserved";
  const canReturn = s === "handed_over" || s === "active";
  const canClose = s === "returned";
  const canCancel = isOwner && s !== "closed" && s !== "cancelled" && s !== "returned";
  const canAmend = s !== "closed" && s !== "cancelled";

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono text-muted">
            #{booking.refNumber} · {booking.source}{booking.externalRef ? ` · ${booking.externalRef}` : ""}
          </div>
          <h1 className="text-2xl font-semibold mt-1">{booking.customerName}</h1>
          <div className="text-sm text-muted">
            {booking.customerPhone}{booking.altPhone ? ` · ${booking.altPhone}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={booking.status} overdue={overdue} />
          <ConflictPill count={conflicts.length} />
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="card space-y-2 border-warn/60 text-sm">
          <h3 className="font-medium flex items-center gap-2">
            <AlertTriangle size={14} /> Overlapping bookings ({conflicts.length})
          </h3>
          <p className="text-xs text-muted">
            Same vehicle, overlapping window. Resolve by amending (swap vehicle / shorten dates) or cancelling one side.
          </p>
          <ul className="space-y-1.5">
            {conflicts.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 border-t border-border pt-1.5">
                <div>
                  <div>
                    <a className="link font-mono text-xs" href={`/bookings/${c.id}`}>#{c.refNumber}</a>
                    {" · "}<span className="font-medium">{c.customerName}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {fmtDate(c.startAt)} → {fmtDate(c.endAt)}
                  </div>
                </div>
                <span className="badge badge-info">{c.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        {canHandOver && <Button variant="primary" disabled={pending} onClick={() => setDialog("handover")}><ArrowRightCircle size={14} /> Hand over</Button>}
        {canReturn && <Button variant="primary" disabled={pending} onClick={() => setDialog("return")}><Undo2 size={14} /> Mark returned</Button>}
        {canClose && <Button variant="primary" disabled={pending} onClick={() => run(() => closeBooking(booking.id), "Booking closed")}><CheckCircle2 size={14} /> Close booking</Button>}
        {canAmend && <Button disabled={pending} onClick={() => setDialog("amend")}><Pencil size={14} /> Amend</Button>}
        <Button disabled={pending} onClick={() => setDialog("payment")}><Plus size={14} /> Add payment</Button>
        {depositHeld > 0 && <Button disabled={pending} onClick={() => setDialog("refundDeposit")}><Undo size={14} /> Refund deposit</Button>}
        {canCancel && <Button variant="danger" disabled={pending} onClick={() => setConfirmCancel(true)}><XCircle size={14} /> Cancel</Button>}
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}

      {/* Two-column layout */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="card space-y-2 text-sm">
            <h3 className="font-medium mb-1">Vehicle</h3>
            <div className="font-medium">{booking.vehicle.model}{booking.vehicle.year ? ` · ${booking.vehicle.year}` : ""}</div>
            <div className="font-mono text-xs text-muted">{booking.vehicle.plate}{booking.vehicle.series ? ` · ${booking.vehicle.series}` : ""}{booking.vehicle.category ? ` · ${booking.vehicle.category}` : ""}</div>
            <Row k="Plan" v={`${booking.plan} @ ${inr(booking.rateUsed)}/${booking.plan === "monthly" ? "mo" : "day"}`} />
            <Row k="From" v={fmtDate(booking.startAt)} />
            <Row k="To" v={fmtDate(booking.endAt)} />
            {booking.handedOverAt && <Row k="Handed over" v={fmtDate(booking.handedOverAt)} />}
            {booking.actualReturnAt && <Row k="Returned" v={fmtDate(booking.actualReturnAt)} />}
            {booking.otpCode && <Row k="OTP" v={<span className="font-mono">{booking.otpCode}</span>} />}
            {(booking.odometerOut != null || booking.odometerIn != null) && (
              <Row k="Odometer" v={`${booking.odometerOut ?? "—"} → ${booking.odometerIn ?? "—"} km`} />
            )}
            {(booking.fuelOut || booking.fuelIn) && (
              <Row k="Fuel" v={`${booking.fuelOut ?? "—"} → ${booking.fuelIn ?? "—"}`} />
            )}
            {booking.conditionOutNote && <Row k="Out note" v={booking.conditionOutNote} />}
            {booking.conditionInNote && <Row k="In note" v={booking.conditionInNote} />}
          </div>

          <div className="card space-y-2 text-sm">
            <h3 className="font-medium mb-1">Amount</h3>
            <Row k="Quoted (current)" v={<span className="num">{inr(booking.quotedAmount)}</span>} />
            {booking.damageCharges > 0 && <Row k="Damage" v={<span className="num">{inr(booking.damageCharges)}</span>} />}
            <Row k="Paid" v={<span className="num">{inr(paid)}</span>} />
            {otherRefunds > 0 && <Row k="Refunded" v={<span className="num">{inr(otherRefunds)}</span>} />}
            {depositTaken > 0 && (
              <Row
                k="Deposit"
                v={
                  <span className="flex items-center gap-2 justify-end">
                    <span className="num">{inr(depositHeld)} / {inr(depositTaken)}</span>
                    {depositStatus === "held" && <span className="badge badge-info">held</span>}
                    {depositStatus === "partial" && <span className="badge badge-warn">partial refund</span>}
                    {depositStatus === "refunded" && <span className="badge badge-success">refunded</span>}
                  </span>
                }
              />
            )}
            <div className="border-t border-border pt-2 mt-2 font-semibold flex justify-between">
              <span>Balance due</span><span className="num">{inr(balance)}</span>
            </div>
            {(depositHeld > 0 || excessAdvance > 0 || rentShortfall > 0) && (
              <div className="border-t border-border pt-2 mt-1 space-y-1 text-xs text-muted">
                <div className="font-medium text-fg">Settlement</div>
                {rentShortfall > 0 && depositCoversRent > 0 && (
                  <div className="flex justify-between"><span>Apply deposit → rent</span><span className="num">{inr(depositCoversRent)}</span></div>
                )}
                {rentShortfall > depositCoversRent && (
                  <div className="flex justify-between"><span>Collect from customer</span><span className="num">{inr(rentShortfall - depositCoversRent)}</span></div>
                )}
                {excessAdvance > 0 && (
                  <div className="flex justify-between"><span>Refund excess advance</span><span className="num">{inr(excessAdvance)}</span></div>
                )}
                {suggestedDepositRefund > 0 && (
                  <div className="flex justify-between"><span>Refund deposit</span><span className="num">{inr(suggestedDepositRefund)}</span></div>
                )}
                {rentShortfall === 0 && excessAdvance === 0 && depositHeld > 0 && suggestedDepositRefund === depositHeld && (
                  <div className="flex justify-between"><span>Profit booked</span><span className="num">{inr(totalDue)}</span></div>
                )}
              </div>
            )}
          </div>

          <div className="card text-sm space-y-2">
            <h3 className="font-medium mb-1">Customer</h3>
            {booking.email && <Row k="Email" v={booking.email} />}
            {booking.address && <Row k="Address" v={booking.address} />}
            {booking.altAddress && <Row k="Alt address" v={booking.altAddress} />}
            <Row k="Docs" v={booking.docsReceived.length ? booking.docsReceived.join(", ") : "none marked"} />
            {booking.docsNote && <Row k="Note" v={booking.docsNote} />}
            <div className="text-xs pt-1 text-muted">Created by {booking.createdBy.fullName} (@{booking.createdBy.username})</div>
          </div>
        </div>

        {/* Right column: timeline */}
        <div className="card space-y-3 text-sm">
          <h3 className="font-medium flex items-center gap-2"><ReceiptText size={14} /> Timeline</h3>
          <div className="tl">
            {[
              ...booking.amendments.map((a) => ({ kind: "amend" as const, at: a.createdAt, data: a })),
              ...booking.payments.map((p) => ({ kind: "pay" as const, at: p.createdAt, data: p })),
            ]
              .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
              .map((e, i) => (
                <div key={i} className="tl-item">
                  {e.kind === "pay" ? (
                    <PayEntry p={e.data} isOwner={isOwner} onEdit={() => setEditingPay(e.data)} />
                  ) : (
                    <AmendEntry a={e.data} />
                  )}
                </div>
              ))}
            {booking.amendments.length === 0 && booking.payments.length === 0 && (
              <div className="text-center py-6 text-muted">No activity yet</div>
            )}
          </div>
        </div>
      </div>

      {dialog === "handover" && <HandOverDialog bookingId={booking.id} onClose={() => setDialog(null)} />}
      {dialog === "return" && <ReturnDialog bookingId={booking.id} onClose={() => setDialog(null)} />}
      {dialog === "payment" && <PaymentDialog bookingId={booking.id} onClose={() => setDialog(null)} />}
      {dialog === "refundDeposit" && <RefundDepositDialog bookingId={booking.id} maxAmount={depositHeld} suggested={suggestedDepositRefund} rentShortfall={rentShortfall} onClose={() => setDialog(null)} />}
      {dialog === "amend" && <AmendDialog booking={booking} vehicles={vehicles} bookings={bookings} onClose={() => setDialog(null)} />}
      {editingPay && <EditPaymentDialog payment={editingPay} onClose={() => setEditingPay(null)} />}

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          run(() => cancelBooking(booking.id), "Booking cancelled");
        }}
        title="Cancel this booking?"
        description="The booking will be marked cancelled and the vehicle freed (unless another active rental uses it). This is owner-only and recorded in the audit log."
        confirmLabel="Cancel booking"
        pending={pending}
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><span className="text-muted">{k}</span><span className="text-right">{v}</span></div>;
}

function PayEntry({ p, isOwner, onEdit }: { p: Pay; isOwner: boolean; onEdit: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const sign = p.kind === "refund" ? "−" : "+";
  function del() {
    setErr(null);
    setConfirmDel(false);
    start(async () => {
      const r = await deletePayment(p.id);
      if (r?.error) setErr(r.error);
      else toast.success("Payment deleted");
    });
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="badge badge-info">{p.kind}</span>
          <span className="text-xs text-muted">{p.mode}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="num font-medium">{sign}{inr(p.amount)}</span>
          {isOwner && (
            <>
              <Button variant="ghost" size="sm" className="px-1.5" title="Edit payment" onClick={onEdit} disabled={pending}><Pencil size={12} /></Button>
              <Button variant="ghost" size="sm" className="px-1.5" title="Delete payment" onClick={() => setConfirmDel(true)} disabled={pending}><Trash2 size={12} /></Button>
            </>
          )}
        </div>
      </div>
      <div className="text-xs mt-1 text-muted">
        {fmtDate(p.createdAt)} · @{p.recordedBy.username}
        {p.reference ? ` · ${p.reference}` : ""}{p.note ? ` · ${p.note}` : ""}
      </div>
      {err && <p className="text-xs mt-1 text-danger">{err}</p>}
      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={del}
        title={`Delete this ${p.kind} of ${inr(p.amount)}?`}
        description="This cannot be undone. The deletion is recorded in the audit log."
        confirmLabel="Delete payment"
        pending={pending}
      />
    </div>
  );
}

function AmendEntry({ a }: { a: Amend }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="badge badge-warn">amendment · {a.kind}</span>
        <span className="num text-xs">
          {inr(a.fromQuotedAmount)} → {inr(a.toQuotedAmount)}
        </span>
      </div>
      <div className="text-sm mt-1">{a.reason}</div>
      <div className="text-xs mt-1 space-y-0.5 text-muted">
        {a.fromVehicle && a.toVehicle && (
          <div>Vehicle: {a.fromVehicle.model} ({a.fromVehicle.plate}) → {a.toVehicle.model} ({a.toVehicle.plate})</div>
        )}
        {a.fromStartAt && a.toStartAt && <div>Dates: {fmtDate(a.fromStartAt)} – {fmtDate(a.fromEndAt!)} → {fmtDate(a.toStartAt)} – {fmtDate(a.toEndAt!)}</div>}
        {a.fromRateUsed != null && <div>Rate: {inr(a.fromRateUsed)} → {inr(a.toRateUsed!)}</div>}
        {a.deltaCharged !== 0 && <div>Delta: {a.deltaCharged > 0 ? "+" : "−"}{inr(Math.abs(a.deltaCharged))}</div>}
        <div>{fmtDate(a.createdAt)} · @{a.createdBy.username}</div>
      </div>
    </div>
  );
}

/* ---------- Dialogs ---------- */

function HandOverDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await handOver(bookingId, fd);
      if (r?.error) setErr(r.error);
      else {
        toast.success("Vehicle handed over");
        onClose();
      }
    });
  }
  return (
    <Dialog open onClose={onClose} title="Hand over vehicle">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Handed over at (IST)" required>
          <Input name="handedOverAt" type="datetime-local" defaultValue={toIstInputValue(new Date())} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Odometer out (km)">
            <Input name="odometerOut" type="number" />
          </Field>
          <Field label="Fuel out">
            <Input name="fuelOut" placeholder="F / 1/2 / 1/4" />
          </Field>
        </div>
        <Field label="Condition note (out)">
          <Textarea name="conditionOutNote" rows={3} />
        </Field>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>Confirm hand over</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ReturnDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await markReturned(bookingId, fd);
      if (r?.error) setErr(r.error);
      else {
        toast.success("Return recorded");
        onClose();
      }
    });
  }
  return (
    <Dialog open onClose={onClose} title="Mark returned">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Actual return time (IST)" required>
          <Input name="actualReturnAt" type="datetime-local" defaultValue={toIstInputValue(new Date())} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Odometer in (km)">
            <Input name="odometerIn" type="number" />
          </Field>
          <Field label="Fuel in">
            <Input name="fuelIn" placeholder="F / 1/2 / 1/4" />
          </Field>
        </div>
        <Field label="Condition / damage notes">
          <Textarea name="conditionInNote" rows={3} />
        </Field>
        <Field label="Damage charges (₹)">
          <Input name="damageCharges" type="number" defaultValue={0} />
        </Field>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>Confirm return</Button>
        </div>
      </form>
    </Dialog>
  );
}

function PaymentDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await addPayment(bookingId, fd);
      if (r?.error) setErr(r.error);
      else {
        toast.success("Payment added");
        onClose();
      }
    });
  }
  return (
    <Dialog open onClose={onClose} title="Add payment">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select name="kind" defaultValue="balance">
              {["advance", "balance", "deposit", "refund", "extra", "amendment"].map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Mode">
            <Select name="mode" defaultValue="cash">
              {["cash", "upi", "card", "bank", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Amount (₹)" required>
            <Input name="amount" type="number" required />
          </Field>
          <Field label="Reference">
            <Input name="reference" />
          </Field>
          <div className="col-span-2">
            <Field label="Note">
              <Input name="note" />
            </Field>
          </div>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>Add</Button>
        </div>
      </form>
    </Dialog>
  );
}

function AmendDialog({ booking, vehicles, bookings, onClose }: { booking: B; vehicles: V[]; bookings: BookingRange[]; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [vehicleId, setVehicleId] = useState<number | "">(booking.vehicle.srNo);
  const [plan, setPlan] = useState<"daily" | "monthly">(booking.plan);
  const [startAt, setStartAt] = useState(toIstInputValue(new Date(booking.startAt)));
  const [endAt, setEndAt] = useState(toIstInputValue(new Date(booking.endAt)));
  const veh = vehicles.find((v) => v.srNo === vehicleId);
  const [rate, setRate] = useState<number>(booking.rateUsed);
  const [pendingConflicts, setPendingConflicts] = useState<Conflict[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const newQuote = (() => {
    try {
      const s = new Date(startAt), e = new Date(endAt);
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return 0;
      return calcQuote(plan, s, e, rate).total;
    } catch { return 0; }
  })();
  const suggestedDelta = newQuote - booking.quotedAmount;

  function send(fd: FormData) {
    start(async () => {
      const r = await amendBooking(booking.id, fd);
      if (r && "error" in r && r.error) setErr(r.error);
      else if (r && "conflicts" in r && r.conflicts) setPendingConflicts(r.conflicts);
      else {
        toast.success("Booking amended");
        onClose();
      }
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    send(new FormData(e.currentTarget));
  }

  function confirmConflicts() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    fd.set("confirmConflicts", "1");
    setPendingConflicts(null);
    setErr(null);
    send(fd);
  }

  return (
    <Dialog open onClose={onClose} title="Amend booking">
      <form ref={formRef} onSubmit={submit} className="space-y-3">
        <Field label="Reason" required>
          <Input name="reason" placeholder="e.g. customer swapped to Hunter after engine issue" required />
        </Field>
        <div>
          <div className="label">Vehicle</div>
          <VehiclePicker vehicles={vehicles} value={vehicleId} onChange={(id) => { setVehicleId(id); const v = vehicles.find((x) => x.srNo === id); if (v) setRate(plan === "monthly" ? v.monthlyRate : v.dailyRate); }} bookings={bookings} rangeStart={startAt} rangeEnd={endAt} excludeBookingId={booking.id} />
          <input type="hidden" name="vehicleId" value={vehicleId} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label">Plan</div>
            <Select name="plan" value={plan} onChange={(e) => { const p = e.target.value as "daily" | "monthly"; setPlan(p); if (veh) setRate(p === "monthly" ? veh.monthlyRate : veh.dailyRate); }}>
              <option value="daily">Daily</option><option value="monthly">Monthly</option>
            </Select>
          </div>
          <Field label={`Rate (₹/${plan === "monthly" ? "mo" : "day"})`} required>
            <Input name="rateUsed" type="number" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} required />
          </Field>
          <Field label="New start (IST)" required>
            <Input name="startAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
          </Field>
          <Field label="New end (IST)" required>
            <Input name="endAt" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
          </Field>
        </div>
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted">Old quoted</span><span className="num">{inr(booking.quotedAmount)}</span></div>
          <div className="flex justify-between"><span className="text-muted">New quoted</span><span className="num">{inr(newQuote)}</span></div>
          <div className="flex justify-between border-t border-border pt-1 mt-1 font-medium">
            <span>Suggested delta</span><span className="num">{suggestedDelta >= 0 ? "+" : "−"}{inr(Math.abs(suggestedDelta))}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Delta charged now (₹)">
            <Input name="deltaCharged" type="number" defaultValue={suggestedDelta} />
          </Field>
          <div>
            <div className="label">Mode</div>
            <Select name="deltaMode" defaultValue="cash">
              {["cash", "upi", "card", "bank", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted">
          Positive = customer pays extra. Negative = refund. The booking&apos;s quoted amount becomes the new value — revenue is not double-counted.
        </p>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>Save amendment</Button>
        </div>
      </form>
      {pendingConflicts && (
        <ConflictConfirmDialog
          conflicts={pendingConflicts}
          onConfirm={confirmConflicts}
          onCancel={() => setPendingConflicts(null)}
          pending={pending}
        />
      )}
    </Dialog>
  );
}

function EditPaymentDialog({ payment, onClose }: { payment: Pay; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await editPayment(payment.id, fd);
      if (r?.error) setErr(r.error);
      else {
        toast.success("Payment updated");
        onClose();
      }
    });
  }
  return (
    <Dialog open onClose={onClose} title="Edit payment">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select name="kind" defaultValue={payment.kind}>
              {["advance", "balance", "deposit", "refund", "extra", "amendment"].map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Mode">
            <Select name="mode" defaultValue={payment.mode}>
              {["cash", "upi", "card", "bank", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Amount (₹)" required>
            <Input name="amount" type="number" defaultValue={payment.amount} required />
          </Field>
          <Field label="Reference">
            <Input name="reference" defaultValue={payment.reference ?? ""} />
          </Field>
          <div className="col-span-2">
            <Field label="Note">
              <Input name="note" defaultValue={payment.note ?? ""} />
            </Field>
          </div>
        </div>
        <p className="text-xs text-muted">Owner-only. The change is recorded in the audit log.</p>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>Save</Button>
        </div>
      </form>
    </Dialog>
  );
}

function RefundDepositDialog({ bookingId, maxAmount, suggested, rentShortfall, onClose }: { bookingId: string; maxAmount: number; suggested: number; rentShortfall: number; onClose: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await refundDeposit(bookingId, fd);
      if (r?.error) setErr(r.error);
      else {
        toast.success("Deposit refund recorded");
        onClose();
      }
    });
  }
  return (
    <Dialog open onClose={onClose} title="Refund deposit">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-muted">Deposit held: <span className="num">{inr(maxAmount)}</span>. Partial refunds are allowed.</p>
        {rentShortfall > 0 && (
          <p className="rounded bg-surface-2 p-2 text-xs text-muted">
            Rent unpaid: <span className="num">{inr(rentShortfall)}</span>. Suggested refund <span className="num">{inr(suggested)}</span> — keeps {inr(Math.min(maxAmount, rentShortfall))} to settle rent. Add a payment of kind <em>balance</em> for the kept amount before closing.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" required>
            <Input name="amount" type="number" defaultValue={suggested || maxAmount} max={maxAmount} required />
          </Field>
          <div>
            <div className="label">Mode</div>
            <Select name="mode" defaultValue="cash">
              {["cash", "upi", "card", "bank", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
          <Field label="Reference">
            <Input name="reference" placeholder="UPI ref, txn id…" />
          </Field>
          <div className="col-span-2">
            <Field label="Note">
              <Input name="note" placeholder="e.g. minor scratch deducted ₹200" />
            </Field>
          </div>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={pending}>Refund</Button>
        </div>
      </form>
    </Dialog>
  );
}
