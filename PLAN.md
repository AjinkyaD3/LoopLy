# Looply — Remediation Plan for Issues 1–7

Diagnosis and design only. Nothing in this document has been implemented. Every "current behavior"
claim below was re-verified against the live files in this session (not copied from WORKING.md) —
file paths and line references are cited. Where I actually ran a command to verify a claim (Issue 7),
that's called out explicitly.

## Dependency ordering (why the sections below are in this order, not the issue numbering above)

```
Issue 4 (independent program-mechanism toggles)
   └──▶ Issue 1 (scratch-card gated by approved Visit — needs Issue 4's model to exist,
                  because today SCRATCH_CARD programs have no visit/approval flow at all)

Issue 2 (real bill upload)
   └──▶ Issue 3 (duplicate-bill detection — needs a real uploaded image/typed bill number
                 to hash/constrain; nothing to hash today)

Issue 6 (settings persistence)      — independent, no dependencies
Issue 5 (Google Review/Instagram)   — independent, only needs a small customer/progress route change
Issue 7 (test + script cleanup)     — import-fix is independent/do-anytime; the deeper rewrite of
                                       scratch-card-dashboard.test.ts's assertions must happen
                                       together with Issue 4 (it currently tests the `type` field
                                       that Issue 4 removes) — doing it separately means rewriting
                                       it twice
```

Sections are ordered: **4 → 1 → 2 → 3 → 6 → 5 → 7**, matching this graph. 4 and 1 form one hard
chain; 2 and 3 form a second, independent chain; 6 and 5 have no dependencies and are placed after
the two correctness-critical chains only for narrative flow, not because they must wait; 7 is last
because its full fix is entangled with 4.

---

## Issue 4 — VISITS and SCRATCH_CARD are mutually exclusive per program

### (a) Confirmed current behavior

Re-read `prisma/schema.prisma` lines 38–46 and 155–175 directly. Current shape:

```prisma
enum ProgramType { VISITS  SCRATCH_CARD }
enum RewardType  { STANDARD  SCRATCH_CARD }

model LoyaltyProgram {
  type               ProgramType        @default(VISITS)   // <- the exclusivity switch
  requiredVisits     Int                @default(10)
  rewardTitle        String
  rewardDescription  String
  rewardValidityDays Int                @default(30)
  verificationMethod VerificationMethod @default(VISIT_CONFIRMATION)
  rewardType         RewardType         @default(STANDARD) // <- separate, parallel enum
  isActive           Boolean            @default(true)
  scratchCardPrizes  ScratchCardPrize[]
}
```

Confirmed every branch point in the live code keys off `type`, never `rewardType`:
- `src/components/JoinFlow.tsx` line 177: `if (program.type === "SCRATCH_CARD") { /* entirely different UI: instant-play form, no visit submission at all */ }` vs. the VISITS branch (submit-and-wait form).
- `src/app/api/customer/reward/instant-scratch/route.ts` line 20: `if (!program || program.type !== "SCRATCH_CARD" ...)`.
- `src/app/api/business/requests/[requestId]/route.ts` line 133: `if (programType !== "VISITS") { throw new Error("INVALID_PROGRAM_TYPE"); }` inside the reward-mint branch.
- `src/components/BusinessDashboardTabs.tsx` and `src/app/business/loyalty/create/page.tsx` both drive a single `programType` radio ("Visits Threshold" **or** "Instant Scratch Card") — the UI itself has no concept of "both."

