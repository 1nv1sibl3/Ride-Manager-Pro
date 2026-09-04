"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession, requireOwner } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { calcQuote, inr } from "@/lib/pricing";
import { parseIstLocal, fmtDateShort } from "@/lib/utils";
import { findConflicts } from "@/lib/conflicts";
import { notify } from "@/lib/notifications";
import { sendBookingConfirmation, sendPaymentReceipt } from "@/components/emails/send";
import { computeSettlement } from "@/lib/settlement";

const DOC_OPTIONS = ["aadhaar", "driving_license", "passport", "voter_id", "other_id", "selfie"] as const;

const newBookingSchema = z.object({
  source: z.enum(["offline", "online"]),
  externalRef: z.string().max(80).optional().or(z.literal("")),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(1).max(40),
  altPhone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().max(120).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  altAddress: z.string().max(500).optional().or(z.literal("")),
  docsNote: z.string().max(500).optional().or(z.literal("")),
  otpCode: z.string().max(20).optional().or(z.literal("")),
  vehicleId: z.coerce.number().int().positive(),
  plan: z.enum(["daily", "monthly"]),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  rateUsed: z.coerce.number().int().nonnegative(),
  depositAmount: z.coerce.number().int().nonnegative().default(0),
  conditionOutNote: z.string().max(500).optional().or(z.literal("")),
  advanceAmount: z.coerce.number().int().nonnegative().default(0),
  advanceMode: z.enum(["cash", "upi", "card", "bank", "other"]).default("cash"),
  handOverNow: z.string().optional(),
});

export async function createBooking(formData: FormData) {
  const session = await requireSession();
  const docs = formData.getAll("docsReceived").map(String).filter((d) => (DOC_OPTIONS as readonly string[]).includes(d));
  const parsed = newBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;
  const start = parseIstLocal(d.startAt);
  const end = parseIstLocal(d.endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return { error: "Invalid date range" };

  const vehicle = await prisma.vehicle.findUnique({ where: { srNo: d.vehicleId } });
  if (!vehicle) return { error: "Vehicle not found" };
  if (vehicle.status === "retired" || vehicle.status === "maintenance") return { error: "Vehicle not available" };

  // Overlaps are flagged, not blocked. Staff can save anyway after confirming.
  const conflicts = await findConflicts(d.vehicleId, start, end);
  const confirmed = String(formData.get("confirmConflicts") || "") === "1";
  if (conflicts.length > 0 && !confirmed) {
    return { conflicts };
  }

  const { total: quoted } = calcQuote(d.plan, start, end, d.rateUsed);
  const handOver = d.handOverNow === "on";

  let bookingId = "";
  let refNumber = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          source: d.source,
          externalRef: d.externalRef || null,
          status: handOver ? "handed_over" : "booked",
          handedOverAt: handOver ? new Date() : null,
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          altPhone: d.altPhone || null,
          email: d.email || null,
          address: d.address || null,
          altAddress: d.altAddress || null,
          docsReceived: docs,
          docsNote: d.docsNote || null,
          otpCode: d.source === "online" ? (d.otpCode || null) : null,
          vehicleId: d.vehicleId,
          plan: d.plan,
          startAt: start,
          endAt: end,
          rateUsed: d.rateUsed,
          quotedAmount: quoted,
          depositAmount: d.depositAmount || vehicle.deposit,
          conditionOutNote: d.conditionOutNote || null,
          createdById: session.id,
        },
      });
      bookingId = booking.id;
      refNumber = booking.refNumber;
      if (handOver) {
        await tx.vehicle.update({ where: { srNo: vehicle.srNo }, data: { status: "rented" } });
      }
      if (d.advanceAmount > 0) {
        await tx.payment.create({
          data: { bookingId: booking.id, kind: "advance", amount: d.advanceAmount, mode: d.advanceMode, recordedById: session.id },
        });
      }
      if (d.depositAmount > 0) {
        await tx.payment.create({
          data: { bookingId: booking.id, kind: "deposit", amount: d.depositAmount, mode: d.advanceMode, recordedById: session.id, note: "Security deposit" },
        });
      }
    });
  } catch (e: unknown) {
    return { error: (e as { message?: string }).message || "Failed to create booking" };
  }
  await logAudit({ tableName: "Booking", rowId: bookingId, action: "insert", actorId: session.id });

  await notify({
    type: "booking_created",
    title: `New booking #${refNumber} — ${d.customerName}`,
    body: `${vehicle.model} (${vehicle.plate}) · ${fmtDateShort(start)} → ${fmtDateShort(end)}`,
    link: `/bookings/${bookingId}`,
    exceptUserId: session.id,
  });
  if (conflicts.length > 0 && confirmed) {
    await notify({
      type: "conflict_detected",
      title: `Booking #${refNumber} saved with ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}`,
      body: `${vehicle.plate} overlaps another booking in the same window.`,
      link: `/bookings/${bookingId}`,
      exceptUserId: session.id,
    });
  }
  if (d.email) {
    // Best-effort; never blocks or fails the booking.
    await sendBookingConfirmation({
      to: d.email,
      refNumber,
      customerName: d.customerName,
      vehicleModel: vehicle.model,
      vehiclePlate: vehicle.plate,
      startAt: start,
      endAt: end,
      plan: d.plan,
      rateUsed: d.rateUsed,
      quotedAmount: quoted,
      depositAmount: d.depositAmount || vehicle.deposit,
    });
  }

  revalidatePath("/bookings");
  revalidatePath("/dashboard");
  redirect(`/bookings/${bookingId}`);
}

