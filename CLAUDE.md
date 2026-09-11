# Looply — Project Guide for Claude

Looply is a **multi-tenant, mobile-first loyalty platform**. A business owner sets up a loyalty
program and gets a permanent QR code; customers scan it, enter their mobile number, and earn
visits toward a reward — **no customer account, no customer login, ever**. Business owners are
the only authenticated role in the system.

## Stack

- **Next.js 14** (App Router, `src/app`), React 18, TypeScript
- **Prisma 5** + PostgreSQL (Supabase-hosted in production)
- **Supabase Storage** for bill-image uploads, with automatic local-disk fallback (`public/uploads/bills/`)
- Tailwind CSS, `lucide-react` icons
- **Zod** for request validation (`src/lib/validations/index.ts`)
- **Vitest** for tests (`src/__tests__`)
- Session auth via **signed cookie + DB-backed `Session` table** (no NextAuth/JWT library)

## Two Separate User Flows — Do Not Blur Them

1. **Business owner** — full auth flow (`register` → `login` → cookie session in `looply_session`
   → `src/lib/auth.ts`). Owns exactly one `Business` (`Business.ownerId` is `@unique`). Manages
   the dashboard at `/business/*`.
2. **Customer** — **no account, no password, no session.** Identified only by
   `(businessId, mobileNumber)` via the `Customer` model, which has **no FK to `User`**. The
   entire customer journey lives at `/join/[businessToken]` (component: `JoinFlow.tsx`) and its
   API routes under `src/app/api/customer/*`.

Customer-login functionality was **deliberately and fully removed** in a past restructure (see
`looply-complete-login-removal-prompt.md` for the historical rationale — kept for context, not as
a live task list). **Do not reintroduce customer accounts, customer passwords, or a customer
`Session`/login screen.** If a task seems to call for it, stop and ask first.

## Architecture Map

```
src/
├── app/
│   ├── api/
│   │   ├── auth/                  # register, login, logout, me — BUSINESS OWNER ONLY
│   │   ├── business/              # setup, loyalty, analytics, requests, members, rewards, account
│   │   ├── customer/               # progress, visit, reward/claim-code, reward/instant-scratch, dashboard
│   │   └── public/business/[businessToken]/  # public read-only business info for the join page
│   ├── business/                  # business owner dashboard pages (auth-gated)
│   ├── join/[businessToken]/      # THE customer entry point (public, no auth)
│   ├── legal/{privacy,terms}/     # static legal pages, versioned via src/lib/constants.ts
│   ├── login/, register/          # business owner auth only
│   └── page.tsx                    # marketing/home
├── components/
│   ├── Business*.tsx               # owner dashboard panels (Analytics, Members, Requests, Rewards, Tabs)
│   ├── JoinFlow.tsx                 # the entire no-login customer UI/state machine
│   ├── ScratchCardComponent.tsx     # SCRATCH_CARD reward reveal animation
│   └── QRCodeDisplay.tsx            # renders the business's permanent join QR
├── lib/
│   ├── auth.ts                     # session create/validate/invalidate, requireBusinessOwner(), requireOwnerBusiness()
│   ├── prisma.ts                   # Prisma client singleton
│   ├── storage.ts                  # bill image upload: Supabase Storage → local fallback
│   ├── supabase.ts                 # Supabase client factory
│   ├── rate-limit.ts               # in-memory rate limiter (per-process, not distributed)
│   ├── token.ts                    # businessToken validation
│   └── validations/index.ts        # all Zod schemas
└── __tests__/                      # Vitest specs
prisma/schema.prisma                 # source of truth for the data model
```

## Data Model (prisma/schema.prisma)

- `User` — business owner only (email/password). Owns one `Business`.
- `Session` — DB-backed session tokens for `User`, 7-day expiry (`SESSION_MS` in `auth.ts`).
- `Business` — has a permanent unique `businessToken` used in `/join/{businessToken}`.
- `LoyaltyProgram` — one per business; `type` is `VISITS` or `SCRATCH_CARD`, drives which reward
  flow applies.
- `Customer` — keyed by `@@unique([businessId, mobileNumber])`; **no relation to `User`**.
- `Membership` — the `Customer`↔`Business` join; tracks `currentVisits` (resets at threshold) and
  `totalVisits` (lifetime).
- `VisitRequest` → `Visit` — a customer's evidence submission (`PENDING`/`APPROVED`/`REJECTED`);
  approval is an atomic Prisma transaction that creates an immutable `Visit`, increments
  membership counters, and — if the threshold is hit — creates a `Reward` and resets
  `currentVisits`. See `src/app/api/business/requests/[requestId]/route.ts` for the reference
  implementation of this transaction pattern.
- `Reward` — `STANDARD` (claim code) or `SCRATCH_CARD` (`ScratchCardPrize`, weighted random).

## Conventions To Follow

- **Tenant isolation is non-negotiable.** Every business-owner route must resolve the business via
  `requireOwnerBusiness()` / `Business.ownerId === session.user.id` — **never** trust a
  client-supplied `businessId`. This is enforced throughout `src/lib/auth.ts`; keep using it.
- **Route handlers** (`src/app/api/**/route.ts`) follow this shape: `try { requireBusinessOwner()
  or requireOwnerBusiness() → zod safeParse body → prisma call(s), wrapped in `$transaction` for
  any multi-step state change → NextResponse.json(...) } catch` with a fixed set of string error
  codes (`UNAUTHORIZED`, `FORBIDDEN*`, `NOT_FOUND`, `ALREADY_PROCESSED`, ...) mapped to HTTP status
  in the `catch` block. Match this pattern in new routes rather than inventing a new error shape.
- **Validation lives in `src/lib/validations/index.ts`** as Zod schemas — add new schemas there,
  don't inline ad-hoc validation in route handlers.
- Money/threshold/state-transition logic that touches more than one table (approve request, claim
  reward, redeem reward) must be a Prisma `$transaction` with status re-checked *inside* the
  transaction (race-condition guard), matching the requests route above.
- `uploadBillImage()` in `src/lib/storage.ts` **must never throw for infra reasons** — it always
  falls back to local disk. Preserve that guarantee if you touch it.
- Legal doc versions are bumped in `src/lib/constants.ts` (`LEGAL_VERSIONS`), not hardcoded inline.

## Commands

```bash
npm run dev              # start dev server
npm run build             # production build — must be zero errors/warnings before calling work done
npm run lint
npm test                  # vitest run (single pass)
npm run test:watch
npm run prisma:generate
npm run prisma:validate
npm run prisma:seed
```

Always run `npm run build` and `npm test` before reporting a change complete — this project has a
history of "done" being reported without either actually passing (see the historical restructure
prompt). Don't repeat that.

## Housekeeping

- `scratch/` holds throwaway one-off scripts (`check-db.js`, `fix.js`, ...) — not part of the app,
  safe to ignore unless asked about them.
- `.env` holds real local secrets (gitignored); `.env.example` documents the required shape —
  update both together when adding a new env var.
- **Log every non-trivial work session** in `logs/` — see `logs/README.md` for the format. Create
  a new dated log entry summarizing what changed and why before ending a session that modified
  code, schema, or config.
