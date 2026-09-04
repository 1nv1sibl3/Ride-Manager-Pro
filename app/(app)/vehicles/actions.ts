"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireOwner } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { fmtDateShort } from "@/lib/utils";
import { inr } from "@/lib/pricing";

const optInt = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : v),
  z.coerce.number().int().nullable(),
);
const optStr = z.string().max(80).optional().or(z.literal(""));

// srNo is now the primary key — required on create, immutable on update.
const baseSchema = z.object({
  plate: z.string().trim().min(1).max(20),
  model: z.string().trim().min(1).max(80),
  category: optStr,
  series: optStr,
  color: z.string().max(40).optional().or(z.literal("")),
  year: optInt,
  odometer: z.coerce.number().int().min(0).default(0),
  status: z.enum(["available", "rented", "maintenance", "retired"]).default("available"),
  notes: z.string().max(500).optional().or(z.literal("")),
  dailyRate: z.coerce.number().int().nonnegative().default(0),
  monthlyRate: z.coerce.number().int().nonnegative().default(0),
  deposit: z.coerce.number().int().nonnegative().default(0),
});

const createSchema = baseSchema.extend({
  srNo: z.coerce.number().int().positive("Sr. no. is required and must be a positive number"),
});

export async function createVehicle(formData: FormData) {
  const session = await requireSession();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;
  // Guard against duplicate srNo with a friendly message.
  const dupe = await prisma.vehicle.findUnique({ where: { srNo: d.srNo } });
  if (dupe) return { error: `Sr. no. ${d.srNo} is already used by ${dupe.plate}` };
  try {
    const v = await prisma.vehicle.create({
      data: {
        srNo: d.srNo,
        plate: d.plate.toUpperCase(),
        model: d.model,
        category: d.category ? d.category.trim() : null,
        series: d.series ? d.series.trim() : null,
        color: d.color || null,
        year: d.year,
        odometer: d.odometer,
        status: d.status,
        notes: d.notes || null,
        dailyRate: d.dailyRate,
        monthlyRate: d.monthlyRate,
        deposit: d.deposit,
      },
    });
    await logAudit({ tableName: "Vehicle", rowId: String(v.srNo), action: "insert", actorId: session.id, after: v });
  } catch (e: unknown) {
    return { error: (e as { message?: string }).message || "Failed to create" };
  }
  revalidatePath("/vehicles");
  return { ok: true };
}

export async function updateVehicle(srNo: number, formData: FormData) {
  const session = await requireSession();
  const parsed = baseSchema.partial().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const before = await prisma.vehicle.findUnique({ where: { srNo } });
  if (!before) return { error: "Not found" };
  const d = parsed.data;
  const after = await prisma.vehicle.update({
    where: { srNo },
    data: {
      plate: d.plate ? d.plate.toUpperCase() : undefined,
      model: d.model,
      category: d.category !== undefined ? (d.category ? d.category.trim() : null) : undefined,
      series: d.series !== undefined ? (d.series ? d.series.trim() : null) : undefined,
      color: d.color !== undefined ? d.color || null : undefined,
      year: d.year !== undefined ? d.year : undefined,
      odometer: d.odometer,
      status: d.status,
      notes: d.notes !== undefined ? d.notes || null : undefined,
      dailyRate: d.dailyRate,
      monthlyRate: d.monthlyRate,
      deposit: d.deposit,
    },
  });
  await logAudit({ tableName: "Vehicle", rowId: String(srNo), action: "update", actorId: session.id, before, after });
  revalidatePath("/vehicles");
  return { ok: true };
}

export async function deleteVehicle(srNo: number) {
  const session = await requireOwner();
  const before = await prisma.vehicle.findUnique({ where: { srNo }, include: { bookings: true } });
  if (!before) return { error: "Not found" };
  if (before.bookings.length > 0) return { error: "Vehicle has bookings — retire it instead" };
  await prisma.vehicle.delete({ where: { srNo } });
  await logAudit({ tableName: "Vehicle", rowId: String(srNo), action: "delete", actorId: session.id, before });
  revalidatePath("/vehicles");
  return { ok: true };
}

// --- Maintenance ---

const optDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .optional()
  .or(z.literal(""));

const serviceSchema = z.object({
  description: z.string().trim().min(1).max(300),
  servicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  odometer: optInt,
  cost: z.coerce.number().int().nonnegative().default(0),
  nextDueOdometer: optInt,
  nextDueDate: optDate,
  markMaintenance: z.string().optional(),
});

// Date-only input parsed as an IST date (noon, so day boundaries are stable).
function istNoon(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+05:30`);
}

export async function addServiceRecord(srNo: number, formData: FormData) {
  const session = await requireSession();
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;

  const vehicle = await prisma.vehicle.findUnique({ where: { srNo } });
  if (!vehicle) return { error: "Vehicle not found" };
  if (d.nextDueOdometer != null && d.odometer != null && d.nextDueOdometer <= d.odometer) {
    return { error: "Next service odometer must be after the current reading" };
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      const r = await tx.serviceRecord.create({
        data: {
          vehicleId: srNo,
          description: d.description,
          servicedAt: istNoon(d.servicedAt),
          odometer: d.odometer,
          cost: d.cost,
          nextDueOdometer: d.nextDueOdometer,
          nextDueDate: d.nextDueDate ? istNoon(d.nextDueDate) : null,
          createdById: session.id,
        },
      });
      // Roll the vehicle's odometer forward if this reading is newer.
      if (d.odometer != null && d.odometer > vehicle.odometer) {
        await tx.vehicle.update({ where: { srNo }, data: { odometer: d.odometer } });
      }
      if (d.markMaintenance === "on" && vehicle.status === "available") {
        await tx.vehicle.update({ where: { srNo }, data: { status: "maintenance" } });
      }
      return r;
    });
    await logAudit({
      tableName: "ServiceRecord", rowId: record.id, action: "insert", actorId: session.id,
      after: { vehicleId: srNo, description: d.description, cost: d.cost, servicedAt: d.servicedAt },
    });
    await notify({
      type: "service_recorded",
      title: `Service: ${vehicle.model} (${vehicle.plate})`,
      body: `${d.description}${d.cost > 0 ? ` · ${inr(d.cost)}` : ""} · ${fmtDateShort(istNoon(d.servicedAt))}`,
      link: `/vehicles/${srNo}`,
      exceptUserId: session.id,
    });
  } catch (e: unknown) {
    return { error: (e as { message?: string }).message || "Failed to record service" };
  }
  revalidatePath(`/vehicles/${srNo}`);
  revalidatePath("/vehicles");
  return { ok: true };
}
