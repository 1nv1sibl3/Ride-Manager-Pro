<div align="center">

<img src="assets/logo.png" width="110" alt="ProBikes logo" />

# Ride Manager Pro

**Two-wheeler rental shop operations — bookings, payments, fleet, reminders and audit.**

Built for a real motorbike/scooter rental shop: walk-in and online-app bookings,
a payment ledger with deposits and settlement math, conflict-aware scheduling,
maintenance tracking and an immutable audit trail. Built as per required features with no further development scope as of now.

![Next.js](https://img.shields.io/badge/Next.js%2016-App%20Router-black)
![React 19](https://img.shields.io/badge/React%2019-gray)
![Prisma](https://img.shields.io/badge/Prisma%205-PostgreSQL-blue)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind%20CSS%204-5.0-blueviolet)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![License](https://img.shields.io/badge/license-MIT-green)

<!-- Uncomment after pushing to GitHub:
![CI](https://github.com/<your-username>/probikes-admin/actions/workflows/ci.yml/badge.svg)
-->

</div>

---

## Features

**Bookings & operations**
- Full rental lifecycle: `booked → handed over → returned → closed`, plus owner-only cancel
- Conflict-aware scheduling — overlapping bookings on one vehicle are allowed but flagged everywhere with a `Conflict ×N` pill, so nothing is silently double-booked
- Amendments (vehicle swap / date change / rate change) recorded as an immutable history; the booking's quote always reflects the latest state, revenue is never double-counted
- Daily activity board: returning today, on rent, pending drops
- Customer document checklist (Aadhaar / DL / …), OTP capture for online-app bookings

**Money**
- Payment ledger per booking: advance / balance / deposit / refund / extra / amendment, with mode + reference
- Settlement math on every booking: deposit held vs refunded, rent shortfall, excess advance, suggested refund
- Daily cash reconciliation and all-time utilisation reports (by vehicle / series / category) with CSV exports

**Fleet & inventory**
- Per-vehicle pricing (daily rate, monthly rate, deposit), status, odometer, notes
- Service records per vehicle with next-due date/odometer — feeds service reminders
- Accessories inventory (helmets, locks, …) with stock adjustments and low-stock alerts

**People & accountability**
- Roles: **owner** (everything incl. audit log + financial overrides), **manager** (user management), **staff** (day-to-day operations)
- In-app notifications with read/unread state, fanned out per user
- Reminders — manual and system-generated (overdue rentals, returns due, service due, low stock)
- Immutable audit log with actor + before/after JSON diffs on every mutation

**Platform**
- Custom auth: bcrypt password hashing + opaque, DB-backed sessions (tokens stored as SHA-256 hashes — a database leak can't be replayed)
- Server Actions with zod validation on every mutation; role checks re-verified server-side
- Login rate limiting, same-origin checks, security headers
- Dark mode, mobile-responsive, toasts, loading/error states, sortable + paginated tables
- Revenue chart, fleet breakdown, KPI deltas on the dashboard
- Optional transactional email (booking confirmations, payment receipts, daily digest) via Resend
- 45 unit tests over the pure domain logic (pricing, conflicts, settlement, IST parsing, pagination)

## Screenshots

| Dashboard | Booking detail |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Booking](docs/screenshots/booking-detail.png) |

| Reminders | Audit log diff |
|---|---|
| ![Reminders](docs/screenshots/reminders.png) | ![Audit](docs/screenshots/audit-diff.png) |

## Architecture

Next.js 16 App Router with React server components for reads and server actions for writes — no client-side data fetching layer, no API layer to keep in sync.

```
app/            routes — pages are server components (dynamic, auth-gated)
  (app)/        authenticated area: dashboard, bookings, vehicles, reminders,
                accessories, reports, users, audit, notifications
  api/          login/logout, CSV exports, reminder cron endpoint
components/     app shell + ui primitives (button, dialog, toast, table…) —
                hand-rolled on CSS design tokens, no component library
lib/            domain logic: pricing, conflicts, settlement, sessions,
                notifications, email, reminder scanner
prisma/         schema + bootstrap seed
scripts/        demo seed, icon generation, schema sync
```

**Design decisions worth knowing**

- **Opaque sessions over JWTs** — revocation is a row delete; cookies hold a raw token, the DB stores its hash
- **Conflicts computed on read, never stored** — the booking table stays a source of truth; overlap is a pure function (`lib/conflicts-core.ts`) reused by the list, detail, picker and amendment flows
- **Notifications fan out at event time** — one row per recipient, so read/unread is a trivial index lookup at shop scale
- **Reminders are idempotent** — system reminders carry a unique `systemKey`, so the scanner can run any number of times without duplicating
- **IST everywhere** — display, parsing and day bucketing are pinned to Asia/Kolkata; money is INR. This is intentional: it runs an Indian shop. Timezone-generalisation is on the roadmap

### Data model

```mermaid
erDiagram
    User ||--o{ Session : "logs in from"
    User ||--o{ Booking : creates
    User ||--o{ Payment : records
    User ||--o{ BookingAmendment : makes
    User ||--o{ AuditLog : "appears in"
    User ||--o{ Notification : receives
    User ||--o{ Reminder : sets
    User ||--o{ ServiceRecord : logs
    User ||--o{ AccessoryLog : adjusts
    Vehicle ||--o{ Booking : "is rented in"
    Vehicle ||--o{ BookingAmendment : "swapped from/to"
    Vehicle ||--o{ Reminder : references
    Vehicle ||--o{ ServiceRecord : "has"
    Booking ||--o{ Payment : "is settled by"
    Booking ||--o{ BookingAmendment : "is changed by"
    Booking ||--o{ Reminder : references
    Accessory ||--o{ AccessoryLog : "has"
```

## Quick start

Requires Node 20+ and a Postgres database. [Supabase](https://supabase.com) works out of the box (free tier) — or any local/managed Postgres.

### 1. Database

**Supabase (recommended, no local Postgres needed):**
create a project, then copy the **session pooler** connection string
(*Project Settings → Database → Connection string → Connection pooling → Session mode*):

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

**Local Postgres:**

```
createdb probikes
# → postgresql://postgres:postgres@localhost:5432/probikes
```

### 2. Configure

```bash
cp .env.example .env
# edit DATABASE_URL (and OWNER_* if you want a specific first-owner password)
```

### 3. Install, sync, seed

```bash
npm install          # also generates the Prisma client
npm run db:push      # create tables from the schema
npm run db:seed      # first owner account + starter inventory
```

### 4. Run

```bash
npm run dev          # http://localhost:3000
```

The owner password is printed by the seed when `OWNER_PASSWORD` is left empty. Staff and manager accounts are created in-app on the **Users** page.

Want a fully populated demo instead? See [demo data](#demo-data).

## Demo data

`npm run db:seed:demo` loads a deterministic, realistic 90-day dataset — ~140 bookings with complete lifecycles and payment ledgers, amendments, service records, reminders, notifications, low-stock accessories and one intentional booking conflict — so the dashboard charts, reports and audit views all have something to show.

```bash
npm run db:seed:demo             # fresh database only
npm run db:seed:demo -- --force  # wipe existing data first
```

Demo logins (override with `DEMO_OWNER_PASSWORD` / `DEMO_MANAGER_PASSWORD` / `DEMO_STAFF_PASSWORD`):

| Username | Password | Role |
|---|---|---|
| `owner` | `demo1234` | everything, incl. audit log + financial overrides |
| `manager` | `demo1234` | user management, no audit |
| `staff` | `demo1234` | day-to-day operations |

> These credentials exist for demo deployments. Change the passwords (or don't seed the demo at all) for anything real.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Any Postgres. Supabase session pooler recommended (see above). Pool/SSL params are added automatically if missing. |
| `OWNER_USERNAME` / `OWNER_NAME` / `OWNER_PASSWORD` | no | First owner account created by `npm run db:seed`. Empty password → a strong one is generated and printed once. Minimum 8 characters. |
| `RESEND_API_KEY` + `EMAIL_FROM` | no | Transactional email (booking confirmations, payment receipts, reminder digests). Both unset → email silently disabled; in-app notifications keep working. |
| `DEMO_EMAIL_TO` | no | Force all outbound email to one address — Resend's free tier only delivers to your own verified address. |
| `CRON_SECRET` | no | Bearer token protecting `GET /api/cron/reminders`. |
| `NEXT_PUBLIC_APP_URL` | no | Canonical URL used in email links + OG metadata. |
| `DEMO_OWNER_PASSWORD` / `DEMO_MANAGER_PASSWORD` / `DEMO_STAFF_PASSWORD` | no | Override the demo-seed passwords. |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (schema auto-synced first if `DATABASE_URL` is set) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | TypeScript strict typecheck |
| `npm test` | Vitest unit tests (pure domain logic) |
| `npm run db:push` | Apply `prisma/schema.prisma` to the database |
| `npm run db:seed` | Bootstrap: owner + starter inventory |
| `npm run db:seed:demo` | Rich 90-day demo dataset (see above) |
| `npm run db:studio` | Prisma Studio — browse/edit data |
| `npm run setup` | generate + push + seed in one go |
| `npm run icons` | Regenerate favicon/OG/social assets from `assets/logo.png` |

## Deployment

### Replit

The repo ships with `.replit` and `replit.nix`. Push it to a Repl, set `DATABASE_URL` (and any optional vars) as **Secrets**, then **Deploy → Autoscale**. The build runs `npm install && npm run build`; the schema syncs automatically before the build when `DATABASE_URL` is present.

### VPS (systemd + nginx)

```ini
# /etc/systemd/system/probikes-admin.service
[Unit]
Description=ProBikes Admin
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/probikes-admin
EnvironmentFile=/opt/probikes-admin/.env
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

Then `sudo systemctl enable --now probikes-admin` and reverse-proxy with nginx.

## Reminders & email

System reminders (overdue rentals, returns due today/tomorrow, service due, low stock) are generated by a scan that runs from two places:

1. **`GET /api/cron/reminders`** — the authoritative trigger, protected by `Authorization: Bearer $CRON_SECRET`. Point any scheduler at it, e.g. a GitHub Actions workflow on a free tier:

   ```yaml
   # .github/workflows/digest.yml (in a private repo or with the URL kept private)
   on:
     schedule:
       - cron: "30 3 * * *"   # 09:00 IST daily
   jobs:
     digest:
       runs-on: ubuntu-latest
       steps:
         - run: curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://your-app.example.com/api/cron/reminders
   ```

2. **A lazy in-app fallback** — the dashboard triggers the same scan at most once per ~20h, so a deployment without any cron still gets reminders and digest emails.

When the scan finds items, owners with an email address receive a digest, and everyone gets in-app notifications.

## Testing

```bash
npm test
```

Unit tests cover the pure domain logic: quote/pricing math (day and month rounding), booking-overlap rules (touching ≠ conflict), settlement computation (deposit held/partial/refunded, shortfalls, excess advance), IST datetime parsing, and the pagination/sort whitelist (which doubles as an injection guard). Tests intentionally import only pure modules — nothing that touches the database or network.

## Notes

- Dates are handled in **IST** and money in **INR** — this runs an Indian rental shop. `parseIstLocal`/`toIstInputValue` are the only sanctioned ways to move between `<input type="datetime-local">` values and `Date`s.
- Customer documents are **not uploaded** — the booking form records a checklist of what was received (the shop keeps the originals on WhatsApp).
- All mutations write to the audit log with actor + before/after JSON.

## License

[MIT](LICENSE)
