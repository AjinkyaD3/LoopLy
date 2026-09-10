import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { UserRegistrationSchema } from "@/lib/validations";
import { hashPassword, createSession, getSessionCookieOptions } from "@/lib/auth";
import { LEGAL_VERSIONS } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting by client IP
    const clientIp = request.headers.get("x-forwarded-for") || "localhost";
    const rateCheck = checkRateLimit(`register:${clientIp}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    // 2. Parse & validate request body
    const body = await request.json();
    const parsed = UserRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email, password, acceptTerms, acceptPrivacy } = parsed.data;

    // 3. Normalize email: lowercase & trimmed
    const normalizedEmail = email.trim().toLowerCase();

    // 4. Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists." },
        { status: 409 }
      );
    }

    // 5. Hash password (never plaintext)
    const passwordHash = await hashPassword(password);

    // 6. Create user (Only business owners now)
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        legalAcceptances: {
          create: {
            termsVersion: LEGAL_VERSIONS.terms,
            termsAcceptedAt: new Date(),
            privacyVersion: LEGAL_VERSIONS.privacy,
            privacyAcceptedAt: new Date(),
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 7. Create server-side session
    const session = await createSession(user.id);

    // 8. Set HTTP-only cookie
    const response = NextResponse.json({ success: true, user }, { status: 201 });
    const cookieOptions = getSessionCookieOptions(session.expiresAt);
    response.cookies.set({
      ...cookieOptions,
      value: session.sessionToken,
    });

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}
