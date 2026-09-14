"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import Button from "@/components/ui/Button";

interface Props {
  membershipId: string;
  businessName: string;
  googleReviewUrl: string;
  currentVisits: number;
  reviewPromptedAt: Date | null;
}

export default function GoogleReviewModal({
  membershipId,
  businessName,
  googleReviewUrl,
  currentVisits,
  reviewPromptedAt,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Only trigger if visits >= 2
    if (currentVisits < 2 || !googleReviewUrl) return;

    // Check if we already prompted recently (e.g., within 30 days)
    if (reviewPromptedAt) {
      const promptedDate = new Date(reviewPromptedAt);
      const daysSincePrompt = (Date.now() - promptedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePrompt < 30) {
        return; // Don't show if prompted in the last 30 days
      }
    }

    // Small delay so it doesn't pop up instantly on page load
    const timer = setTimeout(() => setIsOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [currentVisits, reviewPromptedAt, googleReviewUrl]);

  if (!isOpen) return null;

  const recordPrompt = async () => {
    try {
      await fetch(`/api/customer/membership/${membershipId}/review-prompt`, {
        method: "POST",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleReviewClick = () => {
    recordPrompt();
    setIsOpen(false);
    window.open(googleReviewUrl, "_blank", "noopener,noreferrer");
  };

  const handleDismiss = () => {
    recordPrompt();
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto">
            <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
          </div>
          
          <div>
            <h3 className="font-display text-xl font-extrabold text-slate-900">Enjoying {businessName}?</h3>
            <p className="text-sm text-slate-500 mt-2">
              Your feedback helps us grow. Would you mind taking a moment to leave us a quick review on Google?
            </p>
          </div>

          <div className="pt-4 space-y-2.5">
            <Button onClick={handleReviewClick} size="lg" fullWidth>
              Sure, I&apos;ll leave a review!
            </Button>
            <Button onClick={handleDismiss} variant="secondary" size="lg" fullWidth className="border-transparent">
              Remind me later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
