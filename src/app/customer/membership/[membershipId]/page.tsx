import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { UserRole, RequestStatus } from "@prisma/client";
import VisitRequestButton from "@/components/VisitRequestButton";
import InstagramButton from "@/components/InstagramButton";
import GoogleReviewModal from "@/components/GoogleReviewModal";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  XCircle,
  Store,
  Sparkles,
  TrendingUp,
  Receipt,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ membershipId: string }>;
}

export default async function MembershipDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.CUSTOMER) redirect("/login");
  const { membershipId } = await params;

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      business: { include: { loyaltyProgram: true } },
      verificationRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      visits: {
        orderBy: { visitedAt: "desc" },
        take: 10,
      },
      rewards: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Tenant check
  if (!membership || membership.customerId !== user.id) notFound();

  const program = membership.business.loyaltyProgram;
  if (!program) notFound();

  const hasPending = membership.verificationRequests.some(
    (r) => r.status === RequestStatus.PENDING
  );
  const progress = Math.min(membership.currentVisits, program.requiredVisits);
  const progressPct = Math.round((progress / program.requiredVisits) * 100);
  const now = new Date();

  const availableRewards = membership.rewards.filter(
    (r) => r.status === "AVAILABLE" && r.expiresAt > now
  );
  const redeemedRewards = membership.rewards.filter((r) => r.status === "REDEEMED");
  const expiredRewards = membership.rewards.filter(
    (r) => r.status === "EXPIRED" || (r.status === "AVAILABLE" && r.expiresAt <= now)
  );

  function statusBadge(status: RequestStatus) {
    if (status === "PENDING")
      return <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Pending</span>;
    if (status === "APPROVED")
      return <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Approved</span>;
    return <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold flex items-center gap-1"><XCircle className="w-2.5 h-2.5" /> Rejected</span>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/customer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> My Rewards
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-900 truncate">{membership.business.name}</span>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6 flex-1">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">{membership.business.name}</h1>
                <p className="text-xs text-slate-500">{program.programName}</p>
                {membership.business.instagramHandle && (
                  <InstagramButton handle={membership.business.instagramHandle} />
                )}
              </div>
            </div>
            {!program.isActive && (
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">Paused</span>
            )}
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Visit Progress</span>
              <span className={`font-bold ${progress >= program.requiredVisits ? "text-emerald-600" : "text-indigo-700"}`}>
                {progress} / {program.requiredVisits}
              </span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progress >= program.requiredVisits ? "bg-emerald-500" : "bg-indigo-500"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Lifetime: {membership.totalVisits} verified visits</span>
              {progress < program.requiredVisits && (
                <span>{program.requiredVisits - progress} more to earn reward</span>
              )}
            </div>
          </div>

          {/* Reward info */}
          <div className="pt-3 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-700">
            <Award className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <div>
              <span className="font-semibold">{program.rewardTitle}</span>
              {program.rewardDescription && (
                <p className="text-slate-500 mt-0.5">{program.rewardDescription}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            <span>Verification: {program.verificationMethod === "BILL" ? "Bill Upload" : "Visit Confirmation"}</span>
            <span>Reward valid: {program.rewardValidityDays} days</span>
          </div>
        </div>

        {/* Active Rewards */}
        {availableRewards.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Available Rewards
            </h2>
            {availableRewards.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-emerald-900">🎉 {r.title}</p>
                    {r.description && <p className="text-xs text-slate-600 mt-1">{r.description}</p>}
                    <p className="text-[11px] text-slate-400 mt-2">
                      Expires: {r.expiresAt.toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold whitespace-nowrap">
                    Ready to Claim
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-emerald-100 text-xs text-emerald-800">
                  Show this screen to the business owner to claim your reward.
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Submit Visit */}
        {program.isActive && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Record Today&apos;s Visit</h2>
            <p className="text-xs text-slate-500">
              {program.verificationMethod === "BILL"
                ? "Take a photo of your bill and upload it below. The business owner will approve your visit."
                : "Tap the button below when you're at the business. The owner will confirm your visit."}
            </p>
            <VisitRequestButton
              membershipId={membership.id}
              verificationMethod={program.verificationMethod}
              hasPending={hasPending}
            />
          </div>
        )}

        {/* Recent Visit History */}
        {membership.verificationRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Visit Requests
            </h2>
            <div className="space-y-2">
              {membership.verificationRequests.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      {r.method === "BILL" ? <Receipt className="w-3 h-3 text-slate-400" /> : <CheckCircle2 className="w-3 h-3 text-slate-400" />}
                      {r.method === "BILL" ? "Bill Upload" : "Visit Confirmation"}
                    </p>
                    <p className="text-slate-400 mt-0.5">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                    {r.rejectionReason && (
                      <p className="text-rose-600 mt-1 text-[11px]">Reason: {r.rejectionReason}</p>
                    )}
                  </div>
                  {statusBadge(r.status)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past Rewards */}
        {(redeemedRewards.length > 0 || expiredRewards.length > 0) && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Past Rewards</h2>
            <div className="space-y-2">
              {redeemedRewards.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-semibold text-slate-700">{r.title}</p>
                    <p className="text-slate-400 mt-0.5">Redeemed {r.redeemedAt ? new Date(r.redeemedAt).toLocaleDateString() : ""}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">Redeemed</span>
                </div>
              ))}
              {expiredRewards.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <p className="font-semibold text-slate-500">{r.title}</p>
                    <p className="text-slate-400 mt-0.5">Expired {new Date(r.expiresAt).toLocaleDateString()}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">Expired</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        Looply &copy; {new Date().getFullYear()} — Simple Small Business Loyalty
      </footer>

      <GoogleReviewModal
        membershipId={membership.id}
        businessName={membership.business.name}
        googleReviewUrl={membership.business.googleReviewUrl || ""}
        currentVisits={membership.currentVisits}
        reviewPromptedAt={membership.reviewPromptedAt}
      />
    </div>
  );
}
