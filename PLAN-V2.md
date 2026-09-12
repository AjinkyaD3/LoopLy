# Looply — Revised Remediation & Feature Plan (v2)

Diagnosis and design only — nothing in this document has been implemented. Every claim below was
re-verified against the live repository and the live database in this session (not copied from
WORKING.md or PLAN.md). Where a command was actually run to establish ground truth, that's stated
explicitly.

## ⚠️ Critical finding: schema.prisma and the live database currently disagree

Before anything else: while implementing PLAN.md's Issue 4 last session, I edited
`prisma/schema.prisma` (removed `ProgramType` enum, replaced `LoyaltyProgram.type`/`rewardType` with
`visitsEnabled`/`scratchCardEnabled`) but was interrupted before generating or applying a migration —
and that edit was subsequently committed (`a3f510e`) as part of a broader commit alongside
`CLAUDE.md`/`WORKING.md`/`PLAN.md`/logs. **The database was never touched.** I confirmed this by
running `npx prisma db pull --print`, which introspects the live Supabase Postgres database directly:
the actual `LoyaltyProgram` table still has `type ProgramType` and `rewardType RewardType` — there is
no `visitsEnabled`/`scratchCardEnabled` column in the database at all. The generated Prisma Client in
`node_modules/.prisma/client` also still matches the OLD (database) shape — I confirmed this by
grepping its `.d.ts` for `ProgramType` (61 matches) vs `visitsEnabled` (0 matches) — so nothing is
broken *yet*, but `prisma/schema.prisma` (the checked-in source of truth) and reality have silently
diverged. `npm install`'s `postinstall: prisma generate` would regenerate the client to match the
stale, unmigrated schema file the moment anyone runs it, which would immediately break every route
still written against `.type`/`.rewardType` (roughly a dozen files). This is now the first thing
Phase 1 below has to resolve — by reverting the stray edit back to the DB's true current shape and
building this plan's real migration from that known-good baseline, since the target shape has changed
anyway (Part A below retires scratch-card-as-a-LoyaltyProgram-mode entirely, which is a different end
state than my aborted `visitsEnabled`/`scratchCardEnabled` edit was heading toward).

I also queried the live database directly (via a one-off Node script using the generated Prisma
Client, since `prisma db execute` doesn't return `SELECT` output to the terminal) to check whether any
real data would be affected by retiring `LoyaltyProgram.type = SCRATCH_CARD`. This is **not** empty
test fixture data:

```
LoyaltyProgram by type: 10 rows type=VISITS, 5 rows type=SCRATCH_CARD (all rewardType=STANDARD)
ScratchCardPrize rows: 12
Reward rows with type=SCRATCH_CARD: 10
Businesses: 17, Customers: 14, Visits: 7, Memberships: 12
```

`prisma/seed.ts` only creates 2 businesses, so this isn't seed output — it's accumulated dev/manual-
testing data in the connected Supabase instance. Small numbers, but real rows with real foreign-key
relationships, which is exactly the kind of data Part D3 below has to make an explicit, non-silent
decision about rather than just dropping columns.

---

## Dependency ordering (why sections are grouped this way)

```
Phase 0  Fix the schema.prisma/DB drift (prerequisite for touching LoyaltyProgram at all)
            │
Phase 1  Campaign subsystem (Part B) + retire scratch-card mode from LoyaltyProgram (D3)
            │   — bundled: D3's fix IS "here's where scratch-cardness moved to" (Part B).
            │   Both touch LoyaltyProgram's schema; doing them as one migration avoids
            │   migrating that model's shape twice.
            ▼
Phase 2  Windowed loyalty thresholds (Part C)
            │   — touches LoyaltyProgram + the visit-approval transaction again. No hard
            │   technical dependency on Phase 1, but both phases edit the same model and
            │   the same route file, so doing Part C on top of the already scratch-free
            │   LoyaltyProgram (rather than interleaved) avoids two separate partial
            │   restructurings of the same file in the same session.
            ▼
Phase 3  D4 — Google Review / Instagram wiring
            │   — depends on Phase 2: it needs membershipId/reviewPromptedAt added to
            │   /api/customer/progress, and I'd rather add that once, to the FINAL shape
            │   of that route after Part C has already changed what "progress" means,
            │   not before.
            ▼
Phase 4  D1 → D2 — real bill upload, then duplicate-bill prevention
            │   — D2 hard-depends on D1 (needs real bytes to hash). Independent of
            │   Phases 1–3; placed here for narrative flow only, not because it must wait.
            ▼
Phase 5  D5 — Settings field persistence (fully independent, no schema change)
Phase 6  D7 — Customer.email UI bug (fully independent, trivial, no schema change)
Phase 7  D6 — Test/script cleanup (must follow Phase 1 + 2: the specific tests affected
            exercise the exact fields those phases remove)
```

Phases 5 and 6 have zero dependencies and could genuinely run in any order or in parallel with
everything else — they're listed last only because Phases 1–4 are where the real architectural risk
and the open decisions needing your input are concentrated, and I want those resolved first.

**Honest scope flag up front**: Phases 1 and 2 together are a large amount of new schema and
transaction-logic surface for one plan — a new 3-table subsystem plus a rework of how every loyalty
reward gets minted. I don't think either is avoidable given what you've asked for, but I'd flag that
if you want to ship incrementally, Phase 1 (Campaigns) and Phase 2 (windowed thresholds) are fully
separable and could go out as two independent releases rather than one — there's no reason they need
to land in the same deploy.

---

# PART A — Corrected assumptions (confirmed, no further design needed)

**A1 (scratch cards are standalone campaigns, not loyalty rewards)** and **A2 (one-play-per-mobile-
per-campaign, no OTP)** are product decisions, not something to re-verify against code — they
supersede PLAN.md's Issue 1 design outright. Noted and applied throughout Part B below. Per your
explicit instruction, I'm not re-litigating the no-OTP tradeoff — it matches the trust model already
accepted everywhere else in the join flow (confirmed again this session: `src/lib/auth.ts` has zero
customer-facing session/verification logic, and `POST /api/customer/visit`,
`POST /api/customer/reward/claim-code` etc. all trust a client-supplied `mobileNumber` with no proof of
possession).

---

# PHASE 0 — Fix the schema/DB drift

### (a) Confirmed current state
Covered in full above. `prisma/schema.prisma` has an uncommitted-to-DB edit; the DB and generated
client both still reflect the pre-edit shape (`type: ProgramType`, `rewardType: RewardType`).

### (c) Fix
Revert `LoyaltyProgram` in `prisma/schema.prisma` back to exactly what `prisma db pull` shows is live
today (restore `type ProgramType @default(VISITS)` and `rewardType RewardType @default(STANDARD)`,
restore the `ProgramType` enum), so the schema file and the database agree again — this is pure
reversion, not a new design decision. Phase 1's real migration is then built from that confirmed-
correct starting point.

### (d) Open decisions
None — this is corrective, not a design choice.

---

# PHASE 1 — Campaign subsystem (Part B) + retire scratch-card mode from LoyaltyProgram (D3)

## B1 — Campaign / CampaignPrize / CampaignPlay schema

### (a) Confirmed current behavior
`ScratchCardPrize` (`prisma/schema.prisma` lines 176–189 in the current file) has no stock concept at
all — just `weight`. The old scratch mechanism (`src/app/api/customer/reward/instant-scratch/route.ts`,
re-read in full this session, unchanged from prior audit) creates a `Reward` row directly, with no
time-boxing, no per-prize stock, and no gate — confirmed again: it takes only
`{ mobileNumber, businessId, name }`, no play-limit of any kind.

### (b) Why the current shape can't support this feature
Nothing here — this section is additive. The problem being solved is the complete absence of any of
these concepts (campaign identity, time-boxing, stock, one-play-per-number).

### (c) Proposed schema

```prisma
model Campaign {
  id              String    @id @default(cuid())
  businessId      String
  business        Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name            String
  campaignToken   String    @unique
  startsAt        DateTime
  endsAt          DateTime?
  endedManuallyAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  prizes CampaignPrize[]
  plays  CampaignPlay[]

  @@index([businessId])
  @@index([campaignToken])
}

model CampaignPrize {
  id             String   @id @default(cuid())
  campaignId     String
  campaign       Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  title          String
  weight         Int
  totalStock     Int
  remainingStock Int
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  plays CampaignPlay[]

  @@index([campaignId])
}

model CampaignPlay {
  id            String         @id @default(cuid())
  campaignId    String
  campaign      Campaign       @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  mobileNumber  String
  customerName  String?
  wonPrizeId    String?
  wonPrize      CampaignPrize? @relation(fields: [wonPrizeId], references: [id], onDelete: SetNull)
  revealedPrize String
  playedAt      DateTime       @default(now())

  @@unique([campaignId, mobileNumber])
  @@index([campaignId])
}
```

`businessId` on `Campaign` is a plain indexed FK, **not** `@unique` — confirmed this is what you asked
for (many campaigns per business) and matches nothing in the current schema forcing exclusivity (unlike
`LoyaltyProgram.businessId`, which genuinely is `@unique` today — one program per business, a
constraint I am not touching).

`campaignToken`: reuse `generateBusinessToken()` from `src/lib/token.ts` (re-read this session,
unchanged) — it's already generic (crypto-random, 32-char non-ambiguous charset, no business-specific
logic despite the name) — call the exact same function for campaign tokens rather than writing a
second generator. Same for validation: `isValidBusinessToken()` is a pure format checker (length +
charset), reusable as-is for campaign tokens.

