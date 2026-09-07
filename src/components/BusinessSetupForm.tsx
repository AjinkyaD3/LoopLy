"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  ArrowRight,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  Instagram,
  Star,
  MapPin,
  Briefcase,
  Youtube,
} from "lucide-react";

export default function BusinessSetupForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [youtubeHandle, setYoutubeHandle] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side quick checks
    if (!name.trim() || name.trim().length < 2) {
      setError("Business name must be at least 2 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/business/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          businessType: businessType.trim(),
          googleReviewUrl: googleReviewUrl.trim(),
          instagramHandle: instagramHandle.trim(),
          youtubeHandle: youtubeHandle.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to set up business. Please try again.");
        setLoading(false);
        return;
      }

      // Success: redirect to the owner dashboard where the QR is now available
      router.push("/business");
      router.refresh();
    } catch {
      setError("Unable to connect to server. Please check your network.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Business Profile */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
          <Store className="w-3.5 h-3.5 text-indigo-600" />
          Business Details
        </div>

        <div>
          <label htmlFor="business-name" className="block text-xs font-semibold text-slate-800 mb-1">
            Business Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="business-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bella's Hair Studio, Sweet Crumbs Bakery"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="business-type" className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-slate-500" /> Business Type <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            id="business-type"
            type="text"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder="e.g. Cafe, Salon, Retail Store"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="business-address" className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-500" /> Address <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            id="business-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Main St, Springfield"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Section 2: Social & Reviews */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
          <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
          Social & Reviews (Optional)
        </div>

        <div>
          <label htmlFor="instagram-handle" className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
            <Instagram className="w-3 h-3 text-pink-600" /> Instagram Handle
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-400">@</span>
            <input
              id="instagram-handle"
              type="text"
              value={instagramHandle}
              onChange={(e) => {
                const val = e.target.value.startsWith("@") ? e.target.value.substring(1) : e.target.value;
                setInstagramHandle(val);
              }}
              placeholder="looply_cafe"
              className="w-full pl-7 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="youtube-handle" className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
            <Youtube className="w-3 h-3 text-red-600" /> YouTube Handle
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-400">@</span>
            <input
              id="youtube-handle"
              type="text"
              value={youtubeHandle}
              onChange={(e) => {
                const val = e.target.value.startsWith("@") ? e.target.value.substring(1) : e.target.value;
                setYoutubeHandle(val);
              }}
              placeholder="looply_channel"
              className="w-full pl-7 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="google-review" className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-500" /> Google Review URL
          </label>
          <input
            id="google-review"
            type="url"
            value={googleReviewUrl}
            onChange={(e) => setGoogleReviewUrl(e.target.value)}
            placeholder="https://g.page/r/.../review"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Business...
            </>
          ) : (
            <>
              Create My Business
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
