// ============================================================================
// FILE: src/theme/typography.ts
// CONTEXT: Granola editorial typography — serif display + Inter UI
// ============================================================================

import { Platform, type TextStyle } from 'react-native';

export const fontSerif = Platform.select({
  web: '"Playfair Display", Georgia, "Times New Roman", serif',
  default: 'Georgia',
}) as string;

export const fontSans = Platform.select({
  web: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  default: 'System',
}) as string;

export const typography = {
  brand: {
    fontFamily: fontSerif,
    fontSize: 28,
    fontWeight: '400' as const,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: fontSerif,
    fontSize: 24,
    fontWeight: '400' as const,
  },
  subtitle: {
    fontFamily: fontSans,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: fontSans,
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  micro: {
    fontFamily: fontSans,
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
  },
};

export const serifTitle = (size = 24): TextStyle => ({
  fontFamily: fontSerif,
  fontSize: size,
  fontWeight: '400',
  letterSpacing: -0.4,
  color: '#1C1C1E',
});
