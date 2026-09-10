import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../lib/prisma";
import {
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  invalidateSession,
} from "../lib/auth";
import { checkRateLimit, resetRateLimit } from "../lib/rate-limit";

describe("Password Hashing & Security", () => {
  it("hashes password with bcrypt so plaintext is never stored", async () => {
    const rawPassword = "SecretPassword123!";
    const hash = await hashPassword(rawPassword);

    expect(hash).not.toBe(rawPassword);
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt prefix
    expect(await verifyPassword(rawPassword, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword!", hash)).toBe(false);
  });
});

describe("Authentication & Registration Logic", () => {
  const testOwnerAEmail = "test.owner.a." + Date.now() + "@example.test";
  const testOwnerBEmail = "test.owner.b." + Date.now() + "@example.test";

  let createdOwnerAId = "";
  let createdOwnerBId = "";

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: {
        userId: { in: [createdOwnerAId, createdOwnerBId].filter(Boolean) },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [createdOwnerAId, createdOwnerBId].filter(Boolean) },
      },
    });
  });

  it("registers a business owner", async () => {
    const passwordHash = await hashPassword("OwnerPass123!");
    const owner = await prisma.user.create({
      data: {
        email: testOwnerAEmail.toLowerCase(),
        name: "Owner Alice",
        passwordHash,
      },
    });
    createdOwnerAId = owner.id;

    expect(owner.id).toBeDefined();
    expect(owner.email).toBe(testOwnerAEmail.toLowerCase());
  });
});

describe("Session Validation", () => {
  let tempUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `session.test.${Date.now()}@example.test`,
        name: "Session Tester",
        passwordHash: "hash",
      },
    });
    tempUserId = user.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: tempUserId } });
    await prisma.user.deleteMany({ where: { id: tempUserId } });
  });

  it("creates and validates an active server-side session", async () => {
    const session = await createSession(tempUserId);
    expect(session.sessionToken).toBeTruthy();

    const validated = await validateSession(session.sessionToken);
    expect(validated).not.toBeNull();
    expect(validated?.user.id).toBe(tempUserId);
    // Never returns passwordHash
    expect((validated?.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("invalidates session upon logout", async () => {
    const session = await createSession(tempUserId);
    expect(await validateSession(session.sessionToken)).not.toBeNull();

    await invalidateSession(session.sessionToken);
    expect(await validateSession(session.sessionToken)).toBeNull();
  });
});

describe("Tenant Isolation & Ownership Guards", () => {
  let ownerAId: string;
  let ownerBId: string;
  let businessAId: string;
  let businessBId: string;

  beforeAll(async () => {
    // Setup Owner A + Business A
    const ownerA = await prisma.user.create({
      data: {
        email: `tenant.a.${Date.now()}@example.test`,
        name: "Owner A",
        passwordHash: "hash",
      },
    });
    ownerAId = ownerA.id;

    const bizA = await prisma.business.create({
      data: {
        name: "Business A",
        businessToken: "token_biz_a_" + Date.now(),
        ownerId: ownerA.id,
      },
    });
    businessAId = bizA.id;

    // Setup Owner B + Business B
    const ownerB = await prisma.user.create({
      data: {
        email: `tenant.b.${Date.now()}@example.test`,
        name: "Owner B",
        passwordHash: "hash",
      },
    });
    ownerBId = ownerB.id;

    const bizB = await prisma.business.create({
      data: {
        name: "Business B",
        businessToken: "token_biz_b_" + Date.now(),
        ownerId: ownerB.id,
      },
    });
    businessBId = bizB.id;
  });

  afterAll(async () => {
    await prisma.business.deleteMany({
      where: { id: { in: [businessAId, businessBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerAId, ownerBId] } },
    });
  });

  it("enforces that Business A is strictly owned by Owner A and not Owner B", async () => {
    // Database check: query business by owner
    const bizA = await prisma.business.findUnique({ where: { ownerId: ownerAId } });
    const bizB = await prisma.business.findUnique({ where: { ownerId: ownerBId } });

    expect(bizA?.id).toBe(businessAId);
    expect(bizB?.id).toBe(businessBId);

    // Owner B cannot resolve Business A
    const crossCheck = await prisma.business.findFirst({
      where: { id: businessAId, ownerId: ownerBId },
    });
    expect(crossCheck).toBeNull();
  });
});

describe("Authentication Rate Limiting", () => {
  it("allows up to configured maximum and throttles excessive requests", () => {
    const testKey = "rate_limit_test_" + Date.now();
    resetRateLimit(testKey);

    // 5 requests allowed
    for (let i = 0; i < 5; i++) {
      const check = checkRateLimit(testKey, 5, 1000);
      expect(check.allowed).toBe(true);
    }

    // 6th request rejected
    const blockedCheck = checkRateLimit(testKey, 5, 1000);
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.remaining).toBe(0);
  });
});