const paymentSchema = z.object({
  kind: z.enum(["advance", "balance", "deposit", "refund", "extra", "amendment"]),
  amount: z.coerce.number().int().positive(),
  mode: z.enum(["cash", "upi", "card", "bank", "other"]),
  reference: z.string().max(80).optional().or(z.literal("")),
  note: z.string().max(200).optional().or(z.literal("")),
});

export async function addPayment(bookingId: string, formData: FormData) {
  const session = await requireSession();
  const p = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.errors[0].message };
  const d = p.data;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true } });
  if (!booking) return { error: "Booking not found" };
  const pay = await prisma.payment.create({
    data: { bookingId, kind: d.kind, amount: d.amount, mode: d.mode, reference: d.reference || null, note: d.note || null, recordedById: session.id },
  });
  await logAudit({ tableName: "Payment", rowId: pay.id, action: "insert", actorId: session.id, after: pay });

  await notify({
    type: "payment_recorded",
    title: `${inr(d.amount)} ${d.kind.replace("_", " ")} on #${booking.refNumber}`,
    body: `${d.mode}${d.reference ? ` · ${d.reference}` : ""} · ${booking.customerName}`,
    link: `/bookings/${bookingId}`,
    exceptUserId: session.id,
  });
  if (booking.email) {
    const withPayment = await prisma.payment.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });
    const { balance } = computeSettlement(withPayment, booking.quotedAmount, booking.damageCharges);
    // Best-effort receipt; never blocks the payment.
    await sendPaymentReceipt({
      to: booking.email,
      refNumber: booking.refNumber,
      customerName: booking.customerName,
      kind: d.kind,
      amount: d.amount,
      mode: d.mode,
      reference: d.reference || null,
      note: d.note || null,
      recordedAt: pay.createdAt,
      balanceDue: balance,
    });
  }

  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function editPayment(paymentId: string, formData: FormData) {
  const session = await requireOwner();
  const p = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.errors[0].message };
  const d = p.data;
  const before = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!before) return { error: "Payment not found" };
  const after = await prisma.payment.update({
    where: { id: paymentId },
    data: { kind: d.kind, amount: d.amount, mode: d.mode, reference: d.reference || null, note: d.note || null },
  });
  await logAudit({ tableName: "Payment", rowId: paymentId, action: "update", actorId: session.id, before, after });
  await notify({
    type: "payment_edited",
    title: `Payment edited on #${before.bookingId.slice(0, 8)}…`,
    body: `${inr(before.amount)} ${before.kind} → ${inr(after.amount)} ${after.kind}`,
    roles: ["owner", "manager"],
    exceptUserId: session.id,
  });
  revalidatePath(`/bookings/${before.bookingId}`);
  return { ok: true };
}

