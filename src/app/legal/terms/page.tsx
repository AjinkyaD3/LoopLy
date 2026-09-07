import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-semibold">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="text-sm font-black tracking-tight text-slate-900">
              Looply
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 sm:p-12 space-y-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Terms &amp; Conditions</h1>
            <p className="mt-2 text-sm text-slate-500">Last Updated: September 2026</p>
          </div>
          
          <div className="prose prose-slate prose-sm sm:prose-base">
            <p><strong>Looply — a product of Astrix Technologies PVT LTD</strong></p>
            <p>Welcome to Looply. By accessing or using our service, you agree to be bound by these Terms and Conditions.</p>
            
            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">1. Acceptance of Terms</h3>
            <p className="text-slate-600 leading-relaxed">By registering for an account, whether as a Customer or a Business Owner, you explicitly agree to these terms.</p>
            
            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">2. Service Description</h3>
            <p className="text-slate-600 leading-relaxed">Looply provides a digital loyalty platform for small businesses. Astrix Technologies PVT LTD reserves the right to modify or discontinue the service at any time.</p>
            
            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">3. User Responsibilities</h3>
            <p className="text-slate-600 leading-relaxed">Users must provide accurate information during registration and maintain the security of their accounts.</p>
            
            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">4. Liability</h3>
            <p className="text-slate-600 leading-relaxed">Astrix Technologies PVT LTD is not liable for any direct, indirect, or consequential damages arising from the use of Looply.</p>
          </div>
          
          <div className="pt-8 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              &copy; {new Date().getFullYear()} Astrix Technologies PVT LTD. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
