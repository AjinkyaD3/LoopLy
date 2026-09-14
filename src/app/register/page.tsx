"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, acceptTerms, acceptPrivacy }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please check your information.");
        setLoading(false);
        return;
      }

      router.push("/business");
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please check your network.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-slate-50 p-4 py-12 sm:p-6">
      <Card className="w-full max-w-md space-y-6 sm:p-8">
        <header>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-50 border border-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
            <Sparkles className="h-3.5 w-3.5" />
            Looply Loyalty
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Create an Account
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Launch your business loyalty program with a single permanent QR.
          </p>
        </header>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Smith"
            label="Full Name"
          />

          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@example.com"
            label="Email Address"
          />

          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            label="Password (min. 8 characters)"
          />

          <div className="space-y-3 pb-2 pt-2">
            <label className="group flex cursor-pointer items-start gap-3">
              <div className="flex h-5 items-center">
                <input
                  type="checkbox"
                  required
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white text-primary-600 focus:ring-2 focus:ring-primary-600"
                />
              </div>
              <div className="text-xs leading-snug text-slate-600">
                I agree to the{" "}
                <Link
                  href="/legal/terms"
                  target="_blank"
                  className="font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-700"
                >
                  Terms &amp; Conditions
                </Link>
                . <span className="text-rose-500">*</span>
              </div>
            </label>

            <label className="group flex cursor-pointer items-start gap-3">
              <div className="flex h-5 items-center">
                <input
                  type="checkbox"
                  required
                  checked={acceptPrivacy}
                  onChange={(e) => setAcceptPrivacy(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 bg-white text-primary-600 focus:ring-2 focus:ring-primary-600"
                />
              </div>
              <div className="text-xs leading-snug text-slate-600">
                I acknowledge the{" "}
                <Link
                  href="/legal/privacy"
                  target="_blank"
                  className="font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-700"
                >
                  Privacy Policy
                </Link>
                . <span className="text-rose-500">*</span>
              </div>
            </label>
          </div>

          <Button
            type="submit"
            loading={loading}
            disabled={!acceptTerms || !acceptPrivacy}
            fullWidth
            size="lg"
            className="mt-2"
          >
            {loading ? (
              "Creating account..."
            ) : (
              <>
                Register Business
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-xs text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-700"
            >
              Log in here
            </Link>
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Passwords encrypted with bcrypt &bull; No plaintext storage
        </div>
      </Card>
    </div>
  );
}
