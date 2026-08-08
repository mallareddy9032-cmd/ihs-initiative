import type { Config } from "tailwindcss";
import { IHS_DARK_THEME } from "@ihs/types";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ihs: {
          canvas: IHS_DARK_THEME.canvas,
          deep: IHS_DARK_THEME.canvasDeep,
          surface: IHS_DARK_THEME.surface,
          elevated: IHS_DARK_THEME.elevated,
          border: IHS_DARK_THEME.border,
          text: IHS_DARK_THEME.text,
          muted: IHS_DARK_THEME.muted,
          olive: IHS_DARK_THEME.olive,
          mint: IHS_DARK_THEME.mint,
          danger: IHS_DARK_THEME.danger,
          warning: IHS_DARK_THEME.warning,
          info: IHS_DARK_THEME.info,
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Instrument Serif", "Georgia", "serif"],
        sans: ["var(--font-geist)", "var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 24px 60px rgba(0,0,0,0.45)",
        glow: "0 0 28px rgba(61, 220, 151, 0.28)",
        "glow-amber": "0 0 28px rgba(217, 119, 6, 0.35)",
        "glow-red": "0 0 28px rgba(220, 38, 38, 0.35)",
      },
      backgroundImage: {
        "ambient-olive": "radial-gradient(ellipse 50% 40% at 20% 0%, rgba(13,92,77,0.35), transparent 60%)",
        "ambient-blue": "radial-gradient(ellipse 45% 35% at 90% 10%, rgba(37,99,235,0.2), transparent 55%)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
