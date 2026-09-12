"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Award, Loader2, CheckCircle2, RefreshCw } from "lucide-react";

interface Reward {
  id: string;
  title: string;
  description: string;
  expiresAt: string;
  createdAt: string;
  customer: { name: string; mobileNumber: string };
}

export default function BusinessRewardsPanel() {
  const router = useRouter();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [claimCodes, setClaimCodes] = useState<{ [rewardId: string]: string }>({});

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/business/rewards");
      const data = await res.json();
      if (res.ok) setRewards(data.rewards ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRewards(); }, [fetchRewards]);

  async function handleRedeem(rewardId: string) {
    const code = claimCodes[rewardId]?.trim() || "";
    if (code.length < 6) return; // Prevent early submission

    setActionLoading(rewardId);
    setFeedback(null);

    try {
      const res = await fetch(`/api/business/rewards/${rewardId}/redeem`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimCode: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({ id: rewardId, msg: data.error || "Failed to redeem.", ok: false });
      } else {
        setFeedback({ id: rewardId, msg: data.message || "Reward successfully redeemed!", ok: true });
        // Clear the code input on success
        setClaimCodes(prev => {
          const next = { ...prev };
          delete next[rewardId];
          return next;
        });
        fetchRewards();
        router.refresh();
      }
    } catch {
      setFeedback({ id: rewardId, msg: "Network error. Please try again.", ok: false });
    } finally {
      setActionLoading(null);
    }
  }

  const handleCodeChange = (rewardId: string, value: string) => {
    setClaimCodes(prev => ({ ...prev, [rewardId]: value.toUpperCase() }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Active rewards waiting to be redeemed by customers at your counter.</p>
        <button
          type="button"
          onClick={fetchRewards}
          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading rewards…
        </div>
      ) : rewards.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          No active rewards to redeem right now.
        </div>
      ) : (
        rewards.map((r) => {
          const currentCode = claimCodes[r.id] || "";
          const isValidLength = currentCode.length === 6;

          return (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{r.title}</p>
                    <p className="text-xs text-slate-600 font-semibold mt-0.5">{r.customer.name}</p>
                    <p className="text-[11px] text-slate-400">{r.customer.mobileNumber}</p>
                    {r.description && (
                      <p className="text-[11px] text-slate-500 mt-1">{r.description}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      Expires: {new Date(r.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold whitespace-nowrap">
                  Available
                </span>
              </div>

              {feedback?.id === r.id && (
                <p className={`text-xs font-semibold ${feedback.ok ? "text-emerald-700" : "text-rose-600"}`}>
                  {feedback.msg}
                </p>
              )}

              <div className="pt-2 border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  placeholder="Enter 6-char code"
                  value={currentCode}
                  onChange={(e) => handleCodeChange(r.id, e.target.value)}
                  maxLength={6}
                  className="w-1/2 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase tracking-widest focus:ring-2 focus:ring-emerald-600 outline-none"
                />
                <button
                  type="button"
                  disabled={actionLoading === r.id || !isValidLength}
                  onClick={() => handleRedeem(r.id)}
                  className="w-1/2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading === r.id ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Redeeming…</>
                  ) : (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Redeem</>
                  )}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
