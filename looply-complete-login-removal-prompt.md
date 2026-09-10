# Prompt: Complete Removal of Customer Login — Full Restructure (Looply, Next.js + Prisma)

## Context — read this before touching anything
A previous pass added new no-login customer APIs and a `/join/[businessToken]` flow, but **did not remove the old login-gated customer system**. Both now coexist. This is unacceptable — it is not a restructure, it's an addition. Your job this time is **removal and restructure**, not addition on top of legacy code.

The current known structure (verify against the actual repo before editing — do not assume this is 100% current):

```
src/
├── app/
│   ├── api/
│   │   ├── auth/            # register, login, logout, me
│   │   ├── business/        # setup, loyalty, analytics, requests, members, rewards, account
│   │   └── customer/
│   │       ├── progress/                        # KEEP (no-login)
│   │       ├── visit/                            # KEEP (no-login)
│   │       ├── reward/otp/, reward/claim/         # KEEP (no-login)
│   │       ├── membership/[membershipId]/         # LEGACY — remove
│   │       ├── verification-request/              # LEGACY — remove
│   │       ├── bill-upload/                       # LEGACY — remove
│   │       └── rewards/[id]/scratch/              # LEGACY — evaluate (see Task 3)
│   ├── business/            # KEEP — business owner dashboard, unaffected
│   ├── customer/            # LEGACY authenticated dashboard — remove entirely
│   ├── join/[businessToken] # KEEP — this becomes the ONLY customer entry point
│   ├── login/                # Shared by both roles today — restrict to business owner only
│   └── register/             # Shared by both roles today — restrict to business owner only
├── components/
│   ├── Business*.tsx         # KEEP
│   ├── JoinFlow.tsx           # KEEP — this is the real UI, make it the only customer UI
│   └── ScratchCardComponent.tsx  # evaluate (see Task 3)
└── lib/                       # auth, prisma, storage utilities
```

Prisma models: `User` (role: CUSTOMER | BUSINESS_OWNER), `Session`, `LegalAcceptance`, `Business`, `LoyaltyProgram`, `Customer` (already keyed by `@@unique([businessId, mobileNumber])`, no FK to `User`), `Membership`, `VisitRequest`, `Visit`, `Reward`.

## Objective
There must be **zero code path** by which a customer can log in, register, or reach an authenticated customer page. The QR scan → `/join/[businessToken]` → mobile number flow must be the **only** way a customer interacts with the product. Business owner authentication is untouched and must keep working exactly as it does today.

## Required Tasks

**1. Database / Prisma schema**
- Remove `CUSTOMER` from the `User` role enum — `User` should only ever represent a `BUSINESS_OWNER` going forward. If removing the enum entirely (leaving `User` implicitly business-owner-only) is cleaner, do that instead, but state which approach you took and why.
- Confirm `Customer`, `Membership`, `VisitRequest`, `Visit`, `Reward` have no lingering FK or soft dependency on `User`/`Session`. If any exists, remove it.
- Write and run a real Prisma migration (`prisma migrate dev`, not a destructive `db push --force-reset` against a database that might have real data — treat this as production-bound). If any existing `User` rows have role `CUSTOMER`, decide and document what happens to them (e.g., safe to drop since the doc says no real users yet — confirm this assumption with me if uncertain rather than silently deleting data).

**2. Remove legacy pages and routes**
- Delete `/app/customer/` entirely (dashboard, membership detail, rewards wallet, settings) — no authenticated customer views remain.
- Delete `/app/api/customer/membership/[membershipId]`, `/app/api/customer/verification-request`, `/app/api/customer/bill-upload`.
- Update `/app/register` and `/app/api/auth/register` so they can only create `BUSINESS_OWNER` accounts — remove any role selection UI/logic for customers.
- Update `/app/login` and `/app/api/auth/login` the same way — business owner only.
- Search the entire codebase for any remaining links, redirects, or nav items pointing to the removed customer pages/routes and remove them. This includes navbars, footers, onboarding emails/templates, and any hardcoded `/customer/...` or `/login`+`role=customer` references.

**3. Decide and implement: scratch-card reward reveal**
- `ScratchCardComponent.tsx` and `PATCH /api/customer/rewards/[id]/scratch` currently assume an authenticated customer. Since reward claiming is now `POST /api/customer/reward/otp` → `POST /api/customer/reward/claim` (mobile number + OTP, no login), decide:
  - (a) fold the scratch-card reveal animation into the result of `reward/claim` (no separate authenticated endpoint), or
  - (b) make a new no-login endpoint that accepts mobile number + reward id (not a session) to trigger the scratch reveal.
  State which you chose and why, then remove the old authenticated scratch endpoint.

**4. Make `/join/[businessToken]` the real, finished UI**
- This is not optional polish — it is the actual deliverable. The page must visibly and functionally support the full flow: QR scan lands here → enter mobile number → debounced progress check via `GET /api/customer/progress` → either "Submit Visit" (`POST /api/customer/visit`) or, if threshold met, "Claim Reward" (OTP → claim) — all rendered, styled, and working in the browser, not just present as unused API routes.
- Handle and visibly surface every error state: invalid mobile number, network failure, duplicate same-day pending request, OTP expired/incorrect, reward already redeemed.

**5. Business owner side**
- Confirm `BusinessRequestsPanel.tsx` correctly displays mobile numbers (not emails) for pending `VisitRequest`s, and that approve/reject via `PATCH /api/business/requests/[requestId]` still correctly creates a `Visit` and, at threshold, a `Reward`. Do not change this logic unless it's actually broken by the above changes — if it already works, leave it alone.

## Engineering Principles (non-negotiable — same as before, restated because they were not followed)
1. **This is a removal task, not an addition task.** If you find yourself writing a new file that duplicates something the old system already did, stop — you're supposed to be deleting the old thing, not building a parallel one.
2. **No dead code, no unused files left behind.** If a component, route, or Prisma field is made obsolete by this change, delete it — don't leave it unreferenced "just in case."
3. **Do not touch business-owner auth, dashboard, analytics, or program-creation logic** unless a change is strictly required to remove the customer-login coupling — and if you do touch it, explain exactly why.
4. **Before writing code**, list every file you will create, modify, or delete, with a one-line reason each.

## Required Verification (must pass before you report completion — this is where the last attempt failed)
- Run the full production build (`npm run build` or equivalent) and get it to **zero errors and zero warnings you introduced**. Paste the final clean build output.
- Run the full test suite and get it to **zero failing tests**. If existing tests reference removed customer-login functionality, rewrite them to test the new flow — don't just delete inconvenient tests without replacing their coverage.
- Manually trace and confirm, in writing:
  - A fresh customer can complete scan → mobile number → visit submission → owner approval → progress increments → reward eligibility → OTP → claim, with **no login screen appearing anywhere in that path**.
  - Attempting to visit any old customer login/dashboard URL either 404s or redirects sensibly — it does not show a broken or half-authenticated page.
  - Business owner register/login/dashboard/QR/analytics flows still work exactly as before.
- Only after all of the above passes, report completion. Include: files deleted, files modified, files created, migration applied, and the full verification results above. Do not report "done" based on code being written — report it based on the build and tests actually passing.
