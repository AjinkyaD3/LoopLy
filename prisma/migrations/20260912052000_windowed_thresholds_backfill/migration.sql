-- Phase 2 destructive migration: windowed loyalty thresholds.
-- The additive parts (WindowType enum, LoyaltyProgram.windowType/windowDays/windowStartsAt,
-- Reward.thresholdCycle/thresholdVisitId + FK, the Reward unique constraint, and the Visit
-- composite index) were already applied earlier in this session and are NOT part of this
-- file.

-- 1. Backfill thresholdCycle on existing STANDARD reward rows, numbered 1, 2, 3, ... in
--    creation order per (membershipId, loyaltyProgramId). This is mandatory: without it,
--    computeThresholdEligibility()'s "count of existing thresholdCycle rewards" would read
--    0 for every membership that already has reward history, causing the very next approved
--    visit to re-mint a reward the customer already legitimately received. Only 3 rows are
--    affected (2 distinct membership+program pairs; one pair has 2 rewards -> cycles 1 and 2).
--    thresholdVisitId is intentionally left NULL on these backfilled rows — the old
--    reset-based system never tracked which specific Visit completed a given cycle, so NULL
--    is the honest representation of that missing information (see computeThresholdEligibility's
--    ROLLING-mode fallback for what this means going forward).
UPDATE "Reward" r
SET "thresholdCycle" = sub.cycle
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "membershipId", "loyaltyProgramId" ORDER BY "createdAt" ASC
  ) AS cycle
  FROM "Reward"
  WHERE type = 'STANDARD'
) sub
WHERE r.id = sub.id;

-- 2. Drop the now-unused resettable counter. Nothing reads it anymore (progress is always
--    derived from Visit rows via computeThresholdEligibility); totalVisits is untouched and
--    remains the stored lifetime tally.
ALTER TABLE "Membership" DROP COLUMN "currentVisits";
