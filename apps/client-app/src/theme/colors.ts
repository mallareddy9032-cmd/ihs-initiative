// ============================================================================
// FILE: src/theme/colors.ts
// CONTEXT: Granola × Nuraform editorial design system — Patient Vault
// ============================================================================

export const colors = {
  // Canvas & surfaces
  background: '#FDFBF7',
  canvas: '#FDFBF7',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F5F0',
  glass: 'rgba(253, 251, 247, 0.88)',
  mintMesh: '#E2F1E7',
  blushMesh: '#F7EBE8',

  // Text
  darkSlate: '#1C1C1E',
  textPrimary: '#1C1C1E',
  textSecondary: '#6B6B70',
  textInverse: '#FFFFFF',
  border: 'rgba(28, 28, 30, 0.08)',

  // Granola / Nuraform accents
  primary: '#0D5C4D',
  mint: '#1A7A66',
  accent: '#6B46C1',
  danger: '#C53030',
  warning: '#B7791F',
  success: '#0D5C4D',

  dangerSoft: 'rgba(197, 48, 48, 0.10)',
  primarySoft: 'rgba(13, 92, 77, 0.12)',
  mintSoft: 'rgba(226, 241, 231, 0.9)',
  accentSoft: 'rgba(107, 70, 193, 0.10)',
  warningSoft: 'rgba(183, 121, 31, 0.12)',

  overlay: 'rgba(28, 28, 30, 0.35)',
  shadow: 'rgba(0, 0, 0, 0.04)',

  ledGreen: '#0D5C4D',
  ledAmber: '#B7791F',
  ledRed: '#C53030',
  ledBlue: '#2B6CB0',
} as const;

export type ColorToken = keyof typeof colors;
