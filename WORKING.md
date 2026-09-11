# Looply — How The Application Actually Works Today

This document is a factual, read-only audit of the current codebase. It describes what the code
does *as written*, not what CLAUDE.md, prior commit messages, or planning docs say it should do.
Every section names the exact file(s) read to confirm the claim. Where something could not be
confirmed from the code, or looks ambiguous/inconsistent, that is stated explicitly rather than
guessed. No recommendations or fixes are proposed here — see a separate conversation for that.

Stack confirmed from `package.json`: Next.js 14.2.24, React 18.3.1, Prisma `@prisma/client` 5.22.0,
Zod 3.24.2, `bcryptjs`, `qrcode`, `@supabase/supabase-js`. No NextAuth/JWT library present.

---

## 1. Auth & Identity

**Business owner signup/login** — confirmed from `src/lib/auth.ts`, `src/app/api/auth/register/route.ts`,
`src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/me/route.ts`,
`prisma/schema.prisma`.

- `POST /api/auth/register`: rate-limited (10/min per IP via `checkRateLimit` in `src/lib/rate-limit.ts`),
  validates body with `UserRegistrationSchema` (`src/lib/validations/index.ts`), rejects duplicate emails,
  hashes password with `bcryptjs` (`hashPassword`, 10 salt rounds), creates a `User` row together with a
  `LegalAcceptance` row (terms/privacy version from `src/lib/constants.ts`), then calls `createSession()`
  and sets an httpOnly cookie named `looply_session`.
- `POST /api/auth/login`: same rate limiting, looks up `User` by normalized email, verifies password with
  `bcrypt.compare`, creates a new session row, sets the same cookie.
- `POST /api/auth/logout`: deletes the `Session` row for the cookie's token and clears the cookie
  (`maxAge: 0`).
- `GET /api/auth/me`: reads the cookie, calls `validateSession`, returns `{ user: null }` (200, not 401) if
  no/invalid session.
