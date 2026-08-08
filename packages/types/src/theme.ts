/**
 * Granola × Nuraform × IHS Initiative dark editorial tokens.
 * Keep in sync with each app `globals.css` and Tailwind `ihs.*` map.
 */
export const IHS_DARK_THEME = {
  canvas: '#020617',
  canvasDeep: '#030712',
  surface: '#0a0f1c',
  elevated: '#111827',
  border: 'rgba(255, 255, 255, 0.10)',
  borderHover: 'rgba(255, 255, 255, 0.20)',
  text: '#F8FAFC',
  muted: '#94A3B8',
  olive: '#0D5C4D',
  mint: '#3DDC97',
  danger: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  glass: 'rgba(255, 255, 255, 0.02)',
  glassStrong: 'rgba(23, 23, 23, 0.50)',
  fontSerif: "'Playfair Display', 'Instrument Serif', Georgia, serif",
  fontSans: "Geist, Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
} as const;

export type IhsDarkThemeToken = keyof typeof IHS_DARK_THEME;

export const IHS_CSS_VARS = {
  canvas: '--ihs-canvas',
  canvasDeep: '--ihs-canvas-deep',
  surface: '--ihs-surface',
  elevated: '--ihs-elevated',
  border: '--ihs-border',
  borderHover: '--ihs-border-hover',
  text: '--ihs-text',
  muted: '--ihs-muted',
  olive: '--ihs-olive',
  mint: '--ihs-mint',
  danger: '--ihs-red',
  warning: '--ihs-amber',
  info: '--ihs-blue',
  glass: '--ihs-glass',
  glassStrong: '--ihs-glass-strong',
  fontSerif: '--font-serif',
  fontSans: '--font-sans',
} as const;
