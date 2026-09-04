import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { sendDigest } from "@/components/emails/send";
import type { DigestSection } from "@/components/emails/reminder-digest";
import { fmtDateShort } from "@/lib/utils";

// Scans the shop's state and materialises system reminders + notifications,
// then emails a digest to owners. Idempotent: every system reminder carries a
// unique systemKey, so re-running the scan never duplicates anything.
//
// Triggered from:
//   - GET /api/cron/reminders (authoritative; wire any external cron to it)
//   - the dashboard, at most once per ~20h (lazy fallback so a demo with no
//     cron still gets digests)

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** YYYY-MM-DD of the given instant in IST. */
export function istDayKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of IST midnight for a YYYY-MM-DD key. */
export function istDayStart(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+05:30`);
}

export type ScanResult = {
  remindersCreated: number;
  notificationsCreated: number;
  emailsSent: number;
};

async function createSystemReminder(data: {
  systemKey: string;
  title: string;
  notes?: string;
  dueAt: Date;
  vehicleId?: number | null;
  bookingId?: string | null;
  createdById: string;
  notifyType: string;
  notifyBody?: string;
  notifyLink?: string;
}): Promise<boolean> {
  const existing = await prisma.reminder.findUnique({ where: { systemKey: data.systemKey } });
  if (existing) return false;

  await prisma.reminder.create({
    data: {
      systemKey: data.systemKey,
      title: data.title,
      notes: data.notes ?? null,
      dueAt: data.dueAt,
      vehicleId: data.vehicleId ?? null,
      bookingId: data.bookingId ?? null,
      createdById: data.createdById,
    },
  });
  await notify({
    type: data.notifyType,
    title: data.title,
    body: data.notifyBody,
    link: data.notifyLink,
  });
  return true;
}

async function ownerForSystem(): Promise<string> {
  // System reminders need a creator row; use the first active owner.
  const owner = await prisma.user.findFirst({ where: { role: "owner", active: true }, orderBy: { createdAt: "asc" } });
  if (owner) return owner.id;
  const anyUser = await prisma.user.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  return anyUser?.id ?? "";
}

export async function runReminderScan(): Promise<ScanResult> {
  const now = new Date();
  const todayKey = istDayKey(now);
  const todayStart = istDayStart(todayKey);
  const tomorrowKey = istDayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const tomorrowStart = istDayStart(tomorrowKey);
  const weekAhead = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000);

  const ownerId = await ownerForSystem();
  let created = 0;

  if (ownerId) {
    // 1. Overdue rentals (handed over, past their expected end).
    const overdue = await prisma.booking.findMany({
      where: { status: { in: ["handed_over", "active"] }, endAt: { lt: now } },
      include: { vehicle: true },
    });
    for (const b of overdue) {
      const ok = await createSystemReminder({
        systemKey: `overdue:${b.id}`,
        title: `Overdue: #${b.refNumber} ${b.customerName} (${b.vehicle.plate})`,
        notes: `Expected back ${fmtDateShort(b.endAt)} and still out.`,
        dueAt: b.endAt,
        bookingId: b.id,
        vehicleId: b.vehicleId,
        createdById: ownerId,
        notifyType: "reminder_due",
        notifyBody: `Expected back ${fmtDateShort(b.endAt)}.`,
        notifyLink: `/bookings/${b.id}`,
      });
      if (ok) created++;
    }

    // 2. Returns due today / tomorrow (heads-up the day before, again on the day).
    const returning = await prisma.booking.findMany({
      where: {
        status: { in: ["booked", "handed_over", "active"] },
        endAt: { gte: todayStart, lt: new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000) },
      },
      include: { vehicle: true },
    });
    for (const b of returning) {
      const key = istDayKey(b.endAt);
      const isToday = key === todayKey;
      const ok = await createSystemReminder({
        systemKey: `ends-${isToday ? "today" : "tomorrow"}:${b.id}`,
        title: `${isToday ? "Returning today" : "Returning tomorrow"}: #${b.refNumber} ${b.customerName} (${b.vehicle.plate})`,
        dueAt: isToday ? todayStart : tomorrowStart,
        bookingId: b.id,
        vehicleId: b.vehicleId,
        createdById: ownerId,
        notifyType: "reminder_due",
        notifyBody: `Expected back ${fmtDateShort(b.endAt)}.`,
        notifyLink: `/bookings/${b.id}`,
      });
      if (ok) created++;
    }

    // 3. Vehicle service due (latest service record per vehicle).
    const services = await prisma.serviceRecord.findMany({
      where: { OR: [{ nextDueDate: { not: null } }, { nextDueOdometer: { not: null } }] },
      include: { vehicle: true },
      orderBy: { servicedAt: "desc" },
    });
    const seenVehicles = new Set<number>();
    for (const s of services) {
      if (seenVehicles.has(s.vehicleId)) continue; // only the latest record per vehicle
      seenVehicles.add(s.vehicleId);

      if (s.nextDueDate && s.nextDueDate <= weekAhead) {
        const ok = await createSystemReminder({
          systemKey: `service:${s.id}`,
          title: `Service due: ${s.vehicle.model} (${s.vehicle.plate})`,
          notes: `Last serviced ${fmtDateShort(s.servicedAt)} — ${s.description}.`,
          dueAt: s.nextDueDate,
          vehicleId: s.vehicleId,
          createdById: ownerId,
          notifyType: "service_due",
          notifyBody: `Due by ${fmtDateShort(s.nextDueDate)}.`,
          notifyLink: `/vehicles/${s.vehicleId}`,
        });
        if (ok) created++;
      }
      if (s.nextDueOdometer != null && s.vehicle.odometer >= s.nextDueOdometer) {
        const ok = await createSystemReminder({
          systemKey: `service-odo:${s.id}`,
          title: `Service due (odometer): ${s.vehicle.model} (${s.vehicle.plate})`,
          notes: `Past ${s.nextDueOdometer} km — now at ${s.vehicle.odometer} km.`,
          dueAt: now,
          vehicleId: s.vehicleId,
          createdById: ownerId,
          notifyType: "service_due",
          notifyLink: `/vehicles/${s.vehicleId}`,
        });
        if (ok) created++;
      }
    }

    // 4. Low accessory stock.
    const lowStock = await prisma.accessory.findMany({
      where: { stock: { lte: prisma.accessory.fields.lowStockThreshold } },
    });
    for (const a of lowStock) {
      const ok = await createSystemReminder({
        systemKey: `lowstock:${a.id}`,
        title: `Low stock: ${a.name}`,
        notes: `${a.stock} left (threshold ${a.lowStockThreshold}).`,
        dueAt: now,
        createdById: ownerId,
        notifyType: "low_stock",
        notifyBody: `${a.stock} left (threshold ${a.lowStockThreshold}).`,
        notifyLink: "/accessories",
      });
      if (ok) created++;
    }
  }

  // Digest email to owners with an address.
  const sections = await buildDigestSections();
  let emailsSent = 0;
  const total = sections.reduce((s, sec) => s + sec.items.length, 0);
  if (total > 0) {
    const owners = await prisma.user.findMany({ where: { role: "owner", active: true, email: { not: null } } });
    for (const o of owners) {
      const r = await sendDigest({ to: o.email!, sections, generatedAt: now, total });
      if (r.ok) emailsSent++;
    }
  }

  return { remindersCreated: created, notificationsCreated: created, emailsSent };
}

