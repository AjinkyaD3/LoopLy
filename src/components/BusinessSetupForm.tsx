"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  ArrowRight,
  AlertCircle,
  Link as LinkIcon,
  Instagram,
  Star,
  MapPin,
  Briefcase,
  Youtube,
} from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

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
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: Business Profile */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Store className="h-3.5 w-3.5 text-primary-600" />
          Business Details
        </div>

        <Input
          id="business-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bella's Hair Studio, Sweet Crumbs Bakery"
          label="Business Name *"
        />

        <Input
          id="business-type"
          type="text"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="e.g. Cafe, Salon, Retail Store"
          label={
            <span className="flex items-center gap-1">
              <Briefcase className="h-3 w-3 text-slate-500" /> Business Type{" "}
              <span className="font-normal text-slate-400">(Optional)</span>
            </span>
          }
        />

        <Input
          id="business-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 123 Main St, Springfield"
          label={
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-slate-500" /> Address{" "}
              <span className="font-normal text-slate-400">(Optional)</span>
            </span>
          }
        />
      </div>

      {/* Section 2: Social & Reviews */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          <LinkIcon className="h-3.5 w-3.5 text-primary-600" />
          Social & Reviews (Optional)
        </div>

        <div>
          <label
            htmlFor="instagram-handle"
            className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-800"
          >
            <Instagram className="h-3 w-3 text-pink-600" /> Instagram Handle
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
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-7 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="youtube-handle"
            className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-800"
          >
            <Youtube className="h-3 w-3 text-red-600" /> YouTube Handle
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
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-7 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <Input
          id="google-review"
          type="url"
          value={googleReviewUrl}
          onChange={(e) => setGoogleReviewUrl(e.target.value)}
          placeholder="https://g.page/r/.../review"
          label={
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-500" /> Google Review URL
            </span>
          }
        />
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button type="submit" loading={loading} fullWidth size="lg">
          {loading ? (
            "Creating Business..."
          ) : (
            <>
              Create My Business
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
