"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createBooking } from "../actions";
import { calcQuote, inr } from "@/lib/pricing";
import { toIstInputValue } from "@/lib/utils";
import { Search, ChevronDown } from "lucide-react";
import { ConflictConfirmDialog } from "@/components/conflict-confirm-dialog";
import type { Conflict } from "@/lib/conflicts";

export type V = {
  srNo: number; plate: string; model: string; year: number | null;
  status: string; category: string | null; series: string | null;
  dailyRate: number; monthlyRate: number; deposit: number;
};

export type BookingRange = {
  id: string; vehicleId: number; startAt: string; endAt: string;
  refNumber: number; customerName: string;
};

// Overlap = ranges share open interior. Touching (end == start) is OK.
function findConflict(bookings: BookingRange[], vehicleId: number, start: Date, end: Date, excludeId?: string) {
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
  const sMs = start.getTime(), eMs = end.getTime();
  for (const b of bookings) {
    if (b.vehicleId !== vehicleId) continue;
    if (excludeId && b.id === excludeId) continue;
    const bs = new Date(b.startAt).getTime();
    const be = new Date(b.endAt).getTime();
    if (bs < eMs && be > sMs) return b;
  }
  return null;
}

const DOC_OPTIONS = [
  { id: "aadhaar", label: "Aadhaar" },
  { id: "driving_license", label: "Driving License" },
  { id: "passport", label: "Passport" },
  { id: "voter_id", label: "Voter ID" },
  { id: "other_id", label: "Other ID" },
  { id: "selfie", label: "Selfie/Photo" },
];

