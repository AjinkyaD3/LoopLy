import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Deepened, slightly more jewel-toned indigo/violet — same family as before,
        // tuned for a richer default (600/700 are the workhorse shades).
        primary: {
          50: "#eef1ff",
          100: "#e1e3fe",
          200: "#c8cbfd",
          300: "#a4a2fa",
          400: "#8676f4",
          500: "#6c50e8",
          600: "#5a35d6",
          700: "#4b28b3",
          800: "#3d2291",
          900: "#2f1c73",
        },
        // Warm accent reserved for reward/celebration moments only (scratch-card reveal,
        // "reward ready" highlights) — never a second primary, never used for chrome/UI.
        accent: {
          400: "#dfa93f",
          500: "#c78f2a",
          600: "#a5711f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      boxShadow: {
        // Soft, layered shadows replacing Tailwind's flatter defaults — applied
        // automatically wherever the app already uses shadow-sm/md/xl.
        sm: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)",
        DEFAULT: "0 2px 6px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.04)",
        md: "0 6px 16px rgba(15, 23, 42, 0.07), 0 2px 6px rgba(15, 23, 42, 0.05)",
        xl: "0 20px 40px rgba(15, 23, 42, 0.12), 0 8px 16px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
