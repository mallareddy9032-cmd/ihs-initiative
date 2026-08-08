import type { Config } from 'tailwindcss';
import { IHS_DARK_THEME } from '@ihs/types';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ihs: {
          canvas: IHS_DARK_THEME.canvas,
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
        serif: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 16px 40px rgba(0, 0, 0, 0.35)',
        glow: '0 0 24px rgba(13, 92, 77, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
