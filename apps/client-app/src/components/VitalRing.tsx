// ============================================================================
// FILE: src/components/VitalRing.tsx
// CONTEXT: Apple Watch–style radial vital meter (SVG)
// ============================================================================

import React, { useEffect, useId, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type RingTone = 'pink' | 'mint';

interface VitalRingProps {
  label: string;
  value: string | number;
  unit: string;
  meta?: string;
  /** 0–100 progress around the ring */
  progress: number;
  tone: RingTone;
  size?: number;
}

const TONE = {
  pink: { stroke: '#FF2D55', soft: 'rgba(255,45,85,0.12)', a: '#FF2D55', b: '#FF6482' },
  mint: { stroke: '#34C759', soft: 'rgba(52,199,89,0.12)', a: '#34C759', b: '#30D158' },
} as const;

export const VitalRing: React.FC<VitalRingProps> = ({
  label,
  value,
  unit,
  meta,
  progress,
  tone,
  size = 112,
}) => {
  const palette = TONE[tone];
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, progress));
  const [drawn, setDrawn] = useState(0);
  const gradId = useId().replace(/:/g, '');

  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const offset = c * (1 - drawn / 100);

  const ringSvg =
    Platform.OS === 'web' ? (
      React.createElement(
        'svg',
        {
          width: size,
          height: size,
          viewBox: `0 0 ${size} ${size}`,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
          },
        },
        React.createElement(
          'defs',
          null,
          React.createElement(
            'linearGradient',
            { id: gradId, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
            React.createElement('stop', { offset: '0%', stopColor: palette.a }),
            React.createElement('stop', { offset: '100%', stopColor: palette.b }),
          ),
        ),
        React.createElement('circle', {
          cx: size / 2,
          cy: size / 2,
          r,
          fill: 'none',
          stroke: palette.soft,
          strokeWidth: stroke,
        }),
        React.createElement('circle', {
          cx: size / 2,
          cy: size / 2,
          r,
          fill: 'none',
          stroke: `url(#${gradId})`,
          strokeWidth: stroke,
          strokeLinecap: 'round',
          strokeDasharray: `${c} ${c}`,
          strokeDashoffset: offset,
          transform: `rotate(-90 ${size / 2} ${size / 2})`,
          style: {
            transition: 'stroke-dashoffset 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          },
        }),
      )
    ) : (
      <View
        style={[
          styles.nativeRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: palette.soft,
          },
        ]}
      />
    );

  return (
    <View style={styles.card}>
      <View style={[styles.ringWrap, { width: size, height: size }]}>
        {ringSvg}
        <View style={styles.center}>
          <Text style={styles.value}>{value}</Text>
          <Text style={[styles.unit, { color: palette.stroke }]}>{unit}</Text>
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  nativeRing: {
    position: 'absolute',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: -2,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
});