export async function deletePayment(paymentId: string) {
  const session = await requireOwner();
  const before = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!before) return { error: "Payment not found" };
  await prisma.payment.delete({ where: { id: paymentId } });
  await logAudit({ tableName: "Payment", rowId: paymentId, action: "delete", actorId: session.id, before });
  await notify({
    type: "payment_deleted",
    title: `Payment deleted (${inr(before.amount)} ${before.kind})`,
    body: `From booking ${before.bookingId.slice(0, 8)}…`,
    roles: ["owner", "manager"],
    exceptUserId: session.id,
  });
  revalidatePath(`/bookings/${before.bookingId}`);
  return { ok: true };
}

const depositRefundSchema = z.object({
  amount: z.coerce.number().int().positive(),
  mode: z.enum(["cash", "upi", "card", "bank", "other"]),
  reference: z.string().max(80).optional().or(z.literal("")),
  note: z.string().max(200).optional().or(z.literal("")),
});

// Dedicated deposit refund — tagged so the UI can track how much of the deposit
// has been returned vs still held.
export async function refundDeposit(bookingId: string, formData: FormData) {
  const session = await requireSession();
  const p = depositRefundSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.errors[0].message };
  const d = p.data;
  const noteSuffix = d.note ? ` — ${d.note}` : "";
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { error: "Booking not found" };
  const pay = await prisma.payment.create({
    data: {
      bookingId,
      kind: "refund",
      amount: d.amount,
      mode: d.mode,
      reference: d.reference || null,
      note: `Deposit refund${noteSuffix}`,
      recordedById: session.id,
    },
  });
  await logAudit({ tableName: "Payment", rowId: pay.id, action: "insert", actorId: session.id, after: pay });
  await notify({
    type: "payment_recorded",
    title: `Deposit refund ${inr(d.amount)} on #${booking.refNumber}`,
    body: `${d.mode}${noteSuffix} · ${booking.customerName}`,
    link: `/bookings/${bookingId}`,
    exceptUserId: session.id,
  });
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

// --- Lifecycle transitions ---

const handOverSchema = z.object({
  handedOverAt: z.string().min(1),
  odometerOut: z.coerce.number().int().nonnegative().optional(),
  fuelOut: z.string().max(20).optional().or(z.literal("")),
  conditionOutNote: z.string().max(500).optional().or(z.literal("")),
});

export async function handOver(bookingId: string, formData: FormData) {
  const session = await requireSession();
  const parsed = handOverSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;
  const before = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!before) return { error: "Not found" };
  if (before.status !== "booked" && before.status !== "reserved") return { error: "Only booked rentals can be handed over" };

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "handed_over",
        handedOverAt: parseIstLocal(d.handedOverAt),
        odometerOut: d.odometerOut ?? null,
        fuelOut: d.fuelOut || null,
        conditionOutNote: d.conditionOutNote || before.conditionOutNote,
      },
    });
    await tx.vehicle.update({ where: { srNo: before.vehicleId }, data: { status: "rented" } });
  });
  await logAudit({ tableName: "Booking", rowId: bookingId, action: "update", actorId: session.id, before, after: { status: "handed_over" } });
  await notify({
    type: "booking_handed_over",
    title: `#${before.refNumber} handed over — ${before.customerName}`,
    link: `/bookings/${bookingId}`,
    exceptUserId: session.id,
  });
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

const returnSchema = z.object({
  actualReturnAt: z.string().min(1),
  odometerIn: z.coerce.number().int().nonnegative().optional(),
  fuelIn: z.string().max(20).optional().or(z.literal("")),
  conditionInNote: z.string().max(500).optional().or(z.literal("")),
  damageCharges: z.coerce.number().int().nonnegative().default(0),
});

