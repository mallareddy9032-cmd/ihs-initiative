// ============================================================================
// FILE: src/theme/colors.ts
// CONTEXT: Apple iOS / macOS HIG Light Design System — Patient Concierge
// ============================================================================

export const colors = {
  // Canvas & surfaces
  background: '#F2F2F7',
  canvas: '#F9F9FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F2F7',
  glass: 'rgba(255, 255, 255, 0.82)',

  // Text
  darkSlate: '#1C1C1E',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  textInverse: '#FFFFFF',
  border: 'rgba(0, 0, 0, 0.05)',

  // Apple HIG accents
  primary: '#007AFF',
  mint: '#34C759',
  accent: '#5856D6',
  danger: '#FF2D55',
  warning: '#FF9500',
  success: '#34C759',

  dangerSoft: 'rgba(255, 45, 85, 0.10)',
  primarySoft: 'rgba(0, 122, 255, 0.08)',
  mintSoft: 'rgba(52, 199, 89, 0.08)',
  accentSoft: 'rgba(88, 86, 214, 0.08)',
  warningSoft: 'rgba(255, 149, 0, 0.10)',

  overlay: 'rgba(28, 28, 30, 0.35)',
  shadow: 'rgba(0, 0, 0, 0.03)',

  ledGreen: '#34C759',
  ledAmber: '#FF9500',
  ledRed: '#FF2D55',
  ledBlue: '#007AFF',
} as const;

export type ColorToken = keyof typeof colors;
