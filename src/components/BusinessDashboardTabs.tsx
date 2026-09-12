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

interface RewardDef {
  id: string;
  cardPosition: number;
  title: string;
  description: string;
}

interface LoyaltyData {
  id: string;
  programName: string;
  requiredVisits: number;
  startsAt: string | Date;
  endsAt: string | Date;
  endedManuallyAt: string | Date | null;
  isActive: boolean;
  rewardValidityDays: number;
  verificationMethod: VerificationMethod;
  retiredScratchNotice: boolean;
  rewardDefinitions: RewardDef[];
  _count: { cards: number };
}

interface BusinessData {
  id: string;
  name: string;
  businessToken: string;
  loyaltyPrograms: LoyaltyData[];
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

  const now = new Date();
  const activeProgram = business.loyaltyPrograms.find(p => !p.endedManuallyAt && new Date(p.endsAt) >= now);
  const historicalPrograms = business.loyaltyPrograms.filter(p => p.id !== activeProgram?.id);

  const [scratchNoticeVisible, setScratchNoticeVisible] = useState(
    business.loyaltyPrograms.some(p => p.retiredScratchNotice)
  );
  const [dismissingNotice, setDismissingNotice] = useState(false);

  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const [loyaltySuccess, setLoyaltySuccess] = useState<string | null>(null);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);


  // Edit mode states
  const [isEditingActive, setIsEditingActive] = useState(false);
  const [editIsActive, setEditIsActive] = useState(false);
  const [editRewards, setEditRewards] = useState<{ id: string; title: string; description: string }[]>([]);

  function startEditing() {
    if (!activeProgram) return;
    setEditIsActive(activeProgram.isActive);
    setEditRewards(activeProgram.rewardDefinitions.map(r => ({ id: r.id, title: r.title, description: r.description })));
    setIsEditingActive(true);
  }

  function handleEditRewardChange(id: string, field: "title" | "description", value: string) {
    setEditRewards(current => current.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  async function handleSaveEdits() {
    if (!activeProgram) return;
    setSavingLoyalty(true);
    setLoyaltyError(null);
    setLoyaltySuccess(null);
    try {
      const res = await fetch("/api/business/loyalty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: editIsActive,
          rewards: editRewards,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update program");
      
      setLoyaltySuccess("Program updated successfully.");
      setIsEditingActive(false);
      router.refresh();
      setTimeout(() => setLoyaltySuccess(null), 3000);
    } catch (e: any) {
      setLoyaltyError(e.message || "Network error");
    } finally {
      setSavingLoyalty(false);
    }
  }

  // Form states for creating new program
  const [newProgramName, setNewProgramName] = useState("My Loyalty Card");
  
  function localDate(daysFromNow: number) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().slice(0, 10);
  }
  
  const [newStartsAt, setNewStartsAt] = useState(localDate(0));
  const [newEndsAt, setNewEndsAt] = useState(localDate(30));
  const [newRequiredVisits, setNewRequiredVisits] = useState(5);
  const [newRewards, setNewRewards] = useState<{ cardPosition: number; title: string; description: string }[]>([
    { cardPosition: 5, title: "Your reward", description: "" },
  ]);

  const newPositions = Array.from({ length: newRequiredVisits }, (_, index) => index + 1);

  function toggleNewReward(position: number) {
    setNewRewards((current) => {
      const existing = current.find((reward) => reward.cardPosition === position);
      return existing
        ? current.filter((reward) => reward.cardPosition !== position)
        : [...current, { cardPosition: position, title: "New reward", description: "" }].sort((a, b) => a.cardPosition - b.cardPosition);
    });
  }

  function changeNewReward(position: number, field: "title" | "description", value: string) {
    setNewRewards((current) => current.map((reward) => reward.cardPosition === position ? { ...reward, [field]: value } : reward));
  }

  async function handleCreateLoyalty(e: React.FormEvent) {
    e.preventDefault();
    setLoyaltyError(null);
    setLoyaltySuccess(null);
    
    const validRewards = newRewards.filter((reward) => reward.cardPosition <= newRequiredVisits);
    if (!validRewards.length) return setLoyaltyError("Choose at least one card position that earns a reward.");

    setSavingLoyalty(true);

    try {
      const payload = {
        programName: newProgramName.trim(),
        startsAt: new Date(`${newStartsAt}T00:00:00`).toISOString(),
        endsAt: new Date(`${newEndsAt}T23:59:59`).toISOString(),
        requiredVisits: newRequiredVisits,
        rewards: validRewards,
        rewardValidityDays: 14, // Default per requested behavior
      };

      const res = await fetch("/api/business/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoyaltyError(data.error || "Failed to create loyalty program.");
        setSavingLoyalty(false);
        return;
      }

      setLoyaltySuccess("New loyalty program started successfully!");
      setSavingLoyalty(false);
      router.refresh();
      setTimeout(() => setLoyaltySuccess(null), 3000);
    } catch {
      setLoyaltyError("Network error. Please try again.");
      setSavingLoyalty(false);
    }
  }

  async function handleEndProgram() {
    if (!confirm("Are you sure you want to end this program early?")) return;
    
    setSavingLoyalty(true);
    try {
      const res = await fetch("/api/business/loyalty", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to end program");
      
      setLoyaltySuccess("Program ended successfully.");
      router.refresh();
      setTimeout(() => setLoyaltySuccess(null), 3000);
    } catch (e) {
      setLoyaltyError("Network error. Please try again.");
    } finally {
      setSavingLoyalty(false);
    }
  }

  async function handleDismissScratchNotice() {
    setDismissingNotice(true);
    try {
      await fetch("/api/business/loyalty/dismiss-scratch-notice", { method: "POST" });
      setScratchNoticeVisible(false);
    } finally {
      setDismissingNotice(false);
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
                    {activeProgram?.programName || "No Active Program"}
                  </h3>
                  <p className="text-xs text-slate-500">{business.name}</p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    activeProgram?.isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {activeProgram?.isActive ? "Program Active" : "Paused"}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Reward Benefit</span>
                  <span className="font-bold text-slate-900">{activeProgram?.rewardDefinitions[0]?.title || "-"}</span>
                </div>
                {activeProgram?.rewardDefinitions[0]?.description && (
                  <div className="py-1 border-b border-slate-100 text-slate-500">
                    <p className="leading-relaxed">{activeProgram?.rewardDefinitions[0]?.description || ""}</p>
                  </div>
                )}

                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Required Visits</span>
                  <span className="font-semibold text-slate-800">{activeProgram?.requiredVisits || 0} visits</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Reward Validity</span>
                  <span className="font-semibold text-slate-800">{activeProgram?.rewardValidityDays || 0} days</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("loyalty")}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
                >
                  Manage Loyalty Program
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
            requiredVisits={activeProgram?.requiredVisits || 5}
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
        <div className="space-y-6 max-w-2xl">
                    {/* Active Program Details (if any) */}
          {activeProgram ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                    Active Program
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {activeProgram.programName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {new Date(activeProgram.startsAt).toLocaleDateString()} – {new Date(activeProgram.endsAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditingActive ? (
                    <>
                      <button
                        type="button"
                        onClick={startEditing}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleEndProgram}
                        disabled={savingLoyalty}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                      >
                        {savingLoyalty ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertCircle className="w-3 h-3" />}
                        End Program
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditingActive(false)}
                        className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 text-[11px] font-bold rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEdits}
                        disabled={savingLoyalty}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                      >
                        {savingLoyalty && <Loader2 className="w-3 h-3 animate-spin" />}
                        Save Changes
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditingActive ? (
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Loyalty program is active and accepting visits</span>
                  </label>
                  <div className="space-y-3">
                    {activeProgram.rewardDefinitions.map((reward) => {
                      const editingReward = editRewards.find(r => r.id === reward.id);
                      if (!editingReward) return null;
                      return (
                        <div key={reward.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">Reward at card {reward.cardPosition}</span>
                          <input
                            value={editingReward.title}
                            onChange={(e) => handleEditRewardChange(reward.id, "title", e.target.value)}
                            placeholder="Reward title"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                          />
                          <input
                            value={editingReward.description || ""}
                            onChange={(e) => handleEditRewardChange(reward.id, "description", e.target.value)}
                            placeholder="Short description (optional)"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Required Visits</span>
                    <span className="font-semibold text-slate-800">{activeProgram.requiredVisits}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Status</span>
                    <span className={`font-bold ${activeProgram.isActive ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {activeProgram.isActive ? "Active (Accepting Visits)" : "Paused"}
                    </span>
                  </div>
                  {activeProgram.rewardDefinitions.map((reward) => (
                    <div key={reward.id} className="py-2 border-b border-slate-100 flex justify-between">
                      <div>
                        <span className="text-slate-500 font-semibold block">Reward at card {reward.cardPosition}</span>
                        <span className="font-bold text-slate-900 block">{reward.title}</span>
                        {reward.description && <span className="text-slate-400 block">{reward.description}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Start New Loyalty Program</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your shop QR stays the same. Customers scanning it will see this new program.
                </p>
              </div>

              <form onSubmit={handleCreateLoyalty} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">Program Name</label>
                  <input
                    type="text"
                    required
                    value={newProgramName}
                    onChange={(e) => setNewProgramName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">Starts</label>
                    <input
                      type="date"
                      required
                      value={newStartsAt}
                      onChange={(e) => setNewStartsAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">Ends</label>
                    <input
                      type="date"
                      required
                      value={newEndsAt}
                      onChange={(e) => setNewEndsAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">Cards to collect</label>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={newRequiredVisits}
                    onChange={(e) => setNewRequiredVisits(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <section className="space-y-3 pt-4 border-t border-slate-100">
                  <div>
                    <h2 className="text-xs font-semibold text-slate-800">Choose reward positions</h2>
                    <p className="text-[11px] text-slate-500">Select the card positions that issue rewards.</p>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-2">
                    {newPositions.map((position) => {
                      const selected = newRewards.some((reward) => reward.cardPosition === position);
                      return (
                        <button
                          key={position}
                          type="button"
                          onClick={() => toggleNewReward(position)}
                          className={`rounded-xl border p-2 text-xs font-bold transition-colors ${
                            selected ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {position}
                          {selected ? " 🎁" : ""}
                        </button>
                      );
                    })}
                  </div>

                  {newRewards.filter((reward) => reward.cardPosition <= newRequiredVisits).map((reward) => (
                    <div key={reward.cardPosition} className="rounded-xl bg-slate-50 p-3 space-y-2 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-800">Reward on card {reward.cardPosition}</p>
                      <input
                        value={reward.title}
                        onChange={(e) => changeNewReward(reward.cardPosition, "title", e.target.value)}
                        placeholder="Reward title"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                        required
                      />
                      <input
                        value={reward.description}
                        onChange={(e) => changeNewReward(reward.cardPosition, "description", e.target.value)}
                        placeholder="Short description (optional)"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      />
                    </div>
                  ))}
                </section>

                <div className="pt-2 flex items-center justify-end border-t border-slate-100 mt-4">
                  <button
                    type="submit"
                    disabled={savingLoyalty}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingLoyalty ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Start Program
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Messages */}
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

          {/* Historical Programs List */}
          {historicalPrograms.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs mt-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Program History</h3>
              <div className="space-y-4">
                {historicalPrograms.map((program) => (
                  <div key={program.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{program.programName}</h4>
                        <p className="text-[11px] text-slate-500">
                          {new Date(program.startsAt).toLocaleDateString()} – {program.endedManuallyAt ? new Date(program.endedManuallyAt).toLocaleDateString() : new Date(program.endsAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md">Ended</span>
                    </div>
                    <div className="text-xs text-slate-600 flex flex-col gap-1">
                      <span>Required Visits: {program.requiredVisits}</span>
                      <span>Cards completed: {program._count?.cards || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}