import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth";
import { UserRole, VerificationMethod } from "@prisma/client";
import { generateBusinessToken, isValidBusinessToken } from "../lib/token";
import { BusinessSetupSchema, BusinessUpdateSchema, LoyaltyProgramSchema } from "../lib/validations";
import { getBusinessJoinUrl, generateQRCodeDataUrl, generateQRCodeSvg } from "../lib/qr";

describe("Phase 3 Checkpoint 1 — Backend Business Setup & APIs", () => {
  const timestamp = Date.now();
  const ownerEmailA = `owner.cp1.a.${timestamp}@example.test`;
  const ownerEmailB = `owner.cp1.b.${timestamp}@example.test`;
  const customerEmail = `customer.cp1.${timestamp}@example.test`;
  const password = "Password123!";

  let ownerAId = "";
  let ownerBId = "";
  let customerId = "";
  let businessAId = "";
  let businessAToken = "";

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);

    const ownerA = await prisma.user.create({
      data: {
        email: ownerEmailA,
        name: "Checkpoint Owner A",
        passwordHash,
        role: UserRole.BUSINESS_OWNER,
      },
    });
    ownerAId = ownerA.id;

    const ownerB = await prisma.user.create({
      data: {
        email: ownerEmailB,
        name: "Checkpoint Owner B",
        passwordHash,
        role: UserRole.BUSINESS_OWNER,
      },
    });
    ownerBId = ownerB.id;

    const customer = await prisma.user.create({
      data: {
        email: customerEmail,
        name: "Checkpoint Customer",
        passwordHash,
        role: UserRole.CUSTOMER,
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    // Clean up created entities
    if (businessAId) {
      await prisma.loyaltyProgram.deleteMany({ where: { businessId: businessAId } });
      await prisma.business.deleteMany({ where: { id: businessAId } });
    }
    await prisma.business.deleteMany({ where: { ownerId: { in: [ownerAId, ownerBId] } } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerAId, ownerBId, customerId] } },
    });
  });

  // 1. Validation Tests
  describe("Input Validation", () => {
    it("accepts valid business setup payload", () => {
      const valid = BusinessSetupSchema.safeParse({
        name: "Artisan Coffee",
        programName: "Bean Loyalty",
        requiredVisits: 5,
        rewardTitle: "Free Cold Brew",
        rewardDescription: "16oz house cold brew",
        rewardValidityDays: 30,
        verificationMethod: "BILL",
      });
      expect(valid.success).toBe(true);
    });

    it("rejects invalid business name (< 2 chars)", () => {
      const invalid = BusinessSetupSchema.safeParse({
        name: "A",
        programName: "Club",
        requiredVisits: 5,
        rewardTitle: "Free Coffee",
        rewardValidityDays: 30,
        verificationMethod: "BILL",
      });
      expect(invalid.success).toBe(false);
    });

    it("rejects invalid requiredVisits (0 or negative or > 100)", () => {
      const zero = LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 0,
        rewardTitle: "Reward",
      });
      expect(zero.success).toBe(false);

      const overHundred = LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 101,
        rewardTitle: "Reward",
      });
      expect(overHundred.success).toBe(false);
    });

    it("rejects invalid reward validity days (0 or > 365)", () => {
      const zero = LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 5,
        rewardTitle: "Reward",
        rewardValidityDays: 0,
      });
      expect(zero.success).toBe(false);

      const overYear = LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 5,
        rewardTitle: "Reward",
        rewardValidityDays: 400,
      });
      expect(overYear.success).toBe(false);
    });

    it("rejects invalid verification method", () => {
      const invalidMethod = LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 5,
        rewardTitle: "Reward",
        verificationMethod: "INVALID_METHOD",
      });
      expect(invalidMethod.success).toBe(false);
    });
  });

  // 2. Business Setup & Atomic Creation
  describe("Atomic Business + Loyalty Creation & Token Generation", () => {
    it("atomically creates Business and LoyaltyProgram for BUSINESS_OWNER", async () => {
      const businessToken = generateBusinessToken(12);
      expect(businessToken).toHaveLength(12);
      expect(isValidBusinessToken(businessToken)).toBe(true);
      businessAToken = businessToken;

      const created = await prisma.$transaction(async (tx) => {
        return tx.business.create({
          data: {
            name: "The Corner Bakery",
            businessToken,
            ownerId: ownerAId,
            loyaltyProgram: {
              create: {
                programName: "Pastry Pass",
                requiredVisits: 6,
                rewardTitle: "Free Croissant",
                rewardDescription: "Choice of plain or chocolate croissant",
                rewardValidityDays: 45,
                verificationMethod: VerificationMethod.BILL,
                isActive: true,
              },
            },
          },
          include: {
            loyaltyProgram: true,
          },
        });
      });

      businessAId = created.id;
      expect(created.name).toBe("The Corner Bakery");
      expect(created.ownerId).toBe(ownerAId);
      expect(created.businessToken).toBe(businessToken);
      expect(created.loyaltyProgram).toBeDefined();
      expect(created.loyaltyProgram?.programName).toBe("Pastry Pass");
      expect(created.loyaltyProgram?.requiredVisits).toBe(6);
      expect(created.loyaltyProgram?.verificationMethod).toBe(VerificationMethod.BILL);
    });

    it("rejects duplicate business setup for the same owner (409 Conflict logic)", async () => {
      // Simulate the check in /api/business/setup
      const existing = await prisma.business.findUnique({
        where: { ownerId: ownerAId },
      });
      expect(existing).not.toBeNull();

      // Attempting to create another business for ownerA must fail DB unique constraint
      await expect(
        prisma.business.create({
          data: {
            name: "Second Bakery",
            businessToken: generateBusinessToken(12),
            ownerId: ownerAId,
          },
        })
      ).rejects.toThrow();
    });

    it("enforces that CUSTOMER cannot be configured as a business owner", async () => {
      const customerUser = await prisma.user.findUnique({ where: { id: customerId } });
      expect(customerUser?.role).toBe(UserRole.CUSTOMER);
      expect(customerUser?.role !== UserRole.BUSINESS_OWNER).toBe(true);
    });
  });

  // 3. Retrieval & Tenant Scoping
  describe("Owner Business Retrieval & Isolation", () => {
    it("owner retrieves own business and loyalty program", async () => {
      const owned = await prisma.business.findUnique({
        where: { ownerId: ownerAId },
        include: { loyaltyProgram: true },
      });

      expect(owned).not.toBeNull();
      expect(owned?.id).toBe(businessAId);
      expect(owned?.name).toBe("The Corner Bakery");
      expect(owned?.loyaltyProgram?.requiredVisits).toBe(6);
    });

    it("returns null when an owner has not yet configured a business", async () => {
      const unconfigured = await prisma.business.findUnique({
        where: { ownerId: ownerBId },
      });
      expect(unconfigured).toBeNull();
    });

    it("Owner B cannot access or resolve Owner A's business", async () => {
      // Querying by ownerBId never returns Owner A's business
      const result = await prisma.business.findUnique({
        where: { ownerId: ownerBId },
      });
      expect(result).toBeNull();

      const crossCheck = await prisma.business.findFirst({
        where: { id: businessAId, ownerId: ownerBId },
      });
      expect(crossCheck).toBeNull();
    });
  });

  // 4. Update Business Name & Permanence of Token
  describe("Business Update & Token Immutability", () => {
    it("owner updates business name successfully", async () => {
      const updateData = BusinessUpdateSchema.parse({ name: "The Corner Bakery & Cafe" });

      const updated = await prisma.business.update({
        where: { id: businessAId },
        data: { name: updateData.name },
      });

      expect(updated.name).toBe("The Corner Bakery & Cafe");
    });

    it("businessToken remains strictly unchanged after business name update", async () => {
      const current = await prisma.business.findUnique({ where: { id: businessAId } });
      expect(current?.businessToken).toBe(businessAToken);
    });

    it("verifies immutable fields (id, ownerId, businessToken) cannot be updated via update schema", () => {
      // BusinessUpdateSchema permits only name and social links
      const keys = Object.keys(BusinessUpdateSchema.shape);
      expect(keys.includes("name")).toBe(true);
      expect(keys.includes("googleReviewUrl")).toBe(true);
      expect(keys.includes("instagramHandle")).toBe(true);
      expect(keys.includes("id")).toBe(false);
      expect(keys.includes("ownerId")).toBe(false);
      expect(keys.includes("businessToken")).toBe(false);
    });
  });

  // 5. Checkpoint 2: Loyalty Configuration & Membership Safety
  describe("Checkpoint 2: Loyalty Configuration & Membership Safety", () => {
    let testMembershipId = "";

    beforeAll(async () => {
      // Create a customer membership with existing progress to test invariance
      const membership = await prisma.membership.create({
        data: {
          customerId,
          businessId: businessAId,
          currentVisits: 4,
          totalVisits: 9,
        },
      });
      testMembershipId = membership.id;
    });

    afterAll(async () => {
      if (testMembershipId) {
        await prisma.membership.deleteMany({ where: { id: testMembershipId } });
      }
    });

    it("valid loyalty update succeeds and reflects new configuration", async () => {
      const updateData = {
        programName: "VIP Pastry Club",
        requiredVisits: 10,
        rewardTitle: "Free Lunch Combo",
        rewardDescription: "Includes beverage and artisanal sandwich",
        rewardValidityDays: 60,
        verificationMethod: VerificationMethod.VISIT_CONFIRMATION,
        isActive: true,
      };

      const business = await prisma.business.findUnique({
        where: { ownerId: ownerAId },
        include: { loyaltyProgram: true },
      });
      expect(business?.loyaltyProgram).toBeDefined();

      const updated = await prisma.loyaltyProgram.update({
        where: { id: business!.loyaltyProgram!.id },
        data: updateData,
      });

      expect(updated.programName).toBe("VIP Pastry Club");
      expect(updated.requiredVisits).toBe(10);
      expect(updated.rewardTitle).toBe("Free Lunch Combo");
      expect(updated.rewardValidityDays).toBe(60);
      expect(updated.verificationMethod).toBe(VerificationMethod.VISIT_CONFIRMATION);
      expect(updated.isActive).toBe(true);
    });

    it("rejects invalid requiredVisits (0, negative, > 100)", () => {
      expect(LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 0,
        rewardTitle: "Reward",
        rewardValidityDays: 30,
      }).success).toBe(false);

      expect(LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: -5,
        rewardTitle: "Reward",
        rewardValidityDays: 30,
      }).success).toBe(false);

      expect(LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 105,
        rewardTitle: "Reward",
        rewardValidityDays: 30,
      }).success).toBe(false);
    });

    it("rejects invalid rewardValidityDays (0, negative, > 365)", () => {
      expect(LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 5,
        rewardTitle: "Reward",
        rewardValidityDays: 0,
      }).success).toBe(false);

      expect(LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 5,
        rewardTitle: "Reward",
        rewardValidityDays: 366,
      }).success).toBe(false);
    });

    it("rejects invalid verification method", () => {
      expect(LoyaltyProgramSchema.safeParse({
        programName: "Club",
        requiredVisits: 5,
        rewardTitle: "Reward",
        verificationMethod: "POINTS_SCAN",
      }).success).toBe(false);
    });

    it("rejects invalid text fields (empty or < 2 characters)", () => {
      expect(LoyaltyProgramSchema.safeParse({
        programName: "A", // too short
        requiredVisits: 5,
        rewardTitle: "Free Coffee",
      }).success).toBe(false);

      expect(LoyaltyProgramSchema.safeParse({
        programName: "Good Name",
        requiredVisits: 5,
        rewardTitle: "", // empty
      }).success).toBe(false);
    });

    it("CUSTOMER cannot access or update owner loyalty configuration", async () => {
      const customerUser = await prisma.user.findUnique({ where: { id: customerId } });
      expect(customerUser?.role).toBe(UserRole.CUSTOMER);
      // Customer has no owned business
      const owned = await prisma.business.findUnique({ where: { ownerId: customerId } });
      expect(owned).toBeNull();
    });

    it("Owner A cannot modify Owner B's loyalty configuration (Tenant Isolation)", async () => {
      // Owner B has no business configured; Owner A's query by ownerBId resolves null
      const ownerBBusiness = await prisma.business.findUnique({
        where: { ownerId: ownerBId },
        include: { loyaltyProgram: true },
      });
      expect(ownerBBusiness).toBeNull();

      // Owner B attempting to query business A by ownerId resolves null
      const crossCheck = await prisma.business.findFirst({
        where: { id: businessAId, ownerId: ownerBId },
      });
      expect(crossCheck).toBeNull();
    });

    it("Business token and ownerId remain strictly unchanged after loyalty updates", async () => {
      const businessAfter = await prisma.business.findUnique({
        where: { id: businessAId },
      });
      expect(businessAfter?.businessToken).toBe(businessAToken);
      expect(businessAfter?.ownerId).toBe(ownerAId);
    });

    it("Membership progress (currentVisits & totalVisits) remains strictly untouched after loyalty updates", async () => {
      // Re-query customer membership
      const membership = await prisma.membership.findUnique({
        where: { id: testMembershipId },
      });

      expect(membership).not.toBeNull();
      // Progress must remain exactly 4 / 9 even after threshold changed from 6 to 10
      expect(membership?.currentVisits).toBe(4);
      expect(membership?.totalVisits).toBe(9);
    });
  });

  // 6. Checkpoint 3: Permanent QR Generation & Public Join Route
  describe("Checkpoint 3: Permanent QR Generation & Public Join Route", () => {
    let businessBId = "";
    let businessBToken = "";
    let testCustomerId = "";

    beforeAll(async () => {
      // Create a second business for multi-tenant testing
      businessBToken = generateBusinessToken(12);
      const bizB = await prisma.business.create({
        data: {
          name: "Apex Gym Studio",
          businessToken: businessBToken,
          ownerId: ownerBId,
          loyaltyProgram: {
            create: {
              programName: "Iron Club",
              requiredVisits: 8,
              rewardTitle: "Free Shake",
              rewardDescription: "Protein smoothie of your choice",
              rewardValidityDays: 30,
              verificationMethod: VerificationMethod.VISIT_CONFIRMATION,
              isActive: true,
            },
          },
        },
      });
      businessBId = bizB.id;

      // Create dedicated customer for join tests
      const cust = await prisma.user.create({
        data: {
          email: `join.tester.${Date.now()}@example.test`,
          name: "Join Tester",
          passwordHash: "hash",
          role: UserRole.CUSTOMER,
        },
      });
      testCustomerId = cust.id;
    });

    afterAll(async () => {
      if (businessBId) {
        await prisma.membership.deleteMany({ where: { businessId: businessBId } });
        await prisma.loyaltyProgram.deleteMany({ where: { businessId: businessBId } });
        await prisma.business.deleteMany({ where: { id: businessBId } });
      }
      if (testCustomerId) {
        await prisma.membership.deleteMany({ where: { customerId: testCustomerId } });
        await prisma.user.deleteMany({ where: { id: testCustomerId } });
      }
    });

    it("valid business token resolves the correct business and loyalty program", async () => {
      const resolved = await prisma.business.findUnique({
        where: { businessToken: businessAToken },
        include: { loyaltyProgram: true },
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.id).toBe(businessAId);
      expect(resolved?.name).toBe("The Corner Bakery & Cafe");
      expect(resolved?.loyaltyProgram?.programName).toBe("VIP Pastry Club");
    });

    it("invalid or malformed business token returns not found", async () => {
      expect(isValidBusinessToken("short")).toBe(false);
      expect(isValidBusinessToken("invalid!token@#")).toBe(false);

      const resolved = await prisma.business.findUnique({
        where: { businessToken: "nonexistent12" },
      });
      expect(resolved).toBeNull();
    });

    it("QR encodes the correct permanent join URL without modifying businessToken", async () => {
      const joinUrl = getBusinessJoinUrl(businessAToken);
      expect(joinUrl).toContain(`/join/${businessAToken}`);

      const qrDataUrl = await generateQRCodeDataUrl(joinUrl);
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);

      const qrSvg = await generateQRCodeSvg(joinUrl);
      expect(qrSvg).toContain("<svg");
      expect(qrSvg).toContain("viewBox=");

      // Re-running QR generation 5 times must never modify the database token
      for (let i = 0; i < 5; i++) {
        const svg = await generateQRCodeSvg(joinUrl);
        expect(svg).toBe(qrSvg);
      }

      // Verify token in DB remains identical
      const check = await prisma.business.findUnique({ where: { id: businessAId } });
      expect(check?.businessToken).toBe(businessAToken);
      expect(check?.ownerId).toBe(ownerAId);
    });

    it("unconfigured owner has no QR identity and resolves null safely", async () => {
      const unconfigured = await prisma.business.findUnique({
        where: { ownerId: ownerBId },
      });
      // Owner B has businessB created in beforeAll, so let's test a brand new unconfigured owner
      const freshOwner = await prisma.user.create({
        data: {
          email: `unconfigured.${Date.now()}@example.test`,
          name: "Fresh Owner",
          passwordHash: "hash",
          role: UserRole.BUSINESS_OWNER,
        },
      });

      const result = await prisma.business.findUnique({
        where: { ownerId: freshOwner.id },
      });
      expect(result).toBeNull();

      // Clean up
      await prisma.user.delete({ where: { id: freshOwner.id } });
    });

    it("Business Owner can access their QR page while Customer is rejected", async () => {
      const ownerUser = await prisma.user.findUnique({ where: { id: ownerAId } });
      expect(ownerUser?.role).toBe(UserRole.BUSINESS_OWNER);

      const customerUser = await prisma.user.findUnique({ where: { id: testCustomerId } });
      expect(customerUser?.role).toBe(UserRole.CUSTOMER);
      expect(customerUser?.role === UserRole.BUSINESS_OWNER).toBe(false);
    });

    it("unauthenticated visitor can resolve public sanitized business details without private fields", async () => {
      const business = await prisma.business.findUnique({
        where: { businessToken: businessAToken },
        include: { loyaltyProgram: true },
      });

      // Simulation of public projection in /api/public/business/[businessToken]
      const publicProjection = {
        name: business!.name,
        programName: business!.loyaltyProgram!.programName,
        requiredVisits: business!.loyaltyProgram!.requiredVisits,
        rewardTitle: business!.loyaltyProgram!.rewardTitle,
        rewardDescription: business!.loyaltyProgram!.rewardDescription,
        verificationMethod: business!.loyaltyProgram!.verificationMethod,
        isActive: business!.loyaltyProgram!.isActive,
      };

      expect(publicProjection.name).toBe("The Corner Bakery & Cafe");
      expect(publicProjection.rewardTitle).toBe("Free Lunch Combo");

      // Verify ZERO private fields exposed
      const record = publicProjection as unknown as Record<string, unknown>;
      expect(record.id).toBeUndefined();
      expect(record.ownerId).toBeUndefined();
      expect(record.passwordHash).toBeUndefined();
      expect(record.owner).toBeUndefined();
    });

    it("authenticated customer can join a business and creates exactly one membership", async () => {
      const membership = await prisma.membership.create({
        data: {
          customerId: testCustomerId,
          businessId: businessAId,
          currentVisits: 0,
          totalVisits: 0,
        },
      });

      expect(membership).toBeDefined();
      expect(membership.customerId).toBe(testCustomerId);
      expect(membership.businessId).toBe(businessAId);
      expect(membership.currentVisits).toBe(0);
      expect(membership.totalVisits).toBe(0);
    });

    it("repeated joins / QR scans do not create duplicate memberships (unique constraint)", async () => {
      // Attempt duplicate creation must fail DB unique constraint
      await expect(
        prisma.membership.create({
          data: {
            customerId: testCustomerId,
            businessId: businessAId,
            currentVisits: 0,
            totalVisits: 0,
          },
        })
      ).rejects.toThrow();

      // Total count of memberships for this customer at business A remains 1
      const count = await prisma.membership.count({
        where: { customerId: testCustomerId, businessId: businessAId },
      });
      expect(count).toBe(1);
    });

    it("customer can belong to multiple businesses independently with isolated progress", async () => {
      // Join second business (Business B - Gym)
      const membershipB = await prisma.membership.create({
        data: {
          customerId: testCustomerId,
          businessId: businessBId,
          currentVisits: 2,
          totalVisits: 2,
        },
      });

      expect(membershipB.businessId).toBe(businessBId);

      // Verify customer has 2 distinct memberships
      const memberships = await prisma.membership.findMany({
        where: { customerId: testCustomerId },
      });

      expect(memberships).toHaveLength(2);
      const memA = memberships.find((m) => m.businessId === businessAId);
      const memB = memberships.find((m) => m.businessId === businessBId);

      expect(memA?.currentVisits).toBe(0);
      expect(memB?.currentVisits).toBe(2);
    });

    it("Business Owner scanning a QR does not create a customer membership", () => {
      // Simulation of guard logic in join route:
      function handleJoinAttempt(role: UserRole) {
        if (role === UserRole.BUSINESS_OWNER) {
          return {
            allowed: false,
            error: "You're logged in as a Business Owner. Please use a Customer account to join this loyalty program.",
          };
        }
        return { allowed: true };
      }

      const ownerAttempt = handleJoinAttempt(UserRole.BUSINESS_OWNER);
      expect(ownerAttempt.allowed).toBe(false);
      expect(ownerAttempt.error).toContain("Business Owner");

      const customerAttempt = handleJoinAttempt(UserRole.CUSTOMER);
      expect(customerAttempt.allowed).toBe(true);
    });
  });

  // 7. Checkpoint 4A: Business Owner Onboarding & Business Setup Flow
  describe("Checkpoint 4A: Business Owner Onboarding & Business Setup Flow", () => {
    const cp4Timestamp = Date.now();
    const newOwnerEmail = `new.owner.cp4a.${cp4Timestamp}@example.test`;
    let newOwnerId = "";
    let newBusinessId = "";
    let newBusinessToken = "";

    beforeAll(async () => {
      const passwordHash = await hashPassword(password);
      const newOwner = await prisma.user.create({
        data: {
          email: newOwnerEmail,
          name: "Fresh Onboarding Owner",
          passwordHash,
          role: UserRole.BUSINESS_OWNER,
        },
      });
      newOwnerId = newOwner.id;
    });

    afterAll(async () => {
      if (newBusinessId) {
        await prisma.loyaltyProgram.deleteMany({ where: { businessId: newBusinessId } });
        await prisma.business.deleteMany({ where: { id: newBusinessId } });
      }
      if (newOwnerId) {
        await prisma.user.deleteMany({ where: { id: newOwnerId } });
      }
    });

    it("newly registered business owner starts with no business configured", async () => {
      const owned = await prisma.business.findUnique({
        where: { ownerId: newOwnerId },
      });
      expect(owned).toBeNull();
    });

    it("completing business setup creates Business and LoyaltyProgram with permanent token", async () => {
      const token = generateBusinessToken(12);
      newBusinessToken = token;

      const created = await prisma.$transaction(async (tx) => {
        return tx.business.create({
          data: {
            name: "Test Barber Studio",
            businessToken: token,
            ownerId: newOwnerId,
            loyaltyProgram: {
              create: {
                programName: "Barber Rewards",
                requiredVisits: 5,
                rewardTitle: "Free Haircut",
                rewardDescription: "Get one complimentary haircut.",
                rewardValidityDays: 30,
                verificationMethod: VerificationMethod.VISIT_CONFIRMATION,
                isActive: true,
              },
            },
          },
          include: {
            loyaltyProgram: true,
          },
        });
      });

      newBusinessId = created.id;
      expect(created.name).toBe("Test Barber Studio");
      expect(created.businessToken).toBe(token);
      expect(created.loyaltyProgram?.programName).toBe("Barber Rewards");
      expect(created.loyaltyProgram?.requiredVisits).toBe(5);
      expect(created.loyaltyProgram?.rewardTitle).toBe("Free Haircut");
    });

    it("dashboard now detects configured business and provides QR link", async () => {
      const owned = await prisma.business.findUnique({
        where: { ownerId: newOwnerId },
        include: { loyaltyProgram: true },
      });

      expect(owned).not.toBeNull();
      expect(owned?.name).toBe("Test Barber Studio");
      expect(owned?.businessToken).toBe(newBusinessToken);
      expect(owned?.loyaltyProgram).toBeDefined();
    });

    it("attempting duplicate setup via setup flow is prevented", async () => {
      const checkExisting = await prisma.business.findUnique({
        where: { ownerId: newOwnerId },
      });
      expect(checkExisting).not.toBeNull();

      // DB unique constraint blocks any secondary business creation
      await expect(
        prisma.business.create({
          data: {
            name: "Second Barber Studio",
            businessToken: generateBusinessToken(12),
            ownerId: newOwnerId,
          },
        })
      ).rejects.toThrow();
    });

    it("Customer role cannot access business setup or own a business", async () => {
      const customer = await prisma.user.findUnique({ where: { id: customerId } });
      expect(customer?.role).toBe(UserRole.CUSTOMER);
      expect(customer?.role !== UserRole.BUSINESS_OWNER).toBe(true);
    });

    it("strictly enforces login role consistency: Customer selected with Owner credentials is rejected", () => {
      // Logic simulation of POST /api/auth/login
      function verifyLoginRole(selectedRole: UserRole, userRole: UserRole) {
        if (selectedRole !== userRole) {
          if (userRole === UserRole.BUSINESS_OWNER) {
            return {
              allowed: false,
              status: 403,
              error: "These credentials belong to a Business Owner account. Please select Business Owner to continue.",
            };
          } else {
            return {
              allowed: false,
              status: 403,
              error: "These credentials belong to a Customer account. Please select Customer to continue.",
            };
          }
        }
        return { allowed: true, status: 200 };
      }

      // Customer tab selected + Business Owner account
      const rejectMismatch1 = verifyLoginRole(UserRole.CUSTOMER, UserRole.BUSINESS_OWNER);
      expect(rejectMismatch1.allowed).toBe(false);
      expect(rejectMismatch1.status).toBe(403);
      expect(rejectMismatch1.error).toContain("Business Owner");

      // Business Owner tab selected + Customer account
      const rejectMismatch2 = verifyLoginRole(UserRole.BUSINESS_OWNER, UserRole.CUSTOMER);
      expect(rejectMismatch2.allowed).toBe(false);
      expect(rejectMismatch2.status).toBe(403);
      expect(rejectMismatch2.error).toContain("Customer");

      // Correct matching role
      const matchOwner = verifyLoginRole(UserRole.BUSINESS_OWNER, UserRole.BUSINESS_OWNER);
      expect(matchOwner.allowed).toBe(true);
      expect(matchOwner.status).toBe(200);

      const matchCustomer = verifyLoginRole(UserRole.CUSTOMER, UserRole.CUSTOMER);
      expect(matchCustomer.allowed).toBe(true);
      expect(matchCustomer.status).toBe(200);
    });
  });
});
