import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Privacy Policy</h1>
            <p className="mt-2 text-sm text-slate-500">Last Updated: September 2026</p>
          </div>
          
          <div className="prose prose-slate prose-sm sm:prose-base">
            <p><strong>Looply — a product of Astrix Technologies PVT LTD</strong></p>
            <p>Your privacy is critically important to us. This policy explains how we collect, use, and protect your personal information.</p>
            
            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">1. Information We Collect</h3>
            <p className="text-slate-600 leading-relaxed">We collect information you provide directly to us, such as your name, email address, and business details upon registration.</p>
            
            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">2. How We Use Information</h3>
            <p className="text-slate-600 leading-relaxed">We use the information we collect to operate, maintain, and improve Looply, as well as to communicate with you.</p>
            
            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">3. Information Sharing</h3>
            <p className="text-slate-600 leading-relaxed">Astrix Technologies PVT LTD does not sell your personal information. We only share information with third parties when necessary to provide our services or comply with the law.</p>
            
            <h3 className="text-lg font-bold text-slate-800 mt-6 mb-2">4. Data Security</h3>
            <p className="text-slate-600 leading-relaxed">We implement reasonable security measures to protect your personal information from unauthorized access.</p>
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
