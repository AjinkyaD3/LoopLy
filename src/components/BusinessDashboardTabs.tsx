"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VerificationMethod } from "@prisma/client";
import QRCodeDisplay from "@/components/QRCodeDisplay";
import BusinessRequestsPanel from "@/components/BusinessRequestsPanel";
import BusinessRewardsPanel from "@/components/BusinessRewardsPanel";
import BusinessAnalyticsPanel from "@/components/BusinessAnalyticsPanel";
import BusinessMembersPanel from "@/components/BusinessMembersPanel";
import {
  QrCode,
  Award,
  CheckCircle2,
  AlertCircle,
  Save,
  Loader2,
  Building2,
  Gift,
  ClipboardList,
  UserCheck,
  Sparkles,
  X,
} from "lucide-react";

interface LoyaltyData {
  id: string;
  programName: string;
  requiredVisits: number;
  windowType: "LIFETIME" | "ROLLING" | "FIXED_PERIOD";
  windowDays: number | null;
  windowStartsAt: string | Date | null;
  rewardTitle: string;
  rewardDescription: string | null;
  rewardValidityDays: number;
  verificationMethod: VerificationMethod;
  isActive: boolean;
  retiredScratchNotice: boolean;
}

interface BusinessData {
  id: string;
  name: string;
  businessToken: string;
  loyaltyProgram: LoyaltyData;
}

interface BusinessDashboardTabsProps {
  business: BusinessData;
  joinUrl: string;
  qrSvg: string;
  qrDataUrl: string;
  memberCount: number;
}

