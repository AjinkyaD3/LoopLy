import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../lib/prisma";
import { NextRequest } from "next/server";
import { GET as dashboardGET } from "../app/api/customer/dashboard/route";

let user1: any, user2: any;
let businessVisits: any, businessScratch: any;
let customerVisits: any, customerScratch: any;
let membershipVisits: any, membershipScratch: any;
const testMobile = "555-MY-REWARDS";

describe("My Rewards Dashboard API", () => {
  beforeAll(async () => {
    // 1. Create two owners
    user1 = await prisma.user.create({
      data: { name: "Owner V", email: "v@test.com", passwordHash: "hash" },
    });
    user2 = await prisma.user.create({
      data: { name: "Owner S", email: "s@test.com", passwordHash: "hash" },
    });

    // 2. Create two businesses
    businessVisits = await prisma.business.create({
      data: {
        ownerId: user1.id,
        name: "Visits Cafe",
        businessToken: "VISITS_DASH",
        loyaltyProgram: {
          create: {
            programName: "Coffee Club",
            type: "VISITS",
            requiredVisits: 5,
            rewardTitle: "Free Coffee",
            rewardDescription: "Enjoy",
          },
        },
      },
      include: { loyaltyProgram: true },
    });

    businessScratch = await prisma.business.create({
      data: {
        ownerId: user2.id,
        name: "Scratch Store",
        businessToken: "SCRATCH_DASH",
        loyaltyProgram: {
          create: {
            programName: "Lucky Spin",
            type: "SCRATCH_CARD",
            rewardTitle: "Spin & Win",
            rewardDescription: "Good luck",
          },
        },
      },
      include: { loyaltyProgram: true },
    });

    // 3. Create customers and memberships using the SAME mobile number
    customerVisits = await prisma.customer.create({
      data: {
        mobileNumber: testMobile,
        businessId: businessVisits.id,
        name: "John Dash",
      },
    });
    membershipVisits = await prisma.membership.create({
      data: {
        customerId: customerVisits.id,
        businessId: businessVisits.id,
        currentVisits: 3,
        totalVisits: 3,
      },
    });

    customerScratch = await prisma.customer.create({
      data: {
        mobileNumber: testMobile,
        businessId: businessScratch.id,
        name: "John Dash",
      },
    });
    membershipScratch = await prisma.membership.create({
      data: {
        customerId: customerScratch.id,
        businessId: businessScratch.id,
      },
    });

    // 4. Create a past reward win for the Scratch Card business
    await prisma.reward.create({
      data: {
        membershipId: membershipScratch.id,
        businessId: businessScratch.id,
        customerId: customerScratch.id,
        loyaltyProgramId: businessScratch.loyaltyProgram!.id,
        title: "Lucky Spin",
        description: "Spin & Win",
        type: "SCRATCH_CARD",
        status: "AVAILABLE",
        revealedPrize: "Free Cookie",
        isScratched: true,
        expiresAt: new Date(Date.now() + 100000000),
      },
    });
  });

  afterAll(async () => {
    await prisma.reward.deleteMany({ where: { customerId: { in: [customerVisits.id, customerScratch.id] } } });
    await prisma.membership.deleteMany({ where: { customerId: { in: [customerVisits.id, customerScratch.id] } } });
    await prisma.customer.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.loyaltyProgram.deleteMany({ where: { businessId: { in: [businessVisits.id, businessScratch.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessVisits.id, businessScratch.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });
    await prisma.$disconnect();
  });

  it("should return empty array for non-existent mobile number", async () => {
    const req = new NextRequest("http://localhost/api/customer/dashboard?mobileNumber=000-000-0000");
    const res = await dashboardGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.memberships).toEqual([]);
  });

  it("should return correct data for a mobile number across multiple businesses", async () => {
    const req = new NextRequest(`http://localhost/api/customer/dashboard?mobileNumber=${testMobile}`);
    const res = await dashboardGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.memberships.length).toBe(2);

    const visitsData = data.memberships.find((m: any) => m.programType === "VISITS");
    const scratchData = data.memberships.find((m: any) => m.programType === "SCRATCH_CARD");

    expect(visitsData).toBeDefined();
    expect(visitsData.businessName).toBe("Visits Cafe");
    expect(visitsData.programName).toBe("Coffee Club");
    expect(visitsData.progress.currentVisits).toBe(3);
    expect(visitsData.progress.requiredVisits).toBe(5);
    expect(visitsData.progress.rewardAvailable).toBe(false);
    expect(visitsData.progress.rewardTitle).toBe("Free Coffee");

    expect(scratchData).toBeDefined();
    expect(scratchData.businessName).toBe("Scratch Store");
    expect(scratchData.wins.length).toBe(1);
    expect(scratchData.wins[0].title).toBe("Free Cookie");
    expect(scratchData.wins[0].date).toBeDefined();
  });

  it("should return 400 for invalid mobile number", async () => {
    const req = new NextRequest("http://localhost/api/customer/dashboard?mobileNumber=12");
    const res = await dashboardGET(req);
    expect(res.status).toBe(400);
  });
});
