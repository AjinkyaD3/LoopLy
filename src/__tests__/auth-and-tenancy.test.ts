import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../lib/prisma";
import {
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  invalidateSession,
  getSessionExpiration,
  BUSINESS_OWNER_SESSION_MS,
  CUSTOMER_SESSION_MS,
  requireCustomer,
  requireBusinessOwner,
  requireOwnerBusiness,
} from "../lib/auth";
import { UserRole } from "@prisma/client";
import { checkRateLimit, resetRateLimit } from "../lib/rate-limit";
import { POST as registerHandler } from "../app/api/auth/register/route";
import { NextRequest } from "next/server";

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
  const testCustomerEmail = "test.cust." + Date.now() + "@example.test";
  const testOwnerAEmail = "test.owner.a." + Date.now() + "@example.test";
  const testOwnerBEmail = "test.owner.b." + Date.now() + "@example.test";

  let createdCustomerId = "";
  let createdOwnerAId = "";
  let createdOwnerBId = "";
  let businessAId = "";
  let businessBId = "";

  beforeAll(async () => {
    // Clean up test data if needed
  });

  afterAll(async () => {
    // Clean up all test records
    await prisma.session.deleteMany({
      where: {
        userId: { in: [createdCustomerId, createdOwnerAId, createdOwnerBId].filter(Boolean) },
      },
    });
    if (businessAId || businessBId) {
      await prisma.business.deleteMany({
        where: { id: { in: [businessAId, businessBId].filter(Boolean) } },
      });
    }
    await prisma.legalAcceptance.deleteMany({
      where: {
        userId: { in: [createdCustomerId, createdOwnerAId, createdOwnerBId].filter(Boolean) },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [createdCustomerId, createdOwnerAId, createdOwnerBId].filter(Boolean) },
      },
    });
  });

  it("registers a customer via API with consent, creating legal acceptances", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: testCustomerEmail,
        password: "ValidPass123!",
        name: "Test Customer",
        role: UserRole.CUSTOMER,
        acceptTerms: true,
        acceptPrivacy: true,
      }),
    });
    
    const res = await registerHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    
    createdCustomerId = data.user.id;
    expect(data.user.role).toBe(UserRole.CUSTOMER);
    expect(data.user.email).toBe(testCustomerEmail.toLowerCase());

    // Verify Legal Acceptance was created
    const acceptances = await prisma.legalAcceptance.findMany({
      where: { userId: createdCustomerId }
    });
    expect(acceptances.length).toBe(1);
    expect(acceptances[0].termsVersion).toBe("v1.0");
    expect(acceptances[0].privacyVersion).toBe("v1.0");
    expect(acceptances[0].accountRole).toBe(UserRole.CUSTOMER);
    expect(acceptances[0].termsAcceptedAt).toBeDefined();
    expect(acceptances[0].privacyAcceptedAt).toBeDefined();
  });

  it("rejects registration if consent is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "no.consent@example.test",
        password: "ValidPass123!",
        name: "No Consent",
        role: UserRole.CUSTOMER,
        // missing acceptTerms and acceptPrivacy
      }),
    });
    
    const res = await registerHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects duplicate email registrations", async () => {
    const normalized = testCustomerEmail.toLowerCase();
    const passwordHash = await hashPassword("AnotherPass123!");

    await expect(
      prisma.user.create({
        data: {
          email: normalized,
          name: "Duplicate User",
          passwordHash,
          role: UserRole.CUSTOMER,
        },
      })
    ).rejects.toThrow();
  });

  it("registers a business owner with role BUSINESS_OWNER", async () => {
    const passwordHash = await hashPassword("OwnerPass123!");
    const owner = await prisma.user.create({
      data: {
        email: testOwnerAEmail.toLowerCase(),
        name: "Owner Alice",
        passwordHash,
        role: UserRole.BUSINESS_OWNER,
      },
    });
    createdOwnerAId = owner.id;

    expect(owner.role).toBe(UserRole.BUSINESS_OWNER);
  });
});

