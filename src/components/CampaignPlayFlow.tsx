"use client";

import { useState } from "react";
import { Smartphone, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import ScratchCardComponent from "./ScratchCardComponent";

interface CampaignPlayFlowProps {
  campaignToken: string;
  campaignName: string;
}

export default function CampaignPlayFlow({ campaignToken, campaignName }: CampaignPlayFlowProps) {
  const [mobileNumber, setMobileNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [won, setWon] = useState<{ revealedPrize: string } | null>(null);
  const [scratchComplete, setScratchComplete] = useState(false);

  const handlePlay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/campaign/${campaignToken}/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber, customerName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to play");

      setWon(data.play);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (won) {
    if (!scratchComplete) {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 text-center">You&apos;re In!</h2>
          <p className="text-slate-600 text-center mb-6">Scratch the card below to reveal your prize.</p>
          <ScratchCardComponent
            revealedPrize={won.revealedPrize}
            onScratchComplete={() => setScratchComplete(true)}
          />
        </div>
      );
    }

    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">You Won!</h2>
        <p className="text-slate-600">
          <strong className="text-slate-900">{won.revealedPrize}</strong>
          <br />
          Show this screen to the business owner to claim your prize.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handlePlay} className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="font-bold text-indigo-900 text-xl">Play &quot;{campaignName}&quot;</h3>
        <p className="text-sm text-indigo-600">Enter your details for one chance to win.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
        <div className="relative">
          <Smartphone className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
          <input
            type="tel"
            required
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="Enter your number"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Name (Optional)</label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="What should we call you?"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none"
        />
      </div>

      {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}

      <button
        type="submit"
        disabled={loading || mobileNumber.length < 5}
        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Play Now
          </>
        )}
      </button>
    </form>
  );
}
