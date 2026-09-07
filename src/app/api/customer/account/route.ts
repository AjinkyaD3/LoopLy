import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireCustomer, invalidateSession } from "@/lib/auth";
import { CustomerUpdateSchema } from "@/lib/validations";
import { cookies } from "next/headers";

export async function PUT(req: Request) {
  try {
    const user = await requireCustomer();
    const body = await req.json();

    const data = CustomerUpdateSchema.parse(body);

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { name: data.name },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
      },
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN_NOT_CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Customer update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireCustomer();
    
    // Deleting the user will cascade and delete Memberships, Visits, VerificationRequests, Rewards, and Sessions.
    await prisma.user.delete({
      where: { id: user.id },
    });

    // We invalidate the session manually just in case, and clear the cookie
    const cookieStore = cookies();
    const token = cookieStore.get("looply_session")?.value;
    if (token) {
      await invalidateSession(token);
      cookieStore.delete("looply_session");
    }

    return NextResponse.json({ success: true, message: "Account deleted successfully" });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN_NOT_CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Customer deletion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