export async function markReturned(bookingId: string, formData: FormData) {
  const session = await requireSession();
  const r = returnSchema.safeParse(Object.fromEntries(formData));
  if (!r.success) return { error: r.error.errors[0].message };
  const d = r.data;
  const before = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!before) return { error: "Not found" };
  if (before.status !== "handed_over" && before.status !== "active") return { error: "Only handed-over rentals can be returned" };

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "returned",
        actualReturnAt: parseIstLocal(d.actualReturnAt),
        odometerIn: d.odometerIn ?? null,
        fuelIn: d.fuelIn || null,
        conditionInNote: d.conditionInNote || null,
        damageCharges: d.damageCharges,
      },
    });
    const stillOut = await tx.booking.count({
      where: { vehicleId: before.vehicleId, status: { in: ["handed_over", "active"] }, id: { not: bookingId } },
    });
    if (stillOut === 0) {
      await tx.vehicle.update({ where: { srNo: before.vehicleId }, data: { status: "available" } });
    }
  });
  await logAudit({ tableName: "Booking", rowId: bookingId, action: "update", actorId: session.id, before, after: { status: "returned" } });
  await notify({
    type: "booking_returned",
    title: `#${before.refNumber} returned — ${before.customerName}`,
    body: d.damageCharges > 0 ? `Damage charges: ${inr(d.damageCharges)}` : undefined,
    link: `/bookings/${bookingId}`,
    exceptUserId: session.id,
  });
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function closeBooking(bookingId: string) {
  const session = await requireSession();
  const before = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!before) return { error: "Not found" };
  if (before.status !== "returned") return { error: "Only returned bookings can be closed" };
  await prisma.booking.update({ where: { id: bookingId }, data: { status: "closed", closedAt: new Date() } });
  await logAudit({ tableName: "Booking", rowId: bookingId, action: "update", actorId: session.id, before, after: { status: "closed" } });
  await notify({
    type: "booking_closed",
    title: `#${before.refNumber} closed — ${before.customerName}`,
    link: `/bookings/${bookingId}`,
    exceptUserId: session.id,
  });
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function cancelBooking(bookingId: string) {
  const session = await requireOwner();
  const before = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!before) return { error: "Not found" };
  if (before.status === "closed" || before.status === "returned") return { error: "Cannot cancel a returned/closed booking" };
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: bookingId }, data: { status: "cancelled" } });
    const stillOut = await tx.booking.count({
      where: { vehicleId: before.vehicleId, status: { in: ["handed_over", "active"] }, id: { not: bookingId } },
    });
    if (stillOut === 0) {
      await tx.vehicle.update({ where: { srNo: before.vehicleId }, data: { status: "available" } });
    }
  });
  await logAudit({ tableName: "Booking", rowId: bookingId, action: "update", actorId: session.id, before, after: { status: "cancelled" } });
  await notify({
    type: "booking_cancelled",
    title: `#${before.refNumber} cancelled — ${before.customerName}`,
    link: `/bookings/${bookingId}`,
    exceptUserId: session.id,
  });
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

// --- Amendment (vehicle swap / date change / rate change) ---

const amendSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  vehicleId: z.coerce.number().int().positive(),
  plan: z.enum(["daily", "monthly"]),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  rateUsed: z.coerce.number().int().nonnegative(),
  deltaCharged: z.coerce.number().int().default(0),
  deltaMode: z.enum(["cash", "upi", "card", "bank", "other"]).default("cash"),
});