- Sessions are **DB-backed**, not JWT: `Session` model has `sessionToken` (random 32-byte hex, generated
  with Node's `crypto.randomBytes`), `userId`, `expiresAt`. `SESSION_MS` in `auth.ts` = 7 days. Expired
  sessions are deleted on read (`validateSession` deletes-and-returns-null when `expiresAt <= now`).
- `getCurrentUser()` / `requireBusinessOwner()` / `requireOwnerBusiness()` in `auth.ts` are the only auth
  guards used throughout the API routes I read. `requireOwnerBusiness()` resolves the caller's business
  strictly via `Business.ownerId === session.user.id` and throws `FORBIDDEN_TENANT_MISMATCH` if a
  caller-supplied businessId doesn't match — confirmed no route trusts a client-supplied businessId for
  authorization (checked all `src/app/api/business/**/route.ts` files).

**`User` model actual fields** (from `prisma/schema.prisma` lines 52–69): `id`, `email` (unique),
`passwordHash`, `name`, `createdAt`, `updatedAt`, relation `ownedBusiness` (`Business?`, i.e. zero-or-one),
relation `sessions` (`Session[]`), relation `redeemedRewards` (`Reward[]`, named `RedeemedBy` — tracks which
owner redeemed a reward at the counter), relation `legalAcceptances` (`LegalAcceptance[]`). There is **no
`role` field and no `UserRole` enum** in the current schema — `User` exists only for the business-owner
persona. (Note: `src/__tests__/scratch-card-dashboard.test.ts` still `import { UserRole } from
"@prisma/client"` — see §7, this is stale/broken.)

**Customer join / auth** — confirmed by reading `src/lib/auth.ts` in full (no customer-facing session logic
anywhere in it — it only exports business-owner session helpers), `src/app/join/[businessToken]/page.tsx`,
and `src/components/JoinFlow.tsx`.

- There is **no customer login, no customer password, no customer session** anywhere in the current code.
  `Customer` (schema lines 104–121) has no relation to `User` and no password/auth field at all — it is
  keyed only by `@@unique([businessId, mobileNumber])`.
- The join page `src/app/join/[businessToken]/page.tsx` is a public Next.js server component
  (`export const dynamic = "force-dynamic"`, no auth check) that validates the token format
  (`isValidBusinessToken` in `src/lib/token.ts`), loads the `Business` + `LoyaltyProgram` directly via
  Prisma, and renders `<JoinFlow>` with that data as props.
- `JoinFlow.tsx` is a pure client-side form: it takes a mobile number (plus optional name), and POSTs
  directly to `/api/customer/*` routes with `mobileNumber` and `businessId` in the JSON body — no cookie,
  no token, no server-verified identity of any kind. Anyone who knows (or guesses) a mobile number and a
  businessId can act as that customer; there is no OTP/SMS verification step anywhere in the codebase.
- A second public route, `src/app/api/public/business/[businessToken]/route.ts`, exposes a read-only
  sanitized projection of business+program info (name, programName, requiredVisits, rewardTitle,
  rewardDescription, verificationMethod, isActive) by token. Its selected fields differ from what the
  server-rendered join page fetches directly (that page queries the full `Business` row via Prisma, which
  also carries `googleReviewUrl`/`instagramHandle`/`youtubeHandle`/`address`/`businessType` — none of which
  `JoinFlow.tsx` currently reads or renders). I could not find any client code that calls this public API
  route — the join page itself does its own direct Prisma query instead. This route appears unused by the
  current UI (see §7).

**How "Membership" ties to a person across visits** — confirmed from `src/app/api/customer/visit/route.ts`
and the `Membership`/`Customer` models in `prisma/schema.prisma`.

- Identity is entirely the tuple `(businessId, mobileNumber)`. `POST /api/customer/visit` does
  `prisma.customer.upsert({ where: { businessId_mobileNumber: { businessId, mobileNumber } }, ... })` — if a
  customer with that exact mobile number (string match, no normalization/formatting applied anywhere I
  found) has visited this business before, the same `Customer` row is reused and its `name` is opportunistically
  updated; otherwise a new one is created.
- `Membership` (schema lines 200–221) is the `Customer`↔`Business` join row, unique on
  `[customerId, businessId]`, and carries the loyalty counters (`currentVisits`, `totalVisits`). It is
  upserted the same way in the visit route. So "identity across visits" is entirely trust-based on whoever
  types in the same mobile number at that business's join link — there is no verification that the phone
  number's owner is the one typing it.

---

## 2. Business Setup & Loyalty Program Configuration

**Current `Business` fields** (schema lines 127–153, confirmed by direct read): `id`, `name`,
`businessToken` (unique, permanent), `ownerId` (unique — one business per owner, enforced by the `@unique`
on the FK), `googleReviewUrl`, `instagramHandle`, `youtubeHandle`, `address`, `businessType` (all four
optional strings), `createdAt`, `updatedAt`, plus relations to `loyaltyProgram`, `memberships`,
`customers`, `visitRequests`, `visits`, `rewards`.

**Current `LoyaltyProgram` fields** (schema lines 155–175): `id`, `businessId` (unique — one program per
business), `programName`, `type` (`ProgramType` enum: `VISITS` | `SCRATCH_CARD`, default `VISITS`),
`requiredVisits` (Int, default 10), `rewardTitle`, `rewardDescription`, `rewardValidityDays` (default 30),
`verificationMethod` (`VerificationMethod` enum: `BILL` | `VISIT_CONFIRMATION`, default
`VISIT_CONFIRMATION`), `rewardType` (`RewardType` enum: `STANDARD` | `SCRATCH_CARD`, default `STANDARD`),
`isActive` (default true), relations to `rewards` and `scratchCardPrizes`.

**Reward mechanism confirmed as currently implemented: two parallel enums, one effective mechanism per
program.** This is worth stating precisely because the schema has *two* type-like fields that look
redundant:
- `LoyaltyProgram.type` (`ProgramType`: `VISITS`/`SCRATCH_CARD`) is what actually branches behavior
  everywhere in the API and UI I read (`JoinFlow.tsx`, `src/app/api/customer/visit/route.ts`,
  `src/app/api/customer/reward/instant-scratch/route.ts`, `src/app/api/business/requests/[requestId]/route.ts`).
- `LoyaltyProgram.rewardType` (`RewardType`: `STANDARD`/`SCRATCH_CARD`) exists on the schema and is stored
  on each `Reward` row, but **none of the UI forms I read (`BusinessSetupForm.tsx`,
  `src/app/business/loyalty/create/page.tsx`, `BusinessDashboardTabs.tsx`, `BusinessSettingsClient.tsx`)
  ever set it** — it is never included in the payloads those components POST/PUT to
  `/api/business/loyalty`. It only ever takes its Zod/Prisma default (`STANDARD`), except in the auto-scratch
  reward creation path (`instant-scratch/route.ts` line 80 explicitly sets `type: "SCRATCH_CARD"` on the
  created `Reward`, and the visit-approval path at `requests/[requestId]/route.ts` line 148 sets
  `type: rewardType` — i.e. whatever the program's stored `rewardType` currently is, which per the above is
  always `STANDARD` in practice given the UI never sets it).
- There is no separate "milestone" reward mechanism in the schema or code — only these two: (a) `VISITS`
  threshold → claim-code reward (`STANDARD`), and (b) `SCRATCH_CARD` → instant weighted-random prize,
  redeemed immediately on win. `ScratchCardPrize` (schema lines 181–194) is the weighted-prize pool,
  `@@index([loyaltyProgramId])`, no unique constraint on title within a program.

**`BusinessSetupForm.tsx` → what actually gets saved** — confirmed by reading
`src/components/BusinessSetupForm.tsx` and `src/app/api/business/setup/route.ts` side by side.
- The form collects `name`, `address`, `businessType`, `googleReviewUrl`, `instagramHandle`,
  `youtubeHandle` and POSTs all six to `/api/business/setup`.
- The route validates with `BusinessSetupSchema`, checks the owner doesn't already have a business (409 if
  so — one business per owner is enforced at the app layer here, and also at the DB layer via
  `Business.ownerId @unique`), generates a `businessToken` via `generateBusinessToken(12)`
  (`src/lib/token.ts`, cryptographically random from a 32-char non-ambiguous charset, rejection-sampling-free
  since 32 is a power of two), and creates the `Business` row with all six fields persisted. **No
  `LoyaltyProgram` is created at this step** — the comment in the route (`"Create Business (no loyalty
  program yet)"`) and the dashboard's branching in `src/app/business/page.tsx` (renders a "Start a Loyalty
  Program" CTA when `!business.loyaltyProgram`) confirm loyalty-program setup is a separate, later step via
  `/business/loyalty/create` → `POST /api/business/loyalty`.
