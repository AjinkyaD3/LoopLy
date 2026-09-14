# 2026-09-14 — Manual subscription gating + admin panel

## What changed
- `prisma/schema.prisma`: added `UserRole` (`BUSINESS_OWNER`/`ADMIN`) and `SubscriptionStatus`
  (`INACTIVE`/`ACTIVE`) enums, `User.role` (default `BUSINESS_OWNER`), `User.activatedSubscriptions`
  back-relation, `Business.subscription` one-to-one, and a new `Subscription` model
  (`businessId` unique FK, `status`, `activatedAt`/`activatedById` audit fields, `notes`).
- `src/lib/auth.ts`: `SafeUser.role`, `role: true` added to `validateSession()`'s user select,
  new `requireAdmin()` guard (`requireBusinessOwner()` + role check → throws `FORBIDDEN`),
  `requireOwnerBusiness()` now also `include`s `subscription`.
- `src/lib/validations/index.ts`: new `SubscriptionUpdateSchema` (`status` enum + optional `notes`).
- `src/app/api/business/loyalty/route.ts` and `src/app/api/business/campaigns/route.ts`: `POST`
  handlers now throw `SUBSCRIPTION_REQUIRED` (mapped to 402) when
  `business.subscription?.status !== "ACTIVE"`, right after `requireOwnerBusiness()`. No other
  routes touched — business setup and all GET/read routes are ungated per spec.
- New admin-only routes: `src/app/api/admin/businesses/route.ts` (GET, list businesses + owner +
  subscription status, missing row reported as INACTIVE) and
  `src/app/api/admin/businesses/[businessId]/subscription/route.ts` (PUT, upserts the
  Subscription row; stamps `activatedAt`/`activatedById` only when transitioning to ACTIVE,
  leaves them untouched on deactivation to preserve the audit trail).
- New `src/app/admin/page.tsx` (server component, `getCurrentUser()` → redirect `/login` if
  unauthenticated, plain "Access denied" message if authenticated but not ADMIN) with a small
  client button, `src/components/SubscriptionToggleButton.tsx`, calling the PUT endpoint and
  `router.refresh()`.
- `scratch/make-admin.js`: one-off script, `node scratch/make-admin.js <email>` sets a user's
  role to ADMIN — the only way to create the first admin.
- `CLAUDE.md`: surgical edits — role note in the intro and "Two Separate User Flows" section,
  `Subscription` added to Data Model, `/admin` + `src/app/api/admin` added to Architecture Map.

## Why
Business owners need to be gated behind a paid subscription before they can create loyalty
programs or campaigns, but there is no payment gateway yet. This adds manual admin activation
now, with the schema (`Subscription.activatedById`/`activatedAt`/`notes`) shaped so automatic
(payment-gateway-driven) activation can be layered on later without a rework.

## Verification
- `npm run prisma:validate` — schema valid.
- `npx prisma generate` — client regenerated successfully.
- `npm run build` — zero errors/warnings.
- `npm run lint` — no ESLint warnings or errors.
- `npm test` — 8 passed, 1 pre-existing skip, 0 failures.
- Migration SQL applied directly to the real dev DB via
  `npx prisma db execute --file prisma/migrations/20260914120000_add_subscription_admin_role/migration.sql --schema prisma/schema.prisma`
  (see Follow-ups — `prisma migrate deploy`/`dev` cannot be used cleanly in this environment due
  to a pre-existing, unrelated migration-history/DB drift).

## Follow-ups
- **Pre-existing environment issue, not caused by this change**: `_prisma_migrations` bookkeeping
  on the real DB is not in sync with `prisma/migrations/` — `prisma migrate deploy` returns P3005
  (schema not empty, no migration history), and `prisma migrate dev`'s shadow-database validation
  fails on an earlier migration (`20260912051500_retire_loyalty_program_scratch_mode`, "column
  \"type\" does not exist") because the tracked migration files have already drifted from the real
  schema. Applying `prisma migrate dev`/`deploy` normally will require baselining the existing
  migration history first (`prisma migrate resolve --applied <name>` for each already-applied
  migration, verified one at a time against the real schema) — that's a separate cleanup task,
  deliberately not attempted blind as part of this change. The new migration's SQL is captured at
  `prisma/migrations/20260914120000_add_subscription_admin_role/migration.sql` and was applied
  directly to the real DB with `prisma db execute`, so the live schema and Prisma client are in
  sync with `prisma/schema.prisma` today.
- Payment-gateway integration (automatic activation) is intentionally not built — manual admin
  activation via `/admin` is the only path for now, as scoped.
- First admin: `node scratch/make-admin.js <email>` (requires `DATABASE_URL` to be reachable, same
  as other `scratch/` scripts).
