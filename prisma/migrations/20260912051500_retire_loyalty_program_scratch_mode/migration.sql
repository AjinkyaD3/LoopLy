-- STEP B of the LoyaltyProgram scratch-mode retirement.
-- STEP A (ALTER TABLE "LoyaltyProgram" ADD COLUMN "retiredScratchNotice" BOOLEAN NOT NULL
-- DEFAULT false;) was already applied earlier in this same session and is NOT part of this
-- file — "retiredScratchNotice" already exists on every row (defaulted to false) before
-- this file runs.

-- 1. Pause the 5 programs currently in SCRATCH_CARD mode, and mark them for the one-time
--    dashboard banner, before the "type" column that identifies them is dropped below.
UPDATE "LoyaltyProgram" SET "isActive" = false, "retiredScratchNotice" = true WHERE "type" = 'SCRATCH_CARD';

-- 2. Drop the retired fields/enum. RewardType enum and Reward.type / scratchCardPrizeId /
--    isScratched / revealedPrize are NOT touched — preserved for the 10 historical
--    SCRATCH_CARD Reward rows and their FK integrity to ScratchCardPrize (12 rows, also
--    untouched).
ALTER TABLE "LoyaltyProgram" DROP COLUMN "rewardType",
DROP COLUMN "type";

DROP TYPE "ProgramType";