async function buildDigestSections(): Promise<DigestSection[]> {
  const now = new Date();
  const todayStart = istDayStart(istDayKey(now));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [overdueRentals, returningToday, dueReminders] = await Promise.all([
    prisma.booking.findMany({
      where: { status: { in: ["handed_over", "active"] }, endAt: { lt: now } },
      include: { vehicle: true },
      orderBy: { endAt: "asc" },
      take: 20,
    }),
    prisma.booking.findMany({
      where: { status: { in: ["booked", "handed_over", "active"] }, endAt: { gte: now, lt: tomorrowStart } },
      include: { vehicle: true },
      orderBy: { endAt: "asc" },
      take: 20,
    }),
    prisma.reminder.findMany({
      where: { doneAt: null, dueAt: { lt: tomorrowStart } },
      orderBy: { dueAt: "asc" },
      take: 30,
    }),
  ]);

  return [
    {
      title: "Overdue rentals",
      items: overdueRentals.map((b) => ({
        title: `#${b.refNumber} ${b.customerName} (${b.vehicle.plate})`,
        detail: `expected back ${fmtDateShort(b.endAt)}`,
        href: `/bookings/${b.id}`,
      })),
    },
    {
      title: "Returning today",
      items: returningToday.map((b) => ({
        title: `#${b.refNumber} ${b.customerName} (${b.vehicle.plate})`,
        detail: `by ${fmtDateShort(b.endAt)}`,
        href: `/bookings/${b.id}`,
      })),
    },
    {
      title: "Reminders due",
      items: dueReminders.map((r) => ({
        title: r.title,
        detail: r.dueAt < todayStart ? `overdue since ${fmtDateShort(r.dueAt)}` : undefined,
        href: "/reminders",
      })),
    },
  ];
}

/**
 * Lazy fallback for deployments without an external cron: runs the scan at most
 * once every ~20h, triggered from the dashboard. Two concurrent dashboards
 * loading at once can both run it — the systemKey dedupe makes that harmless.
 */
export async function maybeRunDailyDigest(): Promise<void> {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "reminderDigest" } });
    const raw = (setting?.value as { lastRunAt?: unknown } | null)?.lastRunAt;
    const last = typeof raw === "string" ? new Date(raw) : null;
    if (last && !isNaN(last.getTime()) && Date.now() - last.getTime() < 20 * 60 * 60 * 1000) return;

    await runReminderScan();

    const nowIso = new Date().toISOString();
    await prisma.appSetting.upsert({
      where: { key: "reminderDigest" },
      update: { value: { lastRunAt: nowIso } },
      create: { key: "reminderDigest", value: { lastRunAt: nowIso } },
    });
  } catch (e) {
    console.error("[reminder-scan] daily digest failed:", e);
  }
}