Confirmed `rewardType` is never set by any form (`BusinessSetupForm.tsx`, `create/page.tsx`,
`BusinessDashboardTabs.tsx`, `BusinessSettingsClient.tsx` — grepped all four, none include `rewardType`
in their POST/PUT payloads), so it sits at its Zod/Prisma default (`STANDARD`) for every program ever
created through the live UI, except where a reward row's own `type` is set explicitly at creation time
(`instant-scratch/route.ts` line 80 hardcodes `type: "SCRATCH_CARD"` on the `Reward` it creates,
independent of the program's `rewardType`).

### (b) Why it's a problem

`type` conflates two things that should be independent: *which reward mechanism(s) a program runs*
and *what a given VisitRequest's verification looks like*. Because it's a single enum, a business
cannot run "collect visits toward a free item" and "instant scratch card on every visit" at the same
time — they're the exact same field. Turning one on requires turning the other off, destructively (see
Issue 1 — SCRATCH_CARD programs today don't even create `Visit`/`VisitRequest` rows). This directly
blocks the product requirement: both mechanisms running simultaneously, independently toggleable,
without losing configured data (existing prizes, `currentVisits`, unredeemed rewards) when toggling.

### (c) Proposed fix

Replace `type` (`ProgramType`) and `rewardType` (`RewardType`, at the `LoyaltyProgram` level only —
`Reward.type` stays, see below) with two independent booleans:

```prisma
model LoyaltyProgram {
  id                 String             @id @default(cuid())
  businessId         String             @unique
  business           Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  programName        String

  visitsEnabled       Boolean @default(true)   // was: type == VISITS
  scratchCardEnabled  Boolean @default(false)  // was: type == SCRATCH_CARD

  requiredVisits     Int                @default(10)   // meaningful only while visitsEnabled
  rewardTitle        String                             // milestone claim-code reward's title
  rewardDescription  String                             // milestone claim-code reward's description
  rewardValidityDays Int                @default(30)    // shared expiry window (see open decision)
  verificationMethod VerificationMethod @default(VISIT_CONFIRMATION) // how a Visit is verified, applies regardless of which reward mechanism(s) are on
  isActive           Boolean            @default(true)
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  rewards            Reward[]
  scratchCardPrizes  ScratchCardPrize[]  // meaningful only while scratchCardEnabled; rows persist when disabled

  @@index([businessId])
}
```

`RewardType` enum is **not** deleted — `Reward.type` (per-reward-row, not per-program) still needs to
distinguish a `STANDARD` (claim-code) reward from a `SCRATCH_CARD` reward, and that distinction remains
meaningful and correct at the `Reward` level. Only the redundant `LoyaltyProgram.rewardType` column is
dropped — it was never anything but a mostly-unused shadow of `type`.

`ProgramType` enum is dropped entirely (no other model references it after this change).

**Migration for existing rows** (so no program silently loses its current behavior):

```sql
ALTER TABLE "LoyaltyProgram" ADD COLUMN "visitsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LoyaltyProgram" ADD COLUMN "scratchCardEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "LoyaltyProgram" SET
  "visitsEnabled"      = ("type" = 'VISITS'),
  "scratchCardEnabled" = ("type" = 'SCRATCH_CARD');

ALTER TABLE "LoyaltyProgram" DROP COLUMN "type";
ALTER TABLE "LoyaltyProgram" DROP COLUMN "rewardType";
DROP TYPE "ProgramType";
-- "RewardType" is NOT dropped — still used by Reward.type
```

Every existing row ends up with exactly the flags matching its current `type` — a VISITS program
becomes `visitsEnabled=true, scratchCardEnabled=false`; a SCRATCH_CARD program becomes the inverse.
Zero behavioral change for existing programs at migration time; the new capability (both true at once)
is opt-in going forward.

**Validation change**: `LoyaltyProgramSchema` (`src/lib/validations/index.ts`) currently `superRefine`s
prize-count requirements off `data.type === "SCRATCH_CARD"`; change the condition to
`data.scratchCardEnabled === true`. Drop `type`/`rewardType` fields from the schema, add
`visitsEnabled`/`scratchCardEnabled` (both `z.boolean()`, sensible defaults).

**API/UI surfaces that must change to stop assuming exclusivity**: `POST`/`PUT /api/business/loyalty`
(read/write both flags instead of `type`), `create/page.tsx` and `BusinessDashboardTabs.tsx` (replace
the single radio-button "Visits vs Scratch Card" choice with two independent toggles/checkboxes, each
revealing its own config section when on), `JoinFlow.tsx` (its current `if (program.type ===
"SCRATCH_CARD") { ...totally separate UI... }` branch has no correct replacement as a simple `if` — see
Issue 1(c), since the customer-facing flow itself needs to become one unified "submit a visit" flow
whose *result* may include a milestone reward and/or a scratch result, rather than two mutually
exclusive screens).

### (d) Open decisions needing your input

1. **Naming** — I used `visitsEnabled`/`scratchCardEnabled` to match the codebase's existing
   vocabulary (`requiredVisits`, "Visits Threshold" in the UI). Your issue text suggested
   `milestonesEnabled` as an example name. I'd recommend `visitsEnabled` for consistency with existing
   field/UI names, but flagging since you may have a reason to prefer "milestone" terminology
   (e.g. if you're planning multiple milestone tiers later, "milestones" reads better as a future-proof
   name than "visits"). Confirm which name you want before I touch the schema.
2. **Can both flags be false simultaneously?** Today `isActive` already lets an owner pause a program
   entirely. Should the API additionally *require* at least one of `visitsEnabled`/`scratchCardEnabled`
   to be true (i.e. a program must have at least one live mechanism), or is "both off, program
   effectively dormant but not `isActive:false`" an acceptable state? I'd default to requiring at least
   one, but this is a product call.
3. **Shared vs. separate `rewardValidityDays`** — this single field currently governs the expiry of
   *both* the milestone claim-code reward and (post-Issue-1) the scratch-card reward. Once both can be
   active simultaneously, does the business need independent validity windows per mechanism (e.g.
   "scratch prizes expire in 7 days, milestone rewards in 30")? I'd default to keeping it shared for
   now (simpler schema, matches what exists today) unless you tell me these need to diverge.
4. **Program-level "headline" for the scratch mechanism** — `rewardTitle`/`rewardDescription` are
   currently reused as dual-purpose copy ("Reward Benefit" for VISITS, "Card Title" for SCRATCH_CARD,
   per `BusinessDashboardTabs.tsx` line 311). Once both mechanisms can run at once, one field can't
   label both. Individual `ScratchCardPrize` rows already carry their own `title`/`description`, so
   functionally nothing breaks if I leave `rewardTitle`/`rewardDescription` scoped to the milestone
   reward only and drop them as scratch-card copy — but that changes what currently displays as the
   scratch card's headline. Confirm whether you want a separate `scratchCardTitle`/
   `scratchCardDescription` pair added, or whether dropping the dual-purpose reuse is fine.
5. **The JoinFlow UI split** (see Issue 1(c)) is really a consequence of this issue — flagging here too
   since it's the biggest visible product-shape decision in this whole plan: what does the customer
   see on the join page when a business has both mechanisms on at once?

---

## Issue 1 — Scratch cards have no gate at all

### (a) Confirmed current behavior

Re-read `src/app/api/customer/reward/instant-scratch/route.ts` in full. Confirmed:
- Takes only `{ mobileNumber, businessId, name }` in the POST body — no `visitId`, no
  `verificationRequestId`, nothing tying the call to any prior evidence of a purchase.
- Runs one `$transaction`: loads `LoyaltyProgram` + `scratchCardPrizes`, validates
  `type === "SCRATCH_CARD"` and `isActive` and prize-count 3–10, **upserts `Customer` and
  `Membership` from scratch if they don't exist** (lines 29–54 — meaning a brand-new phone number with
  zero history at this business can call this endpoint and immediately win), performs a weighted
  `Math.random()` draw over `scratchCardPrizes`, and creates a `Reward` with `status: "REDEEMED"`
  immediately (line 79 — already redeemed at creation, no separate claim step).
- No rate limiting (`src/lib/rate-limit.ts`'s `checkRateLimit` is only used by
  `/api/auth/register` and `/api/auth/login` — confirmed by grep, not used here).
- No cooldown/per-day check of any kind (unlike `POST /api/customer/visit`, which has the
  one-pending-request-per-day guard).
- Confirmed via `prisma/schema.prisma`: `Reward` has no FK to `Visit` at all — only shares
  `membershipId`/`businessId`/`customerId` scalars, no relation that could constrain "one reward per
  visit."

