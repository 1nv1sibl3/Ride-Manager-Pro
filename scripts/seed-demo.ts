// Seeds a realistic 90-day demo dataset: staff accounts, a 15-vehicle fleet,
// ~140 bookings with full lifecycles and payment ledgers, amendments, service
// records, reminders, notifications and accessory inventory — enough history
// for the dashboard charts, reports and audit views to look alive.
//
//   npm run db:seed:demo             # aborts if any users exist
//   npm run db:seed:demo -- --force  # wipes existing data first
//
// Demo logins (override with DEMO_OWNER_PASSWORD / DEMO_MANAGER_PASSWORD /
// DEMO_STAFF_PASSWORD):
//   owner   / demo1234   (sees everything incl. audit + financials)
//   manager / demo1234   (user management, no audit)
//   staff   / demo1234   (day-to-day operations)
//
// Deterministic: seeded PRNG, so every run produces the same dataset.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calcQuote } from "../lib/pricing";

const prisma = new PrismaClient();

/* ── Deterministic PRNG ─────────────────────────────────────────── */

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const chance = (p: number) => rand() < p;

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/* ── Source data ─────────────────────────────────────────────────── */

const CUSTOMER_NAMES = [
  "Rahul Sharma", "Priya Patil", "Amit Deshmukh", "Sneha Kulkarni", "Vikram Jadhav",
  "Ananya Iyer", "Karan Mehta", "Pooja Nair", "Rohit Kadam", "Divya Menon",
  "Sachin Pawar", "Meera Joshi", "Arjun Reddy", "Kavya Rao", "Nikhil Gupta",
  "Shreya Bose", "Manoj Verma", "Tanvi Shah", "Prateek Sinha", "Neha Kapoor",
  "Sameer Khan", "Ritu Chauhan", "Aditya Malhotra", "Swati Dixit", "Gaurav Naik",
  "Lakshmi Pillai", "Mihir Bhatt", "Farah Ali", "Yash Thakur", "Isha Deshpande",
] as const;

const VEHICLES = [
  { srNo: 1,  plate: "MH12AB1024", model: "Apache RTR 160",     category: "Commuter Bike", series: "Apache",     year: 2018, dailyRate: 600,  monthlyRate: 11000, deposit: 3000 },
  { srNo: 2,  plate: "MH14CD2087", model: "Activa 5G",          category: "Scooter",       series: "Activa",     year: 2018, dailyRate: 500,  monthlyRate: 9000,  deposit: 2000 },
  { srNo: 3,  plate: "MH12EF3140", model: "Activa 4G",          category: "Scooter",       series: "Activa",     year: 2016, dailyRate: 450,  monthlyRate: 8500,  deposit: 2000 },
  { srNo: 4,  plate: "MH12GH4219", model: "Activa 4G",          category: "Scooter",       series: "Activa",     year: 2016, dailyRate: 450,  monthlyRate: 8500,  deposit: 2000 },
  { srNo: 5,  plate: "MH14JK5308", model: "Duet",               category: "Scooter",       series: "Duet",       year: 2015, dailyRate: 400,  monthlyRate: 8000,  deposit: 2000 },
  { srNo: 6,  plate: "MH12LM6475", model: "Jupiter ZX",         category: "Scooter",       series: "Jupiter",    year: 2019, dailyRate: 550,  monthlyRate: 9500,  deposit: 2500 },
  { srNo: 7,  plate: "MH14NP7523", model: "Bullet 350",         category: "Cruiser 350",   series: "Bullet",     year: 2014, dailyRate: 1500, monthlyRate: 28000, deposit: 5000 },
  { srNo: 8,  plate: "MH12QR8691", model: "Hunter 350",         category: "Cruiser 350",   series: "Hunter 350", year: 2023, dailyRate: 2000, monthlyRate: 35000, deposit: 5000 },
  { srNo: 9,  plate: "MH14ST9746", model: "Hunter 350",         category: "Cruiser 350",   series: "Hunter 350", year: 2023, dailyRate: 2000, monthlyRate: 35000, deposit: 5000 },
  { srNo: 10, plate: "MH12UV0853", model: "Discover 125",       category: "Commuter Bike", series: "Discover",   year: 2017, dailyRate: 500,  monthlyRate: 9000,  deposit: 2500 },
  { srNo: 11, plate: "MH14WX1987", model: "Pulsar 150",         category: "Commuter Bike", series: "Pulsar",     year: 2019, dailyRate: 700,  monthlyRate: 12500, deposit: 3000 },
  { srNo: 12, plate: "MH12YZ2406", model: "Splendor Plus",      category: "Commuter Bike", series: "Splendor",   year: 2017, dailyRate: 450,  monthlyRate: 8000,  deposit: 2000 },
  { srNo: 13, plate: "MH14AB3125", model: "TVS Ntorq 125",      category: "Scooter",       series: "Ntorq",      year: 2021, dailyRate: 650,  monthlyRate: 11000, deposit: 2500 },
  { srNo: 14, plate: "MH12CD4871", model: "Avenger 220",        category: "Cruiser 350",   series: "Avenger",    year: 2016, dailyRate: 1200, monthlyRate: 22000, deposit: 4000 },
  { srNo: 15, plate: "MH14EF5528", model: "Royal Enfield Classic 350", category: "Cruiser 350", series: "Classic 350", year: 2020, dailyRate: 1800, monthlyRate: 32000, deposit: 5000 },
] as const;

