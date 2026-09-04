"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { addServiceRecord } from "../actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { toastResult } from "@/components/ui/toast";

export function ServiceForm({ srNo }: { srNo: number }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus size={13} /> Add service
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add service record">
        <form
          className="space-y-3"
          action={(fd) => {
            setErr(null);
            start(async () => {
              const res = await addServiceRecord(srNo, fd);
              if (res?.error) setErr(res.error);
              else {
                toastResult(res, "Service recorded");
                setOpen(false);
              }
            });
          }}
        >
          <Field label="Description" required>
            <Input name="description" required maxLength={300} placeholder="e.g. oil change + brake pads" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Serviced on" required>
              <Input name="servicedAt" type="date" defaultValue={today} required />
            </Field>
            <Field label="Cost (₹)">
              <Input name="cost" type="number" min={0} defaultValue={0} />
            </Field>
            <Field label="Odometer (km)">
              <Input name="odometer" type="number" min={0} placeholder="current reading" />
            </Field>
            <Field label="Next due (date)">
              <Input name="nextDueDate" type="date" />
            </Field>
            <Field label="Next due (odometer km)">
              <Input name="nextDueOdometer" type="number" min={0} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="markMaintenance" /> Mark vehicle as in maintenance
          </label>

          <p className="text-xs text-muted">
            Next-due values feed the service reminders on the dashboard and the daily digest.
          </p>

          {err && <p className="text-sm text-danger">{err}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={pending}>Save</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
