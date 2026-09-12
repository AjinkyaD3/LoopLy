# 2026-09-12 — Loyalty-card restructure (in progress)

## Intent

Replace lifetime/rolling/fixed visit-counter behavior with a dated loyalty-card promotion.
The business QR remains permanent and resolves the currently active program; it is never
regenerated for a program change. A customer scan only creates a pending counter-confirmation
request. An owner/cashier approval is the only operation that awards a card position.

## Implemented in this session

- Added dated program fields, reward definitions by card position, customer loyalty cards, and
  immutable card-position records to the Prisma schema and migration.
- Kept historical program/reward data and added a current-program pointer on `Business` for a
  safe staged migration from existing dashboard code.
- Reworked program creation to make one dated program at a time, configure selected reward
  positions, retain the permanent QR, and end rather than delete programs.
- Reworked visit requests so bill uploads are not accepted, a customer has one pending request
  per business, and requests capture the active program.
- Reworked owner approval to award exactly one card position and issue rewards only at configured
  positions.

## Follow-up required

- Regenerate Prisma client, apply migration in a safe database environment, and run build/tests.
- Finish migration of all dashboard/join components from legacy visit-counter wording and fields
  to loyalty-card terminology and card-position display.
