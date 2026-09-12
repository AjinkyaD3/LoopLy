import { z } from "zod";

// =============================================================================
// DOMAIN ENUMS (matching Prisma schema)
// =============================================================================


export const VerificationMethodSchema = z.enum(["BILL", "VISIT_CONFIRMATION"]);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const RequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const RewardStatusSchema = z.enum(["AVAILABLE", "REDEEMED", "EXPIRED"]);
export type RewardStatus = z.infer<typeof RewardStatusSchema>;

// Retained only for the historical Reward.type field (legacy SCRATCH_CARD reward rows).
// No new code path sets rewardType — scratch-style plays now live under the Campaign
// subsystem's own CampaignPlay/CampaignPrize models.
export const RewardTypeSchema = z.enum(["STANDARD", "SCRATCH_CARD"]);
export type RewardType = z.infer<typeof RewardTypeSchema>;

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const UserRegistrationSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms & Conditions." }),
  }),
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: "You must acknowledge the Privacy Policy." }),
  }),
});

export const UserLoginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

export const BusinessCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must be less than 100 characters")
    .trim(),
  businessToken: z.string().min(8).max(32).optional(),
});

export const BusinessSetupSchema = z.object({
  name: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must be less than 100 characters")
    .trim(),
  address: z.string().max(255).optional().or(z.literal("")),
  businessType: z.string().max(100).optional().or(z.literal("")),
  googleReviewUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  instagramHandle: z.string().optional().or(z.literal("")),
  youtubeHandle: z.string().optional().or(z.literal("")),
});

export const CustomerUpdateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .trim(),
});

export const BusinessUpdateSchema = z.object({
  name: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must be less than 100 characters")
    .trim(),
  address: z.string().max(255).optional().or(z.literal("")),
  businessType: z.string().max(100).optional().or(z.literal("")),
  googleReviewUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  instagramHandle: z.string().optional().or(z.literal("")),
  youtubeHandle: z.string().optional().or(z.literal("")),
});

export const LoyaltyRewardDefinitionSchema = z.object({
  cardPosition: z.number().int().min(1).max(20),
  title: z.string().min(2, "Reward title must be at least 2 characters").max(100).trim(),
  description: z.string().max(500, "Reward description must be at most 500 characters").trim().default(""),
});

// A loyalty program is a single, dated loyalty-card promotion. Reward positions
// are optional card slots: e.g. card positions 3 and 5 on a five-card program.
export const LoyaltyProgramSchema = z.object({
  programName: z.string().min(2, "Program name must be at least 2 characters").max(100, "Program name must be at most 100 characters").trim(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  requiredVisits: z.number().int().min(2, "A loyalty card needs at least 2 cards").max(20, "A loyalty card can have at most 20 cards").default(5),
  rewards: z.array(LoyaltyRewardDefinitionSchema).min(1, "Add at least one reward to the loyalty card").max(20),
  rewardValidityDays: z.number().int().min(1, "Validity must be at least 1 day").max(365, "Validity must be at most 365 days").default(14),
  verificationMethod: z.literal("VISIT_CONFIRMATION").default("VISIT_CONFIRMATION"),
  isActive: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.endsAt <= data.startsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date must be after start date", path: ["endsAt"] });
  }
  const seen = new Set<number>();
  for (const [index, reward] of data.rewards.entries()) {
    if (reward.cardPosition > data.requiredVisits) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reward position must be on the loyalty card", path: ["rewards", index, "cardPosition"] });
    }
    if (seen.has(reward.cardPosition)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each card position can have only one reward", path: ["rewards", index, "cardPosition"] });
    }
    seen.add(reward.cardPosition);
  }
});

export const CampaignPrizeCreateSchema = z.object({
  title: z.string().min(2, "Prize title must be at least 2 characters").max(100).trim(),
  weight: z.number().int().positive("Weight must be a positive number"),
  totalStock: z.number().int().positive("Total stock must be a positive number"),
});

export const CampaignCreateSchema = z.object({
  name: z.string().min(2, "Campaign name must be at least 2 characters").max(100).trim(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  prizes: z.array(CampaignPrizeCreateSchema).min(1, "At least one prize is required"),
}).superRefine((data, ctx) => {
  if (data.endsAt && data.endsAt <= data.startsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date must be after the start date", path: ["endsAt"] });
  }
});

export const CampaignPlaySchema = z.object({
  mobileNumber: z.string().min(5, "Mobile number is required"),
  customerName: z.string().max(100).trim().optional(),
});

export const VerificationRequestCreateSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  membershipId: z.string().min(1, "Membership ID is required"),
  method: VerificationMethodSchema,
  billImagePath: z.string().nullable().optional(),
});

export const VerificationReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(300).optional(),
});
