"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <Link href="/business" className="text-sm text-indigo-600">← Back to dashboard</Link>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create loyalty card</h1>
        <p className="mt-1 text-sm text-slate-600">Your shop QR stays the same. Customers scanning it see this current loyalty card.</p>
      </div>
      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium">Program name<input value={programName} onChange={(e) => setProgramName(e.target.value)} className="mt-1 w-full rounded-lg border p-2" required /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-medium">Starts<input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full rounded-lg border p-2" required /></label>
          <label className="text-sm font-medium">Ends<input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1 w-full rounded-lg border p-2" required /></label>
        </div>
        <label className="block text-sm font-medium">Cards to collect<input type="number" min="2" max="20" value={requiredVisits} onChange={(e) => setRequiredVisits(Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2" /></label>
        <section className="space-y-3"><div><h2 className="font-semibold">Choose reward positions</h2><p className="text-sm text-slate-600">A customer receives a loyalty card for every approved purchase. Select the card positions that issue rewards.</p></div>
          <div className="grid grid-cols-5 gap-2">{positions.map((position) => { const selected = rewards.some((reward) => reward.cardPosition === position); return <button key={position} type="button" onClick={() => toggleReward(position)} className={`rounded-xl border p-3 text-sm font-bold ${selected ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200"}`}>{position}{selected ? " 🎁" : ""}</button>; })}</div>
          {rewards.filter((reward) => reward.cardPosition <= requiredVisits).map((reward) => <div key={reward.cardPosition} className="rounded-xl bg-slate-50 p-3 space-y-2"><p className="text-sm font-semibold">Reward on card {reward.cardPosition}</p><input value={reward.title} onChange={(e) => changeReward(reward.cardPosition, "title", e.target.value)} placeholder="Reward title" className="w-full rounded-lg border p-2" required /><input value={reward.description} onChange={(e) => changeReward(reward.cardPosition, "description", e.target.value)} placeholder="Short description (optional)" className="w-full rounded-lg border p-2" /></div>)}</section>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Creating…" : "Create loyalty card"}</button>
      </form>
    </main>
  );
}
