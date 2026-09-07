import { z } from "zod";

// =============================================================================
// DOMAIN ENUMS (matching Prisma schema)
// =============================================================================

export const UserRoleSchema = z.enum(["CUSTOMER", "BUSINESS_OWNER"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const VerificationMethodSchema = z.enum(["BILL", "VISIT_CONFIRMATION"]);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const RequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const RewardStatusSchema = z.enum(["AVAILABLE", "REDEEMED", "EXPIRED"]);
export type RewardStatus = z.infer<typeof RewardStatusSchema>;

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
  role: UserRoleSchema.default("CUSTOMER"),
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
  role: UserRoleSchema.default("CUSTOMER"),
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

export const LoyaltyProgramSchema = z.object({
  programName: z.string().min(2, "Program name must be at least 2 characters").max(100, "Program name must be at most 100 characters").trim(),
  requiredVisits: z.number().int().min(1, "Required visits must be at least 1").max(100, "Required visits must be at most 100"),
  rewardTitle: z.string().min(2, "Reward title must be at least 2 characters").max(100, "Reward title must be at most 100 characters").trim(),
  rewardDescription: z.string().max(500, "Reward description must be at most 500 characters").trim().default(""),
  rewardValidityDays: z.number().int().min(1, "Validity must be at least 1 day").max(365, "Validity must be at most 365 days").default(30),
  verificationMethod: VerificationMethodSchema.default("VISIT_CONFIRMATION"),
  rewardType: RewardTypeSchema.default("STANDARD"),
  isActive: z.boolean().default(true),
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
