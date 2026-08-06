// ============================================================================
// FILE: src/screens/AmbulanceTrackingScreen.tsx
// CONTEXT: Post-SOS live ambulance tracking — driver, map, ETA countdown
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StackScreenProps } from '@react-navigation/stack';
import { TrackingMap } from '../components/TrackingMap';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props =
  | NativeStackScreenProps<RootStackParamList, 'AmbulanceTracking'>
  | StackScreenProps<RootStackParamList, 'AmbulanceTracking'>;

const DRIVER = {
  name: 'Ravi Kumar',
  role: 'ALS Paramedic / Driver',
  fleetId: 'AMB-VSKP-07',
  vehicle: 'Toyota HiAce · Advanced Life Support',
  phone: '+919876501122',
  phoneLabel: '+91 98765 01122',
  rating: '4.9 · 1,240 emergency runs',
};

const INITIAL_ETA_SEC = 8 * 60; // 8 minutes

function formatEta(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const AmbulanceTrackingScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { ihsUid, patientLat, patientLng, dispatchStatus } = route.params;

  const startVehicle = useMemo(
    () => ({
      lat: patientLat + 0.018,
      lng: patientLng - 0.014,
    }),
    [patientLat, patientLng],
  );

  const [etaSec, setEtaSec] = useState(INITIAL_ETA_SEC);
  const [progress, setProgress] = useState(0);
  const [arrived, setArrived] = useState(false);

  const vehicleLat = lerp(startVehicle.lat, patientLat, progress);
  const vehicleLng = lerp(startVehicle.lng, patientLng, progress);

  // ETA countdown
  useEffect(() => {
    if (arrived) return;
    const id = setInterval(() => {
      setEtaSec((prev) => {
        if (prev <= 1) {
          setArrived(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [arrived]);

  // Simulate ambulance approaching patient (~progress 0→0.92 over ETA window)
  useEffect(() => {
    if (arrived) {
      setProgress(1);
      return;
    }
    const id = setInterval(() => {
      setProgress((p) => Math.min(0.92, p + 0.92 / INITIAL_ETA_SEC));
    }, 1000);
    return () => clearInterval(id);
  }, [arrived]);

  const callDriver = () => {
    void Linking.openURL(`tel:${DRIVER.phone}`);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>EMERGENCY RESPONSE</Text>
          <Text style={styles.title}>Live Ambulance Tracking</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.etaCard, arrived && styles.etaArrived]}>
          <Text style={styles.etaLabel}>{arrived ? 'STATUS' : 'ETA'}</Text>
          <Text style={styles.etaValue}>{arrived ? 'ARRIVED' : formatEta(etaSec)}</Text>
          <Text style={styles.etaMeta}>
            {arrived
              ? 'Paramedic team is at your location'
              : `Fleet ${DRIVER.fleetId} en route · ${dispatchStatus}`}
          </Text>
        </View>

        <TrackingMap
          patientLat={patientLat}
          patientLng={patientLng}
          vehicleLat={vehicleLat}
          vehicleLng={vehicleLng}
          height={Platform.OS === 'web' ? 320 : 280}
        />

        <Text style={styles.section}>Assigned responder</Text>
        <View style={styles.driverCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>RK</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.driverName}>{DRIVER.name}</Text>
            <Text style={styles.driverRole}>{DRIVER.role}</Text>
            <Text style={styles.driverMeta}>{DRIVER.vehicle}</Text>
            <Text style={styles.driverMeta}>
              {DRIVER.fleetId} · {DRIVER.rating}
            </Text>
          </View>
        </View>

        <View style={styles.rowActions}>
          <Pressable style={styles.callBtn} onPress={callDriver}>
            <Text style={styles.callBtnText}>Call driver · {DRIVER.phoneLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Patient beacon</Text>
          <Text style={styles.infoLine}>IHS UID · {ihsUid}</Text>
          <Text style={styles.infoLine}>
            Live GPS · {patientLat.toFixed(5)}, {patientLng.toFixed(5)}
          </Text>
          <Text style={styles.infoLine}>
            Ambulance · {vehicleLat.toFixed(5)}, {vehicleLng.toFixed(5)}
          </Text>
          <Text style={styles.infoHint}>
            Keep this screen open. Command Center is tracking your dual-pin location.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 8,
  },
  backText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 16,
  },
  eyebrow: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.darkSlate,
    fontSize: 22,
    fontWeight: '800',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  etaCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  etaArrived: {
    backgroundColor: colors.success,
  },
  etaLabel: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  etaValue: {
    color: colors.textPrimary,
    fontSize: 48,
    fontWeight: '900',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  etaMeta: {
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 13,
  },
  section: {
    marginTop: 16,
    marginBottom: 8,
    color: colors.textSecondary,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  driverCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '900',
  },
  driverName: {
    color: colors.darkSlate,
    fontWeight: '800',
    fontSize: 16,
  },
  driverRole: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2,
  },
  driverMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  rowActions: {
    marginTop: 12,
  },
  callBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  callBtnText: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  infoCard: {
    marginTop: 14,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    color: colors.darkSlate,
    fontWeight: '800',
    marginBottom: 6,
  },
  infoLine: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  infoHint: {
    marginTop: 8,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});
