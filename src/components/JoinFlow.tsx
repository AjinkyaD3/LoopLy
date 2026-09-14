"use client";

import { useState, useEffect, useRef } from "react";
import { Award, CheckCircle2, Loader2, Smartphone, Check } from "lucide-react";
import GoogleReviewModal from "./GoogleReviewModal";
import InstagramButton from "./InstagramButton";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

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
    isActive: boolean;
  };
}

export default function JoinFlow({ business, program }: JoinFlowProps) {
  const [mobileNumber, setMobileNumber] = useState("");
  const [enteredName, setEnteredName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [progress, setProgress] = useState<{
    exists: boolean;
    name?: string;
    membershipId?: string;
    reviewPromptedAt?: string | null;
    currentStamps: number;
    totalStamps: number;
    isCompleted: boolean;
  } | null>(null);
  const [checkingProgress, setCheckingProgress] = useState(false);

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
            if (data.name) {
              setEnteredName((prev) => prev ? prev : data.name);
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
  }, [mobileNumber, business.id]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (progress?.isCompleted) {
      setError("You have already completed this loyalty program.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("mobileNumber", mobileNumber);
      formData.append("enteredName", enteredName);
      formData.append("businessId", business.id);

      const res = await fetch("/api/customer/visit", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");

      setSuccess("Loyalty card request submitted! The business owner will review it.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <form onSubmit={handleSubmitRequest} className="space-y-4">
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
              disabled={!program.isActive}
              className="w-full pl-11 pr-4 py-3.5 text-base rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
        </div>

        {checkingProgress && (
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Checking loyalty card...
          </div>
        )}

        {progress && !progress.isCompleted && program.isActive && (
          <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl text-xs text-primary-800">
            {progress.exists ? (
              <span>Welcome back! You have {progress.currentStamps} stamps on your loyalty card.</span>
            ) : (
              <span>New here? Submitting will create your loyalty profile.</span>
            )}
            {business.instagramHandle && <InstagramButton handle={business.instagramHandle} />}
          </div>
        )}

        {progress?.exists && progress.membershipId && business.googleReviewUrl && !progress.isCompleted && program.isActive && (
          <GoogleReviewModal
            membershipId={progress.membershipId}
            businessName={business.name}
            googleReviewUrl={business.googleReviewUrl}
            currentVisits={progress.totalStamps}
            reviewPromptedAt={progress.reviewPromptedAt ? new Date(progress.reviewPromptedAt) : null}
          />
        )}

        {!program.isActive ? (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <h3 className="font-bold text-amber-900 mb-1">Program Paused</h3>
              <p className="text-amber-700 text-xs">This loyalty program is currently paused by the business and is not accepting new visits.</p>
            </div>
          </div>
        ) : progress?.isCompleted ? (
          <div className="space-y-4">
            <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl text-center">
              <Check className="w-8 h-8 text-primary-600 mx-auto mb-2" />
              <h3 className="font-bold text-primary-900">Program Completed!</h3>
              <p className="text-primary-700 text-xs mb-4">You have already completed this loyalty card program.</p>

              <div className="space-y-3">
                <Link href="/my-rewards" className="block">
                  <Button size="lg" fullWidth>View My Rewards</Button>
                </Link>
                <p className="text-[11px] text-primary-600 font-medium">
                  Go to your rewards page to view your collected rewards and claim codes.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              type="text"
              label="Name (Optional)"
              value={enteredName}
              onChange={(e) => setEnteredName(e.target.value)}
              placeholder="What should we call you?"
              className="py-3.5 text-base"
            />

            {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}
            {success && <p className="text-emerald-600 text-xs font-semibold">{success}</p>}

            {!success && (
              <Button
                type="submit"
                loading={loading}
                disabled={mobileNumber.length < 5}
                size="lg"
                fullWidth
              >
                Submit Request
              </Button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
