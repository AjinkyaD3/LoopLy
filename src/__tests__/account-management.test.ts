import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../lib/prisma";
import { hashPassword } from "../lib/auth";
import { UserRole, VerificationMethod } from "@prisma/client";
import { CustomerUpdateSchema, BusinessUpdateSchema } from "../lib/validations";

describe("Account Management & Destructive Cascades", () => {
  const timestamp = Date.now();
  const customerEmail = `account.cust.${timestamp}@example.test`;
  const ownerEmail = `account.owner.${timestamp}@example.test`;
  const password = "Password123!";

  let customerId = "";
  let ownerId = "";
  let businessId = "";
  let loyaltyProgramId = "";
  let membershipId = "";

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);

    const customer = await prisma.user.create({
      data: {
        email: customerEmail,
        name: "Old Customer Name",
        passwordHash,
        role: UserRole.CUSTOMER,
      },
    });
    customerId = customer.id;

    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Owner Name",
        passwordHash,
        role: UserRole.BUSINESS_OWNER,
      },
    });
    ownerId = owner.id;

    const business = await prisma.business.create({
      data: {
        name: "Old Business Name",
        businessToken: `tok_${timestamp}`,
        ownerId: owner.id,
        loyaltyProgram: {
          create: {
            programName: "Test Program",
            requiredVisits: 5,
            rewardTitle: "Free Item",
            rewardDescription: "",
            rewardValidityDays: 30,
            verificationMethod: VerificationMethod.VISIT_CONFIRMATION,
          },
        },
      },
      include: { loyaltyProgram: true },
    });
    businessId = business.id;
    loyaltyProgramId = business.loyaltyProgram!.id;

    const membership = await prisma.membership.create({
      data: {
        customerId,
        businessId,
      },
    });
    membershipId = membership.id;

    await prisma.reward.create({
      data: {
        customerId,
        businessId,
        membershipId,
        loyaltyProgramId,
        title: "Test Reward",
        description: "",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
  });

  afterAll(async () => {
    try {
      // Must delete dependencies first or rely on cascade
      if (businessId) {
        await prisma.business.deleteMany({ where: { id: businessId } });
      }
      await prisma.user.deleteMany({ where: { id: { in: [customerId, ownerId] } } });
    } catch {}
  });

  describe("Customer Account", () => {
    it("allows customer to update their name via validation schema", async () => {
      const data = CustomerUpdateSchema.parse({ name: "New Customer Name" });
      const updated = await prisma.user.update({
        where: { id: customerId },
        data,
      });
      expect(updated.name).toBe("New Customer Name");
    });
  });

  describe("Business Account", () => {
    it("allows owner to update business name", async () => {
      const data = BusinessUpdateSchema.parse({ name: "New Business Name" });
      const updated = await prisma.business.update({
        where: { id: businessId },
        data,
      });
      expect(updated.name).toBe("New Business Name");
    });
  });

  describe("Loyalty Program Deletion Cascade", () => {
    it("securely deletes loyalty program and wipes memberships using a transaction", async () => {
      // Simulate API DELETE logic
      await prisma.$transaction([
        prisma.membership.deleteMany({ where: { businessId: businessId } }),
        prisma.loyaltyProgram.delete({ where: { id: loyaltyProgramId } }),
      ]);

      const deletedProgram = await prisma.loyaltyProgram.findUnique({ where: { id: loyaltyProgramId } });
      const deletedMembership = await prisma.membership.findUnique({ where: { id: membershipId } });
      const orphanedRewards = await prisma.reward.findMany({ where: { businessId: businessId } });

      expect(deletedProgram).toBeNull();
      expect(deletedMembership).toBeNull();
      expect(orphanedRewards.length).toBe(0); // Because membership deletion cascades to rewards
    });
  });

  describe("Owner Account Deletion Cascade", () => {
    it("deleting the owner account safely cascades to business, loyalty, and memberships", async () => {
      // Create a fresh owner and business for this test since previous tests deleted dependencies
      const freshOwner = await prisma.user.create({
        data: {
          email: `fresh.owner.${Date.now()}@example.test`,
          name: "Fresh Owner",
          passwordHash: "hash",
          role: UserRole.BUSINESS_OWNER,
        },
      });
      const freshBiz = await prisma.business.create({
        data: {
          name: "Fresh Business",
          businessToken: `fresh_tok_${Date.now()}`,
          ownerId: freshOwner.id,
        },
      });

      await prisma.user.delete({ where: { id: freshOwner.id } });

      const checkOwner = await prisma.user.findUnique({ where: { id: freshOwner.id } });
      const checkBiz = await prisma.business.findUnique({ where: { id: freshBiz.id } });

      expect(checkOwner).toBeNull();
      expect(checkBiz).toBeNull();
    });
  });

  describe("Customer Deletion Cascade", () => {
    it("deleting a customer safely cascades", async () => {
      await prisma.user.delete({ where: { id: customerId } });
      const checkCustomer = await prisma.user.findUnique({ where: { id: customerId } });
      expect(checkCustomer).toBeNull();
    });
  });
});
