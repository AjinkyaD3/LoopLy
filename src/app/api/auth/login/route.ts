import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { UserLoginSchema } from "@/lib/validations";
import { verifyPassword, createSession, getSessionCookieOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting by client IP
    const clientIp = request.headers.get("x-forwarded-for") || "localhost";
    const rateCheck = checkRateLimit(`login:${clientIp}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    // 2. Parse & validate request body
    const body = await request.json();
    const parsed = UserLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const { email, password } = parsed.data;

    // 3. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 4. Find user by normalized email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 5. Verify password hash
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 6. Create server-side session
    const session = await createSession(user.id);

    // 7. Sanitize user data
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // 8. Set HTTP-only cookie
    const response = NextResponse.json({ success: true, user: safeUser }, { status: 200 });
    const cookieOptions = getSessionCookieOptions(session.expiresAt);
    response.cookies.set({
      ...cookieOptions,
      value: session.sessionToken,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login." },
      { status: 500 }
    );
  }
}