- Separately, editing an existing business's profile from Settings goes through a **different** route,
  `PUT /api/business/account` (`src/app/api/business/account/route.ts`), which only writes `name`,
  `googleReviewUrl`, `instagramHandle` — it silently drops `address`, `businessType`, `youtubeHandle` even
  though `BusinessSettingsClient.tsx` sends all six and `BusinessUpdateSchema` validates all six (see §7).
  A third route, `PUT /api/business` (`src/app/api/business/route.ts`), exists and only updates `name`.

---

## 3. Visit Submission & Verification Flow

Walked file-by-file from `JoinFlow.tsx` → `POST /api/customer/visit` → `BusinessRequestsPanel.tsx` →
`PATCH /api/business/requests/[requestId]`.

1. **Customer submits** (`JoinFlow.tsx`, "VISITS flow" branch): the form collects `mobileNumber`,
   optional `enteredName`, and — only if `program.verificationMethod === "BILL"` — a plain **text input**
   labeled "Bill Photo URL (For Demo)" (`JoinFlow.tsx` lines 307–319) where the customer types/pastes a URL
   string directly. This is POSTed as `billPhotoUrl` in the JSON body to `/api/customer/visit`.
   - Important: there is **no actual file-upload UI wired into this flow**. A separate component,
     `src/components/VisitRequestButton.tsx`, implements a real `<input type="file">` bill-upload flow with
     client-side type/size validation (JPG/PNG/WEBP, 5MB max) and posts `FormData` to
     `/api/customer/bill-upload` and `/api/customer/verification-request` — **neither of those two API
     routes exists** in `src/app/api/customer/*` (confirmed by listing that directory), and
     `VisitRequestButton` is not imported by any other file in the repo (confirmed by grep). It is dead,
     disconnected code from an earlier design (see §7).
