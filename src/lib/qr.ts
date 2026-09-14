import QRCode from "qrcode";
import { headers } from "next/headers";

/**
 * Resolves the app's public base URL. Prefers the incoming request's Host header (so the
 * same deployment auto-adapts across environments — VPS, staging, prod — with no env var
 * needed); falls back to NEXT_PUBLIC_APP_URL / Vercel env vars for contexts without a request
 * (e.g. build-time), and finally to localhost for local dev.
 */
function resolveAppUrl(): string {
  try {
    const headersList = headers();
    const host = headersList.get("x-forwarded-host") || headersList.get("host");
    if (host) {
      const proto = headersList.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() throws outside a request scope (e.g. build-time) — fall through to env vars.
  }

  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"));
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw new Error("NEXT_PUBLIC_APP_URL is missing or invalid in environment configuration.");
  }
  return rawUrl.trim().replace(/\/$/, "");
}

/**
 * Returns the permanent public join URL for a business token.
 */
export function getBusinessJoinUrl(businessToken: string): string {
  return `${resolveAppUrl()}/join/${businessToken}`;
}

/**
 * Returns the public play URL for a campaign token. Separate from the permanent business join
 * URL — campaign QRs are disposable and distributed independently of the standee QR.
 */
export function getCampaignPlayUrl(campaignToken: string): string {
  return `${resolveAppUrl()}/campaign/${campaignToken}`;
}

/**
 * Generates an SVG string for a given text/URL.
 * Native vector format: immune to base64 length limits, crisp at all resolutions.
 */
export async function generateQRCodeSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    width: 240,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0f172a", // Deep slate
      light: "#ffffff", // Pure white
    },
  });
}

/**
 * Generates a PNG data URL for a given text/URL.
 * Used for direct file downloads.
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}
