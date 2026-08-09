/**
 * Clinical Bio-Tech Design System (ihs-initiative.vercel.app).
 * Keep in sync with each app `globals.css` and Tailwind `ihs.*` map.
 */
export const IHS_BIOTECH_THEME = {
  green: {
    primary: '#143525',
    hover: '#1C4B35',
    deep: '#0D281E',
  },
  lime: {
    accent: '#22C55E',
    soft: '#E8F5E9',
  },
  text: {
    primary: '#0F172A',
    muted: '#4B5563',
  },
  border: '#E2E8F0',
  bg: {
    from: '#F4F7F4',
    via: '#FAFCFA',
    to: '#FFFFFF',
  },
  danger: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  fontSerif: "'Playfair Display', Newsreader, Georgia, serif",
  fontSans: "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
} as const;

/** Flat aliases used by Tailwind `ihs.*` and existing UI classNames. */
export const IHS_DARK_THEME = {
  canvas: IHS_BIOTECH_THEME.bg.from,
  canvasDeep: IHS_BIOTECH_THEME.bg.to,
  surface: '#FFFFFF',
  elevated: IHS_BIOTECH_THEME.bg.via,
  border: IHS_BIOTECH_THEME.border,
  borderHover: '#CBD5E1',
  text: IHS_BIOTECH_THEME.text.primary,
  muted: IHS_BIOTECH_THEME.text.muted,
  olive: IHS_BIOTECH_THEME.green.primary,
  mint: IHS_BIOTECH_THEME.lime.accent,
  danger: IHS_BIOTECH_THEME.danger,
  warning: IHS_BIOTECH_THEME.warning,
  info: IHS_BIOTECH_THEME.info,
  greenPrimary: IHS_BIOTECH_THEME.green.primary,
  greenHover: IHS_BIOTECH_THEME.green.hover,
  greenDeep: IHS_BIOTECH_THEME.green.deep,
  limeAccent: IHS_BIOTECH_THEME.lime.accent,
  limeSoft: IHS_BIOTECH_THEME.lime.soft,
  glass: 'rgba(255, 255, 255, 0.80)',
  glassStrong: 'rgba(255, 255, 255, 0.95)',
  fontSerif: IHS_BIOTECH_THEME.fontSerif,
  fontSans: IHS_BIOTECH_THEME.fontSans,
} as const;

export type IhsDarkThemeToken = keyof typeof IHS_DARK_THEME;

export const IHS_CSS_VARS = {
  canvas: '--ihs-canvas',
  canvasDeep: '--ihs-canvas-deep',
  surface: '--ihs-surface',
  elevated: '--ihs-elevated',
  border: '--ihs-border',
  text: '--ihs-text',
  muted: '--ihs-muted',
  olive: '--ihs-olive',
  mint: '--ihs-mint',
  greenPrimary: '--ihs-green-primary',
  greenHover: '--ihs-green-hover',
  greenDeep: '--ihs-green-deep',
  limeAccent: '--ihs-lime-accent',
  limeSoft: '--ihs-lime-soft',
  danger: '--ihs-red',
  warning: '--ihs-amber',
  info: '--ihs-blue',
  fontSerif: '--font-serif',
  fontSans: '--font-sans',
} as const;
