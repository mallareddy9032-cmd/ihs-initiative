/**
 * Granola × Nuraform dark theme tokens — Phase 2 contract.
 * Keep in sync with root `.cursorrules` and each app `globals.css`.
 */
export const IHS_DARK_THEME = {
  canvas: '#020617',
  surface: '#0F172A',
  elevated: '#111827',
  border: 'rgba(148, 163, 184, 0.16)',
  text: '#F8FAFC',
  muted: '#94A3B8',
  olive: '#0D5C4D',
  mint: '#3DDC97',
  danger: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  glass: 'rgba(15, 23, 42, 0.72)',
  fontSerif: "'Playfair Display', Georgia, 'Times New Roman', serif",
  fontSans: "Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
} as const;

export type IhsDarkThemeToken = keyof typeof IHS_DARK_THEME;

/** CSS custom-property names mirrored in Phase 2 `globals.css`. */
export const IHS_CSS_VARS = {
  canvas: '--ihs-canvas',
  surface: '--ihs-surface',
  elevated: '--ihs-elevated',
  border: '--ihs-border',
  text: '--ihs-text',
  muted: '--ihs-muted',
  olive: '--ihs-olive',
  mint: '--ihs-mint',
  danger: '--ihs-red',
  warning: '--ihs-amber',
  info: '--ihs-blue',
  glass: '--ihs-glass',
  fontSerif: '--font-serif',
  fontSans: '--font-sans',
} as const;
