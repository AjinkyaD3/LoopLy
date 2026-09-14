"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, ArrowRight, Loader2, QrCode } from "lucide-react";

export default function JoinBusinessInput() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = tokenInput.trim();
    if (!cleaned) {
      setError("Please enter a business code or join link.");
      return;
    }

    setLoading(true);

    // If user pasted a full URL (e.g. http://localhost:3000/join/abc123xyz), extract the token
    let token = cleaned;
    if (cleaned.includes("/join/")) {
      const parts = cleaned.split("/join/");
      token = parts[parts.length - 1].split("?")[0].split("#")[0].trim();
    }

    if (!token || token.length < 4) {
      setError("Invalid business code format.");
      setLoading(false);
      return;
    }

    router.push(`/join/${encodeURIComponent(token)}`);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
          <QrCode className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-slate-900">Join a New Business</h3>
          <p className="text-[11px] text-slate-500">Enter the business token or paste their join link</p>
        </div>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={tokenInput}
          onChange={(e) => {
            setTokenInput(e.target.value);
            setError(null);
          }}
          placeholder="e.g. paste join link or business token..."
          className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !tokenInput.trim()}
          className="py-2 px-4 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              Join Business
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {error && <p className="mt-2 text-[11px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
}
