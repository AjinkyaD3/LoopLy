import Link from "next/link";
import prisma from "@/lib/prisma";
import { isValidBusinessToken } from "@/lib/token";
import { Sparkles, AlertCircle } from "lucide-react";
import JoinFlow from "@/components/JoinFlow";

export const dynamic = "force-dynamic";

interface JoinPageProps {
  params: {
    businessToken: string;
  };
}

export default async function PublicJoinPage({ params }: JoinPageProps) {
  const { businessToken } = params;

  if (!businessToken || !isValidBusinessToken(businessToken)) {
    return <NotFoundState />;
  }

  const business = await prisma.business.findUnique({
    where: { businessToken },
    include: { loyaltyProgram: true },
  });

  if (!business || !business.loyaltyProgram) {
    return <NotFoundState />;
  }

  const { name } = business;
  const program = business.loyaltyProgram;

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 py-12 bg-slate-50 min-h-screen">
      <div className="w-full max-w-md bg-white sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-sm p-6 sm:p-8 space-y-6">
        {/* Header */}
        <header className="pb-4 text-center border-b border-slate-100">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-700 font-bold text-sm mb-4">
            <Sparkles className="w-4 h-4" /> Looply
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
            Official Loyalty Program
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
          <p className="mt-1 text-xs text-slate-500">{program.programName}</p>
        </header>

        {/* Join Flow */}
        <JoinFlow business={business} program={program} />

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
        <h1 className="text-xl font-bold text-slate-900">Business Not Found</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          This loyalty QR code or join link is invalid or has expired. Please check with the business for a new link.
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