**On the ScratchCardPrize vs. CampaignPrize consolidation you asked me to assess**: I recommend **not**
merging them into one table, but retiring `ScratchCardPrize` as a live path (see D3 below) so only one
system is ever *live* at a time, while its ~12 existing rows stay in the database untouched, purely as
inert history. They're structurally different models now — `ScratchCardPrize` has no stock and belongs
to a `LoyaltyProgram`; `CampaignPrize` has stock and belongs to a `Campaign`. Force-merging them would
mean giving `ScratchCardPrize` a stock concept it never had (fabricated) or giving `CampaignPrize` an
optional stock (weakening the actual guarantee Part B needs). Keeping them as two tables — one live,
one frozen/historical — satisfies "don't leave two parallel *live* systems" without inventing data that
doesn't exist.

### (d) Open decisions
1. Cosmetic: rename `generateBusinessToken`/`isValidBusinessToken` in `token.ts` to
   `generateToken`/`isValidToken` now that they serve two purposes, or leave the names as-is and just
   call them from the campaign code too? Zero functional difference either way — your call.
2. Minimum prize count for a campaign — the old scratch-card-in-LoyaltyProgram model required 3–10
   prizes (a UI rule specific to that old feature). Nothing in your spec re-imposes that range for
   Campaigns. I'd default to "at least 1 prize required, no upper bound," but flagging since 3–10 was a
   deliberate choice somewhere in this codebase's history and you may want to keep it.

## B2 — Derived campaign status

### (c) Proposed fix
One shared helper, not duplicated logic in the public route and the owner dashboard route (this
codebase has a documented history of exactly that kind of divergence — e.g. Issue 6's two
business-update routes silently drifting apart). Proposed: `src/lib/campaign.ts`:

```ts
export type CampaignStatus = "SCHEDULED" | "ACTIVE" | "ENDED";

export function getCampaignStatus(
  campaign: { startsAt: Date; endsAt: Date | null; endedManuallyAt: Date | null },
  prizes: { remainingStock: number }[]
): CampaignStatus {
  const now = new Date();
  if (now < campaign.startsAt) return "SCHEDULED";
  const allOutOfStock = prizes.length > 0 && prizes.every((p) => p.remainingStock <= 0);
  if (campaign.endedManuallyAt || (campaign.endsAt && now > campaign.endsAt) || allOutOfStock) {
    return "ENDED";
  }
  return "ACTIVE";
}
```

Both the public play route/page and the owner's campaign-list route call this same function — no
stored status field, no cron, exactly as specified. The public-facing message shows only `"ENDED"` as
one generic message regardless of which of the three causes triggered it (never exposing which).
`"SCHEDULED"` gets its own distinct "starts soon" message (not the same copy as ended).

### (d) Open decisions
None — this section is fully specified by your instructions.

## B3 — Weighted draw with stock, race-safe

### (a) Confirmed current behavior
The existing scratch draw (`instant-scratch/route.ts` lines 56–67, re-confirmed this session) uses
`Math.random() * totalWeight` with no stock concept — nothing to carry forward here, this is a new
implementation for Campaigns.

### (c) Proposed fix
```ts
await prisma.$transaction(async (tx) => {
  for (let attempt = 0; attempt < MAX_PRIZE_COUNT; attempt++) {
    const inStock = await tx.campaignPrize.findMany({
      where: { campaignId, remainingStock: { gt: 0 } },
    });
    if (inStock.length === 0) throw new Error("CAMPAIGN_ENDED"); // all stock exhausted mid-transaction

    const totalWeight = inStock.reduce((sum, p) => sum + p.weight, 0);
    let roll = randomInt(totalWeight); // crypto.randomInt — see below
    let chosen = inStock[inStock.length - 1];
    for (const p of inStock) {
      if (roll < p.weight) { chosen = p; break; }
      roll -= p.weight;
    }

    const decremented = await tx.campaignPrize.updateMany({
      where: { id: chosen.id, remainingStock: { gt: 0 } },
      data: { remainingStock: { decrement: 1 } },
    });
    if (decremented.count === 0) continue; // someone else took the last unit — re-roll (loop)

    return tx.campaignPlay.create({
      data: { campaignId, mobileNumber, customerName, wonPrizeId: chosen.id, revealedPrize: chosen.title },
    });
    // if this throws P2002 (duplicate mobileNumber for this campaign), the whole transaction —
    // INCLUDING the stock decrement above — rolls back, so a rejected duplicate play never
    // wastes inventory.
  }
  throw new Error("CAMPAIGN_ENDED");
});
```

This matches your required sequence exactly: fetch in-stock-only rows, weighted draw against that
subset, atomic conditional decrement, re-roll (not fail) on a lost race, create the play row only after
a successful decrement, all inside one transaction so a duplicate-play rejection can't consume stock.

