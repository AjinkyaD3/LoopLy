"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
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
            Welcome back
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Sign in to access your business dashboard.
          </p>
        </header>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            label="Email Address"
          />

          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            label="Password"
          />

          <Button type="submit" loading={loading} fullWidth size="lg" className="mt-2">
            {loading ? (
              "Signing in..."
            ) : (
              <>
                Sign In
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href={`/register`}
              className="font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-700"
            >
              Create one here
            </Link>
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          Encrypted server-side HTTP-only session
        </div>
      </Card>
    </div>
  );
}