const DOC_SETS = [
  ["aadhaar", "driving_license"],
  ["driving_license"],
  ["aadhaar", "driving_license", "selfie"],
  ["aadhaar"],
] as const;

const MODES = ["cash", "upi", "upi", "cash", "upi", "card"] as const;
const FUELS = ["F", "3/4", "1/2", "1/2", "1/4"] as const;

const SERVICES = [
  { description: "Oil change + filter", cost: 650 },
  { description: "Front brake pads", cost: 480 },
  { description: "General service", cost: 1200 },
  { description: "Rear tyre replacement", cost: 2100 },
  { description: "Chain sprocket set", cost: 1800 },
  { description: "Battery replacement", cost: 1600 },
  { description: "Clutch plate replacement", cost: 1400 },
] as const;

/* ── Main ────────────────────────────────────────────────────────── */

async function main() {
  const force = process.argv.includes("--force");
  const existing = await prisma.user.count();
  if (existing > 0 && !force) {
    console.error("Users already exist. This seed is for a fresh database.");
    console.error("To wipe and reseed, run: npm run db:seed:demo -- --force");
    process.exit(1);
  }

  if (force) {
    // Wipe in FK-safe order.
    await prisma.notification.deleteMany();
    await prisma.reminder.deleteMany();
    await prisma.serviceRecord.deleteMany();
    await prisma.accessoryLog.deleteMany();
    await prisma.accessory.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.bookingAmendment.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.session.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.appSetting.deleteMany();
    await prisma.user.deleteMany();
    console.log("OK  wiped existing data (--force)");
  }

  const now = Date.now();

  /* Users */
  const ownerPw = process.env.DEMO_OWNER_PASSWORD || "demo1234";
  const managerPw = process.env.DEMO_MANAGER_PASSWORD || "demo1234";
  const staffPw = process.env.DEMO_STAFF_PASSWORD || "demo1234";

  const [owner, manager, staff] = await Promise.all([
    prisma.user.create({ data: { username: "owner", fullName: "Asha Patil", email: "owner@probikes.example", phone: "+91 98200 11111", role: "owner", passwordHash: await bcrypt.hash(ownerPw, 10) } }),
    prisma.user.create({ data: { username: "manager", fullName: "Rahul Verma", email: "manager@probikes.example", phone: "+91 98200 22222", role: "manager", passwordHash: await bcrypt.hash(managerPw, 10) } }),
    prisma.user.create({ data: { username: "staff", fullName: "Sneha Kulkarni", email: "staff@probikes.example", phone: "+91 98200 33333", role: "staff", passwordHash: await bcrypt.hash(staffPw, 10) } }),
  ]);
  await prisma.user.create({ data: { username: "imran", fullName: "Imran Shaikh", email: "imran@probikes.example", role: "staff", active: false, passwordHash: await bcrypt.hash("unused-password-1", 10) } });
  const staffPool = [owner, manager, staff];
  console.log("OK  users: owner, manager, staff, imran (deactivated)");

  /* Vehicles — 13 rentable; #14 in maintenance, #15 retired */
  const vehicleOdo = new Map<number, number>();
  for (const v of VEHICLES) {
    await prisma.vehicle.create({
      data: { ...v, odometer: randInt(8000, 42000), status: v.srNo === 14 ? "maintenance" : v.srNo === 15 ? "retired" : "available" },
    });
    vehicleOdo.set(v.srNo, randInt(8000, 42000));
  }
  // Re-sync odometers (created above with a second random draw).
  for (const v of VEHICLES) {
    const odo = vehicleOdo.get(v.srNo)!;
    await prisma.vehicle.update({ where: { srNo: v.srNo }, data: { odometer: odo } });
  }
  const rentable = VEHICLES.filter((v) => v.srNo !== 14 && v.srNo !== 15);
  console.log(`OK  fleet: ${VEHICLES.length} vehicles (1 maintenance, 1 retired)`);

  /* Bookings */
  type BookingDraft = {
    id: string; refNumber: number; vehicleSr: number; customerName: string;
    status: string; startMs: number; endMs: number; createdAt: Date;
  };
  const drafts: BookingDraft[] = [];
  const auditRows: { tableName: string; rowId: string; action: "insert"; actorId: string; after: object; createdAt: Date }[] = [];
  let overdueLeft = 3;

  for (let d = 90; d >= 0; d--) {
    const perDay = chance(0.12) ? 0 : chance(0.6) ? 1 : 2;
    for (let k = 0; k < perDay; k++) {
      const createdMs = now - d * DAY + randInt(9, 18) * HOUR;

      const v = pick(rentable);
      const plan = chance(0.85) ? ("daily" as const) : ("monthly" as const);
      const rate = plan === "daily" ? v.dailyRate : v.monthlyRate;
      const startMs = createdMs + randInt(0, 4) * HOUR;
      const units = plan === "daily" ? randInt(1, 5) : randInt(1, 2);
      const endMs = plan === "daily" ? startMs + units * DAY : startMs + units * 30 * DAY;
      const { total } = calcQuote(plan, new Date(startMs), new Date(endMs), rate);

      const customerName = pick(CUSTOMER_NAMES);
      const phone = `98${randInt(10000000, 99999999)}`;
      const email = chance(0.35) ? `${customerName.split(" ")[0].toLowerCase()}${randInt(1, 99)}@example.com` : null;
      const creator = pick(staffPool);

      const endPassed = endMs < now;
      let status: string;
      let handedOverAt: Date | null = null;
      let actualReturnAt: Date | null = null;
      let closedAt: Date | null = null;
      let damageCharges = 0;

      if (endPassed) {
        const r = rand();
        if (r < 0.05 && overdueLeft > 0) {
          // Still out, past due — the demo needs a few of these.
          overdueLeft--;
          status = "handed_over";
          handedOverAt = new Date(startMs);
        } else if (r < 0.10) {
          status = "cancelled";
        } else if (r < 0.20) {
          status = "returned";
          handedOverAt = new Date(startMs);
          actualReturnAt = new Date(endMs - randInt(0, 4) * HOUR);
        } else {
          status = "closed";
          handedOverAt = new Date(startMs);
          actualReturnAt = new Date(endMs - randInt(0, 6) * HOUR);
          closedAt = new Date(actualReturnAt.getTime() + randInt(4, 48) * HOUR);
          if (closedAt.getTime() > now) closedAt = new Date(now - randInt(1, 3) * HOUR);
          if (chance(0.08)) damageCharges = pick([150, 250, 500, 800]);
        }
      } else if (startMs < now) {
        status = chance(0.85) ? "handed_over" : "booked";
        if (status === "handed_over") handedOverAt = new Date(startMs);
      } else {
        status = "booked";
      }

      const odoOut = vehicleOdo.get(v.srNo)!;
      const odoIn = odoOut + randInt(30, 90) * units;
      if (status === "handed_over" || status === "returned" || status === "closed") {
        vehicleOdo.set(v.srNo, odoIn);
      }

      const booking = await prisma.booking.create({
        data: {
          source: chance(0.8) ? "offline" : "online",
          status: status as never,
          customerName,
          customerPhone: phone,
          email,
          docsReceived: [...pick(DOC_SETS)],
          vehicleId: v.srNo,
          plan,
          startAt: new Date(startMs),
          endAt: new Date(endMs),
          handedOverAt,
          actualReturnAt,
          closedAt,
          rateUsed: rate,
          quotedAmount: total,
          depositAmount: v.deposit,
          odometerOut: handedOverAt ? odoOut : null,
          odometerIn: actualReturnAt ? odoIn : null,
          fuelOut: handedOverAt ? pick(FUELS) : null,
          fuelIn: actualReturnAt ? pick(FUELS) : null,
          damageCharges,
          createdById: creator.id,
          createdAt: new Date(createdMs),
        },
      });
      drafts.push({ id: booking.id, refNumber: booking.refNumber, vehicleSr: v.srNo, customerName, status, startMs, endMs, createdAt: new Date(createdMs) });
      auditRows.push({ tableName: "Booking", rowId: booking.id, action: "insert", actorId: creator.id, after: { refNumber: booking.refNumber, customerName, vehicle: v.plate, status }, createdAt: new Date(createdMs) });

      /* Payment ledger */
      const payments: { kind: string; amount: number; mode: string; note?: string; at: number; by: string }[] = [];
      payments.push({ kind: "deposit", amount: v.deposit, mode: pick(MODES), note: "Security deposit", at: createdMs + 0.5 * HOUR, by: creator.id });
      const advance = Math.round((total * (chance(0.5) ? 1 : pick([0.3, 0.5, 0.6]))) / 10) * 10;
      if (advance > 0) payments.push({ kind: "advance", amount: advance, mode: pick(MODES), at: createdMs + 0.6 * HOUR, by: creator.id });

      if (actualReturnAt) {
        const returnMs = actualReturnAt.getTime();
        const totalDue = total + damageCharges;
        const balance = Math.max(0, totalDue - advance);
        if (balance > 0) payments.push({ kind: "balance", amount: balance, mode: pick(MODES), at: returnMs + 0.5 * HOUR, by: pick(staffPool).id });
        const refund = Math.max(0, v.deposit - damageCharges);
        if (refund > 0) payments.push({ kind: "refund", amount: refund, mode: pick(MODES), note: "Deposit refund", at: returnMs + 1 * HOUR, by: pick(staffPool).id });
      }

      for (const p of payments) {
        const pay = await prisma.payment.create({
          data: {
            bookingId: booking.id, kind: p.kind as never, amount: p.amount, mode: p.mode as never,
            note: p.note ?? null, recordedById: p.by, createdAt: new Date(p.at),
          },
        });
        auditRows.push({ tableName: "Payment", rowId: pay.id, action: "insert", actorId: p.by, after: { kind: p.kind, amount: p.amount, booking: booking.refNumber }, createdAt: new Date(p.at) });
      }

      /* Occasional amendment (rate bump shortly after creation, before return) */
      if (chance(0.06) && (status === "closed" || status === "returned") && units >= 2) {
        const amendAt = startMs + 10 * HOUR;
        if (amendAt < actualReturnAt!.getTime()) {
          const newRate = rate + 50;
          const { total: newTotal } = calcQuote(plan, new Date(startMs), new Date(endMs), newRate);
          const delta = newTotal - total;
          const amendBy = pick(staffPool);
          await prisma.bookingAmendment.create({
            data: {
              bookingId: booking.id,
              reason: pick(["Rate adjusted at customer request", "Peak weekend pricing applied", "Corporate rate revision"]),
              kind: "rate_change",
              fromRateUsed: rate,
              toRateUsed: newRate,
              fromQuotedAmount: total,
              toQuotedAmount: newTotal,
              deltaCharged: delta,
              createdById: amendBy.id,
              createdAt: new Date(amendAt),
            },
          });
          await prisma.booking.update({ where: { id: booking.id }, data: { rateUsed: newRate, quotedAmount: newTotal } });
          if (delta > 0) {
            await prisma.payment.create({
              data: { bookingId: booking.id, kind: "amendment", amount: delta, mode: pick(MODES), note: "Amendment: rate change", recordedById: amendBy.id, createdAt: new Date(amendAt + HOUR) },
            });
          }
          auditRows.push({ tableName: "Booking", rowId: booking.id, action: "insert", actorId: amendBy.id, after: { amended: "rate_change", refNumber: booking.refNumber }, createdAt: new Date(amendAt) });
        }
      }
    }
  }
  console.log(`OK  bookings: ${drafts.length} with payment ledgers + amendments`);

  /* One intentional conflict pair (overlapping future bookings, same vehicle) */
  const conflictVehicle = rentable[1];
  const conflictBase = now + 2 * DAY;
  for (const offset of [0, 1]) {
    const startMs = conflictBase + offset * DAY;
    const conflict = await prisma.booking.create({
      data: {
        status: "booked",
        customerName: pick(CUSTOMER_NAMES),
        customerPhone: `98${randInt(10000000, 99999999)}`,
        docsReceived: ["aadhaar"],
        vehicleId: conflictVehicle.srNo,
        plan: "daily",
        startAt: new Date(startMs),
        endAt: new Date(startMs + 3 * DAY),
        rateUsed: conflictVehicle.dailyRate,
        quotedAmount: conflictVehicle.dailyRate * 3,
        depositAmount: conflictVehicle.deposit,
        createdById: staff.id,
        createdAt: new Date(now - offset * HOUR),
      },
    });
    auditRows.push({ tableName: "Booking", rowId: conflict.id, action: "insert", actorId: staff.id, after: { refNumber: conflict.refNumber, note: "overlaps the other booking" }, createdAt: new Date(now - offset * HOUR) });
  }
  console.log("OK  1 conflict pair (overlapping bookings on one vehicle)");

  /* Vehicle statuses: rented where an active rental exists */
  const activeVehicleIds = new Set(
    (await prisma.booking.findMany({ where: { status: { in: ["handed_over", "active"] } }, select: { vehicleId: true } })).map((b) => b.vehicleId),
  );
  for (const sr of activeVehicleIds) {
    await prisma.vehicle.update({ where: { srNo: sr }, data: { status: "rented", odometer: vehicleOdo.get(sr) } });
  }

  /* Service records */
  const serviceVehicles = rentable.slice(0, 8);
  for (let i = 0; i < serviceVehicles.length; i++) {
    const v = serviceVehicles[i];
    const servicedAtMs = now - randInt(20, 160) * DAY;
    const odo = Math.max(1000, vehicleOdo.get(v.srNo)! - randInt(500, 4000));
    const s = pick(SERVICES);
    // Two vehicles get a service due within the next two weeks, one by date
    // and one by odometer, so the reminder scanner has something to find.
    const nextDueDate = i === 0 ? new Date(now + 5 * DAY) : i === 1 ? new Date(now + 12 * DAY) : chance(0.4) ? new Date(now + randInt(30, 90) * DAY) : null;
    const nextDueOdometer = i === 2 ? vehicleOdo.get(v.srNo)! - 50 : chance(0.3) ? odo + randInt(4000, 8000) : null;
    await prisma.serviceRecord.create({
      data: {
        vehicleId: v.srNo,
        description: s.description,
        cost: s.cost,
        servicedAt: new Date(servicedAtMs),
        odometer: odo,
        nextDueDate,
        nextDueOdometer,
        createdById: pick(staffPool).id,
      },
    });
  }
  console.log(`OK  service records: ${serviceVehicles.length} (2 due soon, 1 past odometer)`);

  /* Reminders */
  const overdueDraft = drafts.find((d) => d.status === "handed_over" && d.endMs < now);
  const reminderRows: { title: string; dueAt: Date; doneAt: Date | null; systemKey: string | null; vehicleId: number | null; by: string }[] = [
    { title: "Call customer about pending DL submission", dueAt: new Date(now - 2 * DAY), doneAt: null, systemKey: null, vehicleId: null, by: staff.id },
    { title: "Insurance renewal — Activa 5G", dueAt: new Date(now + 3 * HOUR), doneAt: null, systemKey: null, vehicleId: 2, by: manager.id },
    { title: "PUC renewal due — Bullet 350", dueAt: new Date(now + 2 * DAY), doneAt: null, systemKey: null, vehicleId: 7, by: manager.id },
    { title: "Follow up with corporate client (Zomato riders)", dueAt: new Date(now + 5 * DAY), doneAt: null, systemKey: null, vehicleId: null, by: owner.id },
    { title: "Restock helmet cleaning spray", dueAt: new Date(now + 6 * DAY), doneAt: null, systemKey: null, vehicleId: null, by: staff.id },
    { title: "Pay shop electricity bill", dueAt: new Date(now - 5 * DAY), doneAt: new Date(now - 5 * DAY + 4 * HOUR), systemKey: null, vehicleId: null, by: owner.id },
    { title: "Submit GST returns", dueAt: new Date(now - 12 * DAY), doneAt: new Date(now - 11 * DAY), systemKey: null, vehicleId: null, by: owner.id },
  ];
  if (overdueDraft) {
    reminderRows.push({
      title: `Overdue: #${overdueDraft.refNumber} ${overdueDraft.customerName}`,
      dueAt: new Date(overdueDraft.endMs),
      doneAt: null,
      systemKey: `overdue:${overdueDraft.id}`,
      vehicleId: overdueDraft.vehicleSr,
      by: owner.id,
    });
  }
  for (const r of reminderRows) {
    await prisma.reminder.create({
      data: { title: r.title, dueAt: r.dueAt, doneAt: r.doneAt, systemKey: r.systemKey, vehicleId: r.vehicleId, createdById: r.by },
    });
  }
  console.log(`OK  reminders: ${reminderRows.length}`);

  /* Accessories */
  const accessories = [
    { name: "Helmet (M)", category: "Safety", stock: 6, unitPrice: 100, lowStockThreshold: 2 },
    { name: "Helmet (L)", category: "Safety", stock: 1, unitPrice: 100, lowStockThreshold: 2 },
    { name: "Helmet (XL)", category: "Safety", stock: 4, unitPrice: 120, lowStockThreshold: 2 },
    { name: "Bike lock (chain)", category: "Security", stock: 0, unitPrice: 150, lowStockThreshold: 2 },
    { name: "Phone mount", category: "Accessory", stock: 5, unitPrice: 80, lowStockThreshold: 1 },
    { name: "Rain poncho", category: "Safety", stock: 3, unitPrice: 60, lowStockThreshold: 2 },
  ];
  const recentDrafts = drafts.slice(-12);
  for (const a of accessories) {
    const created = await prisma.accessory.create({ data: a });
    await prisma.accessoryLog.create({
      data: { accessoryId: created.id, quantity: a.stock + 4, kind: "restock", note: "Initial stock", createdById: manager.id, createdAt: new Date(now - 80 * DAY) },
    });
    // A few issues/returns against recent bookings.
    const logs = randInt(1, 3);
    for (let i = 0; i < logs; i++) {
      const d = pick(recentDrafts);
      if (d) {
        await prisma.accessoryLog.create({
          data: {
            accessoryId: created.id, quantity: -1, kind: "issue",
            bookingRef: `#${d.refNumber}`, createdById: pick(staffPool).id,
            createdAt: new Date(now - randInt(1, 20) * DAY),
          },
        });
      }
    }
  }
  console.log(`OK  accessories: ${accessories.length} (2 below threshold)`);

  /* Notifications for the owner */
  const notifRows = [
    { type: "booking_created", title: `New booking #${drafts[drafts.length - 1]?.refNumber ?? 1} — ${drafts[drafts.length - 1]?.customerName ?? ""}`, body: "Created just now", at: now - 1 * HOUR },
    { type: "payment_recorded", title: "Payment ₹2,000 balance on a recent booking", body: "upi · recorded by staff", at: now - 3 * HOUR },
    { type: "conflict_detected", title: "2 bookings overlap on the same vehicle", body: "Check the bookings list for the conflict pill.", at: now - 5 * HOUR },
    { type: "reminder_due", title: "Insurance renewal — Activa 5G", body: "Due today.", at: now - 8 * HOUR },
    { type: "service_due", title: "Service due: Activa 5G (MH14CD2087)", body: "Due by next week.", at: now - 26 * HOUR },
    { type: "low_stock", title: "Low stock: Bike lock (chain)", body: "0 left (threshold 2).", at: now - 30 * HOUR },
    { type: "booking_returned", title: "A vehicle was returned late", body: "Damage charges may apply.", at: now - 2 * DAY },
  ];
  for (const n of notifRows) {
    await prisma.notification.create({
      data: { userId: owner.id, type: n.type, title: n.title, body: n.body, createdAt: new Date(n.at), readAt: n.at < now - DAY ? new Date(n.at + HOUR) : null },
    });
  }
  console.log(`OK  notifications: ${notifRows.length} for the owner`);

  /* Audit log */
  await prisma.auditLog.createMany({
    data: auditRows.map((r) => ({ tableName: r.tableName, rowId: r.rowId, action: "insert" as never, actorId: r.actorId, after: r.after as never, createdAt: r.createdAt })),
  });
  console.log(`OK  audit log: ${auditRows.length} entries`);

  /* Summary */
  console.log("\n──────────────────────────────────────────────");
  console.log("Demo data seeded. Log in with:");
  console.log(`  owner   / ${ownerPw}   (full access)`);
  console.log(`  manager / ${managerPw}   (user management, no audit)`);
  console.log(`  staff   / ${staffPw}   (operations)`);
  console.log("──────────────────────────────────────────────");
  console.log("Run `npm run dev` and open http://localhost:3000");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
