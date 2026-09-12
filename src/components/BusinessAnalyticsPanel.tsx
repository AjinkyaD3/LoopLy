"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Award,
  TrendingUp,
  Gift,
  Clock,
  RefreshCw,
  Loader2,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface AnalyticsMetrics {
  totalMembers: number;
  repeatMembersCount: number;
  repeatRate: number;
  totalVisits: number;
  visitsLast30Days: number;
  rewardsIssued: number;
  rewardsRedeemed: number;
  activeRewardsCount: number;
  pendingRequestsCount: number;
}

interface TimelineItem {
  id: string;
  type: "JOIN" | "VISIT" | "REDEEM";
  title: string;
  customerName: string;
  customerMobile: string;
  timestamp: string;
}

interface BusinessAnalyticsPanelProps {
  onNavigateToTab?: (tab: "requests" | "rewards" | "members") => void;
}

export default function BusinessAnalyticsPanel({ onNavigateToTab }: BusinessAnalyticsPanelProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/business/analytics");
      const data = await res.json();
      if (res.ok) {
        setMetrics(data.metrics);
        setTimeline(data.recentActivity || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Loading business analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests Alert */}
      {metrics && metrics.pendingRequestsCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              You have {metrics.pendingRequestsCount} pending visit{" "}
              {metrics.pendingRequestsCount === 1 ? "request" : "requests"} waiting for approval.
            </span>
          </div>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab("requests")}
              className="py-1.5 px-3.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-semibold text-xs rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs"
            >
              Review Requests
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Club Members</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {metrics?.totalMembers ?? 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {metrics?.repeatRate ?? 0}% repeat customer rate
            </p>
          </div>
        </div>

        {/* Total Visits */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Verified Visits</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {metrics?.totalVisits ?? 0}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">
              +{metrics?.visitsLast30Days ?? 0} in last 30 days
            </p>
          </div>
        </div>

        {/* Active Rewards */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ready to Claim</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {metrics?.activeRewardsCount ?? 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Active customer rewards
            </p>
          </div>
        </div>

        {/* Rewards Redeemed */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Redeemed</span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {metrics?.rewardsRedeemed ?? 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {metrics?.rewardsIssued ?? 0} total issued
            </p>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Live Customer Activity
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Real-time feed of joins, verified visits, and reward redemptions.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-50"
            title="Refresh Timeline"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {timeline.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No customer activity recorded yet. Share your QR code to onboard your first customers!
          </div>
        ) : (
          <div className="space-y-3">
            {timeline.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white ${
                      item.type === "JOIN"
                        ? "bg-indigo-600"
                        : item.type === "VISIT"
                        ? "bg-emerald-600"
                        : "bg-amber-600"
                    }`}
                  >
                    {item.type === "JOIN" ? (
                      <Users className="w-3.5 h-3.5" />
                    ) : item.type === "VISIT" ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Award className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{item.customerName}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">{item.title}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.customerMobile}</p>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400 whitespace-nowrap">
                  {new Date(item.timestamp).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
