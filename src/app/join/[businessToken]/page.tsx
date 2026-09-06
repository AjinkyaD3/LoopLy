import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@prisma/client";
import { isValidBusinessToken } from "@/lib/token";
import {
  Sparkles,
  Award,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface JoinPageProps {
  params: Promise<{
    businessToken: string;
  }>;
}

export default async function PublicJoinPage({ params }: JoinPageProps) {
  const { businessToken } = await params;

  if (!businessToken || !isValidBusinessToken(businessToken)) {
    return <NotFoundState />;
  }

  const business = await prisma.business.findUnique({
    where: { businessToken },
    include: { loyaltyProgram: true },
  });

  if (!business || !business.loyaltyProgram) {
    return <NotFoundState />;
  }

  const { name } = business;
  const program = business.loyaltyProgram;
  const user = await getCurrentUser();

  // If authenticated as CUSTOMER, ensure membership (idempotent)
  let isExistingMember = false;
  if (user && user.role === UserRole.CUSTOMER) {
    const existingMembership = await prisma.membership.findUnique({
      where: {
        customerId_businessId: {
          customerId: user.id,
          businessId: business.id,
        },
      },
    });

    if (existingMembership) {
      isExistingMember = true;
    } else {
      try {
        await prisma.membership.create({
          data: {
            customerId: user.id,
            businessId: business.id,
            currentVisits: 0,
            totalVisits: 0,
          },
        });
        isExistingMember = true;
      } catch {
        isExistingMember = true;
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 py-12 bg-slate-50 min-h-screen">
      <div className="w-full max-w-md bg-white sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-sm p-6 sm:p-8 space-y-6">
        {/* Header */}
        <header className="pb-4 text-center border-b border-slate-100">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-700 font-bold text-sm mb-4">
            <Sparkles className="w-4 h-4" /> Looply
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
            Official Loyalty Program
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
          <p className="mt-1 text-xs text-slate-500">{program.programName}</p>
        </header>

        {/* Loyalty Reward Highlight Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-slate-50 border border-indigo-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 block">
                Reward Benefit
              </span>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {program.rewardTitle}
              </h2>
            </div>
          </div>

          {program.rewardDescription && (
            <p className="text-xs text-slate-600 leading-relaxed pl-1">
              {program.rewardDescription}
            </p>
          )}

          <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between text-xs text-slate-600">
            <span>Required Visits:</span>
            <span className="font-bold text-slate-900">{program.requiredVisits} visits</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Verification:</span>
            <span className="font-semibold text-slate-800">
              {program.verificationMethod === "BILL" ? "Bill Upload" : "Visit Confirmation"}
            </span>
          </div>

          {!program.isActive && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>This loyalty program is temporarily paused.</span>
            </div>
          )}
        </div>

        {/* Dynamic Action Section */}
        <div className="space-y-3">
          {!user && (
            <div className="space-y-3">
              <p className="text-xs text-center text-slate-500 mb-2">
                Join {name}&apos;s loyalty club to start earning your reward.
              </p>
              <Link
                href={`/login?returnUrl=/join/${businessToken}&role=CUSTOMER`}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                Sign In as Customer
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/register?returnUrl=/join/${businessToken}&role=CUSTOMER`}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-2"
              >
                Create Customer Account
              </Link>
            </div>
          )}

          {user && user.role === UserRole.BUSINESS_OWNER && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                Business Owner Account Detected
              </div>
              <p className="leading-relaxed text-amber-800">
                You&apos;re logged in as a Business Owner. Please use a Customer account to join this loyalty program.
              </p>
              <Link
                href="/business"
                className="inline-flex items-center gap-1 text-indigo-700 font-semibold underline underline-offset-2 pt-1"
              >
                Return to Owner Dashboard →
              </Link>
            </div>
          )}

          {user && user.role === UserRole.CUSTOMER && isExistingMember && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-emerald-950">
                You&apos;re a member of {name}!
              </h3>
              <p className="text-emerald-700 leading-relaxed">
                Your membership is active and ready to record visits toward your {program.rewardTitle}.
              </p>
              <div className="pt-2">
                <Link
                  href="/customer"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors inline-flex items-center justify-center gap-2"
                >
                  View My Loyalty Cards
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        <footer className="pt-4 text-center text-xs text-slate-400">
          Looply &copy; {new Date().getFullYear()} — Simple Small Business Loyalty
        </footer>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6 py-12 bg-slate-50 min-h-screen">
      <div className="text-center space-y-3 max-w-xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-2">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Business Not Found</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          This loyalty QR code or join link is invalid or has expired. Please check with the business for a new link.
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            Go to Looply Home
          </Link>
        </div>
      </div>
    </div>
  );
}