**Randomness**: use `crypto.randomInt(totalWeight)` (Node's built-in, cryptographically secure,
unbiased integer generator — available since Node 14.10) rather than hand-rolling rejection sampling
over `randomBytes` a second time (that pattern already exists once, in `token.ts`, for charset
indexing over a fixed power-of-two alphabet — `randomInt` is the more direct, already-correct primitive
for an arbitrary-sized weighted draw and needs no bias-correction logic of its own).

**On `generateClaimCode()`'s `Math.random()`** (`src/app/api/business/requests/[requestId]/route.ts`
lines 7–14, confirmed unchanged): flagging as requested, **not changing it**. It's unrelated to
Campaigns and you asked me not to touch it without approval.

### (d) Open decisions
1. `MAX_PRIZE_COUNT` retry bound for the re-roll loop — I'd cap it at the campaign's total prize count
   (can't loop more times than there are prizes to exhaust), which is self-limiting and needs no manual
   tuning. Flagging only because it's a concrete number I'm choosing rather than something you specified.

## B4 — Campaign QR is separate from the permanent business QR

### (a) Confirmed current behavior
`src/app/join/[businessToken]/page.tsx` and `src/lib/qr.ts` (`getBusinessJoinUrl`,
`generateQRCodeSvg`/`generateQRCodeDataUrl`) are the existing pattern for the permanent standee QR — a
public server component resolving a token to content, plus two small QR-rendering helpers built on the
`qrcode` package. Both re-confirmed unchanged this session.

### (c) Proposed fix
Mirror the exact same pattern for campaigns, not a new one:
- `src/lib/qr.ts` gains `getCampaignPlayUrl(campaignToken)` (same shape as `getBusinessJoinUrl`, just
  targeting `/campaign/${campaignToken}`); `generateQRCodeSvg`/`generateQRCodeDataUrl` are already
  generic (take arbitrary text) and need no change.
- `src/app/campaign/[campaignToken]/page.tsx` — public, no auth, `export const dynamic =
  "force-dynamic"`, resolves the `Campaign` (+ prizes, + business name) by token, computes status via
  `getCampaignStatus()`, and renders a `CampaignPlayFlow` client component (new, mirrors
  `JoinFlow.tsx`'s shape: mobile number + optional name input, POSTs to the play endpoint, renders the
  won prize). If status is `SCHEDULED` or `ENDED`, render the appropriate static message instead of the
  play form (no form rendered at all in either case, consistent with "not playable").
- The permanent `businessToken` QR (`join/[businessToken]/page.tsx`, `/api/public/business/[businessToken]`)
  is untouched — confirmed no code path anywhere makes it dynamically campaign-aware, and none should be
  added, exactly as you specified.

### (d) Open decisions
None — this section is fully specified.

## B5 — Owner dashboard: campaign list view

### (c) Proposed fix
New routes (all `requireOwnerBusiness()`-gated, tenant-scoped exactly like every existing
`/api/business/*` route):
- `POST /api/business/campaigns` — create (`name`, `startsAt`, `endsAt?`, `prizes: [{title, weight,
  totalStock}]`); sets `remainingStock = totalStock` on each prize at creation.
- `GET /api/business/campaigns` — list, each row annotated with computed status (via the shared
  `getCampaignStatus()` helper), `plays: { _count }`, and per-prize `remainingStock`/`totalStock`.
- `POST /api/business/campaigns/[campaignId]/end` — sets `endedManuallyAt = now()`; idempotent (calling
  it again on an already-ended campaign is a no-op, not an error).
- New page `src/app/business/campaigns/page.tsx` — the list view: name, status badge, downloadable QR
  (reusing `QRCodeDisplay` + the new `getCampaignPlayUrl`), play count, per-prize stock bars, "End now"
  button (disabled/hidden once already ended).
- New page `src/app/business/campaigns/create/page.tsx` — mirrors `business/loyalty/create/page.tsx`'s
  existing form pattern.
- `BusinessDashboardTabs.tsx` gains a "Campaigns" tab entry alongside the existing Overview/Requests/
  Members/Rewards/QR/Loyalty tabs.

### (d) Open decisions
1. You didn't ask for campaign editing (rename, change dates, adjust prize stock after creation) beyond
   "End now" — I'm treating a campaign as otherwise immutable once created, which fits the "time-boxed
   promotional campaign" mental model (you wouldn't want prize odds changing mid-campaign while people
   are already playing) and keeps this phase's scope contained. Confirm that's acceptable, or tell me
   if owners need to edit a live campaign's prizes/dates.

## D3 (revised) — Retire LoyaltyProgram's scratch-card mode

### (a) Confirmed current behavior
Re-confirmed this session (see the "Critical finding" section above): the live database has 5
`LoyaltyProgram` rows with `type = 'SCRATCH_CARD'`, 12 `ScratchCardPrize` rows, and 10 `Reward` rows
with `type = 'SCRATCH_CARD'` — real, non-trivial data. `LoyaltyProgramSchema` in
`src/lib/validations/index.ts` (lines 100–117, re-confirmed) still has the `type`/`rewardType` fields
and the 3–10-prize `superRefine`. `src/app/api/business/loyalty/route.ts` (POST + PUT, re-confirmed)
still branches all its `scratchCardPrizes` handling off `type === "SCRATCH_CARD"`.
`src/app/api/business/requests/[requestId]/route.ts` line 133 still throws `INVALID_PROGRAM_TYPE` if
`programType !== "VISITS"` inside the reward-mint branch. `src/app/api/customer/dashboard/route.ts`
(lines 51, 54, 78–97) still branches its entire response shape on `loyaltyProgram.type`.
`src/components/JoinFlow.tsx` line 177 still renders a completely separate instant-play UI when
`program.type === "SCRATCH_CARD"`.

### (b) Why it's a problem
Per A1, this whole mechanism is being replaced by Campaigns — keeping `type`/`rewardType`/
`ProgramType` around after that would mean two parallel, semantically-conflicting definitions of
"scratch card" living in the schema at once (the old LoyaltyProgram-embedded one, now dead code once
Campaigns exist, and the new Campaign one) — exactly the kind of confusion WORKING.md §2 already
flagged about these two enums being partly vestigial even before this change.

### (c) Proposed fix
Migration (run **after** Phase 0's revert, and after Campaign/CampaignPrize/CampaignPlay have been
added in a separate, purely-additive migration first — never bundle an additive, zero-risk migration
with a destructive/restructuring one):

```sql
-- 1. Pause (do not silently repurpose) the 5 existing SCRATCH_CARD programs, so they don't suddenly
--    start behaving as live VISITS programs using whatever placeholder requiredVisits/rewardTitle
--    values happen to already be sitting in those rows.
UPDATE "LoyaltyProgram" SET "isActive" = false WHERE "type" = 'SCRATCH_CARD';

-- 2. Drop the now-retired fields/enum from LoyaltyProgram.
ALTER TABLE "LoyaltyProgram" DROP COLUMN "type";
ALTER TABLE "LoyaltyProgram" DROP COLUMN "rewardType";
DROP TYPE "ProgramType";

-- NOTE: RewardType enum and Reward.type / Reward.scratchCardPrizeId / Reward.isScratched /
-- Reward.revealedPrize are NOT dropped. They stay exactly as they are, to preserve the 10 existing
-- historical SCRATCH_CARD Reward rows and their FK integrity to ScratchCardPrize (also left in place,
-- 12 rows, untouched). No new code path will ever create a Reward with type=SCRATCH_CARD again — the
-- instant-scratch route is deleted (see below) — but old rows remain fully intact and queryable.
```

