import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

import LogoutButton from "@/components/LogoutButton";
import BusinessDashboardTabs from "@/components/BusinessDashboardTabs";
import { getBusinessJoinUrl, generateQRCodeSvg, generateQRCodeDataUrl } from "@/lib/qr";
import {
  Store,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BusinessDashboardPage() {
  const user = await getCurrentUser();

  // Guard: Must be authenticated
  if (!user) {
    redirect("/login");
  }

  // Intelligently check if the owner has already configured a business
  const business = await prisma.business.findUnique({
    where: { ownerId: user.id },
    include: { loyaltyProgram: true },
  });

  // If business is configured, fetch live membership count & QR assets
  let joinUrl = "";
  let qrSvg = "";
  let qrDataUrl = "";
  let memberCount = 0;

  if (business && business.loyaltyProgram) {
    joinUrl = getBusinessJoinUrl(business.businessToken);
    [qrSvg, qrDataUrl, memberCount] = await Promise.all([
      generateQRCodeSvg(joinUrl),
      generateQRCodeDataUrl(joinUrl),
      prisma.membership.count({ where: { businessId: business.id } }),
    ]);
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                Looply
              </span>
            </Link>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
              Business Owner Hub
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right text-xs">
              <Link href="/business/settings" className="font-bold text-slate-900 hover:text-indigo-600 transition-colors">
                {user.name}
              </Link>
              <span className="text-[10px] text-slate-400">{user.email}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* STATE 1: Unconfigured Owner Onboarding */}
        {!business && (
          <div className="max-w-md mx-auto my-12 p-8 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md">
              <Store className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Welcome to Looply!
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                Let&apos;s set up your business. Create your business profile and loyalty program to generate your permanent counter QR code.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/business/setup"
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                Set Up My Business
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Takes under 60 seconds to configure</span>
            </div>
          </div>
        )}

        {/* STATE 2: Configured Business Management Dashboard */}
        {business && (
          <div className="space-y-6">
            {/* Owner Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {business.name}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Manage your business profile and loyalty program.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-xs flex items-center gap-1.5 select-all">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Token: {business.businessToken}
                </span>
                <Link
                  href="/business/campaigns"
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  Campaigns
                </Link>
                <Link
                  href="/business/settings"
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  Edit Profile
                </Link>
              </div>
            </div>

            {/* Loyalty Program Section */}
            {!business.loyaltyProgram ? (
              <div className="p-8 rounded-2xl bg-white border border-slate-200 border-dashed text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">No Active Loyalty Program</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Start rewarding your customers! Create a Visits or Scratch Card program to generate your permanent QR code.
                  </p>
                </div>
                <Link
                  href="/business/loyalty/create"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors"
                >
                  Start a Loyalty Program
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <BusinessDashboardTabs
                business={{
                  id: business.id,
                  name: business.name,
                  businessToken: business.businessToken,
                  loyaltyProgram: business.loyaltyProgram,
                }}
                joinUrl={joinUrl}
                qrSvg={qrSvg}
                qrDataUrl={qrDataUrl}
                memberCount={memberCount}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Looply &copy; {new Date().getFullYear()} — Simple Small Business Loyalty</span>
          <span className="flex items-center gap-1 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Protected by server-side 7-day owner session
          </span>
        </div>
      </footer>
    </div>
  );
}
