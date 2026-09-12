import Link from "next/link";
import prisma from "@/lib/prisma";
import { isValidToken } from "@/lib/token";
import { getCampaignStatus } from "@/lib/campaign";
import { Sparkles, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import CampaignPlayFlow from "@/components/CampaignPlayFlow";

export const dynamic = "force-dynamic";

interface CampaignPageProps {
  params: { campaignToken: string };
}

export default async function CampaignPlayPage({ params }: CampaignPageProps) {
  const { campaignToken } = params;

  if (!campaignToken || !isValidToken(campaignToken)) {
    return <NotFoundState />;
  }

  const campaign = await prisma.campaign.findUnique({
    where: { campaignToken },
    include: { prizes: true, business: { select: { name: true } } },
  });

  if (!campaign) {
    return <NotFoundState />;
  }

  const status = getCampaignStatus(campaign, campaign.prizes);

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 py-12 bg-slate-50 min-h-screen">
      <div className="w-full max-w-md bg-white sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-sm p-6 sm:p-8 space-y-6">
        <header className="pb-4 text-center border-b border-slate-100">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-700 font-bold text-sm mb-4">
            <Sparkles className="w-4 h-4" /> Looply
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold mb-3">
            Limited-Time Campaign
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{campaign.name}</h1>
          <p className="mt-1 text-xs text-slate-500">{campaign.business.name}</p>
        </header>

        {status === "SCHEDULED" && (
          <div className="text-center space-y-3 py-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Starting Soon</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              This campaign hasn&apos;t started yet. Check back on{" "}
              {campaign.startsAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
            </p>
          </div>
        )}

        {status === "ENDED" && (
          <div className="text-center space-y-3 py-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Campaign Ended</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              This campaign has ended. Thanks for your interest!
            </p>
          </div>
        )}

        {status === "ACTIVE" && <CampaignPlayFlow campaignToken={campaignToken} campaignName={campaign.name} />}

        <footer className="pt-4 text-center text-xs text-slate-400 border-t border-slate-100 mt-6">
          Looply &copy; {new Date().getFullYear()} — Simple Small Business Loyalty
        </footer>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6 py-12 bg-slate-50 min-h-screen">
      <div className="text-center space-y-3 max-w-xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-2">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Campaign Not Found</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          This campaign QR code or link is invalid or no longer exists.
        </p>
        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            Go to Looply Home
          </Link>
        </div>
      </div>
    </div>
  );
}