`Zod`: `LoyaltyProgramSchema` drops `type`, `rewardType`, `prizes`, and the `superRefine` entirely
(the whole scratch-prize-count rule moves to a new `CampaignCreateSchema`, since prize configuration
now belongs to Campaigns, not loyalty programs).

`src/app/api/business/loyalty/route.ts`: drop the `type`/`rewardType`/`scratchCardPrizes` handling from
both POST and PUT — a `LoyaltyProgram` create/update becomes purely the visits-threshold config (see
Phase 2, which reshapes the remaining fields further).

`src/app/api/business/requests/[requestId]/route.ts` line 133's `if (programType !== "VISITS") throw
new Error("INVALID_PROGRAM_TYPE")` guard is deleted outright — with no more `type` field, every
`LoyaltyProgram` is implicitly "VISITS-shaped," so this branch becomes dead code.

`src/app/api/customer/reward/instant-scratch/route.ts` is **deleted** — its entire premise (mint a
`Reward` from a bare mobile number, no gate) no longer has any legitimate purpose once Campaigns exist,
and per A1 scratch plays don't touch `Reward`/`Membership`/`LoyaltyProgram` at all going forward.

`src/app/api/customer/dashboard/route.ts` (the `/my-rewards` backing API) drops its
`loyaltyProgram.type === "VISITS"` branch entirely — it becomes unconditional "return visits progress
for this membership" (scratch-campaign history, if you want it surfaced on `/my-rewards` at all, is out
of scope for this plan since you didn't ask for it — flagging as an open decision below).

`JoinFlow.tsx` line 177's `if (program.type === "SCRATCH_CARD")` branch is deleted — the join page
becomes purely the existing VISITS submission flow, unconditionally (Campaigns are played from their
own separate `/campaign/[campaignToken]` page, never from `/join/[businessToken]`).

### (d) Open decisions
1. **The core one you flagged**: what happens to the 5 existing SCRATCH_CARD programs' *history*? My
   recommendation above is: pause the `LoyaltyProgram` (`isActive = false`) and leave the old
   `ScratchCardPrize`/`Reward` rows exactly where they are — visible only via direct DB/admin access,
   not resurrected as a Campaign automatically. I considered and am explicitly **not** recommending
   auto-creating a "Legacy Scratch Card (migrated)" `Campaign` + backfilling `CampaignPlay` rows from
   the old `Reward` data, because the old data doesn't fit the new model's invariant: the old
   `instant-scratch` endpoint had **no** one-play-per-number gate (that's Issue 1 from the original
   PLAN.md, now void, but the historical data it produced still reflects that gate-less history) — so a
   single mobile number could have multiple historical wins at the same business, which would collide
   with `CampaignPlay`'s new `@@unique([campaignId, mobileNumber])` constraint the moment I tried to
   backfill more than one per number. Forcing a fit would mean silently keeping only one win per number
   and dropping the rest — which is exactly the "silently drop data" outcome you told me to avoid. My
   recommendation avoids that by not attempting the backfill at all; the alternative is available if you
   want a "Legacy Campaign" to show up in the new list UI and are fine with that one-play-per-number
   caveat on the backfilled history — your call.
2. Should the 5 affected business owners see any in-app notice ("your scratch card feature has moved —
   set up a Campaign") the next time they log in? That's a product/copy decision, not a schema one — I
   can build a one-time dashboard banner if you want it, flagging since it wasn't specified.
3. Should `/my-rewards` (customer-facing, cross-business) ever show a customer's Campaign play history
   alongside their loyalty progress? Not asked for, not included in this plan — flagging as a natural
   follow-on if you want it later.

---

# PHASE 2 — Time-windowed loyalty thresholds (Part C)

## C1/C2 — Windowed counting, derived (not stored) progress

### (a) Confirmed current behavior
`Membership.currentVisits`/`totalVisits` (`prisma/schema.prisma` lines 201–202, re-confirmed) — the
approval transaction (`src/app/api/business/requests/[requestId]/route.ts` lines 116–122, 130,
154–158, re-confirmed this session) increments both on every approval and resets `currentVisits` to 0
the moment a reward is minted. `GET /api/customer/progress/route.ts` (re-confirmed, lines 51–53) reads
the stored `currentVisits` directly, with its own comment acknowledging this is a placeholder:
`"Compute progress: derived from approved visit requests or use stored counter. For now we use the
stored counter..."`. `Visit` (schema lines 251–267) has `visitedAt` (not `createdAt` — the model has no
separate `createdAt` field at all) and already has single-column indexes on `membershipId` and
`visitedAt` separately, but no composite index covering both together.

### (b) Why the current model can't support this
Exactly as you diagnosed: a reset-to-0 counter has no way to represent "aged out of a rolling window" —
it can only represent "has/hasn't been spent since the last reward," which is a fundamentally different
piece of information than "how many visits fall within the last N days as of right now." Confirmed
there is no other code path that would make this work without derivation from real `Visit` rows.

### (c) Proposed fix

**Schema:**
```prisma
enum WindowType {
  LIFETIME
  ROLLING
  FIXED_PERIOD
}

model LoyaltyProgram {
  ...
  requiredVisits Int         @default(10)
  windowType     WindowType  @default(LIFETIME)
  windowDays     Int?        // required (Zod-enforced) when windowType == ROLLING
  windowStartsAt DateTime?   // required (Zod-enforced) when windowType == FIXED_PERIOD
  ...
}

model Membership {
  ...
  // currentVisits REMOVED entirely — see reasoning below
  totalVisits Int @default(0) // KEPT — a pure lifetime tally, never needs to reflect a window
  ...
}

model Visit {
  ...
  @@index([membershipId, visitedAt])   // NEW composite index — the field is `visitedAt`, not
                                          // `createdAt` (Visit has no createdAt field at all)
}

model Reward {
  ...
  thresholdCycle   Int?     // which ordinal threshold-crossing this reward represents; null for
                             // non-threshold reward rows (including all historical SCRATCH_CARD rows)
  thresholdVisitId String?
  thresholdVisit   Visit?   @relation("ThresholdCompletingVisit", fields: [thresholdVisitId], references: [id], onDelete: SetNull)
  ...
  @@unique([membershipId, loyaltyProgramId, thresholdCycle])   // THE hard DB-level guard
}
```

**On `Membership.currentVisits`: delete it entirely**, agreeing with your lean, for a reason beyond
"avoid two sources of truth" — it's not just redundant, it's actively wrong the moment ROLLING or
FIXED_PERIOD exist, since a resettable running total cannot represent a window-scoped count under any
circumstances. Keeping it "for LIFETIME only" would mean the eligibility-check code has to branch on
windowType to decide whether to trust the stored field or recompute — two code paths for one concept,
which is worse than one code path that always recomputes. And LIFETIME mode doesn't actually need a
separate cached counter anyway: `totalVisits` (kept) already IS the lifetime visit count, and LIFETIME
eligibility becomes `totalVisits >= nextCycle * requiredVisits` — no extra query needed for LIFETIME,
one indexed `Visit.count()` query needed for ROLLING/FIXED_PERIOD.

