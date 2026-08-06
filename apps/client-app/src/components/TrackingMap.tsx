// ============================================================================
// FILE: src/components/TrackingMap.tsx
// CONTEXT: Native fallback map (no Leaflet) — animated dual-pin board
// ============================================================================

import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme/colors';

export interface TrackingMapProps {
  patientLat: number;
  patientLng: number;
  vehicleLat: number;
  vehicleLng: number;
  height?: number;
}

export const TrackingMap: React.FC<TrackingMapProps> = ({
  patientLat,
  patientLng,
  vehicleLat,
  vehicleLng,
  height = 280,
}) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const positions = useMemo(() => {
    const minLat = Math.min(patientLat, vehicleLat) - 0.001;
    const maxLat = Math.max(patientLat, vehicleLat) + 0.001;
    const minLng = Math.min(patientLng, vehicleLng) - 0.001;
    const maxLng = Math.max(patientLng, vehicleLng) + 0.001;
    const latSpan = Math.max(maxLat - minLat, 0.002);
    const lngSpan = Math.max(maxLng - minLng, 0.002);

    const toXY = (lat: number, lng: number): { top: `${number}%`; left: `${number}%` } => ({
      top: `${(1 - (lat - minLat) / latSpan) * 78 + 8}%` as `${number}%`,
      left: `${((lng - minLng) / lngSpan) * 78 + 8}%` as `${number}%`,
    });

    return {
      patient: toXY(patientLat, patientLng),
      vehicle: toXY(vehicleLat, vehicleLng),
    };
  }, [patientLat, patientLng, vehicleLat, vehicleLng]);

  return (
    <View style={[styles.board, { height }]}>
      <Text style={styles.badge}>LIVE TRACKING</Text>
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={`h-${i}`} style={[styles.hLine, { top: `${20 + i * 20}%` }]} />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <View key={`v-${i}`} style={[styles.vLine, { left: `${20 + i * 20}%` }]} />
        ))}
      </View>

      <View style={[styles.pinWrap, positions.patient]}>
        <View style={[styles.pin, styles.patientPin]} />
        <Text style={styles.pinLabel}>You</Text>
      </View>

      <Animated.View
        style={[styles.pinWrap, positions.vehicle, { transform: [{ scale: pulse }] }]}
      >
        <View style={[styles.pin, styles.vehiclePin]} />
        <Text style={styles.pinLabel}>Ambulance</Text>
      </Animated.View>

      <Text style={styles.coords}>
        You {patientLat.toFixed(4)}, {patientLng.toFixed(4)} · Amb {vehicleLat.toFixed(4)},{' '}
        {vehicleLng.toFixed(4)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.darkSlate,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 5,
    color: colors.accent,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 1,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    marginLeft: -10,
    marginTop: -10,
  },
  pin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  patientPin: {
    backgroundColor: '#3B82F6',
  },
  vehiclePin: {
    backgroundColor: '#EF4444',
  },
  pinLabel: {
    marginTop: 4,
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  coords: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    color: 'rgba(226,232,240,0.7)',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
