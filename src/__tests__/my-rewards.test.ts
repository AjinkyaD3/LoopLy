import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../lib/prisma";
import { NextRequest } from "next/server";
import { GET as dashboardGET } from "../app/api/customer/dashboard/route";

let user1: any, user2: any;
let businessA: any, businessB: any;
let customerA: any, customerB: any;
const suffix = Date.now();
const testMobile = `555-MY-REWARDS-${suffix}`;

describe("My Rewards Dashboard API", () => {
  beforeAll(async () => {
    // 1. Create two owners
    user1 = await prisma.user.create({
      data: { name: "Owner V", email: `v.${suffix}@test.com`, passwordHash: "hash" },
    });
    user2 = await prisma.user.create({
      data: { name: "Owner S", email: `s.${suffix}@test.com`, passwordHash: "hash" },
    });

    // 2. Create two businesses, both plain visits programs
    businessA = await prisma.business.create({
      data: {
        ownerId: user1.id,
        name: "Visits Cafe",
        businessToken: `VISITS_DASH_${suffix}`,
        loyaltyProgram: {
          create: {
            programName: "Coffee Club",
            requiredVisits: 5,
            rewardTitle: "Free Coffee",
            rewardDescription: "Enjoy",
          },
        },
      },
      include: { loyaltyProgram: true },
    });

    businessB = await prisma.business.create({
      data: {
        ownerId: user2.id,
        name: "Salon Bliss",
        businessToken: `VISITS_DASH_B_${suffix}`,
        loyaltyProgram: {
          create: {
            programName: "Haircut Rewards",
            requiredVisits: 8,
            rewardTitle: "Free Haircut",
            rewardDescription: "Enjoy",
          },
        },
      },
      include: { loyaltyProgram: true },
    });

    // 3. Create customers and memberships using the SAME mobile number
    customerA = await prisma.customer.create({
      data: {
        mobileNumber: testMobile,
        businessId: businessA.id,
        name: "John Dash",
      },
    });
    await prisma.membership.create({
      data: {
        customerId: customerA.id,
        businessId: businessA.id,
        totalVisits: 3,
      },
    });

    customerB = await prisma.customer.create({
      data: {
        mobileNumber: testMobile,
        businessId: businessB.id,
        name: "John Dash",
      },
    });
    await prisma.membership.create({
      data: {
        customerId: customerB.id,
        businessId: businessB.id,
        totalVisits: 8,
      },
    });
  });

  afterAll(async () => {
    await prisma.reward.deleteMany({ where: { customerId: { in: [customerA.id, customerB.id] } } });
    await prisma.membership.deleteMany({ where: { customerId: { in: [customerA.id, customerB.id] } } });
    await prisma.customer.deleteMany({ where: { mobileNumber: testMobile } });
    await prisma.loyaltyProgram.deleteMany({ where: { businessId: { in: [businessA.id, businessB.id] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessA.id, businessB.id] } } });
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

  it("should return correct progress for a mobile number across multiple businesses", async () => {
    const req = new NextRequest(`http://localhost/api/customer/dashboard?mobileNumber=${testMobile}`);
    const res = await dashboardGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.memberships.length).toBe(2);

    const cafeData = data.memberships.find((m: any) => m.businessName === "Visits Cafe");
    const salonData = data.memberships.find((m: any) => m.businessName === "Salon Bliss");

    expect(cafeData).toBeDefined();
    expect(cafeData.programName).toBe("Coffee Club");
    expect(cafeData.progress.currentVisits).toBe(3);
    expect(cafeData.progress.requiredVisits).toBe(5);
    expect(cafeData.progress.rewardAvailable).toBe(false);
    expect(cafeData.progress.rewardTitle).toBe("Free Coffee");

    expect(salonData).toBeDefined();
    expect(salonData.progress.currentVisits).toBe(8);
    expect(salonData.progress.requiredVisits).toBe(8);
    expect(salonData.progress.rewardAvailable).toBe(true);
  });

  it("should return 400 for invalid mobile number", async () => {
    const req = new NextRequest("http://localhost/api/customer/dashboard?mobileNumber=12");
    const res = await dashboardGET(req);
    expect(res.status).toBe(400);
  });
});