**The DB-level "already rewarded" guard**: `@@unique([membershipId, loyaltyProgramId, thresholdCycle])`
on `Reward`. Postgres allows multiple `NULL`s in a unique index, so this only constrains actual
threshold-triggered rewards (the ones that set `thresholdCycle`), consistent with the same NULL-safety
pattern already used elsewhere in this schema (e.g. `Customer`'s `[businessId, mobileNumber]`). This is
windowType-agnostic by design — the constraint just says "you cannot have two rewards claiming the same
ordinal cycle for this membership+program," which the DB refuses to violate regardless of what bug or
race produced the attempt. The window-specific part (deciding, right now, whether the customer
currently qualifies for their *next* cycle) is necessarily an application-level computation — "now"
changes, so it can't be a static constraint — but the constraint guarantees that computation can never
produce a duplicate mint even if it's re-entered concurrently.

**Eligibility computation** (replacing the old `if (updatedMembership.currentVisits >= requiredVisits)`
block in the approval transaction), extracted into one shared helper (`src/lib/loyaltyProgress.ts`) so
the approval transaction (mint-time truth) and the read-only progress endpoints (display-time truth)
can never diverge — the exact kind of divergence this codebase has already produced once (Issue 6's two
business-update routes):

```ts
export async function computeThresholdEligibility(tx, membershipId, program) {
  const existingCount = await tx.reward.count({
    where: { membershipId, loyaltyProgramId: program.id, thresholdCycle: { not: null } },
  });
  const nextCycle = existingCount + 1;

  let qualifyingVisits: number;
  if (program.windowType === "LIFETIME") {
    const membership = await tx.membership.findUniqueOrThrow({ where: { id: membershipId } });
    qualifyingVisits = membership.totalVisits;
  } else {
    let lowerBound: Date;
    if (program.windowType === "ROLLING") {
      const rollingStart = new Date(Date.now() - program.windowDays! * 24 * 60 * 60 * 1000);
      const lastReward = await tx.reward.findFirst({
        where: { membershipId, loyaltyProgramId: program.id, thresholdCycle: { not: null } },
        orderBy: { thresholdCycle: "desc" },
        include: { thresholdVisit: true },
      });
      const anchor = lastReward?.thresholdVisit?.visitedAt ?? new Date(0);
      lowerBound = anchor > rollingStart ? anchor : rollingStart; // the later of the two
    } else {
      lowerBound = program.windowStartsAt!; // FIXED_PERIOD
    }
    qualifyingVisits = await tx.visit.count({ where: { membershipId, visitedAt: { gte: lowerBound } } });
  }

  return { nextCycle, qualifies: qualifyingVisits >= program.requiredVisits, qualifyingVisits };
}
```

The approval route then does:
```ts
const { nextCycle, qualifies } = await computeThresholdEligibility(tx, vr.membershipId, business.loyaltyProgram!);
if (qualifies) {
  reward = await tx.reward.create({
    data: { ..., thresholdCycle: nextCycle, thresholdVisitId: newVisit.id },
  });
}
```
If two concurrent approvals both compute `nextCycle = 3` before either commits (a real, possible race
with this count-then-create pattern), the second `tx.reward.create` throws `P2002` and its transaction
rolls back — the DB constraint is what actually closes this, not the application logic, exactly per your
priority on DB-level enforcement.

**Read-only progress endpoints** (`/api/customer/progress`, `/api/customer/dashboard`) call the same
`computeThresholdEligibility` (outside a transaction, via `prisma` directly instead of `tx`) to display
current standing without needing to touch `Reward` creation at all.

**Query performance**: the new `@@index([membershipId, visitedAt])` composite index makes the
ROLLING/FIXED_PERIOD `Visit.count({ where: { membershipId, visitedAt: { gte } } })` an efficient
indexed range scan rather than a full-table filter. LIFETIME mode needs no extra query at all
(`totalVisits` is already loaded with the membership).

### Migration plan — a genuinely critical detail I want to flag prominently

**Backfilling `thresholdCycle` on existing STANDARD rewards is mandatory, not optional, or this design
double-issues rewards.** Here's the failure mode I traced through: a membership with `totalVisits = 25`,
`requiredVisits = 10`, and 2 already-legitimately-redeemed historical rewards (from the old
reset-based system, which has no `thresholdCycle` value at all — it's a new column). If I don't backfill,
`existingCount` (rewards `WHERE thresholdCycle IS NOT NULL`) reads as 0 for this membership, so
`nextCycle = 1`, and the eligibility check `totalVisits(25) >= 1 * 10` is immediately true — meaning
their very next approved visit would mint **another** reward right away, even though by the true history
they aren't due again until `totalVisits` reaches 30. That's a real, costly bug (double-issuing rewards
customers already received) if the migration doesn't account for it.

**Migration fix**: as part of this same migration, backfill `thresholdCycle` on every existing
`Reward` row where `type = 'STANDARD'` (explicitly excluding the 10 historical `SCRATCH_CARD` rows,
which never had cycle semantics), numbered `1, 2, 3, ...` in `createdAt` order, grouped by
`(membershipId, loyaltyProgramId)`. `thresholdVisitId` is left `NULL` on these backfilled rows — the old
system never tracked which specific `Visit` completed a given cycle, and `NULL` is the honest
representation of that missing information. The only consequence of a `NULL` anchor is in ROLLING
mode's "greatest of (rolling-window-start, last cycle's anchor)" calculation, where it falls back to
`new Date(0)` (i.e., "no anchor, count everything in the rolling window") — a safe default that only
matters for a business that later *switches* an existing program to ROLLING mode, and self-corrects
after that program's first ROLLING-mode cycle completes and sets a real anchor.

### (d) Open decisions
1. **Do ROLLING and FIXED_PERIOD repeat, or are they one-shot goals?** Your spec doesn't disambiguate
   this, and it changes the design materially. My proposed default: **both repeat**, matching how a
   real punch-card loyalty program behaves (LIFETIME already repeats every `requiredVisits` today —
   I'm not changing that expectation for the other two modes without being told to). For ROLLING, this
   needs the anchor-based re-qualification logic above (otherwise a business with a rolling window that
   already has ≥N visits sitting in it would re-trigger a reward on every single subsequent visit,
   which is clearly wrong). For FIXED_PERIOD, repetition is not implemented via extra code — it emerges
   naturally: since `windowStartsAt` is a static date, cycle 2 can only fire once `requiredVisits` *new*
   visits accumulate since that same fixed date, which in practice means a `FIXED_PERIOD` program stays
   at "cycle 1, earned once" until the owner manually moves `windowStartsAt` forward to relaunch a fresh
   challenge — I think that's the right emergent behavior, but confirm it matches what you meant by
   "fixed period," since an alternative reading is "this is a one-time campaign-style goal, period,
   full stop, no relaunch mechanism at all" (which would need an explicit hard block instead).
2. **Recommend deferring C3 (multiple milestones per program).** Reasoning: it's a materially separate
   feature — a list of tiers, per-tier reward configuration, per-tier progress UI on the join page and
   `/my-rewards`, per-tier analytics — none of which is required to fix C2's actual architectural
   problem (the stored, resettable counter). Bundling it now would roughly double this phase's surface
   area for a capability you haven't yet said is needed beyond "assess whether to include it." The
   design above is deliberately structured so a future `Milestone` model is a clean additive change, not
   a rework: today's guard is `@@unique([membershipId, loyaltyProgramId, thresholdCycle])`; a future
   multi-milestone version would just need `@@unique([membershipId, milestoneId, thresholdCycle])`
   instead, reusing the identical pattern. If you want multi-milestone in this same phase after all,
   say so and I'll redesign around a `Milestone` model instead — but my honest recommendation is: ship
   the single-threshold windowing fix first, since it's the part with real architectural risk (the
   double-issue bug above), and treat multi-milestone as its own follow-up phase.
3. `LoyaltyProgramSchema`/the owner-facing create/edit forms need a `windowType` selector
   (Lifetime/Rolling/Fixed Period) replacing the old Visits/Scratch-Card selector that Phase 1 already
   removed — I'll build this as part of implementation, flagging only that the exact UI copy/layout for
   "since [date picker]" vs. "in the last [N] days" isn't specified anywhere and I'll use my judgment
   unless you want to review it first.

---

# PHASE 3 — D4: Wire up Google Review + Instagram

### (a) Confirmed current behavior
`GoogleReviewModal.tsx` and `InstagramButton.tsx` re-read in full this session, unchanged from the
original audit: `GoogleReviewModal` needs `membershipId`, `businessName`, `googleReviewUrl`,
`currentVisits`, `reviewPromptedAt`, and calls `POST /api/customer/membership/${membershipId}/review-prompt`
on both the "review" and "dismiss" actions — confirmed again this route does not exist anywhere under
`src/app/api/customer/`. Confirmed (grep) neither component is imported by any other file in the repo.
`src/app/join/[businessToken]/page.tsx` already fetches the full `Business` row (including
`instagramHandle`/`googleReviewUrl`) but `JoinFlow.tsx`'s `business` prop type only declares
`{ id, name }` — the data exists one level up and is simply not passed down.

### (c) Proposed fix
Same placement recommendation as before, re-affirmed: render both on `/join/[businessToken]` via
`JoinFlow.tsx`, once `progress?.exists === true` — this is where the customer has already identified
themselves for this specific business, which matches what these components are built for (a
single-business prompt), versus `/my-rewards`'s multi-business aggregate view.

Concrete changes, now sequenced *after* Phase 2 (so this only needs to touch the progress endpoint's
final shape once):
- `JoinFlow.tsx`'s `business` prop gains `instagramHandle: string | null` and
  `googleReviewUrl: string | null` (both already available in the parent server component, just not
  threaded through).
- `GET /api/customer/progress/route.ts` gains `membershipId` and `reviewPromptedAt` to its response
  (both trivially available since the route already loads the `membership` row).
- `JoinFlow.tsx` renders `<GoogleReviewModal>` once `progress?.exists === true`.
- New route: `POST /api/customer/membership/[membershipId]/review-prompt/route.ts` — no body, updates
  `Membership.reviewPromptedAt = new Date()`, 404 if the membership doesn't exist, 200 otherwise. Same
  no-customer-auth trust model as every other `/api/customer/*` route today (nothing new is weakened by
  this route — it's exactly as trusting as `claim-code` already is, and it's a low-value write, a
  timestamp, not money or a prize).

### (d) Open decisions
1. Same as before: is `/join/[businessToken]` (visited transactionally, once per store visit) really
   the right long-term home versus a future "my membership at Business X" detail view off
   `/my-rewards`? I'm recommending the join page for minimal scope against what's reachable today —
   confirm before I build it here.

---

# PHASE 4 — D1 → D2: Real bill upload, then duplicate-bill prevention

## D1 — Real bill upload

### (a) Confirmed current behavior
Re-confirmed this session, byte-for-byte unchanged: `JoinFlow.tsx`'s bill step is a plain
`<input type="text">` labeled "Bill Photo URL (For Demo)"; `POST /api/customer/visit` stores whatever
string arrives, verbatim, as `VisitRequest.billImagePath`; `uploadBillImage()` in `src/lib/storage.ts`
has zero callers anywhere in the repo (confirmed by grep again); `VisitRequestButton.tsx` (re-read in
full) has real file-picker UI and client-side validation but posts to
`/api/customer/bill-upload`/`/api/customer/verification-request`, neither of which exists.

### (c) Proposed fix
Per your direction, **adapt and reuse `VisitRequestButton.tsx`** rather than rebuilding from scratch —
concretely, this means:
- Point its existing `handleBillUpload()` at `POST /api/customer/visit` (adapted to accept
  `multipart/form-data`) instead of the nonexistent `/api/customer/bill-upload`, and its
  `handleVisitConfirmation()` at the same route instead of the nonexistent
  `/api/customer/verification-request` — i.e., collapse its two-endpoint design down to the one real
  endpoint that already does customer-upsert + membership-upsert + `VisitRequest`-creation atomically.
  Its existing client-side validation (`ALLOWED_TYPES`, `MAX_BYTES = 5MB`) is kept as-is (good UX, not
  the security boundary — the server-side check below is).
- `VisitRequestButton` currently assumes a pre-existing `membershipId` prop (from a flow where the
  customer already has a membership record before uploading). `JoinFlow.tsx`'s actual flow doesn't have
  a membership yet at the point the bill step renders — it's created in the same call as the
  `VisitRequest`. So `VisitRequestButton` needs its props changed from `membershipId` to whatever
  `JoinFlow` already collects (`mobileNumber`, `enteredName`, `businessId`), and it becomes the
  component `JoinFlow.tsx` renders for its BILL-method step, replacing the current inline
  `<input type="text">` block, rather than a separately-reachable component with its own membership
  precondition.
- `POST /api/customer/visit` starts accepting `multipart/form-data` (`await request.formData()`)
  uniformly (even `VISIT_CONFIRMATION` submissions just omit the file field) — one content-type
  handling path, not two.
- Server-side validation before touching storage: same MIME/size checks `VisitRequestButton` already
  has client-side, now **also enforced server-side** (the whole point of this fix — the current flow is
  bypassable by calling the API directly with any string).
- **Storage path convention**: I looked for an existing convention in `uploadBillImage()`/
  `getBillViewUrl()` (`src/lib/storage.ts`, re-read this session) to follow, per your instruction — there
  isn't one to extract, because there are currently zero real callers. Both functions are convention-
  agnostic: whatever string you pass as `storagePath` is used identically as the Supabase object key
  (within the `"bills"` bucket, from `getSupabaseBucket()` in `src/lib/supabase.ts`) and as the relative
  path under `public/uploads/bills/` for the local fallback. The only actual constraint implied by the
  code is "a relative, hierarchically-nestable string, no leading slash" (`ensureLocalDir` does
  recursive `mkdir`). Within that latitude, I'll use `${businessId}/${customer.id}/${cuid()}.${ext}` —
  flagging this as a choice I'm making in the absence of a real precedent, not a discovered convention.
- Only called when `verificationMethod === "BILL"`; `VISIT_CONFIRMATION` stays exactly as today (no
  file, `billImagePath` stays `null`).

### (d) Open decisions
1. Confirmed you want `VisitRequestButton.tsx` adapted in place (props changed, endpoints repointed)
   rather than left as a separate, still-dead component with a new one built alongside it — that's what
   I'm doing above.
2. `uploadBillImage()`'s local-disk fallback becomes load-bearing for the first time the moment this
   route actually calls it (today it has zero callers, so its "never throw, fall back to local disk"
   contract — which `CLAUDE.md` explicitly says must be preserved — is purely theoretical). On a
   typical serverless deployment (Vercel), that local fallback's writes may not persist across cold
   starts/deploys. I'm not proposing to change the never-throw contract, but flagging that this is the
   moment that theoretical risk becomes real, in case you want logging/alerting added when the fallback
   path is actually taken (today it's just a `console.warn`).

## D2 — Duplicate-bill prevention (now in scope for this phase, not deferred)

### (a) Confirmed current behavior
`VisitRequest` (schema lines 222–245, re-confirmed) has no `billNumber` field, no hash field, no
uniqueness constraint touching bill identity at all. No hashing library exists in `package.json`
(re-confirmed).

### (c) Proposed fix

**Schema:**
```prisma
model VisitRequest {
  ...
  billNumber    String?   // required (Zod-enforced) when method == BILL; null for VISIT_CONFIRMATION
  billImageHash String?   // perceptual hash (dHash), hex-encoded; required when method == BILL
  ...
  @@unique([businessId, billNumber])       // Postgres allows multiple NULLs — only binds BILL rows
  @@unique([businessId, billImageHash])    // same NULL-safety
}
```

**Perceptual hashing**: `sharp` (a single, well-maintained native image library — not a current
dependency) to decode the buffer, downscale to a small grayscale grid, and compute a difference hash
(dHash) by hand against its raw pixel output — no separate hashing package needed on top of it. A
cryptographic hash (SHA-256 of raw bytes) would only catch literal byte-identical re-uploads; the
realistic fraud case (the same physical receipt re-photographed/recompressed) needs a perceptual hash
robust to minor pixel-level variance.

**On the "DB-level enforcement" tension I need to be upfront about**: a `@@unique` constraint can only
catch *exact* hash-string matches. Real dHash-based duplicate detection normally works by
Hamming-distance comparison (flag near-matches, not just identical strings), which is inherently a
"query, compute distance, decide" operation — not something Postgres's native `UNIQUE` can express
without either an extension or a fixed-width `bit`/`bytea` column plus native bit-difference functions
(version-dependent on the Supabase-hosted Postgres version, unconfirmed). Given this, the design is:
- **Tier 1 (hard, DB-enforced)**: `@@unique([businessId, billImageHash])` — catches exact-hash
  duplicates. A true guarantee, no race window, `P2002` on violation.
- **Tier 2 (soft, application-level)**: a pre-insert query comparing the new hash's Hamming distance
  against this business's recent hashes, catching near-matches under a threshold.

**On your instruction "flag for owner review rather than silently auto-reject" — this changes the
design from PLAN.md v1 in an important way**: a Tier 1 exact-hash collision or a Tier 2 near-match no
longer causes an automatic `409` rejection. Instead, the `VisitRequest` is still created (status
`PENDING`, as normal), but flagged — I propose a new field `VisitRequest.duplicateSuspected: Boolean
@default(false)` (plus optionally `duplicateOfRequestId: String?` pointing at the prior request it
matched), surfaced in `BusinessRequestsPanel.tsx` as a visible warning badge on that request so the
owner sees it before approving, rather than the system deciding unilaterally. The `@@unique` constraint
on `billImageHash` therefore can **not** be a hard insert-time rejection anymore (a genuine DB unique
violation would reject the second submission outright, contradicting "flag for review") — so Tier 1
needs to change shape: instead of a hard `@@unique` that blocks the insert, I'd run the same
exact-hash-match query as a pre-check (same as Tier 2), and set `duplicateSuspected = true` on the new
row when a match is found, letting the insert proceed either way. This means **neither tier can be a
true hard DB constraint anymore** once "flag for review" replaces "reject" — the DB-level guarantee I
can still offer is different in kind: not "the DB refuses a duplicate," but "the duplicate is
detected and recorded before the owner ever sees the request," with the detection query itself backed
by the `billImageHash`/`billNumber` columns and indexes so it can't silently be skipped by a route that
forgets to call it (I'd still index `billNumber`/`billImageHash` per business, just not as a blocking
uniqueness constraint). I want to flag this explicitly since it's a real shift from "prioritize DB-level
enforcement" toward "the owner is the final arbiter" — both are reasonable, but they're in tension, and
I've resolved it in favor of your explicit instruction here rather than the general DB-priority
principle, since this is a case where you told me which wins.

**Ordering** (cost-avoidance, unchanged from PLAN.md v1's reasoning): compute the hash from the
in-memory buffer *before* calling `uploadBillImage()` — `sharp` operates on the buffer directly, no
need to upload first to hash it. Route order: validate type/size → compute `billImageHash` → run the
duplicate pre-check (bill number match + hash Hamming-distance match) → call `uploadBillImage()`
regardless of match → create `VisitRequest` with `duplicateSuspected` set accordingly.

### (d) Open decisions
1. **Given "flag for review" instead of "reject," do you still want `billNumber` uniqueness to be a
   hard DB constraint, or should it also become a soft flag** (matching the image-hash treatment,
   consistent behavior between the two checks)? I'd lean toward making both soft flags for
   consistency — having one check hard-reject and the other only warn would be a confusing, inconsistent
   customer experience (one type of duplicate silently blocked, the other allowed through with a
   warning). Confirm which you want.
2. Hamming-distance threshold for Tier 2 near-matches, and how far back to search ("all of this
   business's history" vs. "the last N days") — not specified, needs your input before I pick a number
   that could produce false positives (wrongly flagging a legitimate second visit's bill) or false
   negatives (missing real duplicates).
3. Adding `sharp` as a new dependency — it's a native binary dependency (prebuilt per-platform
   binaries), heavier than this stack's current pure-JS dependencies. Confirm you're fine with that.

---

# PHASE 5 — D5: Settings silently drops fields

### (a) Confirmed current behavior
Re-confirmed this session, unchanged: `PUT /api/business/account` (`src/app/api/business/account/route.ts`
lines 14–21) writes only `name`, `googleReviewUrl`, `instagramHandle` to the database, despite
`BusinessSettingsClient.tsx` sending all six fields and `BusinessUpdateSchema` validating all six.
`PUT /api/business` (`src/app/api/business/route.ts`) is a second, separate route that only ever
updates `name`, called only by `BusinessDashboardTabs.tsx`'s inline rename form (confirmed via grep —
`fetch("/api/business"` appears only there; no client code calls `GET /api/business` at all, confirmed
again — every server component that needs business data queries Prisma directly).

### (c) Proposed fix
Same as PLAN.md v1, re-affirmed: (1) make `PUT /api/business/account` write all six fields it already
validates; (2) consolidate — `BusinessDashboardTabs.tsx`'s quick-rename calls the same
`PUT /api/business/account` route instead of `PUT /api/business`, with `BusinessUpdateSchema` relaxed
so every field but `name` is optional (partial-update semantics: omitted fields are left unchanged, not
overwritten with `null`); the `PUT` handler in `src/app/api/business/route.ts` is deleted (its `GET`
handler stays, since removing it isn't part of what you asked and it's harmless, just unused).

### (d) Open decisions
1. Confirmed no change from PLAN.md v1's open decision here: partial-update semantics (send only what
   changed) vs. requiring the full six-field payload every time. I'm defaulting to partial-update.

---

# PHASE 6 — D7: UI reads nonexistent Customer.email

### (a) Confirmed current behavior
Re-confirmed this session with exact current line numbers:
- `BusinessMembersPanel.tsx` line 20 (`interface MemberItem { ... email: string; ... }`) and line 115
  (`<p ...>{m.email}</p>`) — its backing route, `GET /api/business/members`
  (`src/app/api/business/members/route.ts` line 89), returns `mobileNumber`, never `email`.
- `BusinessRewardsPanel.tsx` line 13 (`customer: { name: string; email: string }`) and line 91
  (`{r.customer.email}`) — its backing route, `GET /api/business/rewards`
  (`src/app/api/business/rewards/route.ts` line 31), selects `{ name, mobileNumber }`, never `email`.
- `BusinessAnalyticsPanel.tsx` line 35 (`customerEmail: string`) and line 229
  (`{item.customerEmail}`) — its backing route, `GET /api/business/analytics`
  (`src/app/api/business/analytics/route.ts`), returns `customerMobile` at lines 120/132/143/155,
  never `customerEmail`.

`Customer` (schema lines 99–116) has never had an `email` field — only `name` and `mobileNumber`.

### (c) Proposed fix
Purely a UI fix, no schema or route changes needed (the routes already return the right data under a
different name): rename `m.email` → `m.mobileNumber` (and the `MemberItem` interface field) in
`BusinessMembersPanel.tsx`; rename `customer.email` → `customer.mobileNumber` (and the inline type) in
`BusinessRewardsPanel.tsx`; rename `item.customerEmail` → `item.customerMobile` (and the
`TimelineItem` interface field) in `BusinessAnalyticsPanel.tsx`.

### (d) Open decisions
None — this one's unambiguous.

---

# PHASE 7 — D6: Broken test / stale scratch scripts

### (a) Confirmed current behavior
`scratch/fix2.js` still exists (confirmed via `test -f` this session) — re-read in full previously,
unchanged: references `UserRole`, `prisma.verificationRequest`, and a `RewardCard` `onReveal` prop that
no longer exist anywhere in the current codebase. `src/__tests__/scratch-card-dashboard.test.ts`
(re-read in full this session) still imports `UserRole` from `@prisma/client` on line 3 (unused
elsewhere in the file) and its one test exercises `PUT /api/business/loyalty` with a payload keyed on
`type: "SCRATCH_CARD"`, asserting the program's `type` doesn't revert to `VISITS` on edit — a test
guarding a mechanism Part A has now removed entirely. I additionally found, re-reading
`src/__tests__/my-rewards.test.ts` this session, that it **also** creates fixtures with
`type: "VISITS"`/`type: "SCRATCH_CARD"` (lines 31, 49) and asserts on `data.memberships[].programType`
and a `wins` array (lines 136–151) — this file will break the moment Phase 1's schema change lands, and
wasn't called out in your D6 description, but is affected by the exact same root cause. Flagging it here
rather than letting it surface as a surprise later.

### (b) Why it's a problem, and what running the actual commands shows
Unchanged from my prior verification (re-confirming the methodology, not re-running the commands this
session since nothing about the build/test infrastructure itself has changed): `npx tsc --noEmit` fails
on the `UserRole` import in isolation; `npm run build` does **not** fail because of it (Next's build-time
type-checking doesn't reach `src/__tests__/**`); `npm run test` fails, but for an unrelated reason — DB
hook/test timeouts (`scratch-card-dashboard.test.ts`'s test hit a 5000ms timeout, `my-rewards.test.ts`'s
`afterAll` hook hit a 10000ms timeout), not the bad import (Vitest's esbuild transform doesn't
type-check, and the import is never actually referenced again in the file, so it's a silently-inert
dead import at runtime).

### (c) Proposed fix
- `scratch/fix2.js`: **delete**, per your confirmation — it's already-executed, one-off, and every
  target it references has moved on.
- `src/__tests__/scratch-card-dashboard.test.ts`: **delete**, not rewrite. Given Part A voids the exact
  feature this test covers (`LoyaltyProgram.type = SCRATCH_CARD` no longer exists at all after Phase 1),
  there's no smaller "fix" available — any replacement coverage would be a new test for a different
  thing (e.g. "editing a program preserves `windowType`" for Phase 2, or "editing a campaign preserves
  its prizes" for Phase 1's Campaign routes), not a patch to this one. I'd recommend writing a fresh,
  small regression test alongside Phase 2's `windowType`-preservation-on-edit logic if you want ongoing
  coverage for the pattern this test was originally guarding (the historical bug it protected against —
  silently reverting a program's mode on edit — is exactly the shape of bug the new `windowType` field
  could reintroduce) — flagging as optional additional scope, not assuming you want it.
- `src/__tests__/my-rewards.test.ts`: needs updating (not deletion) as a **mandatory** part of Phase 1 +
  Phase 2's implementation, not deferred to this phase — its fixtures and assertions must track whatever
  `/api/customer/dashboard`'s new response shape becomes once scratch-card branching is removed from it
  (Phase 1) and progress becomes windowed (Phase 2). I'm calling this out here for visibility, but the
  actual fix happens as part of those phases' implementation, not as separate follow-up work.
- **What it would take to get `npm run test` passing at all**: the DB-timeout failures are unrelated to
  any of the code changes in this plan — they're either genuine database latency from this session's
  environment reaching the Supabase-hosted Postgres instance, or Vitest's default timeouts (5000ms
  test / 10000ms hook, both configurable in `vitest.config.ts`, currently unset so they use Vitest's
  built-in defaults) being too tight for real network round-trips to a remote database. The fix would be
  raising those timeouts in `vitest.config.ts` (`testTimeout`/`hookTimeout`) and re-running to see if
  that alone resolves it, or investigating actual connection latency if it doesn't. This is a real,
  reproducible problem, but it's infrastructure/config, not something any of the code changes in this
  plan touch — I'm not including a fix for it in this plan unless you want me to.

### (d) Open decisions
1. Confirm deletion of `scratch-card-dashboard.test.ts` (vs. some other disposition) — I think deletion
   is clearly right here since PLAN.md v1's original hedge ("maybe rewrite") no longer applies once the
   feature itself is gone, but flagging since deleting a test file is a call worth confirming explicitly.
2. Do you want the `vitest.config.ts` timeout bump included as a small, separate fix in this same body
   of work (low-risk, one-line config change, unblocks `npm run test` actually passing so I can verify
   each phase the way you asked), or left alone entirely? I'd lean toward yes, given you've asked me to
   run and report actual test output after each phase — if the suite can't complete due to timeouts
   unrelated to my changes, I can't give you a clean signal either way, so I'd like your go-ahead to at
   least raise the timeout numbers even though it's outside the original D6 scope.

---

Stopping here per your instruction. Waiting for your review before implementing anything.
