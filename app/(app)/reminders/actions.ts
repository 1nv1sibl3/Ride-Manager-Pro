"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { parseIstLocal } from "@/lib/utils";

const reminderSchema = z.object({
  title: z.string().trim().min(1).max(160),
  notes: z.string().max(500).optional().or(z.literal("")),
  dueAt: z.string().min(1), // datetime-local, IST wall clock
  vehicleId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  bookingId: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().min(1).optional(),
  ),
});

export async function createReminder(formData: FormData) {
  const session = await requireSession();
  const parsed = reminderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;
  const dueAt = parseIstLocal(d.dueAt);
  if (isNaN(dueAt.getTime())) return { error: "Invalid due date" };

  try {
    const r = await prisma.reminder.create({
      data: {
        title: d.title,
        notes: d.notes || null,
        dueAt,
        vehicleId: d.vehicleId ?? null,
        bookingId: d.bookingId ?? null,
        createdById: session.id,
      },
    });
    await logAudit({ tableName: "Reminder", rowId: r.id, action: "insert", actorId: session.id, after: { title: r.title, dueAt: r.dueAt } });
    revalidatePath("/reminders");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create reminder" };
  }
}

export async function updateReminder(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get("id") || "");
  const parsed = reminderSchema.safeParse(Object.fromEntries(formData));
  if (!id || !parsed.success) return { error: parsed.error?.errors[0]?.message || "Invalid input" };
  const d = parsed.data;
  const dueAt = parseIstLocal(d.dueAt);
  if (isNaN(dueAt.getTime())) return { error: "Invalid due date" };

  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) return { error: "Reminder not found" };
  if (existing.systemKey && session.role !== "owner") {
    return { error: "System reminders can only be edited by the owner" };
  }

  try {
    const r = await prisma.reminder.update({
      where: { id },
      data: {
        title: d.title,
        notes: d.notes || null,
        dueAt,
        vehicleId: d.vehicleId ?? null,
        bookingId: d.bookingId ?? null,
      },
    });
    await logAudit({ tableName: "Reminder", rowId: id, action: "update", actorId: session.id, before: { title: existing.title, dueAt: existing.dueAt }, after: { title: r.title, dueAt: r.dueAt } });
    revalidatePath("/reminders");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update reminder" };
  }
}

export async function completeReminder(id: string, done: boolean) {
  const session = await requireSession();
  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) return { error: "Reminder not found" };
  await prisma.reminder.update({ where: { id }, data: { doneAt: done ? new Date() : null } });
  await logAudit({
    tableName: "Reminder", rowId: id, action: "update", actorId: session.id,
    before: { done: !!existing.doneAt }, after: { done },
  });
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteReminder(id: string) {
  const session = await requireSession();
  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) return { error: "Reminder not found" };
  // Own reminders always; system reminders owner-only.
  if (existing.createdById !== session.id && session.role !== "owner") {
    return { error: "Only the creator or an owner can delete this reminder" };
  }
  await prisma.reminder.delete({ where: { id } });
  await logAudit({ tableName: "Reminder", rowId: id, action: "delete", actorId: session.id, before: { title: existing.title } });
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  return { ok: true };
}