export default function BusinessDashboardTabs({
  business,
  joinUrl,
  qrSvg,
  qrDataUrl,
}: BusinessDashboardTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "requests" | "rewards" | "members" | "qr" | "loyalty"
  >("overview");

  const [scratchNoticeVisible, setScratchNoticeVisible] = useState(business.loyaltyProgram.retiredScratchNotice);
  const [dismissingNotice, setDismissingNotice] = useState(false);

  const [programName, setProgramName] = useState(business.loyaltyProgram.programName);
  const [requiredVisits, setRequiredVisits] = useState(business.loyaltyProgram.requiredVisits);
  const [windowType, setWindowType] = useState(business.loyaltyProgram.windowType);
  const [windowDays, setWindowDays] = useState(business.loyaltyProgram.windowDays ?? 90);
  const [windowStartsAt, setWindowStartsAt] = useState(
    business.loyaltyProgram.windowStartsAt ? new Date(business.loyaltyProgram.windowStartsAt).toISOString().slice(0, 10) : ""
  );
  const [rewardTitle, setRewardTitle] = useState(business.loyaltyProgram.rewardTitle);
  const [rewardDescription, setRewardDescription] = useState(business.loyaltyProgram.rewardDescription || "");
  const [rewardValidityDays, setRewardValidityDays] = useState(business.loyaltyProgram.rewardValidityDays);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>(
    business.loyaltyProgram.verificationMethod
  );
  const [isActive, setIsActive] = useState(business.loyaltyProgram.isActive);

  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const [loyaltySuccess, setLoyaltySuccess] = useState<string | null>(null);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);

  async function handleDismissScratchNotice() {
    setDismissingNotice(true);
    try {
      await fetch("/api/business/loyalty/dismiss-scratch-notice", { method: "POST" });
      setScratchNoticeVisible(false);
    } finally {
      setDismissingNotice(false);
    }
  }

  async function handleUpdateLoyalty(e: React.FormEvent) {
    e.preventDefault();
    setLoyaltyError(null);
    setLoyaltySuccess(null);

    if (windowType === "ROLLING" && (!windowDays || windowDays < 1)) {
      setLoyaltyError("Rolling window requires a number of days.");
      return;
    }
    if (windowType === "FIXED_PERIOD" && !windowStartsAt) {
      setLoyaltyError("Fixed period requires a start date.");
      return;
    }

    setSavingLoyalty(true);

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
        isActive,
      };

      const res = await fetch("/api/business/loyalty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoyaltyError(data.error || "Failed to update loyalty settings.");
        setSavingLoyalty(false);
        return;
      }

      setLoyaltySuccess("Loyalty program updated successfully!");
      setSavingLoyalty(false);
      router.refresh();
      setTimeout(() => setLoyaltySuccess(null), 3000);
    } catch {
      setLoyaltyError("Network error. Please try again.");
      setSavingLoyalty(false);
    }
  }

  return (
    <div className="space-y-6">
      {scratchNoticeVisible && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5 text-xs">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Your scratch card has moved</p>
              <p className="text-amber-800 mt-0.5">
                Scratch cards are now standalone Campaigns, independent of your loyalty program. Your
                previous scratch card configuration has been paused — set up a Campaign to relaunch it.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismissScratchNotice}
            disabled={dismissingNotice}
            className="p-1 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors flex-shrink-0"
            title="Dismiss"
          >
            {dismissingNotice ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-px text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`py-2.5 px-4 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "overview"
              ? "bg-white border border-slate-200 border-b-transparent text-indigo-600 font-bold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`py-2.5 px-4 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "requests"
              ? "bg-white border border-slate-200 border-b-transparent text-indigo-600 font-bold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Requests
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`py-2.5 px-4 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "members"
              ? "bg-white border border-slate-200 border-b-transparent text-indigo-600 font-bold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Members
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rewards")}
          className={`py-2.5 px-4 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "rewards"
              ? "bg-white border border-slate-200 border-b-transparent text-indigo-600 font-bold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          Redeem Rewards
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("qr")}
          className={`py-2.5 px-4 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "qr"
              ? "bg-white border border-slate-200 border-b-transparent text-indigo-600 font-bold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          Permanent QR
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("loyalty")}
          className={`py-2.5 px-4 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "loyalty"
              ? "bg-white border border-slate-200 border-b-transparent text-indigo-600 font-bold shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          Loyalty Program
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <BusinessAnalyticsPanel
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />

          <div className="grid md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-7 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                    Active Visits Program
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {programName}
                  </h3>
                  <p className="text-xs text-slate-500">{business.name}</p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {isActive ? "Program Active" : "Paused"}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Reward Benefit</span>
                  <span className="font-bold text-slate-900">{rewardTitle}</span>
                </div>
                {rewardDescription && (
                  <div className="py-1 border-b border-slate-100 text-slate-500">
                    <p className="leading-relaxed">{rewardDescription}</p>
                  </div>
                )}

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Required Visits</span>
                  <span className="font-semibold text-slate-800">{requiredVisits} visits</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Reward Validity</span>
                  <span className="font-semibold text-slate-800">{rewardValidityDays} days</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("loyalty")}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
                >
                  Edit Loyalty Program
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("qr")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  View Counter QR
                </button>
              </div>
            </div>

            <div className="md:col-span-5 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Permanent Counter QR
              </span>
              <div
                className="w-40 h-40 mx-auto bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-center shadow-inner"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="text-[11px] font-mono text-slate-500 break-all">{joinUrl}</p>
              <button
                type="button"
                onClick={() => setActiveTab("qr")}
                className="w-full py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Open Full QR Display & Download →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: REQUESTS */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Verification Requests</h3>
            <p className="text-xs text-slate-500 mt-0.5">Review and approve customer visit requests for your business.</p>
          </div>
          <BusinessRequestsPanel
            businessName={business.name}
            requiredVisits={business.loyaltyProgram.requiredVisits}
          />
        </div>
      )}

      {/* TAB: MEMBERS */}
      {activeTab === "members" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Loyalty Club Members</h3>
            <p className="text-xs text-slate-500 mt-0.5">Track and manage customers enrolled in your loyalty program.</p>
          </div>
          <BusinessMembersPanel />
        </div>
      )}

      {/* TAB: REWARDS (REDEEM) */}
      {activeTab === "rewards" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Reward Redemptions</h3>
            <p className="text-xs text-slate-500 mt-0.5">When a customer shows their reward screen, tap &quot;Redeem&quot; to mark it as used.</p>
          </div>
          <BusinessRewardsPanel />
        </div>
      )}

      {/* TAB 2: QR CODE */}
      {activeTab === "qr" && (
        <div className="max-w-md mx-auto">
          <QRCodeDisplay
            businessName={business.name}
            joinUrl={joinUrl}
            qrSvg={qrSvg}
            qrDataUrl={qrDataUrl}
          />
        </div>
      )}

      {/* TAB 3: LOYALTY PROGRAM SETTINGS */}
      {activeTab === "loyalty" && (
        <div className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Loyalty Program Configuration</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update your visits tracking configuration.
            </p>
          </div>

          {loyaltySuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{loyaltySuccess}</span>
            </div>
          )}

          {loyaltyError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{loyaltyError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateLoyalty} className="space-y-4">
            <div>
              <label htmlFor="edit-program-name" className="block text-xs font-semibold text-slate-800 mb-1">
                Program Name
              </label>
              <input
                id="edit-program-name"
                type="text"
                required
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-visits" className="block text-xs font-semibold text-slate-800 mb-1">
                  Required Visits
                </label>
                <input
                  id="edit-visits"
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={requiredVisits}
                  onChange={(e) => setRequiredVisits(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="edit-validity" className="block text-xs font-semibold text-slate-800 mb-1">
                  Reward Validity (Days)
                </label>
                <input
                  id="edit-validity"
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={rewardValidityDays}
                  onChange={(e) => setRewardValidityDays(parseInt(e.target.value, 10) || 30)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-800">
                How should the threshold be counted?
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

              {windowType === "ROLLING" && (
                <div>
                  <label htmlFor="edit-window-days" className="block text-xs font-semibold text-slate-800 mb-1">
                    Rolling Window (Days)
                  </label>
                  <input
                    id="edit-window-days"
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
                  <label htmlFor="edit-window-starts-at" className="block text-xs font-semibold text-slate-800 mb-1">
                    Counting Since
                  </label>
                  <input
                    id="edit-window-starts-at"
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
              <label htmlFor="edit-reward-title" className="block text-xs font-semibold text-slate-800 mb-1">
                Reward Title
              </label>
              <input
                id="edit-reward-title"
                type="text"
                required
                value={rewardTitle}
                onChange={(e) => setRewardTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="edit-reward-desc" className="block text-xs font-semibold text-slate-800 mb-1">
                Description
              </label>
              <textarea
                id="edit-reward-desc"
                rows={2}
                value={rewardDescription}
                onChange={(e) => setRewardDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-200 mt-6">
              <label className="block text-xs font-semibold text-slate-800">Verification Method</label>
              <div className="grid sm:grid-cols-2 gap-2">
                <label
                  className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs ${
                    verificationMethod === VerificationMethod.VISIT_CONFIRMATION
                      ? "bg-indigo-50/60 border-indigo-300 font-semibold"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="editVerificationMethod"
                    checked={verificationMethod === VerificationMethod.VISIT_CONFIRMATION}
                    onChange={() => setVerificationMethod(VerificationMethod.VISIT_CONFIRMATION)}
                  />
                  <span>Visit Confirmation</span>
                </label>

                <label
                  className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs ${
                    verificationMethod === VerificationMethod.BILL
                      ? "bg-indigo-50/60 border-indigo-300 font-semibold"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="editVerificationMethod"
                    checked={verificationMethod === VerificationMethod.BILL}
                    onChange={() => setVerificationMethod(VerificationMethod.BILL)}
                  />
                  <span>Bill Upload</span>
                </label>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Loyalty program is active and accepting visits</span>
              </label>

              <button
                type="submit"
                disabled={savingLoyalty}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingLoyalty ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
