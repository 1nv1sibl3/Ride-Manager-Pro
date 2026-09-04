# Contributing

Thanks for taking an interest! This is a small, focused app, so the bar for
changes is "keep it consistent with what's here" rather than a long rulebook.

## Getting set up

```bash
git clone <your-fork>
cd probikes-admin
npm install
cp .env.example .env       # point DATABASE_URL at a Postgres or Supabase DB
npm run db:push
npm run db:seed            # or: npm run db:seed:demo for a full demo dataset
npm run dev
```

Before opening a PR:

```bash
npm run lint    # strict TypeScript typecheck — must pass
npm test        # unit tests over the pure domain logic — must pass
npm run build   # full production build (works without a DATABASE_URL)
```

## Conventions

**Data flow.** Reads happen in React server components (pages query Prisma
directly). Writes happen in server actions (`app/(app)/**/actions.ts`),
validated with zod, guarded by `requireSession` / `requireOwner` /
`requireAdmin`, and recorded via `logAudit`. There is deliberately no REST
layer for the app's own UI.

**Styling.** Tailwind CSS 4 with design tokens defined in `app/globals.css`
(`--c-*` custom properties, exposed as utilities via `@theme inline` — e.g.
`bg-surface`, `text-muted`, `border-border`). Use the tokens; don't hardcode
hex colors or raw zinc/amber classes. Reusable behavior lives in
`components/ui/` (Button, Dialog, ConfirmDialog, Toast, Table, …) — prefer
those over hand-rolled versions.

**Dates and money.** All display and input parsing is IST
(`parseIstLocal` / `toIstInputValue` from `lib/utils.ts`), all money is INR
(`inr` from `lib/pricing.ts`). When bucketing by day, use an Asia/Kolkata day
key, never server-local time.

**Database.** The schema lives in `prisma/schema.prisma`; it is applied with
`prisma db push` (automatically before `dev`/`build` when `DATABASE_URL` is
set — see `scripts/db-sync.mjs`). After a schema change, run `npm run dev`
once (or `npm run db:push`) and regenerate the client if the IDE hasn't.

**Notifications.** Fire-and-forget from actions via `notify()` from
`lib/notifications.ts` — it must never be able to fail the mutation that
triggered it.

**Testing.** Unit tests cover pure modules only (`lib/*.test.ts`) — nothing
that imports the database or network. If you add domain logic, keep it pure
and test it; see `lib/settlement.ts` for the pattern (logic extracted from a
component so it's testable).

**Email.** All email is best-effort through `lib/email.ts` — never throws,
silently disabled without `RESEND_API_KEY`.

## Adding a feature checklist

1. Schema change in `prisma/schema.prisma` (+ `npm run db:push`)
2. Server action: zod schema, role guard, `logAudit`, `revalidatePath`
3. Notifications where it makes sense
4. UI with the existing primitives; toasts on success/failure; confirm
   dialogs on destructive actions
5. Empty states and loading states (route-level `loading.tsx` covers pages)
6. Typecheck + tests + build green

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, and the
browser/server logs. Include the booking ref if it's booking-specific.