This matches the issue description exactly: any caller who knows a `businessId` (which is not secret —
it's returned in the public join-page payload and visible in network requests) can mint and
auto-redeem real prizes, unlimited times, for fabricated mobile numbers, with zero connection to an
actual purchase.

### (b) Why it's a problem

- **Direct cost to the business**: every call is a free, real prize (coffee, discount, item) the
  business is now on the hook to honor if the customer shows the "Reward Claimed!" screen — with no
  visit, no purchase, no verification behind it.
- **Trivially automatable**: no auth, no rate limit, no cooldown — a script can hit this in a tight
  loop with incrementing fake phone numbers and drain a business's prize pool of scratch results.
- **No detection surface**: because `Customer`/`Membership` rows are upserted fresh on every call, this
  doesn't even show up as "one suspicious customer with an anomalous number of wins" — it looks like
  many distinct new customers, each playing once, which is exactly what legitimate organic growth looks
  like in the existing analytics (`BusinessAnalyticsPanel.tsx`'s "Club Members" / "repeat rate" metrics
  would not flag this pattern).

### (c) Proposed fix, and the "same code path or separate + shared constraint" question

**Recommendation: unify.** Move scratch-card reward generation into the same transaction as
`PATCH /api/business/requests/[requestId]` (visit approval), gated by
`business.loyaltyProgram.scratchCardEnabled`. Do not keep it as a separate customer-callable endpoint.

**Why a shared DB constraint alone is not enough, and why "stay separate" doesn't actually work:**
A unique constraint (e.g. `Reward.visitId @unique`) only prevents a *second* scratch reward from
attaching to a `Visit` that already has one — it does nothing to prevent the constraint's counterparty,
the `Visit` row itself, from being fabricated or entirely absent. The real hole is "no Visit is required
at all," not "a Visit could be double-spent." Closing that requires the *only* way to mint a
scratch-card reward to be through code that already has a real, approved `Visit` in hand — and today,
the only code path that produces a real, approved `Visit` is the visit-approval transaction. So the fix
isn't "add a constraint next to the existing endpoint," it's "delete the ungated endpoint's ability to
mint rewards and make the gated path (approval) the only minting path." A shared constraint is still
part of the fix (see below) — it prevents a *second* scratch reward on a visit that's somehow processed
twice — but it's a belt-and-suspenders addition on top of the structural fix, not a substitute for it.

This is also **forced**, not just cleaner, by Issue 4: today SCRATCH_CARD programs have no
`VisitRequest`/approval workflow in the UI at all (`JoinFlow.tsx`'s SCRATCH_CARD branch calls
`instant-scratch` directly, never rendering the submit-and-wait form; `BusinessRequestsPanel.tsx` /
the approval endpoint are VISITS-only concepts today). Once Issue 4 makes `scratchCardEnabled`
independent of `visitsEnabled`, *every* program — regardless of which mechanism(s) are on — goes
through the same "customer submits a VisitRequest → owner approves it" flow, because that flow is now
the one universal trigger event for both reward mechanisms. Gating scratch-card reward creation on an
approved Visit isn't possible until that submit→approve flow exists for scratch-only businesses, and
Issue 4 is what makes it exist. Hence 4 → 1.

**Schema change** — add a nullable, unique FK from `Reward` to `Visit`:

```prisma
model Visit {
  ...
  scratchReward Reward? @relation("ScratchRewardForVisit")
}

model Reward {
  ...
  visitId String? @unique
  visit   Visit?  @relation("ScratchRewardForVisit", fields: [visitId], references: [id], onDelete: Cascade)
}
```

`visitId` is populated only for `type: "SCRATCH_CARD"` rewards minted via the new unified approval
path; it stays `null` for milestone `STANDARD` rewards (which remain tied to `Membership`, not a single
`Visit` — the threshold crossing isn't attributable to one specific visit any more than any other) and
for the handful of historical scratch rewards already in the DB from the old `instant-scratch` endpoint
(no `Visit` exists to backfill against — left `null`, which is fine since the constraint only guards
future inserts). `@unique` on `visitId` gives the DB-enforced guarantee: **one approved Visit can never
have more than one scratch-card `Reward` attached**, full stop, regardless of application bugs or
retries — a second `tx.reward.create({ data: { visitId: sameId, ... } })` throws (Prisma error `P2002`)
and the whole approval transaction rolls back.

**Route change** — in `PATCH /api/business/requests/[requestId]/route.ts`'s approval `$transaction`,
after the existing `Visit` creation and `currentVisits`/`totalVisits` increment:

```ts
if (business.loyaltyProgram!.scratchCardEnabled) {
  // load scratchCardPrizes, weighted-random draw (same math as today's instant-scratch route,
  // relocated into this transaction), then:
  await tx.reward.create({
    data: {
      membershipId: vr.membershipId,
      businessId: vr.businessId,
      customerId: vr.customerId,
      loyaltyProgramId,
      visitId: newVisit.id,           // the Visit row just created above, in this same transaction
      title: wonPrize.title,
      description: wonPrize.description || "",
      status: "REDEEMED",
      type: "SCRATCH_CARD",
      scratchCardPrizeId: wonPrize.id,
      revealedPrize: wonPrize.title,
      expiresAt: new Date(now.getTime() + rewardValidityDays * 24 * 60 * 60 * 1000),
      redeemedAt: now,
    },
  });
}
```

This runs independently of (and in addition to) the existing `visitsEnabled`/threshold branch — a
single approval can mint a milestone reward, a scratch reward, both, or neither, depending on the two
flags and whether the threshold was crossed.

`POST /api/customer/reward/instant-scratch` is deleted (see open decision 3 below) since it has no
legitimate remaining purpose once scratch requires an approved visit — an endpoint that still exists
but is now provably wrong to call is exactly the kind of dead-but-reachable surface WORKING.md flags
elsewhere.

### (d) Open decisions needing your input

1. **How does the customer actually see/scratch the prize now?** This is the most consequential change
   in the whole plan. Today, `instant-scratch` is called *by the customer's own browser* and the prize
   comes back in that same HTTP response, rendered immediately. Once minting moves into the *owner's*
   approval action (taken at the counter, possibly after the customer has left), the customer isn't
   there to receive a synchronous response. I see two ways to close this gap, and need you to pick one:
   - **(a) Come back and check.** Customer re-visits `/join/[businessToken]` or `/my-rewards`, enters
     their mobile number, and sees a reward waiting (data already won server-side, `revealedPrize`
     already set) — this mirrors exactly how the claim-code flow already works today (owner approves,
     customer later verifies the code). This is the smaller change: no new "reveal" endpoint strictly
     required, just surfacing the already-set `revealedPrize` the next time the customer looks. It does
     mean the scratch-card *animation* becomes cosmetic-on-reload rather than a true first-time reveal.
   - **(b) Real one-time reveal.** Add `POST /api/customer/reward/[rewardId]/scratch`, doing an atomic
     conditional update (`WHERE isScratched = false`, same pattern as the existing reward-redeem
     route's `updateMany` + `count === 0` check) that flips `isScratched: true` and returns
     `revealedPrize` — the reward is *won* at approval time but the prize stays hidden from any GET
     response until this endpoint is called once. This is more work (new route, and `JoinFlow`/the
     dashboard need a "you have an unscratched card" state) but it makes `isScratched` finally mean
     something server-side (right now it's dead — see WORKING.md §5) and preserves the "surprise"
     moment as a real one-time action rather than a re-fetchable fact.
   I lean toward (b) since it's a natural, low-cost addition once the approval-time minting is already
   built, and it fixes an existing dead-field problem as a side effect — but this is your call, not a
   technical one.
2. **Should `currentVisits`/`totalVisits` still increment on every approval for a scratch-only
   (`visitsEnabled:false`) program?** I'd default to yes (harmless, keeps `totalVisits` meaningful for
   the analytics "repeat rate" panel regardless of which mechanism is active), but flagging since it's
   a real behavior choice.
3. **Delete `instant-scratch` outright, or repurpose it as an owner-triggered manual grant tool** (e.g.
   `requireBusinessOwner()`-gated, for compensating a customer manually)? I'd recommend outright
   deletion for now — the plan above gives no legitimate customer-facing use for it, and a manual-grant
   tool is a separate feature you haven't asked for — but flagging in case you want the scaffolding kept
   for that later.
4. **JoinFlow's UI split** (referenced in Issue 4(d)#5): concretely, once submission is unified, does
   the join page show one generic "Submit your visit" form regardless of which mechanisms are enabled,
   with the *result* screen (after owner approval, next time the customer checks) conditionally showing
   a claim code and/or a scratch card? I believe yes, but want to confirm before touching `JoinFlow.tsx`
   since it's a visible UX change for every existing VISITS-only business too (their flow doesn't change
   functionally, but the component is being restructured underneath it).

---

## Issue 2 — Bill upload is fake

### (a) Confirmed current behavior

Re-read `src/components/JoinFlow.tsx` lines 307–319, `src/app/api/customer/visit/route.ts` in full,
`src/lib/storage.ts` in full, and `src/components/VisitRequestButton.tsx` in full.

- `JoinFlow.tsx`'s only bill-related input is a `<input type="text">` labeled "Bill Photo URL (For
  Demo)" — the customer types or pastes a string, stored in React state as `billPhotoUrl`, sent as a
  plain JSON string field.
- `POST /api/customer/visit` takes `billPhotoUrl` as an optional string in its local Zod schema (not
  `VerificationRequestCreateSchema` from `src/lib/validations/index.ts`, which exists but is unused by
  this route — a second, looser, inline schema is used instead) and stores it verbatim as
  `VisitRequest.billImagePath` — no file ever touches the server as binary data through this path.
- `uploadBillImage()` (`src/lib/storage.ts` lines 31–103) is fully implemented — Supabase Storage
  upload with auto-bucket-creation and automatic local-disk fallback (`public/uploads/bills/`) — but
  grepping the whole repo for `uploadBillImage` finds only its own definition and its mention in
  `CLAUDE.md`. **Zero callers.**
- `VisitRequestButton.tsx` has real client-side file-picker UI, MIME/size validation
  (`ALLOWED_TYPES`, `MAX_BYTES = 5MB`), and posts `FormData` to `/api/customer/bill-upload` and
  `/api/customer/verification-request` — confirmed **neither route exists** (listed
  `src/app/api/customer/*` directory contents: `dashboard`, `progress`, `reward/claim-code`,
  `reward/instant-scratch`, `visit` — no `bill-upload`, no `verification-request`). Confirmed via grep
  that `VisitRequestButton` itself is imported nowhere else in the repo — it is unreachable dead code.

### (b) Why it's a problem

The verification method a business picks (`BILL`) is supposed to mean "the owner reviews an actual
photo of the receipt before approving a visit." Today it means "the owner reviews whatever string the
customer typed," which could be any URL, a nonsense string, or nothing enforced at all beyond
`billPhotoUrl` being an optional string. There is no evidence behind BILL-verified visits at all right
now — the verification method is cosmetic.

### (c) Proposed fix

**Recommendation: extend `JoinFlow.tsx` + `POST /api/customer/visit` directly. Delete
`VisitRequestButton.tsx` and do not build the two endpoints it currently calls.**

Reasoning: `VisitRequestButton` assumes a fundamentally different shape of the flow — a pre-existing
`membershipId` and a two-call split (`verification-request` then a separate `bill-upload`) — that
doesn't match how the live flow actually works today (`JoinFlow` + `POST /api/customer/visit` already
does customer-upsert + membership-upsert + VisitRequest-creation as one atomic call). Building
`VisitRequestButton`'s two missing endpoints would mean maintaining **two independent ways to submit a
visit** (JoinFlow's one-shot call vs. VisitRequestButton's two-call split), which duplicates exactly the
kind of divergent-flow logic that produced several of the bugs WORKING.md already found (e.g. the
`/api/business` vs `/api/business/account` split in Issue 6). One path is strictly simpler to keep
correct.

