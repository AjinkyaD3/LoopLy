import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import prisma from "../lib/prisma";
import { UserRole } from "@prisma/client";

// Mocks for Auth and NextRequest
import { NextRequest } from "next/server";
import { PUT as loyaltyPUT } from "../app/api/business/loyalty/route";
import * as authLib from "../lib/auth";

let testOwner: any;
let testBusiness: any;

describe("Scratch Card Program Edit Lifecycle", () => {
  beforeAll(async () => {
    testOwner = await prisma.user.create({
      data: {
        name: "Dashboard Tester",
        email: "dashboard@test.com",
        passwordHash: "hashed_password",
      },
    });

    testBusiness = await prisma.business.create({
      data: {
        ownerId: testOwner.id,
        name: "Scratch Tester Cafe",
        businessToken: "TEST_DASH_123",
        loyaltyProgram: {
          create: {
            programName: "Test Scratch Program",
            type: "SCRATCH_CARD",
            rewardTitle: "Scratch Master",
            rewardDescription: "Win big",
            requiredVisits: 10,
            rewardValidityDays: 10,
            scratchCardPrizes: {
              create: [
                { title: "Prize 1", weight: 10 },
                { title: "Prize 2", weight: 20 },
                { title: "Prize 3", weight: 30 },
                { title: "Prize 4", weight: 40 },
                { title: "Prize 5", weight: 50 },
              ],
            },
          },
        },
      },
      include: { loyaltyProgram: true }
    });

    // Mock auth
    const authSpy = vi.spyOn(authLib, "requireOwnerBusiness");
    authSpy.mockResolvedValue({
      user: { id: testOwner.id, email: testOwner.email, name: testOwner.name },
      business: testBusiness
    } as any);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.scratchCardPrize.deleteMany({
      where: { loyaltyProgram: { businessId: testBusiness.id } },
    });
    await prisma.loyaltyProgram.deleteMany({ where: { businessId: testBusiness.id } });
    await prisma.business.deleteMany({ where: { ownerId: testOwner.id } });
    await prisma.user.delete({ where: { id: testOwner.id } });
    await prisma.$disconnect();
  });

  it("should preserve the SCRATCH_CARD type and update specific prize fields correctly when edited", async () => {
    // 1. Re-fetch program directly to confirm type = SCRATCH_CARD and 5 prizes
    const initialProgram = await prisma.loyaltyProgram.findUnique({
      where: { businessId: testBusiness.id },
      include: { scratchCardPrizes: true },
    });

    expect(initialProgram?.type).toBe("SCRATCH_CARD");
    expect(initialProgram?.scratchCardPrizes.length).toBe(5);

    // 2. Simulate editing the program via dashboard (like what BusinessDashboardTabs does)
    const payload = {
      type: "SCRATCH_CARD", // explicitly sending the type, like the fixed UI does
      programName: "Updated Scratch Program",
      requiredVisits: 10, // not used but part of schema
      rewardTitle: "Scratch Master 2.0",
      rewardDescription: "Win bigger",
      rewardValidityDays: 14,
      verificationMethod: "VISIT_CONFIRMATION",
      isActive: true,
      prizes: [
        { title: "Prize 1 Updated", description: "Nice", weight: 15 },
        { title: "Prize 2", description: "", weight: 20 },
        { title: "Prize 3", description: "", weight: 30 },
        { title: "Prize 4", description: "", weight: 40 },
        { title: "Prize 5", description: "", weight: 50 },
      ],
    };

    const req = new NextRequest("http://localhost/api/business/loyalty", {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });

    const res = await loyaltyPUT(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    // 3. Re-fetch from DB and verify it did NOT revert to VISITS and prizes are intact
    const updatedProgram = await prisma.loyaltyProgram.findUnique({
      where: { businessId: testBusiness.id },
      include: { scratchCardPrizes: { orderBy: { weight: "asc" } } },
    });

    expect(updatedProgram?.type).toBe("SCRATCH_CARD");
    expect(updatedProgram?.programName).toBe("Updated Scratch Program");
    expect(updatedProgram?.scratchCardPrizes.length).toBe(5);
    
    // Check if Prize 1 was updated
    const prize1 = updatedProgram?.scratchCardPrizes.find(p => p.title === "Prize 1 Updated");
    expect(prize1).toBeDefined();
    expect(prize1?.weight).toBe(15);
  });
});
