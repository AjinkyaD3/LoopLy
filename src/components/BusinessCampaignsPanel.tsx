"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Plus,
  Users,
  Clock,
  CheckCircle2,
  StopCircle,
  Edit2,
  X,
  Save,
  Gift
} from "lucide-react";

interface CampaignPrize {
  id: string;
  title: string;
  weight: number;
  totalStock: number;
  remainingStock: number;
}

interface CampaignPlay {
  id: string;
  customerName: string | null;
  mobileNumber: string;
  revealedPrize: string;
  status: string;
  claimCode: string | null;
  playedAt: string;
}

interface CampaignItem {
  id: string;
  name: string;
  campaignToken: string;
  playUrl: string;
  qrSvg: string;
  startsAt: string;
  endsAt: string | null;
  endedManuallyAt: string | null;
  status: "SCHEDULED" | "ACTIVE" | "ENDED";
  playsCount: number;
  prizes: CampaignPrize[];
}

const STATUS_STYLES: Record<CampaignItem["status"], string> = {
  SCHEDULED: "bg-indigo-50 text-indigo-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  ENDED: "bg-slate-100 text-slate-600",
};

const STATUS_ICON: Record<CampaignItem["status"], typeof Clock> = {
  SCHEDULED: Clock,
  ACTIVE: Sparkles,
  ENDED: CheckCircle2,
};

export default function BusinessCampaignsPanel() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingId, setEndingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrizes, setEditPrizes] = useState<CampaignPrize[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const [viewPlaysId, setViewPlaysId] = useState<string | null>(null);
  const [plays, setPlays] = useState<CampaignPlay[]>([]);
  const [loadingPlays, setLoadingPlays] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/business/campaigns");
      const data = await res.json();
      if (res.ok) setCampaigns(data.campaigns ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  async function handleEndNow(id: string) {
    setEndingId(id);
    try {
      await fetch(`/api/business/campaigns/${id}/end`, { method: "POST" });
      fetchCampaigns();
    } finally {
      setEndingId(null);
    }
  }

  function startEditing(c: CampaignItem) {
    setEditingId(c.id);
    setEditPrizes(c.prizes.map(p => ({ ...p })));
  }

  async function saveEditing(c: CampaignItem) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/business/campaigns/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizes: editPrizes }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchCampaigns();
      } else {
        alert("Failed to save changes");
      }
    } catch (e) {
      alert("Error saving changes");
    } finally {
      setSavingEdit(false);
    }
  }

  async function loadPlays(id: string) {
    setViewPlaysId(id);
    setLoadingPlays(true);
    try {
      const res = await fetch(`/api/business/campaigns/${id}/plays`);
      if (res.ok) {
        const data = await res.json();
        setPlays(data.plays);
      }
    } finally {
      setLoadingPlays(false);
    }
  }

  function statusLabel(c: CampaignItem): string {
    if (c.status === "SCHEDULED") {
      return `Scheduled — starts ${new Date(c.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
    }
    if (c.status === "ACTIVE") {
      return c.endsAt
        ? `Active — ends ${new Date(c.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
        : "Active";
    }
    return "Ended";
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Standalone promotional campaigns — independent of your loyalty program. Anyone with a
          campaign&apos;s QR can play once.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/business/campaigns/create"
            className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Campaign
          </Link>
          <button
            type="button"
            onClick={fetchCampaigns}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && campaigns.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Loading campaigns…
        </div>
      ) : campaigns.length === 0 ? (
        <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2 p-6 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-800">No campaigns yet</p>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Create a time-boxed scratch card promotion to hand out at the counter or print on a
            poster.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {campaigns.map((c) => {
            const StatusIcon = STATUS_ICON[c.status];
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{c.name}</h4>
                    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[c.status]}`}>
                      <StatusIcon className="w-2.5 h-2.5" />
                      {statusLabel(c)}
                    </span>
                  </div>
                  <div
                    className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-200 shrink-0"
                    dangerouslySetInnerHTML={{ __html: c.qrSvg }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => loadPlays(c.id)}>
                    <Users className="w-3.5 h-3.5" />
                    {c.playsCount} {c.playsCount === 1 ? "play" : "plays"} (View)
                  </div>
                  {c.status === "ACTIVE" && editingId !== c.id && (
                    <button onClick={() => startEditing(c)} className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
                      <Edit2 className="w-3 h-3" /> Edit Prizes
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {editingId === c.id ? (
                    <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {editPrizes.map((p, idx) => (
                        <div key={p.id} className="grid grid-cols-12 gap-2 items-center text-xs">
                          <div className="col-span-4 font-semibold text-slate-700 truncate" title={p.title}>{p.title}</div>
                          <div className="col-span-4">
                            <label className="text-[10px] text-slate-500 block mb-1">Weight</label>
                            <input
                              type="number"
                              min="0"
                              value={p.weight}
                              onChange={(e) => {
                                const newPrizes = [...editPrizes];
                                newPrizes[idx].weight = parseInt(e.target.value) || 0;
                                setEditPrizes(newPrizes);
                              }}
                              className="w-full px-2 py-1 rounded border border-slate-200 text-xs"
                            />
                          </div>
                          <div className="col-span-4">
                            <label className="text-[10px] text-slate-500 block mb-1">Total Stock</label>
                            <input
                              type="number"
                              min={p.totalStock - p.remainingStock}
                              value={p.totalStock}
                              onChange={(e) => {
                                const newPrizes = [...editPrizes];
                                newPrizes[idx].totalStock = parseInt(e.target.value) || p.totalStock;
                                setEditPrizes(newPrizes);
                              }}
                              className="w-full px-2 py-1 rounded border border-slate-200 text-xs"
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => saveEditing(c)}
                          disabled={savingEdit}
                          className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={savingEdit}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    c.prizes.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">{p.title}</span>
                        <span className="font-semibold text-slate-800">
                          {p.remainingStock}/{p.totalStock} left
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {c.status !== "ENDED" && editingId !== c.id && (
                  <button
                    type="button"
                    disabled={endingId === c.id}
                    onClick={() => handleEndNow(c.id)}
                    className="w-full py-2 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {endingId === c.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <StopCircle className="w-3.5 h-3.5" />
                    )}
                    End Now
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewPlaysId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col shadow-xl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Campaign Plays</h3>
              <button onClick={() => setViewPlaysId(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {loadingPlays ? (
                <div className="flex justify-center py-8 text-indigo-600">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : plays.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No plays recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {plays.map((p) => (
                    <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{p.customerName || "Guest"}</p>
                        <p className="text-xs text-slate-500">{p.mobileNumber}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs font-medium text-slate-700">
                          <Gift className="w-3 h-3 text-indigo-500" />
                          {p.revealedPrize}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="text-[10px] text-slate-400">
                          {new Date(p.playedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                        {p.claimCode ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.status === "REDEEMED" ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                            {p.status}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500">
                            TEST PLAY
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
