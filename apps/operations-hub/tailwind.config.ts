import type { Config } from "tailwindcss";

/**
 * Inline Clinical Bio-Tech tokens — do not import @ihs/types here.
 * Tailwind/jiti often fails to resolve workspace TS packages, which crashes
 * CSS with: Cannot read properties of undefined (reading 'border').
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ihs: {
          canvas: "#F4F7F4",
          deep: "#FFFFFF",
          surface: "#FFFFFF",
          elevated: "#FAFCFA",
          border: "#E2E8F0",
          text: "#0F172A",
          muted: "#4B5563",
          olive: "#143525",
          mint: "#22C55E",
          danger: "#DC2626",
          warning: "#D97706",
          info: "#2563EB",
          green: {
            primary: "#143525",
            hover: "#1C4B35",
            deep: "#0D281E",
          },
          lime: {
            accent: "#22C55E",
            soft: "#E8F5E9",
          },
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Newsreader", "Georgia", "serif"],
        sans: ["var(--font-jakarta)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px rgba(2, 44, 34, 0.05)",
        "card-hover": "0 20px 40px rgba(2, 44, 34, 0.10)",
        deep: "0 16px 40px rgba(13, 40, 30, 0.35)",
      },
      backgroundImage: {
        "ihs-gradient": "linear-gradient(to bottom, #F4F7F4, #FAFCFA, #FFFFFF)",
        "ihs-soft": "linear-gradient(to bottom, #F4F7F4, #FFFFFF)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
