"use client";

import { useState } from "react";
import { Smartphone, Sparkles, CheckCircle2 } from "lucide-react";
import ScratchCardComponent from "./ScratchCardComponent";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

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
          <h2 className="font-display text-2xl font-bold text-slate-900 text-center">You&apos;re In!</h2>
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
        <h2 className="font-display text-2xl font-bold text-slate-900">You Won!</h2>
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
        <h3 className="font-bold text-primary-900 text-xl">Play &quot;{campaignName}&quot;</h3>
        <p className="text-sm text-primary-600">Enter your details for one chance to win.</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mobile Number</label>
        <div className="relative">
          <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="tel"
            required
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            placeholder="Enter your number"
            className="w-full pl-11 pr-4 py-3.5 text-base rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
      <Input
        type="text"
        label="Name (Optional)"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        placeholder="What should we call you?"
        className="py-3.5 text-base"
      />

      {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}

      <Button type="submit" loading={loading} disabled={mobileNumber.length < 5} size="lg" fullWidth>
        {loading ? (
          "Playing..."
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Play Now
          </>
        )}
      </Button>
    </form>
  );
}
