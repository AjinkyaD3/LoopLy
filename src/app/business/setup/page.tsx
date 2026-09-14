import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

import BusinessSetupForm from "@/components/BusinessSetupForm";
import { ArrowLeft, CheckCircle2, Store, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function BusinessSetupPage() {
  const user = await getCurrentUser();

  // Guard: Must be authenticated and have role BUSINESS_OWNER
  if (!user) {
    redirect("/login");
  }

  // Check if owner already owns a business
  const existingBusiness = await prisma.business.findUnique({
    where: { ownerId: user.id },
  });

  // Duplicate protection: if business already exists, provide friendly redirection
  if (existingBusiness) {
    return (
      <div className="flex-1 flex flex-col justify-between p-6">
        <div>
          <header className="pt-4 pb-4">
            <Link
              href="/business"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Business Setup
            </h1>
          </header>

          <Card className="my-8 space-y-3 border-emerald-200 bg-emerald-50 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-emerald-950">
              Your business is already configured
            </h2>
            <p className="mx-auto max-w-xs text-xs leading-relaxed text-emerald-800">
              You have already set up <strong>{existingBusiness.name}</strong>. Each business owner account is linked to one business in V1.
            </p>
            <div className="pt-2">
              <Link href="/business">
                <Button size="sm">Go to Dashboard</Button>
              </Link>
            </div>
          </Card>
        </div>

        <footer className="pt-6 pb-2 text-center text-xs text-slate-400">
          Looply &copy; {new Date().getFullYear()} — Simple Small Business Loyalty
        </footer>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between p-6">
      <div>
        <header className="pt-4 pb-4">
          <Link
            href="/business"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Initial Setup
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                Set Up Your Business
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Configure your business and loyalty program in under 60 seconds.
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 text-primary-600 flex items-center justify-center shadow-sm">
              <Store className="w-5 h-5" />
            </div>
          </div>
        </header>

        <div className="my-4">
          <BusinessSetupForm />
        </div>
      </div>

      <footer className="pt-6 pb-2 text-center text-xs text-slate-400">
        Looply &copy; {new Date().getFullYear()} — Simple Small Business Loyalty
      </footer>
    </div>
  );
}
