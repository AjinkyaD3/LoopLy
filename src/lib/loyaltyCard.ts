export type LoyaltyProgramState = "SCHEDULED" | "ACTIVE" | "ENDED";

/**
 * Program state is derived from the dates, never stored. This lets the permanent
 * business QR always select the right program without a scheduled background job.
 */
export function getLoyaltyProgramState(
  program: { startsAt: Date; endsAt: Date; endedManuallyAt: Date | null },
  now = new Date()
): LoyaltyProgramState {
  if (program.endedManuallyAt || now > program.endsAt) return "ENDED";
  if (now < program.startsAt) return "SCHEDULED";
  return "ACTIVE";
}

export function isActiveLoyaltyProgram(
  program: { startsAt: Date; endsAt: Date; endedManuallyAt: Date | null },
  now = new Date()
): boolean {
  return getLoyaltyProgramState(program, now) === "ACTIVE";
}
