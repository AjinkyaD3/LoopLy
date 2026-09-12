"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VerificationMethod } from "@prisma/client";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  Gift,
  FileCheck,
  Receipt,
  ArrowLeft,
} from "lucide-react";

export default function CreateLoyaltyProgramPage() {
  const router = useRouter();

  const [programName, setProgramName] = useState("");
  const [requiredVisits, setRequiredVisits] = useState(5);
  const [windowType, setWindowType] = useState<"LIFETIME" | "ROLLING" | "FIXED_PERIOD">("LIFETIME");
  const [windowDays, setWindowDays] = useState(90);
  const [windowStartsAt, setWindowStartsAt] = useState("");
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [rewardValidityDays, setRewardValidityDays] = useState(30);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>(
    VerificationMethod.VISIT_CONFIRMATION
  );

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!programName.trim() || programName.trim().length < 2) {
      setError("Loyalty program name must be at least 2 characters.");
      return;
    }
    if (!rewardTitle.trim() || rewardTitle.trim().length < 2) {
      setError("Reward title must be at least 2 characters.");
      return;
    }
    if (rewardValidityDays < 1 || rewardValidityDays > 365) {
      setError("Reward validity days must be between 1 and 365.");
      return;
    }
    if (requiredVisits < 1 || requiredVisits > 100) {
      setError("Required visits must be between 1 and 100.");
      return;
    }
    if (windowType === "ROLLING" && (!windowDays || windowDays < 1)) {
      setError("Rolling window requires a number of days.");
      return;
    }
    if (windowType === "FIXED_PERIOD" && !windowStartsAt) {
      setError("Fixed period requires a start date.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        programName: programName.trim(),
        requiredVisits: Number(requiredVisits),
        windowType,
        windowDays: windowType === "ROLLING" ? Number(windowDays) : null,
        windowStartsAt: windowType === "FIXED_PERIOD" ? new Date(windowStartsAt).toISOString() : null,
        rewardTitle: rewardTitle.trim(),
        rewardDescription: rewardDescription.trim(),
        rewardValidityDays: Number(rewardValidityDays),
        verificationMethod,
        isActive: true,
      };

      const res = await fetch("/api/business/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create loyalty program.");
        setLoading(false);
        return;
      }

      router.push("/business");
      router.refresh();
    } catch {
      setError("Unable to connect to server. Please check your network.");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/business" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-semibold">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="text-sm font-black tracking-tight text-slate-900">
              Looply
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-8 sm:p-10 border-b border-slate-100 bg-slate-50/50">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Start a Loyalty Program
            </h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-lg">
              Customers collect visits to unlock a fixed reward. Looking for an instant-win
              promotion instead? Set up a{" "}
              <Link href="/business/campaigns/create" className="text-indigo-600 font-semibold underline underline-offset-2">
                Campaign
              </Link>{" "}
              — it&apos;s independent of this program.
            </p>
          </div>

          <div className="px-6 py-8 sm:p-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
                  <Gift className="w-3.5 h-3.5 text-indigo-600" />
                  General Details
                </div>

                <div>
                  <label htmlFor="program-name" className="block text-xs font-semibold text-slate-800 mb-1">
                    Program Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="program-name"
                    type="text"
                    required
                    value={programName}
                    onChange={(e) => setProgramName(e.target.value)}
                    placeholder="e.g. Haircut Rewards, Bean Loyalty Club"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="required-visits" className="block text-xs font-semibold text-slate-800 mb-1">
                      Required Visits <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="required-visits"
                      type="number"
                      min={1}
                      max={100}
                      required
                      value={requiredVisits}
                      onChange={(e) => setRequiredVisits(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="validity-days" className="block text-xs font-semibold text-slate-800 mb-1">
                      Reward Validity <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="validity-days"
                        type="number"
                        min={1}
                        max={365}
                        required
                        value={rewardValidityDays}
                        onChange={(e) => setRewardValidityDays(parseInt(e.target.value, 10) || 30)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">days</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-800">
                    How should the {requiredVisits}-visit threshold be counted?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["LIFETIME", "ROLLING", "FIXED_PERIOD"] as const).map((wt) => (
                      <button
                        key={wt}
                        type="button"
                        onClick={() => setWindowType(wt)}
                        className={`p-2.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                          windowType === wt
                            ? "bg-indigo-50 border-indigo-300 text-indigo-700 ring-1 ring-indigo-200"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {wt === "LIFETIME" ? "Lifetime" : wt === "ROLLING" ? "Rolling Window" : "Fixed Period"}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {windowType === "LIFETIME" && "Counts all approved visits ever, repeating every time the threshold is hit again."}
                    {windowType === "ROLLING" && "Counts visits within a trailing number of days — e.g. \"10 visits in the last 90 days.\""}
                    {windowType === "FIXED_PERIOD" && "Counts visits since a specific date you choose."}
                  </p>

                  {windowType === "ROLLING" && (
                    <div>
                      <label htmlFor="window-days" className="block text-xs font-semibold text-slate-800 mb-1">
                        Rolling Window (Days) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="window-days"
                        type="number"
                        min={1}
                        max={3650}
                        required
                        value={windowDays}
                        onChange={(e) => setWindowDays(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  )}

                  {windowType === "FIXED_PERIOD" && (
                    <div>
                      <label htmlFor="window-starts-at" className="block text-xs font-semibold text-slate-800 mb-1">
                        Counting Since <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="window-starts-at"
                        type="date"
                        required
                        value={windowStartsAt}
                        onChange={(e) => setWindowStartsAt(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="reward-title" className="block text-xs font-semibold text-slate-800 mb-1">
                    Reward Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="reward-title"
                    type="text"
                    required
                    value={rewardTitle}
                    onChange={(e) => setRewardTitle(e.target.value)}
                    placeholder="e.g. Free Haircut"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reward-description" className="block text-xs font-semibold text-slate-800 mb-1">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    id="reward-description"
                    rows={2}
                    value={rewardDescription}
                    onChange={(e) => setRewardDescription(e.target.value)}
                    placeholder="Provide details about the reward or event."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-200 mt-6">
                <label className="block text-xs font-semibold text-slate-800">
                  How should customer visits be verified? <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${verificationMethod === VerificationMethod.VISIT_CONFIRMATION ? "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                    <input
                      type="radio"
                      name="verificationMethod"
                      checked={verificationMethod === VerificationMethod.VISIT_CONFIRMATION}
                      onChange={() => setVerificationMethod(VerificationMethod.VISIT_CONFIRMATION)}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Visit Confirmation
                      </span>
                      <p className="text-slate-500 leading-relaxed text-[11px]">Customer says &quot;I&apos;m Visiting Today&quot;. You approve the visit.</p>
                    </div>
                  </label>
                  <label className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${verificationMethod === VerificationMethod.BILL ? "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                    <input
                      type="radio"
                      name="verificationMethod"
                      checked={verificationMethod === VerificationMethod.BILL}
                      onChange={() => setVerificationMethod(VerificationMethod.BILL)}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                        Bill Upload
                      </span>
                      <p className="text-slate-500 leading-relaxed text-[11px]">Customer uploads their bill. You review and approve it.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Program...
                    </>
                  ) : (
                    <>
                      Start Program
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
