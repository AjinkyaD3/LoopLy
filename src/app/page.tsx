import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  QrCode,
  Users,
  Award,
  CheckCircle2,
  Zap,
  Store,
  FileCheck,
  Receipt,
  HeartHandshake,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xl font-black tracking-tight text-slate-900">
                Looply
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
              <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">
                How It Works
              </a>
              <a href="#for-businesses" className="hover:text-indigo-600 transition-colors">
                For Businesses
              </a>
              <a href="#pricing" className="hover:text-indigo-600 transition-colors">
                Pricing
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href={user.role === UserRole.BUSINESS_OWNER ? "/business" : "/customer"}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
              >
                Go to Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
                >
                  Get Started
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Next-Gen Loyalty for Small Businesses</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                Turn every visit into a reason to{" "}
                <span className="text-indigo-600">come back.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Simple digital loyalty without complicated apps, points math, or expensive hardware.
                Set up in 60 seconds, print one permanent counter QR, and reward your regulars effortlessly.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                <Link
                  href="/register"
                  className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  Start Your Business Program
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 text-sm font-semibold rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-2"
                >
                  Join as Customer
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Permanent counter QR</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>No POS integration needed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Zero customer app installs</span>
                </div>
              </div>
            </div>

            {/* Right Card / Visual Flow Demonstration */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-slate-900 leading-none">
                        Bella&apos;s Artisan Bakery
                      </h2>
                      <span className="text-[10px] text-slate-400">Sweet Tooth Club</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                    Active
                  </span>
                </div>

                {/* Counter Stand Simulation */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/60 text-[10px] font-bold text-slate-700">
                    <QrCode className="w-3 h-3 text-indigo-600" />
                    Permanent Counter QR
                  </div>
                  <div className="w-36 h-36 mx-auto bg-white rounded-xl border border-slate-200 p-2 flex items-center justify-center shadow-xs">
                    <div className="w-full h-full bg-slate-900 rounded-lg p-3 text-white flex flex-col items-center justify-center">
                      <QrCode className="w-16 h-16 text-white" />
                      <span className="text-[9px] font-mono mt-1 text-slate-300">Scan to Join</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    One QR code on your counter handles discovery, join, and visits.
                  </p>
                </div>

                {/* Progress preview */}
                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-indigo-600" />
                      Reward: Free Coffee & Pastry
                    </span>
                    <span className="font-bold text-indigo-700">4 / 5 visits</span>
                  </div>
                  <div className="w-full h-2 bg-indigo-200/60 rounded-full overflow-hidden">
                    <div className="w-4/5 h-full bg-indigo-600 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Frictionless Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              How Looply Works
            </h2>
            <p className="text-sm text-slate-600">
              A 4-step loop that turns casual foot traffic into loyal brand regulars.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                1
              </div>
              <h3 className="font-bold text-base text-slate-900">Permanent QR</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generate your business QR code once. Print it and place it at your billing counter or table stands.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                2
              </div>
              <h3 className="font-bold text-base text-slate-900">Customer Scans</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customer scans with their phone camera. No mobile app download required; instant membership in seconds.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                3
              </div>
              <h3 className="font-bold text-base text-slate-900">Visit Verified</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Customer confirms their visit or uploads a bill snapshot. You approve with a tap from your phone.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                4
              </div>
              <h3 className="font-bold text-base text-slate-900">Automatic Reward</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Upon reaching your visit threshold (e.g. 5 visits), the customer unlocks your custom reward coupon.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For Businesses & Customers Split Section */}
      <section id="for-businesses" className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid md:grid-cols-2 gap-8">
            {/* For Business Owners */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                For Small Business Owners
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Traditional loyalty software is bloated with POS integrations, monthly fees, and confusing tablet kiosks. Looply keeps it simple:
              </p>
              <ul className="space-y-3 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>One permanent QR</strong> that never expires or changes.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>Visit-based logic</strong> that customers intuitively understand.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>Flexible verification:</strong> One-tap visit approval or bill receipt upload.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>7-day persistent session:</strong> Stays logged in on your phone or laptop.</span>
                </li>
              </ul>
              <div className="pt-2">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  Create your business program →
                </Link>
              </div>
            </div>

            {/* For Customers */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">
                For Everyday Customers
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                No more lost punch cards or cluttering your phone with dozens of separate loyalty apps:
              </p>
              <ul className="space-y-3 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>One account</strong> tracks rewards across your favorite cafes, gyms, and salons.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>Instant scan-and-join:</strong> Open phone camera, scan QR, and you&apos;re in.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>Transparent progress:</strong> Always know how many visits are left for your free reward.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span><strong>Clean & ad-free:</strong> Fast, mobile-optimized experience with no spam.</span>
                </li>
              </ul>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-800"
                >
                  Sign into your customer account →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Clear & Transparent Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Invest in your regulars, not bloated software
            </h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto">
              Simple flat-rate annual pricing. Zero per-transaction commissions. Zero hidden setup fees.
            </p>
          </div>

          {/* Pricing Card */}
          <div className="relative max-w-lg mx-auto rounded-3xl bg-gradient-to-b from-indigo-50/70 via-white to-white border-2 border-indigo-600 p-8 shadow-xl space-y-6">
            {/* Launch Offer Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              New Launch Offer
            </div>

            <div className="text-center space-y-2 pt-2">
              <h3 className="text-xl font-bold text-slate-900">
                Annual Business License
              </h3>
              <p className="text-xs text-slate-500">
                Complete loyalty system for single-store small businesses
              </p>

              <div className="pt-4 flex items-baseline justify-center gap-2">
                <span className="text-sm text-slate-400 line-through font-semibold">
                  ₹1,499
                </span>
                <span className="text-4xl sm:text-5xl font-black text-slate-900">
                  ₹999
                </span>
                <span className="text-xs text-slate-500 font-medium">/ year</span>
              </div>
              <span className="inline-block text-[11px] font-bold text-indigo-700 bg-indigo-100/60 px-2.5 py-0.5 rounded-full">
                Save ₹500 today with early launch pricing
              </span>
            </div>

            <div className="pt-4 border-t border-slate-200/80 space-y-3 text-xs text-slate-700">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>1 Permanent shop counter QR code</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Unlimited customer memberships</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Custom visit threshold and reward definitions</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Visit Confirmation and Bill Upload verification methods</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>7-Day persistent owner session for effortless operation</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Zero hardware requirements — runs on any phone or laptop</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/register"
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                Claim Launch Offer & Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-[10px] text-center text-slate-400 mt-2">
                No credit card required for initial setup.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight text-base">Looply</span>
            </div>
            <p className="text-xs text-slate-400">
              Lightweight, mobile-first, multi-tenant loyalty platform for small businesses.
            </p>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col items-center justify-between text-xs text-slate-500 gap-4 sm:flex-row sm:gap-2">
            <div className="text-center sm:text-left space-y-1">
              <p>&copy; {new Date().getFullYear()} Astrix Technologies PVT LTD. All rights reserved.</p>
              <p>Looply is a product of Astrix Technologies PVT LTD.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4">
              <Link href="/legal/terms" className="hover:text-slate-400 transition-colors">
                Terms &amp; Conditions
              </Link>
              <Link href="/legal/privacy" className="hover:text-slate-400 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/login" className="hover:text-slate-300 transition-colors ml-0 sm:ml-2">
                Sign In
              </Link>
              <Link href="/register" className="hover:text-slate-300 transition-colors">
                Register
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
