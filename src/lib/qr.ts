import QRCode from "qrcode";

/**
 * Returns the permanent public join URL for a business token.
 * Validates environment configuration safely.
 */
export function getBusinessJoinUrl(businessToken: string): string {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"));
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw new Error("NEXT_PUBLIC_APP_URL is missing or invalid in environment configuration.");
  }
  const appUrl = rawUrl.trim().replace(/\/$/, "");
  return `${appUrl}/join/${businessToken}`;
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
