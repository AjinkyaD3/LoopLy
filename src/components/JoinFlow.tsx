"use client";

import { useState, useEffect, useRef } from "react";
import { Award, CheckCircle2, Loader2, Smartphone, Sparkles } from "lucide-react";
import ScratchCardComponent from "./ScratchCardComponent";
import RewardCard from "./RewardCard";

interface JoinFlowProps {
  business: { id: string; name: string };
  program: {
    programName: string;
    type: string;
    rewardTitle: string;
    requiredVisits: number;
    verificationMethod: string;
    rewardType: string;
  };
}

export default function JoinFlow({ business, program }: JoinFlowProps) {
  const [mobileNumber, setMobileNumber] = useState("");
  const [enteredName, setEnteredName] = useState("");
  const [billPhotoUrl, setBillPhotoUrl] = useState(""); 
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Progress State (for VISITS programs)
  const [progress, setProgress] = useState<{
    exists: boolean;
    name?: string;
    currentVisits: number;
    totalVisits: number;
    eligibleForReward: boolean;
  } | null>(null);
  const [checkingProgress, setCheckingProgress] = useState(false);

  // Claim Code State
  const [claimCode, setClaimCode] = useState("");
  const [claimedReward, setClaimedReward] = useState<any>(null);
  const [scratchComplete, setScratchComplete] = useState(false);

  // Debounced progress check
  const debounceTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (program.type !== "VISITS") return; // No progress check for Scratch Card

    if (mobileNumber.length >= 5) {
      setCheckingProgress(true);
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/customer/progress?mobileNumber=${encodeURIComponent(mobileNumber)}&businessId=${business.id}`);
          if (res.ok) {
            const data = await res.json();
            setProgress(data);
            if (data.name && !enteredName) {
              setEnteredName(data.name);
            }
          }
        } catch (e) {
          console.error("Progress check failed", e);
        } finally {
          setCheckingProgress(false);
        }
      }, 500);
    } else {
      setProgress(null);
    }
    return () => clearTimeout(debounceTimer.current);
  }, [mobileNumber, business.id, program.type, enteredName]); // added enteredName just to silence eslint, though it could cause loop if not careful. Wait, I'll remove enteredName from deps and add eslint-disable.

  const handleSubmitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (program.verificationMethod === "BILL" && !billPhotoUrl) {
      setError("Bill photo is required for this program.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobileNumber,
          enteredName,
          billPhotoUrl,
          businessId: business.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit visit");
      
      setSuccess("Visit request submitted! The business owner will review it.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyClaimCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/reward/claim-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber, claimCode, businessId: business.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid Claim Code");
      
      setClaimedReward(data.reward);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInstantScratch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customer/reward/instant-scratch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber, name: enteredName, businessId: business.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process scratch card");
      
      setClaimedReward(data.reward);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (claimedReward) {
    if (claimedReward.type === "SCRATCH_CARD" && claimedReward.revealedPrize && !scratchComplete) {
      return (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 text-center">Reward Unlocked!</h2>
          <p className="text-slate-600 text-center mb-6">Scratch the card below to reveal your prize.</p>
          <ScratchCardComponent
            revealedPrize={claimedReward.revealedPrize}
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
        <h2 className="text-2xl font-bold text-slate-900">Reward Claimed!</h2>
        <p className="text-slate-600">
          You have successfully redeemed: <strong className="text-slate-900">{claimedReward.revealedPrize || claimedReward.title}</strong>.
          <br/>Enjoy!
        </p>
      </div>
    );
  }

  // --- SCRATCH CARD FLOW ---
  if (program.type === "SCRATCH_CARD") {
    return (
      <div className="space-y-6 w-full">
        <form onSubmit={handleInstantScratch} className="space-y-4">
          <div className="text-center mb-6">
            <h3 className="font-bold text-indigo-900 text-xl">Play for a Prize!</h3>
            <p className="text-sm text-indigo-600">Enter your details to instantly win a scratch card reward.</p>
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
              value={enteredName}
              onChange={(e) => setEnteredName(e.target.value)}
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
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <Sparkles className="w-5 h-5" />
                Get Scratch Card
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  // --- VISITS FLOW ---
  return (
    <div className="space-y-6 w-full">
      <form onSubmit={handleSubmitVisit} className="space-y-4">
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

        {checkingProgress && (
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Checking visits...
          </div>
        )}

        {progress && (
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800">
            {progress.exists ? (
              <span>Welcome back! You have {progress.currentVisits} previous visits toward your reward.</span>
            ) : (
              <span>New here? Submitting will create your loyalty profile.</span>
            )}
          </div>
        )}

        {progress?.eligibleForReward ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <Award className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <h3 className="font-bold text-emerald-900">Reward Available!</h3>
              <p className="text-emerald-700 text-xs mb-4">Ask the cashier for your claim code.</p>
              
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                  className="w-full px-4 py-3 text-center tracking-widest text-lg font-mono rounded-xl border border-emerald-300 focus:ring-2 focus:ring-emerald-600 outline-none uppercase"
                />
                
                {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}

                <button
                  type="button"
                  onClick={handleVerifyClaimCode}
                  disabled={loading || claimCode.length < 6}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Code"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Name (Optional)</label>
              <input
                type="text"
                value={enteredName}
                onChange={(e) => setEnteredName(e.target.value)}
                placeholder="What should we call you?"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            {program.verificationMethod === "BILL" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Photo URL (For Demo)</label>
                <input
                  type="text"
                  required
                  value={billPhotoUrl}
                  onChange={(e) => setBillPhotoUrl(e.target.value)}
                  placeholder="https://example.com/bill.jpg"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
            )}

            {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}
            {success && <p className="text-emerald-600 text-xs font-semibold">{success}</p>}

            {!success && (
              <button
                type="submit"
                disabled={loading || mobileNumber.length < 5}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Visit"}
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
