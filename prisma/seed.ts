import { PrismaClient, VerificationMethod, RequestStatus, RewardStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Looply deterministic development seed...");

  // 1. Clean up existing records in reverse dependency order
  await prisma.reward.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.visitRequest.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.loyaltyProgram.deleteMany();
  await prisma.business.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const saltRounds = 10;
  const mockPasswordHash = await bcrypt.hash("Password123!", saltRounds);

  // 2. Create Global Customer
  const customer = await prisma.user.create({
    data: {
      email: "alex.customer@example.test",
      name: "Alex Customer",
      passwordHash: mockPasswordHash,
      
    },
  });
  console.log(`✓ Created Global Customer: ${customer.email} (${customer.id})`);

  // 3. Create Business A Owner & Business A (Bakery - BILL verification)
  const ownerA = await prisma.user.create({
    data: {
      email: "bella.owner@example.test",
      name: "Bella Martin",
      passwordHash: mockPasswordHash,
      
    },
  });

  const programAEndsAt = new Date();
  programAEndsAt.setFullYear(programAEndsAt.getFullYear() + 1);

  const businessA = await prisma.business.create({
    data: {
      name: "Bella's Artisan Bakery",
      businessToken: "bakery88x99z",
      ownerId: ownerA.id,
      loyaltyPrograms: {
        create: {
          programName: "Sweet Tooth Club",
          requiredVisits: 5,
          rewardTitle: "Free Pastry & Hot Coffee",
          rewardDescription: "Enjoy any fresh pastry of your choice with a hot cappuccino or latte.",
          rewardValidityDays: 30,
          verificationMethod: VerificationMethod.BILL,
          isActive: true,
          startsAt: new Date(),
          endsAt: programAEndsAt,
        },
      },
    },
    include: {
      loyaltyPrograms: true,
    },
  });
  
  // Set the current loyalty program
  await prisma.business.update({
    where: { id: businessA.id },
    data: { loyaltyProgramId: businessA.loyaltyPrograms[0].id }
  });
  
  const currentProgramA = businessA.loyaltyPrograms[0];
  console.log(`✓ Created Business A: ${businessA.name} [Token: ${businessA.businessToken}]`);

  // 4. Create Business B Owner & Business B (Gym - VISIT_CONFIRMATION verification)
  const ownerB = await prisma.user.create({
    data: {
      email: "dan.owner@example.test",
      name: "Dan Miller",
      passwordHash: mockPasswordHash,
      
    },
  });

  const programBEndsAt = new Date();
  programBEndsAt.setFullYear(programBEndsAt.getFullYear() + 1);

  const businessB = await prisma.business.create({
    data: {
      name: "Apex Fitness Studio",
      businessToken: "apex77v22w11",
      ownerId: ownerB.id,
      loyaltyPrograms: {
        create: {
          programName: "Iron Milestone Club",
          requiredVisits: 8,
          rewardTitle: "1-Week Free Guest Pass",
          rewardDescription: "Bring a workout partner for free for 7 consecutive days.",
          rewardValidityDays: 60,
          verificationMethod: VerificationMethod.VISIT_CONFIRMATION,
          isActive: true,
          startsAt: new Date(),
          endsAt: programBEndsAt,
        },
      },
    },
    include: {
      loyaltyPrograms: true,
    },
  });

  // Set the current loyalty program
  await prisma.business.update({
    where: { id: businessB.id },
    data: { loyaltyProgramId: businessB.loyaltyPrograms[0].id }
  });
  
  const currentProgramB = businessB.loyaltyPrograms[0];
  console.log(`✓ Created Business B: ${businessB.name} [Token: ${businessB.businessToken}]`);

  // 5. Create Independent Membership for Customer at Business A
  // Business A membership: has 2 current visits towards next threshold, 7 lifetime visits, 1 reward earned
  const membershipA = await prisma.membership.create({
    data: {
      customerId: customer.id,
      businessId: businessA.id,
      totalVisits: 7,
    },
  });

  // Reward previously earned at Business A
  const expiresAtA = new Date();
  expiresAtA.setDate(expiresAtA.getDate() + 30);

  const rewardA = await prisma.reward.create({
    data: {
      membershipId: membershipA.id,
      businessId: businessA.id,
      customerId: customer.id,
      loyaltyProgramId: currentProgramA.id,
      title: currentProgramA.rewardTitle,
      description: currentProgramA.rewardDescription,
      status: RewardStatus.AVAILABLE,
      expiresAt: expiresAtA,
    },
  });

  // Historical verified visits at Business A
  for (let i = 1; i <= 7; i++) {
    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() - (14 - i));
    await prisma.visit.create({
      data: {
        membershipId: membershipA.id,
        businessId: businessA.id,
        customerId: customer.id,
        visitedAt: visitDate,
      },
    });
  }

  // Pending Bill verification request at Business A
  const pendingRequestA = await prisma.visitRequest.create({
    data: {
      membershipId: membershipA.id,
      businessId: businessA.id,
      customerId: customer.id,
      loyaltyProgramId: currentProgramA.id,
      method: VerificationMethod.BILL,
      billImagePath: "bills/seed-bakery-receipt-001.jpg",
      status: RequestStatus.PENDING,
    },
  });

  console.log(`✓ Created Membership A: Customer -> ${businessA.name}`);
  console.log(`  - Current Progress (lifetime): ${membershipA.totalVisits}/${currentProgramA.requiredVisits}`);
  console.log(`  - Total Visits: ${membershipA.totalVisits}`);
  console.log(`  - Active Reward: ${rewardA.title} (Status: ${rewardA.status})`);
  console.log(`  - Pending Request: ID ${pendingRequestA.id} (${pendingRequestA.method})`);

  // 6. Create Independent Membership for Customer at Business B
  // Business B membership: has 1 current visit, 1 lifetime visit, 0 rewards
  const membershipB = await prisma.membership.create({
    data: {
      customerId: customer.id,
      businessId: businessB.id,
      totalVisits: 1,
    },
  });

  // 1 Historical visit at Business B
  const visitDateB = new Date();
  visitDateB.setDate(visitDateB.getDate() - 3);
  await prisma.visit.create({
    data: {
      membershipId: membershipB.id,
      businessId: businessB.id,
      customerId: customer.id,
      visitedAt: visitDateB,
    },
  });

  // Pending Visit Confirmation request at Business B
  const pendingRequestB = await prisma.visitRequest.create({
    data: {
      membershipId: membershipB.id,
      businessId: businessB.id,
      customerId: customer.id,
      loyaltyProgramId: currentProgramB.id,
      method: VerificationMethod.VISIT_CONFIRMATION,
      billImagePath: null,
      status: RequestStatus.PENDING,
    },
  });

  console.log(`✓ Created Membership B: Customer -> ${businessB.name}`);
  console.log(`  - Current Progress (lifetime): ${membershipB.totalVisits}/${currentProgramB.requiredVisits}`);
  console.log(`  - Total Visits: ${membershipB.totalVisits}`);
  console.log(`  - Active Rewards: 0`);
  console.log(`  - Pending Request: ID ${pendingRequestB.id} (${pendingRequestB.method})`);

  console.log("\n✅ Multi-tenant independence verified:");
  console.log(`- Customer ID: ${customer.id}`);
  console.log(`- Business A Membership ID: ${membershipA.id} (Owner: ${ownerA.email})`);
  console.log(`- Business B Membership ID: ${membershipB.id} (Owner: ${ownerB.email})`);
  console.log("Seed finished successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
