"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireOwner } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const optInt = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : v),
  z.coerce.number().int().nonnegative().nullable(),
);

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().max(60).optional().or(z.literal("")),
  stock: z.coerce.number().int().nonnegative().default(0),
  unitPrice: optInt,
  lowStockThreshold: z.coerce.number().int().nonnegative().default(2),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().max(60).optional().or(z.literal("")),
  unitPrice: optInt,
  lowStockThreshold: z.coerce.number().int().nonnegative().default(2),
});

const adjustSchema = z.object({
  kind: z.enum(["restock", "issue", "return", "adjust", "damaged"]),
  quantity: z.coerce.number().int().refine((q) => q !== 0, "Quantity cannot be zero"),
  bookingRef: z.string().max(20).optional().or(z.literal("")),
  note: z.string().max(200).optional().or(z.literal("")),
});

// Signed delta per kind. "adjust" is entered signed by the user.
const SIGN: Record<string, 1 | -1 | 0> = {
  restock: 1,
  return: 1,
  issue: -1,
  damaged: -1,
  adjust: 0,
};

export async function createAccessory(formData: FormData) {
  const session = await requireSession();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;

  const dupe = await prisma.accessory.findUnique({ where: { name: d.name } });
  if (dupe) return { error: `'${d.name}' already exists` };

  try {
    const a = await prisma.$transaction(async (tx) => {
      const created = await tx.accessory.create({
        data: {
          name: d.name,
          category: d.category ? d.category.trim() : null,
          stock: d.stock,
          unitPrice: d.unitPrice,
          lowStockThreshold: d.lowStockThreshold,
        },
      });
      if (d.stock > 0) {
        await tx.accessoryLog.create({
          data: {
            accessoryId: created.id,
            quantity: d.stock,
            kind: "restock",
            note: "Initial stock",
            createdById: session.id,
          },
        });
      }
      return created;
    });
    await logAudit({ tableName: "Accessory", rowId: a.id, action: "insert", actorId: session.id, after: { name: a.name, stock: a.stock } });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create accessory" };
  }
  revalidatePath("/accessories");
  return { ok: true };
}

export async function updateAccessory(id: string, formData: FormData) {
  const session = await requireSession();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;

  const before = await prisma.accessory.findUnique({ where: { id } });
  if (!before) return { error: "Accessory not found" };

  if (d.name !== before.name) {
    const dupe = await prisma.accessory.findUnique({ where: { name: d.name } });
    if (dupe) return { error: `'${d.name}' already exists` };
  }

  const after = await prisma.accessory.update({
    where: { id },
    data: {
      name: d.name,
      category: d.category ? d.category.trim() : null,
      unitPrice: d.unitPrice,
      lowStockThreshold: d.lowStockThreshold,
    },
  });
  await logAudit({ tableName: "Accessory", rowId: id, action: "update", actorId: session.id, before, after });
  revalidatePath("/accessories");
  return { ok: true };
}

export async function adjustAccessoryStock(id: string, formData: FormData) {
  const session = await requireSession();
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;

  const a = await prisma.accessory.findUnique({ where: { id } });
  if (!a) return { error: "Accessory not found" };

  const delta = SIGN[d.kind] === 0 ? d.quantity : d.quantity * SIGN[d.kind];
  if (delta === 0) return { error: "Quantity cannot be zero" };
  if (a.stock + delta < 0) {
    return { error: `Only ${a.stock} in stock — can't remove ${Math.abs(delta)}` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.accessoryLog.create({
        data: {
          accessoryId: id,
          quantity: delta,
          kind: d.kind,
          bookingRef: d.bookingRef || null,
          note: d.note || null,
          createdById: session.id,
        },
      });
      await tx.accessory.update({ where: { id }, data: { stock: a.stock + delta } });
    });
    await logAudit({
      tableName: "Accessory", rowId: id, action: "update", actorId: session.id,
      before: { stock: a.stock }, after: { stock: a.stock + delta, kind: d.kind },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to adjust stock" };
  }
  revalidatePath("/accessories");
  return { ok: true };
}

export async function deleteAccessory(id: string) {
  const session = await requireOwner();
  const before = await prisma.accessory.findUnique({ where: { id } });
  if (!before) return { error: "Accessory not found" };
  await prisma.accessory.delete({ where: { id } }); // logs cascade
  await logAudit({ tableName: "Accessory", rowId: id, action: "delete", actorId: session.id, before });
  revalidatePath("/accessories");
  return { ok: true };
}