2. **`POST /api/customer/visit`** (`src/app/api/customer/visit/route.ts`): validates the loose Zod shape
   (`mobileNumber` min 5 chars, `businessId` required, everything else optional strings — this is a
   different/looser schema than `VerificationRequestCreateSchema` in `src/lib/validations/index.ts`, which
   is defined but not imported by this route). It looks up the `Business`+`LoyaltyProgram`, enforces an
   "abuse guard" (one `PENDING` request per `(businessId, mobileNumber)` per calendar day — 429 if
   violated), upserts `Customer` and `Membership`, then creates a `VisitRequest` row with
   `status: "PENDING"`, `method: program.verificationMethod`, and `billImagePath: billPhotoUrl` (i.e. the
   raw string the customer typed, stored as-is — never passed through `uploadBillImage()` in
   `src/lib/storage.ts`, which is defined but has **no caller anywhere in the codebase**, confirmed by grep;
   see §7).
3. **Business owner reviews** (`BusinessRequestsPanel.tsx` fetching `GET /api/business/requests`, defined in
   `src/app/api/business/requests/route.ts`): lists `VisitRequest` rows for the owner's business filtered by
   status, resolving a viewable bill URL per request via `getBillViewUrl()` (`src/lib/storage.ts`) — this
   function *is* used, and checks local disk first, then Supabase signed URL, returning `null` if neither
   resolves (which for the demo/URL-typed flow will always be `null` since nothing was ever actually
   uploaded to either store).
4. **Approval** — `PATCH /api/business/requests/[requestId]` (`src/app/api/business/requests/[requestId]/route.ts`):
   see §4 below for the full transaction.

**Duplicate-bill prevention**: confirmed **not implemented**. There is no bill-number field, no image
hashing, no perceptual-hash comparison, and no uniqueness constraint tying a `VisitRequest`/`Visit` to a
specific bill anywhere in `prisma/schema.prisma` or the request/approval routes I read. The only
duplicate-submission guard present is the "one PENDING request per customer per business per calendar day"
check in `POST /api/customer/visit` (a submission-throttle, not a bill-duplicate check) — a customer could
submit the same `billPhotoUrl` string across different days, or two different customers could submit
identical bill URLs, and nothing in the code would catch or flag it.

**What triggers `currentVisits` to increment**: exclusively `PATCH /api/business/requests/[requestId]` on
the `APPROVED` branch, inside the `$transaction` — `tx.membership.update({ ..., data: { currentVisits: {
increment: 1 }, totalVisits: { increment: 1 } } })` (`src/app/api/business/requests/[requestId]/route.ts`
lines 116–122). No other code path increments it. `GET /api/customer/progress/route.ts` only *reads* the
stored counter; its own comment (line 51–52) states this explicitly: `"Compute progress: derived from
approved visit requests or use stored counter. For now we use the stored counter currentVisits which
should be incremented on approval."`

---

## 4. Reward Generation Logic

Read in full: `src/app/api/business/requests/[requestId]/route.ts` (VISITS approval path) and
`src/app/api/customer/reward/instant-scratch/route.ts` (SCRATCH_CARD path).