Concrete changes:
- `POST /api/customer/visit` starts accepting `multipart/form-data` instead of JSON (parsed via
  `await request.formData()`), reading `mobileNumber`, `enteredName`, `businessId` as text fields and
  an optional `billPhoto` `File` field. Using FormData uniformly (even for `VISIT_CONFIRMATION`
  submissions, which just omit the file field) avoids maintaining two different content-type-handling
  branches in the same route.
- Server-side validation before touching storage: reuse the same constraints already written (but
  unused) in `VisitRequestButton.tsx` — MIME type ∈ `{image/jpeg, image/png, image/webp}`, size ≤ 5MB —
  enforced **on the server**, not just client-side (the whole point of this fix is closing a flow that's
  currently bypassable by calling the API directly with any string).
- When `program.verificationMethod === "BILL"`: require the file field present and valid, read it into
  a `Buffer`, and call `uploadBillImage(storagePath, buffer, contentType)`. `storagePath` needs the
  upserted `Customer.id`, so the route's step order changes slightly: validate → per-day pending-request
  guard → upsert `Customer` → upsert `Membership` → **upload bill (if BILL method)** → create
  `VisitRequest` with `billImagePath` set to the real `storagePath` returned by `uploadBillImage()` (not
  a signed URL — matching the field's existing doc comment, "Supabase Storage object path"). For
  `VISIT_CONFIRMATION`, this step is skipped entirely and `billImagePath` stays `null`, exactly as
  today.
- `JoinFlow.tsx`'s bill-input step becomes `<input type="file" accept="image/jpeg,image/png,image/webp">`
  with the same client-side pre-checks `VisitRequestButton` already has (good UX, not a security
  boundary — the server check is the real one), and the submit handler builds a `FormData` object
  instead of a JSON body when a file is required.
- `VisitRequestButton.tsx` is deleted (see open decision 2).

### (d) Open decisions needing your input

1. **Storage path convention.** I'd propose `${businessId}/${customer.id}/${cuid()}.${ext}` (scoped
   under the resolved customer so an owner reviewing requests can trace files back to a person, cuid
   suffix avoids collisions) — but you may want something else (date-partitioned folders for easier
   manual cleanup/audit in the Supabase dashboard, for instance). Confirm before I touch the route.
