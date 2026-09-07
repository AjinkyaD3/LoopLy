"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Store, Trash2, AlertTriangle, Sparkles, Instagram, Star } from "lucide-react";

interface BusinessSettingsProps {
  business: {
    id: string;
    name: string;
    address: string | null;
    businessType: string | null;
    googleReviewUrl: string | null;
    instagramHandle: string | null;
    youtubeHandle: string | null;
    loyaltyProgram: {
      id: string;
      programName: string;
      requiredVisits: number;
      rewardTitle: string;
      rewardDescription: string;
      rewardValidityDays: number;
      verificationMethod: string;
      rewardType: string;
      isActive: boolean;
    } | null;
  };
}

export default function BusinessSettingsClient({ business }: BusinessSettingsProps) {
  const router = useRouter();
  
  // Business State
  const [name, setName] = useState(business.name);
  const [address, setAddress] = useState(business.address || "");
  const [businessType, setBusinessType] = useState(business.businessType || "");
  const [googleReviewUrl, setGoogleReviewUrl] = useState(business.googleReviewUrl || "");
  const [instagramHandle, setInstagramHandle] = useState(business.instagramHandle || "");
  const [youtubeHandle, setYoutubeHandle] = useState(business.youtubeHandle || "");
  const [isSavingBiz, setIsSavingBiz] = useState(false);
  const [showBizDeleteConfirm, setShowBizDeleteConfirm] = useState(false);
  const [isDeletingBiz, setIsDeletingBiz] = useState(false);
  const [bizError, setBizError] = useState<string | null>(null);
  const [bizSuccess, setBizSuccess] = useState<string | null>(null);

  // Loyalty Program State
  const [loyalty, setLoyalty] = useState(business.loyaltyProgram);
  const [isSavingLoyalty, setIsSavingLoyalty] = useState(false);
  const [showLoyaltyDeleteConfirm, setShowLoyaltyDeleteConfirm] = useState(false);
  const [isDeletingLoyalty, setIsDeletingLoyalty] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [loyaltySuccess, setLoyaltySuccess] = useState<string | null>(null);

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBiz(true);
    setBizError(null);
    setBizSuccess(null);

    try {
      const res = await fetch("/api/business/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, businessType, googleReviewUrl, instagramHandle, youtubeHandle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update business");
      setBizSuccess("Business details updated successfully.");
      router.refresh();
    } catch (err: any) {
      setBizError(err.message);
    } finally {
      setIsSavingBiz(false);
    }
  };

  const handleDeleteBusiness = async () => {
    setIsDeletingBiz(true);
    setBizError(null);
    try {
      const res = await fetch("/api/business/account", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete account");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setBizError(err.message);
      setIsDeletingBiz(false);
      setShowBizDeleteConfirm(false);
    }
  };

  const handleSaveLoyalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loyalty) return;
    setIsSavingLoyalty(true);
    setLoyaltyError(null);
    setLoyaltySuccess(null);

    try {
      const res = await fetch("/api/business/loyalty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loyalty),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update loyalty program");
      setLoyaltySuccess("Loyalty program updated successfully.");
      router.refresh();
    } catch (err: any) {
      setLoyaltyError(err.message);
    } finally {
      setIsSavingLoyalty(false);
    }
  };

  const handleDeleteLoyalty = async () => {
    setIsDeletingLoyalty(true);
    setLoyaltyError(null);
    try {
      const res = await fetch("/api/business/loyalty", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete loyalty program");
      setLoyalty(null);
      setLoyaltySuccess("Loyalty program deleted. You can create a new one from the dashboard.");
      router.push("/business");
      router.refresh();
    } catch (err: any) {
      setLoyaltyError(err.message);
      setIsDeletingLoyalty(false);
      setShowLoyaltyDeleteConfirm(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/business"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-900">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8 flex-1">
        
        {/* Business Settings Section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Business Profile</h2>
            <p className="text-xs text-slate-500">Manage your business name and social links.</p>
          </div>

          {bizError && <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{bizError}</div>}
          {bizSuccess && <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">{bizSuccess}</div>}

          <form onSubmit={handleSaveBusiness} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              <Store className="w-3.5 h-3.5 text-indigo-600" /> Business Details
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Business Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
                  <Instagram className="w-3 h-3 text-pink-600" /> Instagram Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400">@</span>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => {
                      const val = e.target.value.startsWith("@") ? e.target.value.substring(1) : e.target.value;
                      setInstagramHandle(val);
                    }}
                    placeholder="looply_cafe"
                    className="w-full pl-7 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500" /> Google Review URL
                </label>
                <input
                  type="url"
                  value={googleReviewUrl}
                  onChange={(e) => setGoogleReviewUrl(e.target.value)}
                  placeholder="https://g.page/r/.../review"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
                  Business Type
                </label>
                <input
                  type="text"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="e.g. Cafe, Salon"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 123 Main St"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
                  YouTube Handle
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400">@</span>
                  <input
                    type="text"
                    value={youtubeHandle}
                    onChange={(e) => {
                      const val = e.target.value.startsWith("@") ? e.target.value.substring(1) : e.target.value;
                      setYoutubeHandle(val);
                    }}
                    placeholder="looply_channel"
                    className="w-full pl-7 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingBiz}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> {isSavingBiz ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 pb-2 border-b border-rose-100">
              <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete My Account</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Permanently delete your entire Looply account, your business profile, and all customer memberships. This action cannot be undone and you will lose access immediately.
                </p>
              </div>
              
              {!showBizDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowBizDeleteConfirm(true)}
                  className="px-5 py-2.5 bg-white border border-rose-200 hover:bg-rose-50 hover:border-rose-300 text-rose-600 font-semibold text-xs rounded-xl transition-colors whitespace-nowrap"
                >
                  Delete My Account
                </button>
              ) : (
                <div className="flex flex-col gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-xs font-bold text-rose-700">Are you absolutely sure?</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowBizDeleteConfirm(false)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                    <button onClick={handleDeleteBusiness} disabled={isDeletingBiz} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" /> {isDeletingBiz ? "Deleting..." : "Yes, Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Loyalty Program Section */}
        {loyalty && (
          <section className="space-y-4 pt-6 border-t border-slate-200">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Loyalty Program</h2>
              <p className="text-xs text-slate-500">Manage your reward rules and thresholds.</p>
            </div>

            {loyaltyError && <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{loyaltyError}</div>}
            {loyaltySuccess && <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">{loyaltySuccess}</div>}

            <form onSubmit={handleSaveLoyalty} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Reward Details
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">Program Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={loyalty.programName}
                    onChange={(e) => setLoyalty({ ...loyalty, programName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">Required Visits <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={loyalty.requiredVisits}
                      onChange={(e) => setLoyalty({ ...loyalty, requiredVisits: parseInt(e.target.value) || 1 })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">Reward Validity (Days) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={loyalty.rewardValidityDays}
                      onChange={(e) => setLoyalty({ ...loyalty, rewardValidityDays: parseInt(e.target.value) || 30 })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">Reward Title <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={loyalty.rewardTitle}
                    onChange={(e) => setLoyalty({ ...loyalty, rewardTitle: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">Reward Description</label>
                  <textarea
                    value={loyalty.rewardDescription}
                    onChange={(e) => setLoyalty({ ...loyalty, rewardDescription: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingLoyalty}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> {isSavingLoyalty ? "Saving..." : "Save Program"}
                </button>
              </div>
            </form>

            <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 pb-2 border-b border-rose-100">
                <AlertTriangle className="w-3.5 h-3.5" /> Danger Zone
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Delete Loyalty Program</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Removes your reward program and deletes all customer visits and memberships.
                  </p>
                </div>
                
                {!showLoyaltyDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowLoyaltyDeleteConfirm(true)}
                    className="px-5 py-2.5 bg-white border border-rose-200 hover:bg-rose-50 hover:border-rose-300 text-rose-600 font-semibold text-xs rounded-xl transition-colors whitespace-nowrap"
                  >
                    Delete Program
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <span className="text-xs font-bold text-rose-700">Wipe all memberships?</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowLoyaltyDeleteConfirm(false)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg">Cancel</button>
                      <button onClick={handleDeleteLoyalty} disabled={isDeletingLoyalty} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50">
                        <Trash2 className="w-3.5 h-3.5" /> {isDeletingLoyalty ? "Deleting..." : "Yes, Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
