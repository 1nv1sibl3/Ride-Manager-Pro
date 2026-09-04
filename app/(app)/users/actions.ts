"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

const roleEnum = z.enum(["owner", "staff", "manager"]);
const optStr = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(max).optional().or(z.literal("")));

const createSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_.-]+$/, "Use letters, numbers, _ . - only"),
  fullName: z.string().trim().min(1).max(120),
  email: optStr(160),
  phone: optStr(40),
  role: roleEnum,
  password: z.string().min(6).max(200),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(true),
});

const updateSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().trim().min(1).max(120),
  email: optStr(160),
  phone: optStr(40),
  role: roleEnum.optional(),
  active: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).optional(),
  password: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(6).max(200).optional()),
});

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: optStr(160),
  phone: optStr(40),
  password: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(6).max(200).optional()),
});

export async function createUser(formData: FormData) {
  const actor = await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;
  const dupe = await prisma.user.findUnique({ where: { username: d.username } });
  if (dupe) return { error: `Username '${d.username}' is taken` };
  try {
    const u = await prisma.user.create({
      data: {
        username: d.username,
        fullName: d.fullName,
        email: d.email || null,
        phone: d.phone || null,
        role: d.role,
        active: d.active,
        passwordHash: await bcrypt.hash(d.password, 10),
      },
    });
    await logAudit({
      tableName: "User", rowId: u.id, action: "insert", actorId: actor.id,
      after: { username: u.username, fullName: u.fullName, role: u.role, active: u.active, email: u.email, phone: u.phone },
    });
    await notify({
      type: "user_created",
      title: `User added: ${u.fullName} (@${u.username})`,
      body: `Role: ${u.role}`,
      roles: ["owner", "manager"],
      exceptUserId: actor.id,
    });
    revalidatePath("/users");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create user" };
  }
}

export async function updateUser(formData: FormData) {
  const actor = await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;
  const target = await prisma.user.findUnique({ where: { id: d.id } });
  if (!target) return { error: "User not found" };

  // Don't allow demoting/disabling self via this admin path.
  if (target.id === actor.id) {
    if (d.role && d.role !== actor.role) return { error: "Cannot change your own role here" };
    if (d.active === false) return { error: "Cannot deactivate yourself" };
  }

  // Owners can be changed only by an owner.
  if (target.role === "owner" && actor.role !== "owner") {
    return { error: "Only an owner can modify an owner account" };
  }
  if (d.role === "owner" && actor.role !== "owner") {
    return { error: "Only an owner can promote to owner" };
  }

  const before = { fullName: target.fullName, email: target.email, phone: target.phone, role: target.role, active: target.active };
  try {
    const u = await prisma.user.update({
      where: { id: d.id },
      data: {
        fullName: d.fullName,
        email: d.email ? d.email : null,
        phone: d.phone ? d.phone : null,
        ...(d.role ? { role: d.role } : {}),
        ...(typeof d.active === "boolean" ? { active: d.active } : {}),
        ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
      },
    });
    if (d.password || (typeof d.active === "boolean" && d.active === false)) {
      // Revoke existing sessions on password change or deactivation.
      await prisma.session.deleteMany({ where: { userId: u.id } }).catch(() => {});
    }
    await logAudit({
      tableName: "User", rowId: u.id, action: "update", actorId: actor.id,
      before, after: { fullName: u.fullName, email: u.email, phone: u.phone, role: u.role, active: u.active, passwordChanged: !!d.password },
    });
    await notify({
      type: "user_updated",
      title: `User updated: ${u.fullName} (@${u.username})`,
      body: before.role !== u.role || before.active !== u.active
        ? [before.role !== u.role && `role ${before.role} → ${u.role}`, before.active !== u.active && (u.active ? "reactivated" : "deactivated")].filter(Boolean).join(" · ")
        : undefined,
      roles: ["owner", "manager"],
      exceptUserId: actor.id,
    });
    revalidatePath("/users");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update user" };
  }
}

export async function updateOwnProfile(formData: FormData) {
  const actor = await requireSession();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;
  const before = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!before) return { error: "User not found" };
  try {
    const u = await prisma.user.update({
      where: { id: actor.id },
      data: {
        fullName: d.fullName,
        email: d.email ? d.email : null,
        phone: d.phone ? d.phone : null,
        ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
      },
    });
    await logAudit({
      tableName: "User", rowId: u.id, action: "update", actorId: actor.id,
      before: { fullName: before.fullName, email: before.email, phone: before.phone },
      after: { fullName: u.fullName, email: u.email, phone: u.phone, passwordChanged: !!d.password },
    });
    revalidatePath("/users");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update profile" };
  }
}