2. **Delete `VisitRequestButton.tsx` now, or leave it in the tree?** I'm recommending deletion since it
   represents an incompatible, unreachable second flow and keeping it around risks someone wiring it up
   later without realizing it duplicates `POST /api/customer/visit`'s logic. But deleting code is a call
   I'd rather you confirm than assume, in case it was scaffolded intentionally for a future "resume from
   dashboard" flow you haven't described yet.
3. **`uploadBillImage()`'s local-disk fallback becomes load-bearing for the first time.** Right now this
   function has zero callers, so its "never throw, fall back to `public/uploads/bills/`" contract
   (CLAUDE.md explicitly calls this out as a guarantee to preserve) is purely theoretical. Once this
   route actually calls it, that fallback stops being cosmetic: if Supabase Storage env vars are
   missing/misconfigured in a serverless production deployment (Vercel's filesystem is typically
   ephemeral/read-only outside `/tmp`), a bill "upload" could silently succeed and then vanish on the
   next cold start/deploy, with no error surfaced to anyone. I'm not proposing to change the
   never-throw contract unilaterally since CLAUDE.md treats it as load-bearing, but flagging that this
   fix is the moment that theoretical risk becomes real, and asking whether you want any
   logging/alerting added when the fallback path is actually taken (today it only does a
   `console.warn`), before this ships to production.

---

## Issue 3 — No duplicate-bill prevention

### (a) Confirmed current behavior

Re-read `prisma/schema.prisma`'s `VisitRequest` model (lines 227–250) in full: no `billNumber` field,
no hash field, no uniqueness constraint of any kind involving `billImagePath`. Confirmed no hashing
library (perceptual or otherwise) is present in `package.json` dependencies. Confirmed the only
existing duplicate-adjacent guard anywhere in `POST /api/customer/visit` is the daily
one-pending-request-per-`(businessId, mobileNumber)` throttle — unrelated to bill identity, and easily
defeated by waiting a day or using a different phone number with the same bill.

### (b) Why it's a problem

Once Issue 2 makes bill upload real, a customer (or two colluding customers) could submit the exact
same receipt photo — or the same bill number — across multiple visits (same day via different numbers,
or different days via the same number) and have each approved independently, since nothing compares a
new submission against prior ones. Each approval increments visit counters and can mint real rewards,
so this is a direct path to the same "getting rewards without genuinely qualifying" problem Issue 1
addresses for scratch cards, just via the VISITS/claim-code path instead.

### (c) Proposed fix

**Schema addition:**

```prisma
model VisitRequest {
  ...
  billNumber    String?   // customer-typed, required only when method == BILL (enforced in Zod, not the DB — VISIT_CONFIRMATION rows have none)
  billImageHash String?   // perceptual hash (dHash) of the uploaded photo, hex-encoded; required when method == BILL
  ...
  @@unique([businessId, billNumber])       // Postgres treats NULL as distinct, so VISIT_CONFIRMATION rows (billNumber = null) never collide
  @@unique([businessId, billImageHash])    // same NULL-safety reasoning
}
```

Postgres unique indexes permit multiple `NULL`s by default, so both constraints naturally apply only to
rows where a bill was actually submitted — no partial-index trick needed for that part (there is a
separate partial-index question below, for excluding rejected rows).

**Perceptual hashing approach** — recommend `sharp` (a single, well-maintained, fast native image
library; not a current dependency, would need adding) rather than a dedicated perceptual-hash npm
package: decode the uploaded buffer, downscale to a small fixed grayscale grid (e.g. 9×8), and compute
a **difference hash (dHash)** by hand in ~15–20 lines directly against `sharp`'s raw pixel output. This
keeps the dependency footprint to one library instead of an image-decode library plus a thin
hashing-package wrapper on top of it. dHash (vs. a cryptographic hash like SHA-256 of the raw bytes) is
the right tool here specifically because the realistic fraud case is "the same physical receipt,
re-photographed/re-compressed/rescreenshotted," which changes the exact bytes but not the visual
content — a cryptographic hash would only catch literal byte-identical re-uploads.

