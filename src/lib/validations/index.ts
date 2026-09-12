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

export const WindowTypeSchema = z.enum(["LIFETIME", "ROLLING", "FIXED_PERIOD"]);
export type WindowType = z.infer<typeof WindowTypeSchema>;

export const LoyaltyProgramSchema = z.object({
  programName: z.string().min(2, "Program name must be at least 2 characters").max(100, "Program name must be at most 100 characters").trim(),
  requiredVisits: z.number().int().min(1, "Required visits must be at least 1").max(100, "Required visits must be at most 100").default(10),
  windowType: WindowTypeSchema.default("LIFETIME"),
  windowDays: z.number().int().min(1, "Window must be at least 1 day").max(3650, "Window must be at most 3650 days").nullable().optional(),
  windowStartsAt: z.coerce.date().nullable().optional(),
  rewardTitle: z.string().min(2, "Reward title must be at least 2 characters").max(100, "Reward title must be at most 100 characters").trim(),
  rewardDescription: z.string().max(500, "Reward description must be at most 500 characters").trim().default(""),
  rewardValidityDays: z.number().int().min(1, "Validity must be at least 1 day").max(365, "Validity must be at most 365 days").default(30),
  verificationMethod: VerificationMethodSchema.default("VISIT_CONFIRMATION"),
  isActive: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.windowType === "ROLLING" && !data.windowDays) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rolling window requires a number of days", path: ["windowDays"] });
  }
  if (data.windowType === "FIXED_PERIOD" && !data.windowStartsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed period requires a start date", path: ["windowStartsAt"] });
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
