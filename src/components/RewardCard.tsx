"use client";

import { useState } from "react";
import { Award } from "lucide-react";
import ScratchCardComponent from "./ScratchCardComponent";

interface RewardProps {
  reward: any;
}

export default function RewardCard({ reward }: RewardProps) {
  const [revealedPrize, setRevealedPrize] = useState(reward.revealedPrize);
  const [isScratched, setIsScratched] = useState(reward.isScratched);

  const handleScratchComplete = () => {
    setRevealedPrize(reward.title);
    setIsScratched(true);
  };

  const showScratchCard = reward.type === "SCRATCH_CARD" && !isScratched;

  return (
    <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 w-full">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Award className="w-4 h-4" />
          </div>
          <div className="flex-1 w-full">
            {showScratchCard ? (
              <ScratchCardComponent revealedPrize={reward.title} onScratchComplete={handleScratchComplete} />
            ) : (
              <>
                <p className="text-sm font-bold text-emerald-900">
                  {isScratched && revealedPrize ? revealedPrize : reward.title}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{reward.business.name}</p>
                {reward.description && <p className="text-[11px] text-slate-500 mt-1">{reward.description}</p>}
                <p className="text-[11px] text-slate-400 mt-2">
                  Expires: {new Date(reward.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </>
            )}
          </div>
        </div>
        {!showScratchCard && (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold whitespace-nowrap">
            Ready to Claim
          </span>
        )}
      </div>
      {!showScratchCard && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 text-center font-medium">
          🎉 Show this screen to the business owner to claim your reward!
        </div>
      )}
    </div>
  );
}