**Important limit on "DB-level" enforcement for the *image* hash, stated plainly since you asked for
DB-level correctness wherever a rule matters**: a `@@unique` constraint can only catch *exact* hash
string matches. Real dHash-based duplicate detection is normally done by Hamming-distance comparison
(flag if the new hash differs from an existing one by only a few bits, since recompression/rescan
introduces small variance) — that's inherently a "query existing rows, compute distance, decide"
operation, not something a native Postgres `UNIQUE` constraint can express. I'm proposing a two-tier
approach so the DB does as much of the real work as it structurally can:
- **Tier 1 (hard, DB-enforced):** `@@unique([businessId, billImageHash])` catches exact-hash
  duplicates — literally resubmitting the same file, or a re-save that happens to hash identically.
  This is a true guarantee: a second insert throws `P2002` (Prisma's unique-violation code) even under
  concurrent requests, no race window.
- **Tier 2 (soft, application-level, explicitly *not* a hard constraint):** a pre-insert query comparing
  the new hash's Hamming distance against this business's recent hashes, rejecting/flagging near-matches
  under a threshold. This cannot be a hard constraint without either a Postgres extension or storing the
  hash as a fixed-width `bit`/`bytea` and using native bit-difference functions (version-dependent on
  the Supabase-hosted Postgres version — would need confirming what's available before committing to
  that route). I'm recommending shipping Tier 1 now as the hard guarantee, and treating Tier 2 as a
  clearly-separate follow-on that needs its own threshold/false-positive design (see open decision 1) —
  not silently baking a fuzzy-match threshold decision into this fix.

**Bill-number uniqueness** requires the customer to actually type a bill/receipt number — add a
required text field to `JoinFlow.tsx`'s BILL-method step, validated non-empty in the Zod schema when
`method === "BILL"`.

**Ordering in the route (cost-avoidance, per your explicit ask)**: compute the hash from the in-memory
buffer *before* calling `uploadBillImage()` — `sharp` operates on the buffer directly, no need to upload
first. Updated route order: validate file type/size → **compute `billImageHash` from buffer** → check
`billNumber`/`billImageHash` against existing rows for this business (pre-check, cheap, avoids the
common case) → only if both pass, call `uploadBillImage()` → create `VisitRequest` with `billNumber` +
`billImageHash` + the real storage path. The pre-check is a courtesy (avoids paying for a Supabase
upload we're about to reject) — the actual safety net is the DB unique constraint: if two concurrent
requests both pass the pre-check (race), the second `tx.visitRequest.create(...)` throws `P2002`, which
the route catches and returns as `409 "This bill has already been submitted."` — matching the existing
pattern this codebase already uses elsewhere (the reward-redeem route's `updateMany` + `count === 0`
check trusts the DB over the pre-check, same principle applied here via a unique-constraint catch
instead of a conditional update, since this is an insert not an update).

### (d) Open decisions needing your input

1. **Should the uniqueness apply across *all* `VisitRequest` statuses, or exclude `REJECTED`?** A flat
   `@@unique` as written above blocks resubmission of the same bill/photo forever, even if the first
   submission was rejected for an unrelated, fixable reason (blurry photo, wrong business selected by
   mistake, etc.) — that seems like an unintended customer-hostile side effect. The alternative is a
   **partial unique index** (`CREATE UNIQUE INDEX ... WHERE status != 'REJECTED'`, added via raw SQL in
   the Prisma migration since the schema DSL doesn't support partial indexes directly) so a rejected
   request doesn't permanently block a legitimate resubmission of the same bill, while still blocking
   duplicates among `PENDING`/`APPROVED` rows. I'd recommend the partial-index version, but this is a
   real product judgment call about how "duplicate" should behave around rejections — confirm before I
   build it either way.
2. **Fuzzy/near-duplicate matching (Tier 2 above)** — do you want this in scope now, or is the
   exact-hash DB constraint (Tier 1) sufficient for a first pass? If in scope, I need your input on the
   Hamming-distance threshold and what happens on a flagged-but-not-certain match (hard-reject vs.
   surface it to the owner as a warning during review, since a false positive here wrongly blocks a
   legitimate customer).
3. **Adding `sharp` as a new dependency** — it's a native binary dependency (prebuilt binaries per
   platform), which is a slightly heavier addition than most of this stack's current pure-JS
   dependencies. Confirm you're fine with that, or let me know if you'd rather explore a pure-JS
   perceptual-hash approach (slower, but zero native-binary footprint) instead.

---

## Issue 6 — Settings silently drops fields

### (a) Confirmed current behavior

Re-read `src/app/api/business/account/route.ts` (PUT handler, lines 7–44), `src/app/api/business/route.ts`
(PUT handler, lines 64–123), `src/app/business/settings/BusinessSettingsClient.tsx` (lines 55–76), and
`src/components/BusinessDashboardTabs.tsx` (lines 122–150).

- `BusinessSettingsClient.tsx`'s `handleSaveBusiness` sends all six fields (`name`, `address`,
  `businessType`, `googleReviewUrl`, `instagramHandle`, `youtubeHandle`) to `PUT /api/business/account`.
- `BusinessUpdateSchema` (`src/lib/validations/index.ts` lines 87–98) validates all six.
- The route handler only writes three of them to the database (line 16–20:
  `data: { name: data.name, googleReviewUrl: data.googleReviewUrl || null, instagramHandle:
  data.instagramHandle || null }`) — `address`, `businessType`, `youtubeHandle` are validated,
  accepted, and silently discarded. The route returns `200 OK` with no indication anything was
  dropped.
- Separately, `BusinessDashboardTabs.tsx`'s inline "Overview" rename form (`handleUpdateBusiness`) calls
  a **different** route, `PUT /api/business`, sending only `{ name }`. That route's handler
  (`src/app/api/business/route.ts`) only ever writes `name` — by design, it was never meant to carry
  the other five fields, and doesn't validate for them via `BusinessUpdateSchema` in a way that would
  even surface the mismatch.
- Grepped the whole repo for `fetch(["'`]/api/business["'`]` — confirmed only `BusinessDashboardTabs.tsx`
  calls `PUT /api/business`, and no client code calls `GET /api/business` at all (the server components
  that render business data — `src/app/business/page.tsx`, `.../settings/page.tsx`, `.../qr/page.tsx` —
  all query Prisma directly, not their own API). `GET /api/business` currently has no reachable caller.

### (b) Why it's a problem

A business owner who edits Address, Business Type, or YouTube handle in Settings sees a success
message and no error, but the values are never persisted — a silent data-loss bug that looks like it
worked. This directly undermines trust in the settings page and (per Issue 5) blocks YouTube-handle
data from ever reaching any future consumer, since it can never actually be saved past initial setup.

### (c) Proposed fix

Two related fixes:

1. **Make `PUT /api/business/account` actually write all six fields** it already validates:
   ```ts
   data: {
     name: data.name,
     address: data.address || null,
     businessType: data.businessType || null,
     googleReviewUrl: data.googleReviewUrl || null,
     instagramHandle: data.instagramHandle || null,
     youtubeHandle: data.youtubeHandle || null,
   }
   ```
2. **Consolidate the two update routes into one.** `PUT /api/business` and `PUT /api/business/account`
   aren't redundant in *UI purpose* today (one is a quick inline rename on the dashboard Overview tab,
   the other is the full Settings form) — but they're redundant in *implementation*, each duplicating
   "resolve owner's business → validate → update → return shaped business" with a different field
   subset, which is exactly how this silent-drop bug happened unnoticed. Fix: keep both *affordances*
   in the UI (quick-rename stays convenient, doesn't need to route through full Settings), but have
   both call the same underlying route (`PUT /api/business/account`), with `BusinessUpdateSchema`
   relaxed to make every field but `name` optional so a partial payload (`{ name }` only, from the
   dashboard quick-rename) validates and only updates what's provided (`data: { name: data.name, ...(
   address !== undefined && { address: address || null } ), ... }` — merge semantics, not
   replace-with-null-if-omitted). `BusinessDashboardTabs.tsx`'s `handleUpdateBusiness` then calls
   `PUT /api/business/account` instead of `PUT /api/business`. The `PUT` handler in
   `src/app/api/business/route.ts` is deleted; its `GET` handler is left as-is (see open decision below).

### (d) Open decisions needing your input

1. **`GET /api/business` currently has no caller anywhere in the app** (confirmed by grep — every page
   that needs business data queries Prisma directly instead). It's not part of what you asked me to fix,
   and I'm not proposing to remove it as part of this issue, but flagging it as a related dead-code fact
   since I was already looking at this file: keep it (harmless, might be useful for a future
   client-side refetch or external consumer) or remove it for cleanliness? Your call, out of scope for
   this fix either way — just surfacing it since I noticed it while re-verifying this issue.
2. **Partial-update semantics for the merged route** — confirm the "send only what you're changing,
   omitted fields stay unchanged" behavior I proposed above is what you want, versus requiring the
   client to always send the full six-field object (simpler server logic, but means the dashboard
   quick-rename form would need to fetch and resend the other five fields just to change the name,
   which seems worse). I'm recommending partial-update but flagging since it's a real API-contract
   choice.

---

## Issue 5 — Two fully-built features are wired to nothing

### (a) Confirmed current behavior

Re-read `src/components/GoogleReviewModal.tsx` and `src/components/InstagramButton.tsx` in full, and
grepped both component names plus `review-prompt` across the repo.

- `GoogleReviewModal` needs props `membershipId`, `businessName`, `googleReviewUrl`, `currentVisits`,
  `reviewPromptedAt`. It shows itself once `currentVisits >= 2` and `googleReviewUrl` is set, throttled
  to not re-show within 30 days of `reviewPromptedAt`, and calls
  `POST /api/customer/membership/${membershipId}/review-prompt` on both "review" and "dismiss" actions
  to record the prompt. Confirmed via directory listing that no
  `src/app/api/customer/membership/[membershipId]/review-prompt/route.ts` exists.
- `InstagramButton` just needs a `handle` string; fully functional, renders a link to
  `https://instagram.com/${handle}`.
