"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Plus,
} from "lucide-react";

export default function CreateCampaignPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [prizes, setPrizes] = useState([{ title: "", weight: 10, totalStock: 100 }]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePrizeChange = (index: number, field: string, value: string | number) => {
    const newPrizes = [...prizes];
    newPrizes[index] = { ...newPrizes[index], [field]: value };
    setPrizes(newPrizes);
  };

  const handleAddPrize = () => setPrizes([...prizes, { title: "", weight: 10, totalStock: 100 }]);

  const handleRemovePrize = (index: number) => {
    if (prizes.length > 1) {
      const newPrizes = [...prizes];
      newPrizes.splice(index, 1);
      setPrizes(newPrizes);
    }
  };

  const totalWeight = prizes.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || name.trim().length < 2) {
      setError("Campaign name must be at least 2 characters.");
      return;
    }
    if (!startsAt) {
      setError("Start date is required.");
      return;
    }
    for (let i = 0; i < prizes.length; i++) {
      if (!prizes[i].title.trim() || prizes[i].title.trim().length < 2) {
        setError(`Prize ${i + 1} title must be at least 2 characters.`);
        return;
      }
      if (prizes[i].weight <= 0 || prizes[i].totalStock <= 0) {
        setError(`Prize ${i + 1} weight and stock must be positive.`);
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        prizes: prizes.map((p) => ({
          title: p.title.trim(),
          weight: Number(p.weight),
          totalStock: Number(p.totalStock),
        })),
      };

      const res = await fetch("/api/business/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create campaign.");
        setLoading(false);
        return;
      }

      router.push("/business/campaigns");
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
          <Link href="/business/campaigns" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-semibold">Back to Campaigns</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="text-sm font-black tracking-tight text-slate-900">Looply</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-8 sm:p-10 border-b border-slate-100 bg-slate-50/50">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Campaign</h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-lg">
              A time-boxed promotional scratch card, independent of your loyalty program. Anyone
              holding its QR can play — distribute it however you like.
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

              <div>
                <label htmlFor="campaign-name" className="block text-xs font-semibold text-slate-800 mb-1">
                  Campaign Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="campaign-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Diwali 2026"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="starts-at" className="block text-xs font-semibold text-slate-800 mb-1">
                    Starts <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="starts-at"
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="ends-at" className="block text-xs font-semibold text-slate-800 mb-1">
                    Ends <span className="text-slate-400 font-normal">(Optional — runs until you end it)</span>
                  </label>
                  <input
                    id="ends-at"
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200 mt-6">
                <div className="flex flex-col mb-4">
                  <span className="text-sm font-bold text-slate-900">Prizes</span>
                  <span className="text-xs text-slate-500">
                    Prizes are drawn by weight, and stop appearing once their stock runs out.
                  </span>
                </div>
                {prizes.map((prize, idx) => {
                  const percentage = totalWeight > 0 ? ((Number(prize.weight) || 0) / totalWeight * 100).toFixed(1) : "0";
                  return (
                    <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prize {idx + 1}</span>
                        {prizes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePrize(idx)}
                            className="text-[11px] font-bold text-rose-500 hover:text-rose-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-800 mb-1">Title</label>
                          <input
                            type="text"
                            required
                            value={prize.title}
                            onChange={(e) => handlePrizeChange(idx, "title", e.target.value)}
                            placeholder="e.g. Free Coffee"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-800 mb-1">
                            Weight <span className="text-indigo-600 font-normal">({percentage}%)</span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={prize.weight}
                            onChange={(e) => handlePrizeChange(idx, "weight", parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-800 mb-1">Total Stock</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={prize.totalStock}
                            onChange={(e) => handlePrizeChange(idx, "totalStock", parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleAddPrize}
                  className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Prize
                </button>
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
                      Creating Campaign...
                    </>
                  ) : (
                    <>
                      Create Campaign
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