export function VehiclePicker({
  vehicles, value, onChange, bookings, rangeStart, rangeEnd, excludeBookingId,
}: {
  vehicles: V[]; value: number | ""; onChange: (id: number) => void;
  bookings?: BookingRange[]; rangeStart?: string; rangeEnd?: string; excludeBookingId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const selected = vehicles.find((v) => v.srNo === value);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const ql = q.trim().toLowerCase();
  const list = useMemo(() => {
    const arr = !ql
      ? vehicles
      : vehicles.filter((v) =>
          `${v.plate} ${v.model} ${v.series ?? ""} ${v.category ?? ""} ${v.year ?? ""} ${v.srNo ?? ""}`.toLowerCase().includes(ql),
        );
    return arr.slice(0, 50);
  }, [vehicles, ql]);

  // If bookings + a valid range were provided, derive per-vehicle availability
  // from the actual date window — not the live vehicle.status flag, which only
  // reflects "currently handed over" and would wrongly block back-to-back bookings.
  const conflictByVehicle = useMemo(() => {
    if (!bookings || !rangeStart || !rangeEnd) return null;
    const s = new Date(rangeStart), e = new Date(rangeEnd);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
    const map = new Map<number, BookingRange>();
    for (const v of vehicles) {
      const c = findConflict(bookings, v.srNo, s, e, excludeBookingId);
      if (c) map.set(v.srNo, c);
    }
    return map;
  }, [bookings, vehicles, rangeStart, rangeEnd, excludeBookingId]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        className="input text-left w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">
          {selected
            ? <><b>{selected.model}</b> · <span className="font-mono text-xs">{selected.plate}</span>{selected.year ? ` · ${selected.year}` : ""} — {inr(selected.dailyRate)}/day</>
            : <span className="text-muted-2">Search by plate, model, series…</span>}
        </span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-80 overflow-auto rounded-lg border border-border-strong bg-surface shadow-lg">
          <div className="sticky top-0 flex items-center gap-2 border-b border-border bg-surface p-2">
            <Search size={14} className="text-muted" />
            <input autoFocus className="input border-0 p-0 focus:shadow-none" placeholder="Search plate, model, series…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ul className="text-sm py-1">
            {list.map((v) => {
              // Hard blocks: retired/maintenance always disabled.
              const hardBlock = v.status === "retired" || v.status === "maintenance";
              // Range-aware block when we have a valid date window; otherwise
              // fall back to live status to keep behaviour sane when no range is set.
              const conflict = conflictByVehicle?.get(v.srNo);
              const rangeBlock = conflictByVehicle
                ? !!conflict
                : v.status === "rented";
              const disabled = hardBlock || rangeBlock;
              const note = hardBlock
                ? v.status
                : conflict
                  ? `booked #${conflict.refNumber} · ${conflict.customerName}`
                  : rangeBlock
                    ? v.status
                    : `${inr(v.dailyRate)}/day`;
              return (
                <li key={v.srNo}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => { onChange(v.srNo); setOpen(false); setQ(""); }}
                    className={`w-full text-left px-3 py-2 hover:bg-surface-2 ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${v.srNo === value ? "bg-surface-2" : ""}`}
                  >
                    <div className="flex justify-between gap-3">
                      <span><b>{v.model}</b>{v.year ? ` · ${v.year}` : ""}</span>
                      <span className="text-xs text-muted">{note}</span>
                    </div>
                    <div className="text-xs font-mono text-muted">
                      {v.plate}{v.srNo != null ? ` · #${v.srNo}` : ""}{v.series ? ` · ${v.series}` : ""}
                    </div>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-3 py-4 text-center text-muted">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export function NewBookingClient({ vehicles, bookings }: { vehicles: V[]; bookings: BookingRange[] }) {
  const now = new Date();
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [source, setSource] = useState<"offline" | "online">("offline");
  const [vehicleId, setVehicleId] = useState<number | "">("");
  const [plan, setPlan] = useState<"daily" | "monthly">("daily");
  const [startAt, setStartAt] = useState(toIstInputValue(now));
  const [endAt, setEndAt] = useState(toIstInputValue(later));
  const [rate, setRate] = useState<number>(0);
  const [deposit, setDeposit] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pendingConflicts, setPendingConflicts] = useState<Conflict[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const veh = vehicles.find((v) => v.srNo === vehicleId);

  useEffect(() => {
    if (!veh) { setRate(0); setDeposit(0); return; }
    setRate(plan === "monthly" ? veh.monthlyRate : veh.dailyRate);
    setDeposit(veh.deposit);
  }, [veh, plan]);

  const { quoted, units } = useMemo(() => {
    if (!veh) return { quoted: 0, units: 0 };
    try {
      const s = new Date(startAt), e = new Date(endAt);
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return { quoted: 0, units: 0 };
      const r = calcQuote(plan, s, e, rate);
      return { quoted: r.total, units: r.units };
    } catch { return { quoted: 0, units: 0 }; }
  }, [veh, plan, startAt, endAt, rate]);

  function send(fd: FormData) {
    start(async () => {
      const r = await createBooking(fd);
      if (r && "error" in r && r.error) setErr(r.error);
      else if (r && "conflicts" in r && r.conflicts) setPendingConflicts(r.conflicts);
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
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">New booking</h1>
      <form ref={formRef} onSubmit={submit} className="space-y-4">
        <div className="card space-y-3">
          <h2 className="font-medium">Source</h2>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="source" value="offline" checked={source === "offline"} onChange={() => setSource("offline")} /> Walk-in</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="source" value="online" checked={source === "online"} onChange={() => setSource("online")} /> Online app</label>
          </div>
          {source === "online" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">App reference ID</label><input name="externalRef" className="input" /></div>
              <div><label className="label">OTP (from app)</label><input name="otpCode" className="input" /></div>
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="font-medium">Customer</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name *</label><input name="customerName" className="input" required /></div>
            <div><label className="label">Phone *</label><input name="customerPhone" className="input" required /></div>
            <div><label className="label">Alt phone</label><input name="altPhone" className="input" /></div>
            <div><label className="label">Email</label><input name="email" className="input" /></div>
            <div className="col-span-2"><label className="label">Address</label><textarea name="address" rows={2} className="textarea" /></div>
            <div className="col-span-2"><label className="label">Alternate address</label><textarea name="altAddress" rows={2} className="textarea" /></div>
          </div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-medium">Documents</h2>
          <div className="flex flex-wrap gap-3">
            {DOC_OPTIONS.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="docsReceived" value={d.id} /> {d.label}
              </label>
            ))}
          </div>
          <div><label className="label">Note</label><input name="docsNote" className="input" placeholder="e.g. DL pending" /></div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-medium">Vehicle &amp; plan</h2>
          <div>
            <label className="label">Vehicle *</label>
            <VehiclePicker vehicles={vehicles} value={vehicleId} onChange={setVehicleId} bookings={bookings} rangeStart={startAt} rangeEnd={endAt} />
            <input type="hidden" name="vehicleId" value={vehicleId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Plan *</label>
              <select name="plan" className="select" value={plan} onChange={(e) => setPlan(e.target.value as "daily" | "monthly")}>
                <option value="daily">Daily</option><option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="label">Rate ₹ / {plan === "monthly" ? "month" : "day"} *</label>
              <input name="rateUsed" type="number" className="input" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} required />
              {veh && (
                <p className="mt-1 text-xs text-muted">
                  Default: {inr(plan === "monthly" ? veh.monthlyRate : veh.dailyRate)} — editable per booking.
                </p>
              )}
            </div>
            <div>
              <label className="label">Deposit (₹)</label>
              <input name="depositAmount" type="number" className="input" value={deposit} onChange={(e) => setDeposit(Number(e.target.value) || 0)} />
            </div>
            <div />
            <div><label className="label">Start * (IST)</label><input name="startAt" type="datetime-local" className="input" value={startAt} onChange={(e) => setStartAt(e.target.value)} required /></div>
            <div><label className="label">Expected end * (IST)</label><input name="endAt" type="datetime-local" className="input" value={endAt} onChange={(e) => setEndAt(e.target.value)} required /></div>
          </div>

          {veh && (
            <div className="space-y-1 rounded-lg bg-surface-2 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted">Duration</span><span className="num">{units} {plan === "monthly" ? "month(s)" : "day(s)"}</span></div>
              <div className="flex justify-between"><span className="text-muted">Rate × units</span><span className="num">{inr(rate)} × {units}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold"><span>Quoted total</span><span className="num">{inr(quoted)}</span></div>
            </div>
          )}
          <div><label className="label">Condition note (out)</label><textarea name="conditionOutNote" rows={2} className="textarea" placeholder="scratches, fuel level, etc." /></div>
        </div>

        <div className="card space-y-3">
          <h2 className="font-medium">Payment</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Advance collected (₹)</label><input name="advanceAmount" type="number" className="input" defaultValue={0} /></div>
            <div><label className="label">Mode</label>
              <select name="advanceMode" className="select" defaultValue="cash">
                {["cash", "upi", "card", "bank", "other"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="handOverNow" /> Hand over now (vehicle leaves the shop)</label>
        </div>

        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <a href="/bookings" className="btn">Cancel</a>
          <button className="btn btn-primary" disabled={pending || !vehicleId}>{pending ? "Creating…" : "Create booking"}</button>
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
    </div>
  );
}
