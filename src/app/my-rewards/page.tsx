"use client";

import { useState } from "react";
import { Sparkles, Smartphone, Loader2, Award, Gift, CheckCircle2, Ticket, Clock, Check } from "lucide-react";

type RewardData = {
  title: string;
  description: string;
  claimCode: string | null;
  redeemedAt?: string;
};

type ProgressData = {
  currentStamps: number;
  requiredStamps: number;
  availableRewards: RewardData[];
  redeemedRewards: RewardData[];
  nextReward: {
    title: string;
    position: number;
    stampsNeeded: number;
  } | null;
};

type CardData = {
  businessName: string;
  programName: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  progress: ProgressData;
};

type CampaignData = {
  id: string;
  businessName: string;
  campaignName: string;
  prize: string;
  claimCode: string;
  status: string;
  playedAt: string;
  redeemedAt?: string;
};

export default function MyRewardsPage() {
  const [mobileNumber, setMobileNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState<CardData[] | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
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
      
      setCards(data.cards);
      setCampaigns(data.campaigns || []);
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
          <h1 className="text-2xl font-bold mb-2">My Loyalty Cards</h1>
          <p className="text-slate-500 text-sm">Enter your mobile number to view your loyalty cards and rewards.</p>
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
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "View My Cards"}
          </button>
        </form>

        {hasSearched && cards !== null && (
          <div className="space-y-4">
            {cards.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Gift className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-1">No Cards Found</h3>
                <p className="text-sm text-slate-500">We couldn&apos;t find any loyalty programs linked to this number.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Your Loyalty Cards</h2>
                
                {cards.map((card, idx) => (
                  <div key={idx} className={`bg-white rounded-2xl border shadow-xs overflow-hidden ${card.isActive ? 'border-indigo-200 shadow-indigo-100/50' : 'border-slate-200 opacity-80'}`}>
                    {/* Card Header */}
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-slate-900">{card.businessName}</h3>
                        <p className="text-xs text-slate-500">{card.programName}</p>
                      </div>
                      <div className={`p-2 rounded-lg border shadow-xs ${card.isActive ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-100'}`}>
                        {card.isActive ? <Ticket className="w-5 h-5 text-indigo-600" /> : <Clock className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>

                    {/* Stamps Visualization */}
                    <div className="px-5 py-6 bg-slate-50">
                      <div className="flex justify-between items-end mb-4">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loyalty Card</span>
                        <span className="text-sm font-bold text-indigo-600">
                          {card.progress.currentStamps} / {card.progress.requiredStamps} collected
                        </span>
                      </div>
                      
                      {/* Stamp Grid */}
                      <div className="grid grid-cols-5 gap-3">
                        {Array.from({ length: card.progress.requiredStamps }).map((_, i) => {
                          const isCollected = i < card.progress.currentStamps;
                          // If there's a reward available at this specific position, highlight it. (For now we just check if collected)
                          return (
                            <div 
                              key={i} 
                              className={`aspect-square rounded-full border-2 flex items-center justify-center transition-all ${
                                isCollected 
                                  ? 'bg-indigo-100 border-indigo-600 text-indigo-600' 
                                  : 'bg-white border-dashed border-slate-300 text-slate-300'
                              }`}
                            >
                              {isCollected ? <Check className="w-5 h-5" strokeWidth={3} /> : <span className="text-xs font-bold">{i + 1}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Rewards Section */}
                    <div className="px-5 py-4 bg-white">
                      <div className="space-y-3">
                        {/* Available Unclaimed Rewards */}
                        {card.progress.availableRewards.map((reward, rIdx) => (
                          <div key={rIdx} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                            <Gift className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <h4 className="text-sm font-bold text-emerald-900">{reward.title}</h4>
                                {reward.claimCode && (
                                  <span className="text-xs font-mono bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                    {reward.claimCode}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-emerald-700 mt-0.5">{reward.description}</p>
                              <p className="text-xs text-emerald-600 font-medium mt-1">Show code to cashier to claim!</p>
                            </div>
                          </div>
                        ))}

                        {/* Redeemed Rewards History */}
                        {card.progress.redeemedRewards?.map((reward, rIdx) => (
                          <div key={`redeemed-${rIdx}`} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3 opacity-75">
                            <CheckCircle2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-slate-700">{reward.title}</h4>
                              {reward.redeemedAt && (
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                  You collected this gift on {new Date(reward.redeemedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Next Upcoming Reward */}
                        {card.progress.nextReward && (
                          <p className="text-sm text-slate-600 text-center py-2">
                            {card.progress.nextReward.stampsNeeded} more {card.progress.nextReward.stampsNeeded === 1 ? 'stamp' : 'stamps'} to unlock: <strong className="text-slate-800">{card.progress.nextReward.title}</strong>
                          </p>
                        )}
                        
                        {!card.isActive && (
                          <p className="text-xs text-amber-600 font-medium text-center bg-amber-50 py-1.5 rounded-lg border border-amber-100">
                            This program has ended.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {campaigns.length > 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 mt-8">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Campaign Prizes</h2>
                <div className="space-y-4">
                  {campaigns.map((c, idx) => (
                    <div key={idx} className={`p-5 rounded-2xl border shadow-xs flex flex-col gap-3 ${c.status === 'REDEEMED' ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white border-indigo-200 shadow-indigo-100/50'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-slate-900">{c.businessName}</h3>
                          <p className="text-xs text-slate-500">{c.campaignName}</p>
                        </div>
                        <div className={`p-2 rounded-lg border shadow-xs ${c.status === 'REDEEMED' ? 'bg-slate-100 border-slate-200' : 'bg-indigo-50 border-indigo-100'}`}>
                          {c.status === 'REDEEMED' ? <CheckCircle2 className="w-5 h-5 text-slate-400" /> : <Gift className="w-5 h-5 text-indigo-600" />}
                        </div>
                      </div>
                      
                      <div className={`p-3 rounded-xl border flex items-start gap-3 ${c.status === 'REDEEMED' ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-emerald-50 border-emerald-100 text-emerald-900'}`}>
                        <Gift className={`w-5 h-5 shrink-0 mt-0.5 ${c.status === 'REDEEMED' ? 'text-slate-400' : 'text-emerald-600'}`} />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="text-sm font-bold">{c.prize}</h4>
                            {c.status === 'AVAILABLE' && c.claimCode && (
                              <span className="text-xs font-mono bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-bold">
                                {c.claimCode}
                              </span>
                            )}
                          </div>
                          {c.status === 'AVAILABLE' ? (
                            <p className="text-xs text-emerald-600 font-medium mt-1">Show code to cashier to claim!</p>
                          ) : (
                            <p className="text-xs mt-1">
                              Redeemed on {c.redeemedAt ? new Date(c.redeemedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : 'Unknown date'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