export async function amendBooking(bookingId: string, formData: FormData) {
  const session = await requireSession();
  const parsed = amendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0].message };
  const d = parsed.data;
  const before = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!before) return { error: "Not found" };
  if (before.status === "closed" || before.status === "cancelled") return { error: "Cannot amend a closed/cancelled booking" };

  const newStart = parseIstLocal(d.startAt);
  const newEnd = parseIstLocal(d.endAt);
  if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newEnd <= newStart) return { error: "Invalid date range" };

  const newVehicle = await prisma.vehicle.findUnique({ where: { srNo: d.vehicleId } });
  if (!newVehicle) return { error: "Vehicle not found" };

  // Overlaps on the (possibly new) vehicle are flagged, not blocked.
  const conflicts = await findConflicts(d.vehicleId, newStart, newEnd, bookingId);
  const confirmed = String(formData.get("confirmConflicts") || "") === "1";
  if (conflicts.length > 0 && !confirmed) {
    return { conflicts };
  }

  const { total: newQuoted } = calcQuote(d.plan, newStart, newEnd, d.rateUsed);

  const vehicleSwap = before.vehicleId !== d.vehicleId;
  const dateChange = before.startAt.getTime() !== newStart.getTime() || before.endAt.getTime() !== newEnd.getTime();
  const rateChange = before.rateUsed !== d.rateUsed || before.plan !== d.plan;
  if (!vehicleSwap && !dateChange && !rateChange && d.deltaCharged === 0) {
    return { error: "Nothing changed" };
  }
  const kind = [vehicleSwap && "vehicle_swap", dateChange && "date_change", rateChange && "rate_change"].filter(Boolean).join("+") || "mixed";

  try {
    await prisma.$transaction(async (tx) => {
      // Free up old vehicle if it was rented and the booking was active
      const wasOut = before.status === "handed_over" || before.status === "active";

      await tx.bookingAmendment.create({
        data: {
          bookingId,
          reason: d.reason,
          kind,
          fromVehicleId: vehicleSwap ? before.vehicleId : null,
          toVehicleId:   vehicleSwap ? d.vehicleId : null,
          fromStartAt: dateChange ? before.startAt : null,
          toStartAt:   dateChange ? newStart : null,
          fromEndAt:   dateChange ? before.endAt : null,
          toEndAt:     dateChange ? newEnd : null,
          fromRateUsed: rateChange ? before.rateUsed : null,
          toRateUsed:   rateChange ? d.rateUsed : null,
          fromQuotedAmount: before.quotedAmount,
          toQuotedAmount: newQuoted,
          deltaCharged: d.deltaCharged,
          createdById: session.id,
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          vehicleId: d.vehicleId,
          plan: d.plan,
          startAt: newStart,
          endAt: newEnd,
          rateUsed: d.rateUsed,
          quotedAmount: newQuoted,
        },
      });

      if (vehicleSwap) {
        if (wasOut) {
          // free old vehicle if no other active rental on it
          const stillOut = await tx.booking.count({
            where: { vehicleId: before.vehicleId, status: { in: ["handed_over", "active"] }, id: { not: bookingId } },
          });
          if (stillOut === 0) {
            await tx.vehicle.update({ where: { srNo: before.vehicleId }, data: { status: "available" } });
          }
          await tx.vehicle.update({ where: { srNo: d.vehicleId }, data: { status: "rented" } });
        }
      }

      if (d.deltaCharged !== 0) {
        await tx.payment.create({
          data: {
            bookingId,
            kind: d.deltaCharged > 0 ? "amendment" : "refund",
            amount: Math.abs(d.deltaCharged),
            mode: d.deltaMode,
            note: `Amendment: ${d.reason}`,
            recordedById: session.id,
          },
        });
      }
    });
  } catch (e: unknown) {
    return { error: (e as { message?: string }).message || "Failed to amend" };
  }
  await logAudit({ tableName: "Booking", rowId: bookingId, action: "update", actorId: session.id, before, after: { amended: kind } });
  await notify({
    type: "booking_amended",
    title: `#${before.refNumber} amended — ${before.customerName}`,
    body: `${kind.replace(/_/g, " ")} · ${d.reason}`,
    link: `/bookings/${bookingId}`,
    exceptUserId: session.id,
  });
  if (conflicts.length > 0 && confirmed) {
    await notify({
      type: "conflict_detected",
      title: `Amendment on #${before.refNumber} saved with ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}`,
      link: `/bookings/${bookingId}`,
      exceptUserId: session.id,
    });
  }
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}
