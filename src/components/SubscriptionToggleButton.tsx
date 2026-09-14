"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

interface Props {
  businessId: string;
  currentStatus: "ACTIVE" | "INACTIVE";
}

export default function SubscriptionToggleButton({ businessId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update subscription.");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to update subscription.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        onClick={handleToggle}
        loading={loading}
        size="sm"
        variant={nextStatus === "ACTIVE" ? "primary" : "secondary"}
        className={nextStatus === "ACTIVE" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
      >
        {loading ? "Saving..." : nextStatus === "ACTIVE" ? "Activate" : "Deactivate"}
      </Button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
