"use client";

import { useState, useEffect, useRef } from "react";
import { Award, CheckCircle2, Loader2, Smartphone } from "lucide-react";
import GoogleReviewModal from "./GoogleReviewModal";
import InstagramButton from "./InstagramButton";
import BillPhotoInput from "./VisitRequestButton";

interface JoinFlowProps {
  business: {
    id: string;
    name: string;
    googleReviewUrl: string | null;
    instagramHandle: string | null;
  };
  program: {
    programName: string;
    rewardTitle: string;
    requiredVisits: number;
    verificationMethod: string;
  };
}

export default function JoinFlow({ business, program }: JoinFlowProps) {
  const [mobileNumber, setMobileNumber] = useState("");
  const [enteredName, setEnteredName] = useState("");
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billFileError, setBillFileError] = useState<string | null>(null);
  const [billNumber, setBillNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [progress, setProgress] = useState<{
    exists: boolean;
    name?: string;
    membershipId?: string;
    reviewPromptedAt?: string | null;
    currentVisits: number;
    totalVisits: number;
    eligibleForReward: boolean;
  } | null>(null);
  const [checkingProgress, setCheckingProgress] = useState(false);

  const [claimCode, setClaimCode] = useState("");
  const [claimedReward, setClaimedReward] = useState<any>(null);

  const debounceTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileNumber, business.id]);

  const handleSubmitVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (program.verificationMethod === "BILL" && !billFile) {
      setError("Bill photo is required for this program.");
      return;
    }
    if (program.verificationMethod === "BILL" && !billNumber.trim()) {
      setError("Bill number is required for this program.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("mobileNumber", mobileNumber);
      formData.append("enteredName", enteredName);
      formData.append("businessId", business.id);
      if (billFile) formData.append("billPhoto", billFile);
      if (billNumber) formData.append("billNumber", billNumber.trim());

      const res = await fetch("/api/customer/visit", {
        method: "POST",
        body: formData,
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

  if (claimedReward) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 animate-in zoom-in">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Reward Claimed!</h2>
        <p className="text-slate-600">
          You have successfully redeemed: <strong className="text-slate-900">{claimedReward.title}</strong>.
          <br />Enjoy!
        </p>
      </div>
    );
  }

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
            {business.instagramHandle && <InstagramButton handle={business.instagramHandle} />}
          </div>
        )}

        {progress?.exists && progress.membershipId && business.googleReviewUrl && (
          <GoogleReviewModal
            membershipId={progress.membershipId}
            businessName={business.name}
            googleReviewUrl={business.googleReviewUrl}
            currentVisits={progress.currentVisits}
            reviewPromptedAt={progress.reviewPromptedAt ? new Date(progress.reviewPromptedAt) : null}
          />
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Number</label>
                <input
                  type="text"
                  required
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="e.g. the receipt/invoice number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
            )}

            {program.verificationMethod === "BILL" && (
              <BillPhotoInput
                file={billFile}
                onFileSelect={(file, fileError) => {
                  setBillFile(file);
                  setBillFileError(fileError);
                }}
              />
            )}
            {billFileError && <p className="text-rose-600 text-xs font-semibold">{billFileError}</p>}

            {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}
            {success && <p className="text-emerald-600 text-xs font-semibold">{success}</p>}

            {!success && (
              <button
                type="submit"
                disabled={loading || mobileNumber.length < 5 || !!billFileError}
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
