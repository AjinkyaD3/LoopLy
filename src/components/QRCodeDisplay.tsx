"use client";

import { useState } from "react";
import { Check, Copy, Download, QrCode, ShieldCheck } from "lucide-react";
import Button from "@/components/ui/Button";

interface QRCodeDisplayProps {
  businessName: string;
  joinUrl: string;
  qrSvg: string;
  qrDataUrl: string;
}

export default function QRCodeDisplay({
  businessName,
  joinUrl,
  qrSvg,
  qrDataUrl,
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-permanent-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-4">
      {/* Printable Counter Stand Card */}
      <div className="p-6 bg-white rounded-2xl border-2 border-slate-900 shadow-sm flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-bold uppercase tracking-wider mb-3">
          <QrCode className="w-3.5 h-3.5 text-primary-600" />
          Permanent Counter QR
        </div>
        <h3 className="text-xl font-bold text-slate-900">{businessName}</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-2">
          Scan with your phone camera to join our loyalty club
        </p>

        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-medium mb-4">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
          This QR is permanent. Keep using the same QR at your business.
        </div>

        {/* High-visibility QR Code Container (Native SVG + Image fallback) */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-inner flex items-center justify-center">
          {qrSvg ? (
            <div
              className="w-56 h-56 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
              style={{ width: 224, height: 224, maxWidth: "100%" }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              aria-label={`${businessName} Permanent QR Code`}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={`${businessName} Permanent QR Code`}
              width={224}
              height={224}
              style={{ width: 224, height: 224 }}
              className="w-56 h-56 object-contain block"
            />
          )}
        </div>

        <p className="text-[11px] font-mono text-slate-500 mt-3 break-all px-2 select-all">
          {joinUrl}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              Copy Link
            </>
          )}
        </Button>

        <Button type="button" onClick={handleDownload}>
          <Download className="w-3.5 h-3.5" />
          Download QR
        </Button>
      </div>
    </div>
  );
}
