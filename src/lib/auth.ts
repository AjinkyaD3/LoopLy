import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import * as bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

// =============================================================================
// CONSTANTS & SESSION CONFIGURATION
// =============================================================================

export const SESSION_COOKIE_NAME = "looply_session";

// Business Owner session: 7 days
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// PASSWORD HASHING
// =============================================================================

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// =============================================================================
// SESSION MANAGEMENT (Server-Side)
// =============================================================================

/**
 * Calculates session expiration date.
 */
export function getSessionExpiration(): Date {
  return new Date(Date.now() + SESSION_MS);
}

/**
 * Creates a server-side session in the database with cryptographically random token.
 */
export async function createSession(userId: string) {
  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = getSessionExpiration();

  const session = await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expiresAt,
    },
  });

  return session;
}

/**
 * Validates a session token server-side.
 * Returns the sanitized user (no password hash) or null if invalid/expired.
 */
export async function validateSession(sessionToken: string) {
  if (!sessionToken || typeof sessionToken !== "string") {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Reject expired sessions & purge from database
  if (session.expiresAt <= new Date()) {
    try {
      await prisma.session.delete({ where: { id: session.id } });
    } catch {
      // Ignore if already deleted
    }
    return null;
  }

  return {
    session,
    user: session.user as SafeUser,
  };
}

/**
 * Invalidates and deletes a server-side session.
 */
export async function invalidateSession(sessionToken: string): Promise<void> {
  if (!sessionToken) return;
  try {
    await prisma.session.delete({ where: { sessionToken } });
  } catch {
    // Session may already be deleted
  }
}

/**
 * Returns cookie options matching session expiration and environment security requirements.
 */
export function getSessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

// =============================================================================
// SERVER-SIDE AUTH GUARDS & CURRENT USER HELPERS
// =============================================================================

/**
 * Reads the session cookie and returns the authenticated user, or null if unauthenticated.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const result = await validateSession(token);
  return result?.user ?? null;
}

/**
 * Enforces that the request is from an authenticated BUSINESS_OWNER.
 * Throws an Error with code "UNAUTHORIZED".
 */
export async function requireBusinessOwner(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

/**
 * Strict Tenant Isolation Guard:
 * Derives business ownership directly from the authenticated session (`Business.ownerId === user.id`).
 * Never trusts a client-provided business ID for authorization.
 */
export async function requireOwnerBusiness(clientProvidedBusinessId?: string) {
  const owner = await requireBusinessOwner();

  const business = await prisma.business.findUnique({
    where: { ownerId: owner.id },
    include: { loyaltyProgram: true },
  });

  if (!business) {
    throw new Error("NO_OWNED_BUSINESS");
  }

  // If a specific business ID was requested by the caller, verify it matches the owned business
  if (clientProvidedBusinessId && business.id !== clientProvidedBusinessId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  return { owner, business };
}
