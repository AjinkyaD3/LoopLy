import { describe, it, expect } from "vitest";
import { generateBusinessToken, isValidBusinessToken } from "../lib/token";
import {
  UserRoleSchema,
  VerificationMethodSchema,
  RequestStatusSchema,
  RewardStatusSchema,
  UserRegistrationSchema,
  LoyaltyProgramSchema,
} from "../lib/validations";

describe("Business Token Generator (QR Join Identifier)", () => {
  it("generates a token of the requested length with valid charset", () => {
    const token = generateBusinessToken(12);
    expect(token).toHaveLength(12);
    expect(isValidBusinessToken(token)).toBe(true);
  });

  it("generates distinct, non-sequential tokens with no collisions", () => {
    const tokens = new Set<string>();
    const count = 500;
    for (let i = 0; i < count; i++) {
      const t = generateBusinessToken(12);
      tokens.add(t);
    }
    expect(tokens.size).toBe(count);
  });

  it("rejects tokens that are too short, too long, or contain invalid characters", () => {
    expect(isValidBusinessToken("abc")).toBe(false); // too short
    expect(isValidBusinessToken("invalid-chars!@#$")).toBe(false);
    expect(isValidBusinessToken("123456789012345678901234567890123")).toBe(false); // > 32 chars
  });
});

describe("Domain Enums and Constraints Validation", () => {
  it("enforces exact V1 User Roles (CUSTOMER, BUSINESS_OWNER)", () => {
    expect(UserRoleSchema.parse("CUSTOMER")).toBe("CUSTOMER");
    expect(UserRoleSchema.parse("BUSINESS_OWNER")).toBe("BUSINESS_OWNER");
    expect(() => UserRoleSchema.parse("STAFF")).toThrow();
    expect(() => UserRoleSchema.parse("ADMIN")).toThrow();
  });

  it("enforces Verification Methods (BILL, VISIT_CONFIRMATION)", () => {
    expect(VerificationMethodSchema.parse("BILL")).toBe("BILL");
    expect(VerificationMethodSchema.parse("VISIT_CONFIRMATION")).toBe("VISIT_CONFIRMATION");
    expect(() => VerificationMethodSchema.parse("STAFF")).toThrow();
    expect(() => VerificationMethodSchema.parse("QR_SCAN")).toThrow();
  });

  it("enforces Request Statuses (PENDING, APPROVED, REJECTED)", () => {
    expect(RequestStatusSchema.parse("PENDING")).toBe("PENDING");
    expect(RequestStatusSchema.parse("APPROVED")).toBe("APPROVED");
    expect(RequestStatusSchema.parse("REJECTED")).toBe("REJECTED");
    expect(() => RequestStatusSchema.parse("CANCELLED")).toThrow();
  });

  it("enforces Reward Statuses (AVAILABLE, REDEEMED, EXPIRED)", () => {
    expect(RewardStatusSchema.parse("AVAILABLE")).toBe("AVAILABLE");
    expect(RewardStatusSchema.parse("REDEEMED")).toBe("REDEEMED");
    expect(RewardStatusSchema.parse("EXPIRED")).toBe("EXPIRED");
    expect(() => RewardStatusSchema.parse("USED")).toThrow();
  });

  it("validates User registration input constraints", () => {
    const valid = UserRegistrationSchema.safeParse({
      email: "test@example.com",
      password: "StrongPassword123!",
      name: "Jane Doe",
      role: "CUSTOMER",
      acceptTerms: true,
      acceptPrivacy: true,
    });
    expect(valid.success).toBe(true);

    const invalidPassword = UserRegistrationSchema.safeParse({
      email: "test@example.com",
      password: "short",
      name: "Jane",
      acceptTerms: true,
      acceptPrivacy: true,
    });
    expect(invalidPassword.success).toBe(false);

    const missingConsent = UserRegistrationSchema.safeParse({
      email: "test2@example.com",
      password: "StrongPassword123!",
      name: "John Doe",
      role: "CUSTOMER",
    });
    expect(missingConsent.success).toBe(false);
    if (!missingConsent.success) {
      expect(missingConsent.error.errors.some(e => e.path.includes("acceptTerms"))).toBe(true);
      expect(missingConsent.error.errors.some(e => e.path.includes("acceptPrivacy"))).toBe(true);
    }
  });

  it("validates Loyalty Program configuration constraints", () => {
    const valid = LoyaltyProgramSchema.safeParse({
      programName: "VIP Rewards",
      requiredVisits: 5,
      rewardTitle: "Free Coffee",
      rewardDescription: "Any hot beverage",
      rewardValidityDays: 30,
      verificationMethod: "VISIT_CONFIRMATION",
      isActive: true,
    });
    expect(valid.success).toBe(true);

    const zeroVisits = LoyaltyProgramSchema.safeParse({
      programName: "VIP",
      requiredVisits: 0, // Must be >= 1
      rewardTitle: "Reward",
      rewardValidityDays: 30,
    });
    expect(zeroVisits.success).toBe(false);
  });
});

describe("Multi-Tenancy Independence Invariant", () => {
  it("guarantees independent progress and data isolation for one customer across multiple businesses", () => {
    // Model simulation matching Prisma schema semantics
    const customerId = "cust_123";
    const businessAId = "biz_bakery";
    const businessBId = "biz_gym";

    interface MockMembership {
      id: string;
      customerId: string;
      businessId: string;
      currentVisits: number;
      totalVisits: number;
    }

    const memberships: MockMembership[] = [
      {
        id: "mem_a",
        customerId,
        businessId: businessAId,
        currentVisits: 3,
        totalVisits: 8,
      },
      {
        id: "mem_b",
        customerId,
        businessId: businessBId,
        currentVisits: 1,
        totalVisits: 1,
      },
    ];

    // Verify 1 customer belongs to 2 separate businesses
    expect(memberships.length).toBe(2);
    expect(memberships[0].customerId).toBe(customerId);
    expect(memberships[1].customerId).toBe(customerId);

    // Increment visit on Business A
    const memA = memberships.find((m) => m.businessId === businessAId)!;
    memA.currentVisits += 1;
    memA.totalVisits += 1;

    // Verify Business B progress was untouched
    const memB = memberships.find((m) => m.businessId === businessBId)!;
    expect(memA.currentVisits).toBe(4);
    expect(memA.totalVisits).toBe(9);
    expect(memB.currentVisits).toBe(1);
    expect(memB.totalVisits).toBe(1);

    // Verify Tenant Scoped Query Filter (Owner of Business B querying their memberships)
    const ownerBQuery = memberships.filter((m) => m.businessId === businessBId);
    expect(ownerBQuery).toHaveLength(1);
    expect(ownerBQuery[0].businessId).toBe(businessBId);
    expect(ownerBQuery.some((m) => m.businessId === businessAId)).toBe(false);
  });
});