- Grepped `GoogleReviewModal`/`InstagramButton` repo-wide: each name appears only in its own definition
  file. Neither is imported by `JoinFlow.tsx`, `my-rewards/page.tsx`, or anywhere else.
- Re-confirmed what data is actually available where: `src/app/join/[businessToken]/page.tsx` (the
  server component) already fetches the *full* `Business` row via Prisma, including `instagramHandle`
  and `googleReviewUrl` — but `JoinFlow.tsx`'s `business` prop type only declares `{ id: string; name:
  string }` (line 9), so those fields are silently dropped before ever reaching the component that would
  render them. `GET /api/customer/progress/route.ts` (which `JoinFlow` already calls for VISITS
  programs) returns only `{ exists, name, totalVisits, currentVisits, requiredVisits,
  eligibleForReward }` — no `membershipId`, no `reviewPromptedAt`, no business social fields.
- `Membership.reviewPromptedAt` (`DateTime?`) already exists in the schema (confirmed, schema line 208)
  — no schema change needed for the modal's throttling data itself.

### (b) Why it's a problem

Real, working UI and backend-adjacent logic (30-day cooldown, visit-count gating) exists and does
nothing — the business owner enters a Google review URL or Instagram handle in setup/settings expecting
it to reach customers, and currently no customer ever sees it. This is a straightforward "feature
appears done, isn't actually live" gap.

### (c) Proposed fix

**Render location**: I looked at the two candidate pages given the app's actual current structure (not
older planning docs) — `/join/[businessToken]` (one-shot submission page, `JoinFlow.tsx`) vs.
`/my-rewards` (cross-business lookup-by-mobile-number dashboard, `src/app/my-rewards/page.tsx` +
`GET /api/customer/dashboard`). I'm recommending **`/join/[businessToken]` via `JoinFlow.tsx`**: it's
the page where the customer has already identified themselves (typed their mobile number) *for this one
specific business*, which is exactly the context `GoogleReviewModal`/`InstagramButton` are designed
for — a single-business prompt. `/my-rewards` is a multi-business aggregate view; popping a
single-business review modal there feels contextually mismatched, and its backing API
(`/api/customer/dashboard`) would need heavier changes (currently returns aggregate `progress`/`wins`
objects per business, not raw membership records) to carry `membershipId`/`reviewPromptedAt` per
business cleanly.

Concrete changes:
- `JoinFlow.tsx`'s `business` prop type gains `instagramHandle: string | null` and
  `googleReviewUrl: string | null` (already available in the parent server component today, just not
  passed through) — `InstagramButton` can render immediately wherever appropriate once this prop exists,
  no API change needed for it.
- `GET /api/customer/progress/route.ts` gains `membershipId` and `reviewPromptedAt` to its response
  (both trivially available — it already loads the `membership` row, just doesn't currently select
  those two fields).
- `JoinFlow.tsx` renders `<GoogleReviewModal>` once `progress?.exists === true`, passing the now-available
  `membershipId`/`reviewPromptedAt` from the progress response and `googleReviewUrl`/`businessName` from
  its own props.
- New route: `POST /api/customer/membership/[membershipId]/review-prompt/route.ts` — no request body,
  updates `Membership.reviewPromptedAt = new Date()` for the given id, 404 if the membership doesn't
  exist, 200 otherwise. Same trust model as every other `/api/customer/*` route today (no customer auth
  exists at all, per WORKING.md §1 and confirmed again in this session — nothing new is weakened by this
  route, it's exactly as trusting as `claim-code`/`instant-scratch` already are). Low-value write (a
  timestamp, not money or a prize), so I'm not proposing extra protections beyond confirming the
  membership exists before writing.

### (d) Open decisions needing your input

1. **Is `/join/[businessToken]` really the right long-term home**, given a customer typically only
   visits it transactionally (once per store visit, to submit or check status), versus building this
   into a proper "my membership at Business X" detail view reachable from `/my-rewards` (click into a
   specific business card from the aggregate list)? I'm recommending the join page because it's minimal
   scope against what's reachable *today*, but this is a product-shape call, not a technical one — confirm
   before I build it here.
2. Given open decision 1 in Issue 1 (whether scratch reveal becomes its own page/state), if you choose
   option (b) there (a real one-time scratch reveal), it may make sense to design that reveal screen and
   the review-prompt modal together as part of the same "come back and check your status" experience,
   rather than as two separately-bolted-on pieces. Flagging the overlap now rather than building them in
   isolation and reconciling later — let me know if you want these designed as one cohesive follow-up
   screen.

---

## Issue 7 — Broken test / stale scratch scripts

### (a) Confirmed current behavior — verified by actually running the commands, not just reading

I ran all three relevant commands in this session rather than assuming:

- **`npx tsc --noEmit`** (full-project type-check): **fails**, with exactly one error and nothing else:
  ```
  src/__tests__/scratch-card-dashboard.test.ts(3,10): error TS2305: Module '"@prisma/client"' has no exported member 'UserRole'.
  ```
  Confirms the rest of the project type-checks cleanly — this is an isolated problem.
- **`npm run build`** (`next build`): **succeeds** — full production build completes, all 30 routes
  compile and generate correctly, zero errors. Next.js's build-time type-checking evidently does not
  include `src/__tests__/**` files even though `tsconfig.json`'s `include` glob (`**/*.ts`, `**/*.tsx`)
  technically matches them — my read is that Next only type-checks files actually reachable from the
  app's own compilation graph (pages/routes and their imports), and nothing in the app imports the test
  files, so they never enter that graph. **This directly answers your question: the broken import does
  not currently break `npm run build`.**
- **`npm run test`** (`vitest run`): **fails**, but confirmed **not because of the `UserRole` import** —
  Vitest transforms TypeScript via esbuild, which does not type-check, and the import is never actually
  *used* anywhere else in the file (re-read all 127 lines — `UserRole` appears once, on the import line,
  nowhere else), so it silently becomes an unused, harmless dead import at runtime. The actual failures
  observed:
  - `scratch-card-dashboard.test.ts`: its one test times out (`Test timed out in 5000ms`) — it's making
    real Prisma calls against a real Postgres connection (via `PUT /api/business/loyalty`'s route
    handler, called in-process) and the DB round-trip doesn't complete in Vitest's default 5s test
    timeout in this environment.
  - `my-rewards.test.ts`: its `afterAll` hook times out (`Hook timed out in 10000ms`), which then leaves
    `customerVisits`/`customerScratch` undefined for a subsequent cleanup line, throwing
    `TypeError: Cannot read properties of undefined (reading 'id')`.
  - `auth-and-tenancy.test.ts` passes cleanly (6/6 tests).
  This pattern (multiple unrelated files timing out on DB operations) points to a database
  connectivity/latency issue in this environment, not a code defect in the sense Issue 7 describes. It's
  outside the scope of what you asked me to fix here, but I'm not omitting it since you asked me to
  confirm actual `npm run test` behavior — happy to look at it separately if you want.

### (b) Why it's a problem (as scoped)

The `UserRole` import doesn't break the two commands your CLAUDE.md treats as the completion gate
(`npm run build`, and — modulo the unrelated DB-timeout issue — `npm run test` wouldn't be broken by
this import either), so it's lower-urgency than it first appeared. It's still worth fixing because (1)
it will break any stricter type-check step (a `tsc --noEmit` CI gate, most IDEs' live type-checking,
`prisma:validate`-adjacent tooling) and (2) it's a visible signal the file is stale and was never
re-validated after whatever removed the `UserRole` enum from the schema.

`scratch/fix2.js` (re-read in full again this session) is a historical one-off patch script: it does
blind regex replacements referencing `UserRole`, `prisma.verificationRequest` (renamed to `visitRequest`
at some point), and a `RewardCard` `onReveal` prop that the current `RewardCard.tsx` doesn't have
(current version uses `onScratchComplete`). Per `CLAUDE.md`, `scratch/` is explicitly documented as
"throwaway one-off scripts ... not part of the app, safe to ignore" — but it's already been asked about
directly, so worth deciding its fate explicitly rather than leaving it.

### (c) Proposed fix

**`scratch-card-dashboard.test.ts`**, in two parts, deliberately not done at the same time:
1. **Now, independent of everything else**: delete the single dead line `import { UserRole } from
   "@prisma/client";` (line 3). Zero behavior change — nothing in the file references `UserRole` again —
   fixes the `tsc --noEmit` error immediately, safe to do in isolation before any other issue in this
   plan.
2. **Together with Issue 4's implementation, not before**: the test's actual assertions exercise
   `PUT /api/business/loyalty` with a payload keyed on `type: "SCRATCH_CARD"` and assert the stored
   `LoyaltyProgram.type` stays `"SCRATCH_CARD"` after an edit (its own comments make clear this guards a
   real historical regression — editing a scratch program used to silently revert it to VISITS). Once
   Issue 4 removes the `type` field, this test's payload and assertions need to change to
   `scratchCardEnabled: true` / asserting `updatedProgram.scratchCardEnabled === true` stays `true`
   across the edit — same regression, expressed against the new field names. Doing this rewrite now
   (before Issue 4 ships) would mean writing it twice; doing it only as part of Issue 4's own change
   keeps the regression continuously covered without duplicate work. I'll fold this rewrite into Issue
   4's implementation step rather than treating it as separate follow-up.

**`scratch/fix2.js`**: recommend deletion. It already ran once (its purpose was a one-time migration
patch), every field/prop it targets has since moved on (`UserRole` gone, `verificationRequest` renamed,
`RewardCard`'s prop renamed), and CLAUDE.md's own housekeeping convention marks this directory as
disposable. Keeping it risks someone re-running it against the current schema/components under the
mistaken impression it's still valid tooling, which would corrupt files via blind regex replacement
against targets that no longer exist in the way the script assumes.

### (d) Open decisions needing your input

1. Confirm you want the `UserRole` import deleted now (trivial, zero-risk, independent of the rest of
   this plan) versus bundling that one-line change into the Issue 4 PR too — I don't see a reason to
   wait, but noting it's a small scope decision.
2. Confirm deletion of `scratch/fix2.js` (vs. leaving it per the "safe to ignore" housekeeping
   convention now that you've asked about it directly).
3. The DB-timeout test failures (`scratch-card-dashboard.test.ts`'s own test, and
   `my-rewards.test.ts`'s hook) are real, current, reproducible failures I found while verifying this
   issue, but they're outside what Issue 7 as written asked me to assess. Let me know if you want these
   looked at as part of this work or separately — flagging now so it isn't silently dropped.
