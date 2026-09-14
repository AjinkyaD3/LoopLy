# 2026-09-14 — UI consistency pass (shared component kit + design tokens)

## What changed
- Added `src/lib/cn.ts` (clsx + tailwind-merge helper; both were already installed but unused).
- Added a shared primitive kit at `src/components/ui/`: `Button.tsx`, `Card.tsx`, `Input.tsx`,
  `Textarea.tsx`, `Select.tsx`, `Badge.tsx` (with a `statusToVariant()` mapper),
  `PageHeader.tsx`, `EmptyState.tsx`. All accept `className` passthrough via `cn()`.
- Ran a repo-wide mechanical token normalization across every `.tsx` file in `src/app` and
  `src/components`:
  - `indigo-*` → `primary-*` (the existing `tailwind.config.ts` indigo scale, just inconsistently
    referenced by the raw Tailwind color name in ~24 files instead of the `primary` alias).
  - `rounded-md` / `rounded-lg` → `rounded-xl`; `rounded-3xl` → `rounded-2xl` (radius token rules:
    2xl for cards/containers, xl for buttons/inputs, full for pills/badges/avatars).
  - `shadow-xs` → `shadow-sm`; `shadow-2xl` → `shadow-xl` (shadow ceiling is `shadow-xl`, resting
    cards use `shadow-sm`).
  - Confirmed no stray `gray-*` usage — the app already used `slate` consistently.
- Applied the new kit to auth/onboarding: `src/app/login/page.tsx`, `src/app/register/page.tsx`,
  `src/app/business/setup/page.tsx`, `src/components/BusinessSetupForm.tsx`.
- Applied the kit to the dashboard surface: `src/components/BusinessRequestsPanel.tsx`,
  `BusinessRewardsPanel.tsx`, `BusinessMembersPanel.tsx`, `BusinessAnalyticsPanel.tsx` (Card,
  Badge, Button, Input, EmptyState swapped in for bespoke markup; status colors normalized to
  emerald/amber/rose/slate per the token rules).
- Applied the kit to `src/app/business/loyalty/create/page.tsx` and
  `src/app/business/campaigns/create/page.tsx` (replaced dense inline markup with `Input`/`Button`).
- Applied the kit to the customer-facing, no-login flow: `src/components/JoinFlow.tsx`,
  `src/components/CampaignPlayFlow.tsx`, `src/components/RewardCard.tsx`,
  `src/components/GoogleReviewModal.tsx`, `src/components/QRCodeDisplay.tsx`,
  `src/app/my-rewards/page.tsx` — larger tap targets (`py-3.5`, `text-base`) on the primary
  mobile-number/submit inputs since this flow has zero friction tolerance.
- Applied the kit to `src/app/admin/page.tsx` and `src/components/SubscriptionToggleButton.tsx`
  (new from a prior session, previously unstyled) so the admin panel matches the rest of the app.
- `src/components/LogoutButton.tsx` now uses the shared `Button`.
- Trimmed a few inconsistent emoji in feedback strings (`BusinessRequestsPanel.tsx`,
  `RewardCard.tsx`) where lucide icons already convey the same meaning; left the reward-position
  picker emoji (🎁) alone as a single tasteful indicator, not excessive.
- Removed a handful of pre-existing dead icon imports uncovered while touching these files
  (`BusinessMembersPanel.tsx`, `BusinessAnalyticsPanel.tsx`, `GoogleReviewModal.tsx`,
  `campaigns/create/page.tsx`).

## Why
Per owner feedback ("looks AI generated, no theme followed"): the color palette itself was already
consistent (indigo/primary throughout), but there was no shared component layer, so radius/shadow
choices drifted file to file even when using the same primary color. Normalizing tokens repo-wide
and introducing `src/components/ui/*` gives future changes one place to stay consistent instead of
each new page re-inventing button/card/input styling.

## Verification
- `npm run build` — zero errors/warnings.
- `npm run lint` — no ESLint warnings or errors.
- `npm test` — 8 passed, 1 skipped (pre-existing skip, unrelated to this change).
- `npx tsc --noEmit` — clean.
- Manually re-read every file with a non-mechanical edit (kit integration edits, not just the sed
  token pass) to check for JSX/tag balance issues the build might not catch mid-refactor.

## Follow-ups / deferred
- `src/app/business/settings/BusinessSettingsClient.tsx` (433 lines) and
  `src/app/page.tsx` / `src/app/legal/{privacy,terms}/page.tsx` were left as bespoke markup rather
  than componentized — they were already fully token-compliant after the mechanical pass (no
  `rounded-md/lg/3xl`, no `shadow-xs/2xl`, no `indigo-*`), and forcing their large custom layouts
  into `Card`/`Button` risked regressions for cosmetic-only gain, which the task explicitly allows
  skipping ("where a layout is bespoke enough... at minimum bring its raw Tailwind classes into
  line, rather than skipping it" — done, just not deeper componentization).
- `src/components/BusinessCampaignsPanel.tsx`, `src/components/JoinBusinessInput.tsx`,
  `src/app/business/qr/page.tsx`, `src/app/campaign/[campaignToken]/page.tsx`,
  `src/components/ScratchCardComponent.tsx`, `src/components/VisitRequestButton.tsx`,
  `src/components/InstagramButton.tsx` were audited and found already fully token-compliant
  (correct radius/shadow/color per the rules) — left untouched to minimize diff/risk rather than
  force a kit swap with no visible consistency gain.