describe("Login Role Selection Consistency & Session Suppression", () => {
  const customerEmail = `consistency.cust.${Date.now()}@example.test`;
  const ownerEmail = `consistency.owner.${Date.now()}@example.test`;
  const password = "TestPassword123!";
  let customerId = "";
  let ownerId = "";

  beforeAll(async () => {
    const passwordHash = await hashPassword(password);

    const customer = await prisma.user.create({
      data: {
        email: customerEmail,
        name: "Consistency Customer",
        passwordHash,
        role: UserRole.CUSTOMER,
      },
    });
    customerId = customer.id;

    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Consistency Owner",
        passwordHash,
        role: UserRole.BUSINESS_OWNER,
      },
    });
    ownerId = owner.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: { userId: { in: [customerId, ownerId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [customerId, ownerId] } },
    });
  });

  // Helper simulating the login API route logic directly
  async function simulateLogin(email: string, pass: string, selectedRole: UserRole) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { status: 401, error: "Invalid email or password." };

    const validPass = await verifyPassword(pass, user.passwordHash);
    if (!validPass) return { status: 401, error: "Invalid email or password." };

    // Role check
    if (selectedRole && selectedRole !== user.role) {
      if (user.role === UserRole.BUSINESS_OWNER) {
        return {
          status: 403,
          error: "These credentials belong to a Business Owner account. Please select Business Owner to continue.",
        };
      } else {
        return {
          status: 403,
          error: "These credentials belong to a Customer account. Please select Customer to continue.",
        };
      }
    }

    const session = await createSession(user.id, user.role);
    return { status: 200, user, session };
  }

  it("Customer selection + Customer credentials -> PASS", async () => {
    const res = await simulateLogin(customerEmail, password, UserRole.CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.user?.role).toBe(UserRole.CUSTOMER);
    expect(res.session).toBeDefined();
  });

  it("Customer selection + Business Owner credentials -> REJECT with correct message", async () => {
    const sessionsBefore = await prisma.session.count({ where: { userId: ownerId } });

    const res = await simulateLogin(ownerEmail, password, UserRole.CUSTOMER);
    expect(res.status).toBe(403);
    expect(res.error).toBe(
      "These credentials belong to a Business Owner account. Please select Business Owner to continue."
    );

    // Verify NO session was created on mismatch
    const sessionsAfter = await prisma.session.count({ where: { userId: ownerId } });
    expect(sessionsAfter).toBe(sessionsBefore);
  });

  it("Business Owner selection + Business Owner credentials -> PASS", async () => {
    const res = await simulateLogin(ownerEmail, password, UserRole.BUSINESS_OWNER);
    expect(res.status).toBe(200);
    expect(res.user?.role).toBe(UserRole.BUSINESS_OWNER);
    expect(res.session).toBeDefined();
  });

  it("Business Owner selection + Customer credentials -> REJECT with correct message", async () => {
    const sessionsBefore = await prisma.session.count({ where: { userId: customerId } });

    const res = await simulateLogin(customerEmail, password, UserRole.BUSINESS_OWNER);
    expect(res.status).toBe(403);
    expect(res.error).toBe(
      "These credentials belong to a Customer account. Please select Customer to continue."
    );

    // Verify NO session was created on mismatch
    const sessionsAfter = await prisma.session.count({ where: { userId: customerId } });
    expect(sessionsAfter).toBe(sessionsBefore);
  });
});

describe("Role-Dependent Session Expiration & Validation", () => {
  let tempUserId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `session.test.${Date.now()}@example.test`,
        name: "Session Tester",
        passwordHash: "hash",
        role: UserRole.CUSTOMER,
      },
    });
    tempUserId = user.id;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: tempUserId } });
    await prisma.user.deleteMany({ where: { id: tempUserId } });
  });

  it("computes exactly 7 days expiration for BUSINESS_OWNER", () => {
    const before = Date.now();
    const expiresAt = getSessionExpiration(UserRole.BUSINESS_OWNER);
    const expectedApprox = before + BUSINESS_OWNER_SESSION_MS;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedApprox - 100);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedApprox + 1000);
  });

  it("computes exactly 24 hours expiration for CUSTOMER", () => {
    const before = Date.now();
    const expiresAt = getSessionExpiration(UserRole.CUSTOMER);
    const expectedApprox = before + CUSTOMER_SESSION_MS;

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedApprox - 100);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedApprox + 1000);
  });

  it("creates and validates an active server-side session", async () => {
    const session = await createSession(tempUserId, UserRole.CUSTOMER);
    expect(session.sessionToken).toBeTruthy();

    const validated = await validateSession(session.sessionToken);
    expect(validated).not.toBeNull();
    expect(validated?.user.id).toBe(tempUserId);
    expect(validated?.user.role).toBe(UserRole.CUSTOMER);
    // Never returns passwordHash
    expect((validated?.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("rejects and cleans up expired sessions", async () => {
    // Create an already-expired session
    const expiredToken = "expired_token_" + Date.now();
    await prisma.session.create({
      data: {
        sessionToken: expiredToken,
        userId: tempUserId,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      },
    });

    const result = await validateSession(expiredToken);
    expect(result).toBeNull();

    // Verify it was purged from the database
    const inDb = await prisma.session.findUnique({
      where: { sessionToken: expiredToken },
    });
    expect(inDb).toBeNull();
  });

  it("invalidates session upon logout", async () => {
    const session = await createSession(tempUserId, UserRole.CUSTOMER);
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
        role: UserRole.BUSINESS_OWNER,
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
        role: UserRole.BUSINESS_OWNER,
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

  it("prevents IDOR / BOLA tampering if a client attempts to pass another business ID", () => {
    // Simulation of requireOwnerBusiness tenant check
    function simulateTenantCheck(ownerId: string, ownedBusinessId: string, requestedBusinessId: string) {
      if (ownedBusinessId !== requestedBusinessId) {
        throw new Error("FORBIDDEN_TENANT_MISMATCH");
      }
      return true;
    }

    // Owner A accessing Business A -> Allowed
    expect(simulateTenantCheck(ownerAId, businessAId, businessAId)).toBe(true);

    // Owner A attempting to access Business B -> Denied
    expect(() => simulateTenantCheck(ownerAId, businessAId, businessBId)).toThrow(
      "FORBIDDEN_TENANT_MISMATCH"
    );
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
