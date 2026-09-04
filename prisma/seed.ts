import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

// Minimal bootstrap for a real deployment: the owner account + a starter
// inventory. For a rich demo dataset use `npm run db:seed:demo` instead.
// Plates are fictional — real registrations don't belong in a public repo.
const INVENTORY = [
  { srNo: 1,  plate: "MH12AB1024", model: "Apache RTR",         category: "Commuter Bike", series: "Apache",         year: 2018, dailyRate: 600,  monthlyRate: 11000, deposit: 3000 },
  { srNo: 2,  plate: "MH14CD2087", model: "Activa 5G",          category: "Scooter",       series: "Activa",         year: 2018, dailyRate: 500,  monthlyRate: 9000,  deposit: 2000 },
  { srNo: 3,  plate: "MH12EF3140", model: "Activa 4G",          category: "Scooter",       series: "Activa",         year: 2016, dailyRate: 450,  monthlyRate: 8500,  deposit: 2000 },
  { srNo: 4,  plate: "MH12GH4219", model: "Activa 4G",          category: "Scooter",       series: "Activa",         year: 2016, dailyRate: 450,  monthlyRate: 8500,  deposit: 2000 },
  { srNo: 5,  plate: "MH14JK5308", model: "Duet",               category: "Scooter",       series: "Duet",           year: 2015, dailyRate: 400,  monthlyRate: 8000,  deposit: 2000 },
  { srNo: 7,  plate: "MH12LM6475", model: "Jupiter ZX",         category: "Scooter",       series: "Jupiter",        year: 2019, dailyRate: 550,  monthlyRate: 9500,  deposit: 2500 },
  { srNo: 8,  plate: "MH14NP7523", model: "Bullet",             category: "Cruiser 350",   series: "Bullet",         year: 2014, dailyRate: 1500, monthlyRate: 28000, deposit: 5000 },
  { srNo: 9,  plate: "MH12QR8691", model: "Bullet Hunter 350",  category: "Cruiser 350",   series: "Hunter 350",     year: 2023, dailyRate: 2000, monthlyRate: 35000, deposit: 5000 },
  { srNo: 10, plate: "MH14ST9746", model: "Bullet Hunter 350",  category: "Cruiser 350",   series: "Hunter 350",     year: 2023, dailyRate: 2000, monthlyRate: 35000, deposit: 5000 },
  { srNo: 11, plate: "MH12UV0853", model: "Discover 125",       category: "Commuter Bike", series: "Discover",       year: 2017, dailyRate: 500,  monthlyRate: 9000,  deposit: 2500 },
];

async function main() {
  const username = process.env.OWNER_USERNAME || "owner";
  const fullName = process.env.OWNER_NAME || "Shop Owner";
  let password = process.env.OWNER_PASSWORD || "";
  if (!password) {
    // Generate + print once: safe defaults shouldn't exist, and a strong one
    // nobody can type is worse than a printed one-time secret.
    password = randomBytes(12).toString("base64url");
    console.log("Generated owner password (shown once — store it now):");
    console.log(`  ${password}\n`);
  } else if (password.length < 8) {
    throw new Error("OWNER_PASSWORD must be at least 8 characters. Leave it empty to auto-generate a strong one.");
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (!existing) {
    await prisma.user.create({ data: { username, passwordHash: await bcrypt.hash(password, 10), fullName, role: "owner" } });
    console.log(`OK  created owner '${username}'`);
  } else {
    console.log(`-   owner '${username}' already exists`);
  }

  let added = 0;
  for (const v of INVENTORY) {
    const before = await prisma.vehicle.findUnique({ where: { plate: v.plate } });
    if (before) {
      // Backfill category/series on existing rows (idempotent).
      if (!before.category || !before.series) {
        await prisma.vehicle.update({ where: { srNo: before.srNo }, data: { category: v.category, series: v.series } });
      }
      continue;
    }
    await prisma.vehicle.create({ data: { ...v, status: "available" } });
    added++;
  }
  console.log(`OK  inventory: ${added} new vehicle(s) added`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
