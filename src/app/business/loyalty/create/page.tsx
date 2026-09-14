"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

type CardReward = { cardPosition: number; title: string; description: string };

function localDate(daysFromNow: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

export default function CreateLoyaltyProgramPage() {
  const router = useRouter();
  const [programName, setProgramName] = useState("My Loyalty Card");
  const [startsAt, setStartsAt] = useState(localDate(0));
  const [endsAt, setEndsAt] = useState(localDate(30));
  const [requiredVisits, setRequiredVisits] = useState(5);
  const [rewards, setRewards] = useState<CardReward[]>([
    { cardPosition: 5, title: "Your reward", description: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const positions = useMemo(() => Array.from({ length: requiredVisits }, (_, index) => index + 1), [requiredVisits]);

  function toggleReward(position: number) {
    setRewards((current) => {
      const existing = current.find((reward) => reward.cardPosition === position);
      return existing
        ? current.filter((reward) => reward.cardPosition !== position)
        : [...current, { cardPosition: position, title: "New reward", description: "" }].sort((a, b) => a.cardPosition - b.cardPosition);
    });
  }

  function changeReward(position: number, field: "title" | "description", value: string) {
    setRewards((current) => current.map((reward) => reward.cardPosition === position ? { ...reward, [field]: value } : reward));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const validRewards = rewards.filter((reward) => reward.cardPosition <= requiredVisits);
    if (!validRewards.length) return setError("Choose at least one card position that earns a reward.");

    setSaving(true);
    try {
      const response = await fetch("/api/business/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programName,
          startsAt: new Date(`${startsAt}T00:00:00`).toISOString(),
          endsAt: new Date(`${endsAt}T23:59:59`).toISOString(),
          requiredVisits,
          rewards: validRewards,
          rewardValidityDays: 14,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create loyalty program.");
      router.push("/business");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create loyalty program.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-4 py-6 sm:p-6 sm:py-8 space-y-6">
      <Link href="/business" className="text-sm font-medium text-primary-600 hover:text-primary-700">
        ← Back to dashboard
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Create loyalty card</h1>
        <p className="mt-1 text-sm text-slate-600">Your shop QR stays the same. Customers scanning it see this current loyalty card.</p>
      </div>
      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <Input
          label="Program name"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            label="Starts"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
          <Input
            type="date"
            label="Ends"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
          />
        </div>
        <Input
          type="number"
          min="2"
          max="20"
          label="Cards to collect"
          value={requiredVisits}
          onChange={(e) => setRequiredVisits(Number(e.target.value))}
        />
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Choose reward positions</h2>
            <p className="text-sm text-slate-600">A customer receives a loyalty card for every approved purchase. Select the card positions that issue rewards.</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {positions.map((position) => {
              const selected = rewards.some((reward) => reward.cardPosition === position);
              return (
                <button
                  key={position}
                  type="button"
                  onClick={() => toggleReward(position)}
                  className={`rounded-xl border p-3 text-sm font-bold transition-colors ${
                    selected ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {position}
                  {selected ? " 🎁" : ""}
                </button>
              );
            })}
          </div>
          {rewards.filter((reward) => reward.cardPosition <= requiredVisits).map((reward) => (
            <div key={reward.cardPosition} className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
              <p className="text-sm font-semibold text-slate-800">Reward on card {reward.cardPosition}</p>
              <Input
                value={reward.title}
                onChange={(e) => changeReward(reward.cardPosition, "title", e.target.value)}
                placeholder="Reward title"
                required
              />
              <Input
                value={reward.description}
                onChange={(e) => changeReward(reward.cardPosition, "description", e.target.value)}
                placeholder="Short description (optional)"
              />
            </div>
          ))}
        </section>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" loading={saving} size="lg">
          {saving ? "Creating…" : "Create loyalty card"}
        </Button>
      </form>
    </main>
  );
}
