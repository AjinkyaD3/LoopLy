import type { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient;

interface WindowedProgram {
  id: string;
  requiredVisits: number;
  windowType: "LIFETIME" | "ROLLING" | "FIXED_PERIOD";
  windowDays: number | null;
  windowStartsAt: Date | null;
}

export interface ThresholdEligibility {
  /** The ordinal cycle this membership would earn next (1, 2, 3, ...). */
  nextCycle: number;
  /** How many qualifying visits currently count toward that cycle. */
  qualifyingVisits: number;
  /** Whether qualifyingVisits has reached requiredVisits. */
  qualifies: boolean;
}

/**
 * Computes whether a membership currently qualifies for its next reward cycle under a
 * program's configured window (LIFETIME / ROLLING / FIXED_PERIOD), and what that cycle
 * number would be.
 *
 * Shared by the visit-approval transaction (mint-time truth) and the read-only progress
 * endpoints (display-time truth) so the two can never diverge. Safe to call with either a
 * `$transaction` callback's `tx` client or the top-level `prisma` client directly.
 */
export async function computeThresholdEligibility(
  db: DbClient,
  membershipId: string,
  program: WindowedProgram
): Promise<ThresholdEligibility> {
  const existingCount = await db.reward.count({
    where: {
      membershipId,
      loyaltyProgramId: program.id,
      thresholdCycle: { not: null },
    },
  });
  const nextCycle = existingCount + 1;

  let qualifyingVisits: number;

  if (program.windowType === "LIFETIME") {
    const membership = await db.membership.findUniqueOrThrow({ where: { id: membershipId } });
    qualifyingVisits = membership.totalVisits;
  } else {
    let lowerBound: Date;

    if (program.windowType === "ROLLING") {
      const windowDays = program.windowDays ?? 0;
      const rollingStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

      const lastReward = await db.reward.findFirst({
        where: { membershipId, loyaltyProgramId: program.id, thresholdCycle: { not: null } },
        orderBy: { thresholdCycle: "desc" },
        include: { thresholdVisit: true },
      });
      const anchor = lastReward?.thresholdVisit?.visitedAt ?? new Date(0);
      lowerBound = anchor > rollingStart ? anchor : rollingStart;
    } else {
      // FIXED_PERIOD
      lowerBound = program.windowStartsAt ?? new Date(0);
    }

    qualifyingVisits = await db.visit.count({
      where: { membershipId, visitedAt: { gte: lowerBound } },
    });
  }

  return {
    nextCycle,
    qualifyingVisits,
    qualifies: qualifyingVisits >= program.requiredVisits,
  };
}
