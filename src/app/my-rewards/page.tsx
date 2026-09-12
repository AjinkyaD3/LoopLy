"use client";

import { useState } from "react";
import { Sparkles, Smartphone, Loader2, Award, Gift, CheckCircle2 } from "lucide-react";

type ProgressData = {
  currentVisits: number;
  requiredVisits: number;
  rewardAvailable: boolean;
  rewardTitle: string;
};

type MembershipData = {
  businessName: string;
  programName: string;
  progress: ProgressData;
};

export default function MyRewardsPage() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [memberships, setMemberships] = useState<MembershipData[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mobileNumber.length < 5) return;
    
    setLoading(true);
    setError("");
    setHasSearched(false);
    
    try {
      const res = await fetch(`/api/customer/dashboard?mobileNumber=${encodeURIComponent(mobileNumber)}`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to load rewards");
      }
      
      setMemberships(data.memberships);
      setHasSearched(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xl font-black tracking-tight">Looply</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold mb-2">My Rewards</h1>
          <p className="text-slate-500 text-sm">Enter your mobile number to view your loyalty progress across all businesses.</p>
        </div>

        <form onSubmit={handleSearch} className="mb-8 space-y-4">
          <div>
            <div className="relative">
              <Smartphone className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="Enter your mobile number"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none shadow-xs"
              />
            </div>
          </div>
          
          {error && <p className="text-rose-600 text-xs font-semibold text-center">{error}</p>}
          
          <button
            type="submit"
            disabled={loading || mobileNumber.length < 5}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "View My Rewards"}
          </button>
        </form>

        {hasSearched && memberships !== null && (
          <div className="space-y-4">
            {memberships.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Gift className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-1">No Rewards Found</h3>
                <p className="text-sm text-slate-500">We couldn&apos;t find any loyalty programs linked to this number.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Your Programs</h2>
                
                {memberships.map((m, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-slate-900">{m.businessName}</h3>
                        <p className="text-xs text-slate-500">{m.programName}</p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-xs">
                        <Award className="w-5 h-5 text-indigo-600" />
                      </div>
                    </div>

                    <div className="px-5 py-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</span>
                          <span className="text-sm font-bold text-indigo-600">
                            {m.progress.currentVisits} / {m.progress.requiredVisits} visits
                          </span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                            style={{ width: `${Math.min(100, (m.progress.currentVisits / m.progress.requiredVisits) * 100)}%` }}
                          />
                        </div>

                        {m.progress.rewardAvailable ? (
                          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-bold text-emerald-900">Reward Available!</h4>
                              <p className="text-xs text-emerald-700">You&apos;ve unlocked: <strong>{m.progress.rewardTitle}</strong>. Ask the cashier for your claim code on your next visit to redeem.</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 text-center mt-2">
                            {m.progress.requiredVisits - m.progress.currentVisits} more visits to unlock: <strong className="text-slate-700">{m.progress.rewardTitle}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
