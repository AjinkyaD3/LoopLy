"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  Award,
  TrendingUp,
  RefreshCw,
  Loader2,
  Calendar,
  Gift,
  CheckCircle2,
} from "lucide-react";

interface MemberItem {
  id: string;
  customerId: string;
  name: string;
  mobileNumber: string;
  joinedAt: string;
  currentVisits: number;
  totalVisits: number;
  requiredVisits: number;
  activeRewardsCount: number;
  activeClaimCodes: string[];
  redeemedRewardsCount: number;
  lastVisitAt: string | null;
}

export default function BusinessMembersPanel() {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async (query: string = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/business/members?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchMembers]);

  return (
    <div className="space-y-5">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members by name or email..."
            className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchMembers(search)}
          disabled={loading}
          className="p-2 self-end sm:self-auto rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50"
          title="Refresh Members"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && members.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Loading members…
        </div>
      ) : members.length === 0 ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            {search ? "No matching members found" : "No loyalty club members yet"}
          </p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {search
              ? "Try searching with another name or email."
              : "When customers scan your counter QR code or join link, they will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => {
            const progress = Math.min(m.currentVisits, m.requiredVisits);
            const progressPct = Math.round((progress / m.requiredVisits) * 100);
            const isRewardReady = m.currentVisits >= m.requiredVisits || m.activeRewardsCount > 0;

            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-200 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-tight">{m.name}</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{m.mobileNumber}</p>
                  </div>
                  {isRewardReady && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                      <Gift className="w-2.5 h-2.5" /> Reward Ready
                    </span>
                  )}
                  {m.activeClaimCodes?.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold flex items-center gap-1">
                      Code: {m.activeClaimCodes.join(", ")}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Cycle Progress</span>
                    <span className="font-bold text-slate-900">
                      {progress} / {m.requiredVisits}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isRewardReady ? "bg-emerald-500" : "bg-indigo-500"
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Stats Footer */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div>
                    <span className="block text-slate-400">Total Visits:</span>
                    <span className="font-bold text-slate-800">{m.totalVisits}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Redeemed:</span>
                    <span className="font-bold text-slate-800">{m.redeemedRewardsCount}</span>
                  </div>
                  <div className="col-span-2 pt-1 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Joined {new Date(m.joinedAt).toLocaleDateString()}</span>
                    {m.lastVisitAt && (
                      <span>Last: {new Date(m.lastVisitAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