**VISITS program — reward on threshold, inside the approval transaction:**
- After incrementing `currentVisits`/`totalVisits`, the same transaction checks
  `if (updatedMembership.currentVisits >= requiredVisits)`. If true, it (a) throws
  `INVALID_PROGRAM_TYPE` if `business.loyaltyProgram.type !== "VISITS"` (defensive guard — this branch is
  only reachable from the VISITS-only approval route anyway), (b) generates a random 6-char `claimCode`
  (`generateClaimCode()`, top of the file — uses `Math.random()`, **not** a cryptographically secure RNG,
  drawn from a 32-char non-ambiguous charset), (c) creates a `Reward` row with `status: "AVAILABLE"`,
  `type: rewardType` (the program's stored `rewardType`, effectively always `STANDARD` per §2),
  `claimCode` set, `expiresAt` computed from `rewardValidityDays`, and (d) resets `currentVisits` to 0 in a
  second update within the same transaction.
- This reward creation is **not separately unique-constrained**. Nothing in the schema stops two
  concurrent approvals for the *same* `VisitRequest` from both crossing the threshold and minting two
  rewards — but that specific race is prevented one layer up: the whole approve/reject flow first re-checks
  `vr.status !== "PENDING"` *inside* the transaction and throws `ALREADY_PROCESSED` otherwise, and
  `Visit.verificationRequestId` is `@unique`, so a given `VisitRequest` can only ever produce one `Visit`
  and therefore only ever be approved once. Reward creation is gated behind that same one-time approval, so
  in practice a single `VisitRequest` cannot mint two rewards. There is, however, **no unique constraint on
  `Reward` keyed by `(membershipId, milestone)`** in the schema (no such "milestone" field exists at all) —
  the only thing preventing duplicate reward-mint-per-threshold-crossing is the one-shot nature of
  `VisitRequest` approval combined with the `currentVisits` reset to 0 after each mint. If that reset step
  were ever skipped or the transaction re-entered, nothing at the DB level would stop a duplicate. As
  written today, I did not find a path that produces a duplicate reward for one threshold crossing, but the
  protection is procedural (transaction ordering + reset), not a hard DB constraint.

**SCRATCH_CARD program — reward on-demand, no visit/approval step at all:**
- `POST /api/customer/reward/instant-scratch` runs its own `$transaction`: loads the `LoyaltyProgram` +
  `scratchCardPrizes`, validates `type === "SCRATCH_CARD"` and `isActive`, validates prize count is 3–10,
  upserts `Customer`/`Membership` (creating them fresh if this is the customer's first play), performs a
  weighted-random draw (`Math.random() * totalWeight`, subtract each prize's weight until ≤0 — **not**
  cryptographically secure), and immediately creates a `Reward` with `status: "REDEEMED"` (already redeemed
  at creation time — there is no separate "claim" step for scratch-card wins), `type: "SCRATCH_CARD"`,
  `revealedPrize: wonPrize.title` set at creation, and `redeemedAt: now` also set at creation.
- **Is scratch-card generation tied uniquely to a visit?** No — and this is a meaningful behavioral fact:
  scratch-card play is **not gated by any visit at all**. `instant-scratch` can be called repeatedly by
  anyone who knows a `businessId`, with any mobile number, with no prerequisite `VisitRequest` or `Visit`
  row, no cooldown, and no per-day/per-customer limit (unlike the VISITS flow's daily-pending-request
  guard). Nothing in the schema or route ties a `Reward.type = SCRATCH_CARD` row to a specific `Visit` — the
  `Visit`↔`Reward` relationship the schema does model is only via shared `membershipId`, never enforced as
  1:1. There is no unique constraint of any kind preventing the same customer from calling this endpoint
  many times in a row to win/redeem multiple prizes.
- **Milestone-reward duplicate protection**: not applicable/does not exist as a concept — confirmed there is
  no milestone model or field distinct from the VISITS-threshold mechanism already covered above.

---

## 5. Scratch Card Redemption

Read in full: `src/app/api/customer/reward/instant-scratch/route.ts`, `src/components/ScratchCardComponent.tsx`,
`src/components/RewardCard.tsx`, `src/app/api/customer/dashboard/route.ts`, `src/app/api/customer/reward/claim-code/route.ts`.

**There is no dedicated "scratch" API endpoint at all.** I searched specifically for any route that reads
or writes `isScratched` (grep across the repo) and found it only in: the schema (`isScratched Boolean
@default(false)`), the migration SQL, `src/components/RewardCard.tsx` (client-side `useState` only), and a
test fixture. No `route.ts` file anywhere sets `isScratched`. Concretely:
- For the SCRATCH_CARD program type, the "scratch" and the "reveal" happen **before** any database write
  related to scratching: `instant-scratch/route.ts` computes the prize and writes `revealedPrize`,
  `status: REDEEMED`, `redeemedAt` all in the *same* transaction that mints the `Reward` — the client-side
  scratch animation (`ScratchCardComponent.tsx`) that follows is purely cosmetic canvas-erasing (pointer
  events clear a `<canvas>` overlay via `destination-out` compositing until >40% transparent, then calls
  `onScratchComplete`); it never calls any API. The prize was already known to the client the instant the
  `instant-scratch` response returned (`data.reward.revealedPrize` is in the JSON payload immediately —
  `JoinFlow.tsx` lines 148–159 render the scratch canvas using `claimedReward.revealedPrize` that was
  already fetched).
- **So there is no "atomic vs. two-step" race condition to evaluate for the scratch reveal itself, because
  there is no separate reveal step** — the entire win+reveal+redeem happens in one Prisma `$transaction` at
  play time. The `isScratched` field on the `Reward` model is **never set to `true` by any server code path
  I found** — it stays at its schema default (`false`) forever in the database, regardless of what the
  customer does client-side. The only place `isScratched` is ever toggled is client-side React state in
  `RewardCard.tsx` (`setIsScratched(true)` inside `handleScratchComplete`, purely in-memory, lost on reload)
  and `ScratchCardComponent.tsx`'s local `isRevealed` state.
- `RewardCard.tsx` (which reads `reward.isScratched` and `reward.revealedPrize` as initial state) is
  imported by `JoinFlow.tsx` (`import RewardCard from "./RewardCard"`, line 6) but I could not find it
  actually **rendered** anywhere in `JoinFlow.tsx`'s JSX — `JoinFlow.tsx` renders `ScratchCardComponent`
  directly instead (lines 154–157) for the win-reveal, and its own claimed-reward success screen (lines
  162–173) for STANDARD rewards. `RewardCard` also appears imported in `scratch/fix2.js` (a historical
  one-off patch script, not part of the running app). This means `RewardCard.tsx` currently has **no live
  render path from `JoinFlow`**, and I could not locate any other page/component that renders it either
  (grep found only its own file and `JoinFlow.tsx`'s unused import) — see §7.

**Is `revealedPrize` ever exposed in a list/GET response before scratching?** Given the above (win and
reveal happen atomically at play time, `isScratched` is never server-set to `true`), the concept of
"before scratching" doesn't really apply server-side — `revealedPrize` is populated at creation and is
immediately returned in the `instant-scratch` POST response by design (that endpoint's entire purpose is to
reveal a prize). Separately, `GET /api/customer/dashboard` (`src/app/api/customer/dashboard/route.ts`)
does return `revealedPrize` for scratch-card rewards, but only ones where `r.revealedPrize` is truthy
(lines 81–87, `.filter(r => ... && r.revealedPrize)`), which — because `revealedPrize` is only ever set at
the moment of winning — will always be prizes the customer already won and saw. I found no code path where
a `Reward` exists with `revealedPrize` set but `isScratched` false in a way that would let a *different*
person than the winner see an unrevealed prize through a list endpoint, because there is no unrevealed
state modeled server-side at all.

---

## 6. Google Review & Instagram Features

Read in full: `src/components/GoogleReviewModal.tsx`, `src/components/InstagramButton.tsx`, and grepped
their usage across the repo.

- **Schema-level support exists**: `Business.googleReviewUrl`, `Business.instagramHandle`,
  `Business.youtubeHandle` are real columns, settable from `BusinessSetupForm.tsx` at business creation and
  from `BusinessSettingsClient.tsx` (partially — see §2/§7) afterward. `Membership.reviewPromptedAt`
  (`DateTime?`) also exists in the schema specifically to support review-prompt throttling.
- **`GoogleReviewModal.tsx` is a fully-built component** — it shows a modal once `currentVisits >= 2` and
  `googleReviewUrl` is set, throttled to not re-show within 30 days of `reviewPromptedAt`, opens the review
  URL in a new tab, and calls `POST /api/customer/membership/${membershipId}/review-prompt` to record the
  prompt timestamp. **That API route does not exist anywhere in `src/app/api/`** (confirmed — no
  `customer/membership/[membershipId]/review-prompt` directory exists under `src/app/api/customer/`). More
  fundamentally, **`GoogleReviewModal` is never imported/rendered by any other file in the repo**
  (confirmed by grep — it only appears in its own definition file). It is fully coded but completely
  disconnected — not reachable from the running app at all.
- **`InstagramButton.tsx`** is a small, complete, working component (renders a link to
  `https://instagram.com/${handle}` if a handle is passed) but is likewise **never imported/rendered
  anywhere** (confirmed by grep — only its own file references it).
- **Net state: both features are implemented as isolated components with real logic, but neither is wired
  into any page the customer or business owner actually sees.** The join flow (`JoinFlow.tsx`) and the
  business dashboard (`BusinessDashboardTabs.tsx`) do not reference either component. The `googleReviewUrl`
  and `instagramHandle` data the owner enters in setup/settings currently has no reachable consumer in the
  customer-facing UI (YouTube handle likewise has no consumer anywhere).

---

## 7. Known Gaps / Inconsistencies

Everything below was directly observed in the files read for this audit (cited above), not inferred from
commit messages or docs.

- **Dead/unreachable customer components referencing nonexistent API routes**: `VisitRequestButton.tsx`
  (posts to `/api/customer/verification-request` and `/api/customer/bill-upload`, neither of which exists)
  and `GoogleReviewModal.tsx` (posts to `/api/customer/membership/[id]/review-prompt`, which doesn't exist)
  are both fully-coded but not imported by any live page. `InstagramButton.tsx` is coded and would work but
  is likewise never rendered.
- **`RewardCard.tsx` is imported but not rendered** in `JoinFlow.tsx` — a dead import (`import RewardCard
  from "./RewardCard"` on line 6, never used in JSX).
- **`uploadBillImage()` in `src/lib/storage.ts` is never called anywhere** — the live bill-verification path
  (`JoinFlow.tsx` → `POST /api/customer/visit`) only ever stores a raw string the customer typed into a
  text field labeled "Bill Photo URL (For Demo)"; it never invokes the actual upload function CLAUDE.md
  describes as load-bearing. `getBillViewUrl()` (the read-side counterpart) *is* used, by
  `GET /api/business/requests`.
- **`.email` fields referenced in the UI that don't exist on `Customer`**: `BusinessMembersPanel.tsx`
  (`m.email`, line 21/115), `BusinessRewardsPanel.tsx` (`r.customer.email`, lines 13/91), and
  `BusinessAnalyticsPanel.tsx` (`item.customerEmail`, lines 35/229) all read an `email` property that the
  `Customer` model does not have (only `name` and `mobileNumber`) and that their respective backing API
  routes (`/api/business/members`, `/api/business/rewards`, `/api/business/analytics`) never select or
  return (those routes select/return `mobileNumber`, not `email`). These will render as `undefined` in the
  UI.
- **`PUT /api/business/account` silently drops fields the Settings UI sends**: `BusinessSettingsClient.tsx`
  submits `name`, `address`, `businessType`, `googleReviewUrl`, `instagramHandle`, `youtubeHandle`, and
  `BusinessUpdateSchema` validates all six, but the route handler (`src/app/api/business/account/route.ts`)
  only writes `name`, `googleReviewUrl`, `instagramHandle` to the database — `address`, `businessType`, and
  `youtubeHandle` edits made from Settings are accepted (200 OK) but never persisted. (A separate route,
  `PUT /api/business`, exists too and updates only `name`.)
- **Public API route with no known caller**: `src/app/api/public/business/[businessToken]/route.ts` returns
  a sanitized business/program projection, but the actual join page (`src/app/join/[businessToken]/page.tsx`)
  fetches this data itself via direct server-side Prisma calls, not via this API. I could not find any
  client-side code that calls this route.
- **Broken/stale test file**: `src/__tests__/scratch-card-dashboard.test.ts` does
  `import { UserRole } from "@prisma/client"` (line 3) — no `UserRole` enum exists in the current schema.
  This import would fail Prisma client type generation/compilation as the file stands.
- **`scratch/fix2.js`** (in the gitignored-by-convention `scratch/` housekeeping folder per CLAUDE.md) is a
  historical one-off patch script that references `UserRole`, `prisma.verificationRequest` (renamed to
  `visitRequest` at some point), and a `RewardCard` `onReveal` prop that no longer exists on the current
  `RewardCard.tsx` (which uses `onScratchComplete`) — confirms it is stale/from an earlier architecture, not
  live tooling.
- **`generateClaimCode()` and the scratch-card weighted draw both use `Math.random()`**, not a
  cryptographically secure RNG (`crypto.randomBytes`, which *is* used elsewhere for session tokens and
  business tokens) — noted as a factual code characteristic, not a recommendation.
- **`JoinFlow.tsx` has a leftover self-referential comment** (line 73): `"// added enteredName just to
  silence eslint, though it could cause loop if not careful. Wait, I'll remove enteredName from deps and
  add eslint-disable."` — the effect dependency array still includes `enteredName` as of the current file
  (the described follow-up edit was not made), left in as-is.
- **`rewardType` on `LoyaltyProgram` is effectively vestigial** given current UI (see §2) — always
  `STANDARD` in every program created or edited through the dashboard, since no form ever sets it.
- **In-memory rate limiting is per-process** (`src/lib/rate-limit.ts`, explicit comment: "Prevents
  brute-force attacks without requiring Redis or external infrastructure") — stated here only as a factual
  characteristic (it will not coordinate across multiple server instances/serverless invocations), not a
  recommendation.
