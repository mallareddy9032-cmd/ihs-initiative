// ============================================================================
// FILE: src/screens/HomeScreen.tsx
// CONTEXT: IHS Patient Vault — Granola × Nuraform editorial hub (port 3000)
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  StatusBar,
  Animated,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigationProp } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { fontSans, fontSerif } from '../theme/typography';
import { useCare } from '../context/CareContext';
import { VitalRing } from '../components/VitalRing';
import type { MainTabParamList } from '../navigation/BottomTabs';
import type { RootStackParamList } from '../types/navigation';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const PHONE_DISPLAY = '+91 9032600410';
const PHONE_TEL = 'tel:+919032600410';
const WHATSAPP =
  'https://wa.me/919032600410?text=Hello%20IHS%20Initiative,%20I%20need%20care%20in%20the%20Ananthapuramu%20pilot%20zone.';

const SERVICES = [
  {
    id: 'home',
    title: 'Doorstep GP Visit',
    body: 'Schedule a qualified MBBS doctor home visit in Ananthapur.',
    badge: '🛡️ MBBS Verified',
    glyph: '⌂',
    target: 'home' as const,
  },
  {
    id: 'tele',
    title: 'Specialist Teleconsult',
    body: 'Instant video queue with vault-linked doctors.',
    badge: '⚡ Live Queue',
    glyph: '✚',
    target: 'tele' as const,
  },
  {
    id: 'labs',
    title: 'Home Diagnostics',
    body: 'Sample collection for blood & chronic health markers.',
    badge: '◎ At Home',
    glyph: '◎',
    target: 'labs' as const,
  },
] as const;

const AI_CHIPS = [
  {
    q: 'How do I request a doctor visit in Dharmavaram?',
    a: 'Open Doorstep GP Visit, set location to Dharmavaram (within the Ananthapur 50km pilot), confirm a time slot, and a verified MBBS clinician will arrive with e-prescription sync to your vault.',
  },
  {
    q: 'View my latest e-Prescription',
    a: 'Your latest e-prescription is in the Family Health Vault under Prescriptions. Open Health Vault → Prescriptions to view doses, duration, and order medicines for delivery.',
  },
  {
    q: 'How does the emergency SOS dispatch work?',
    a: 'Hold the SOS control for 1.5 seconds. IHS captures live GPS, opens a dispatch case, routes the nearest ALS ambulance, and notifies the ER trauma bay while you track ETA in real time.',
  },
] as const;

const VAULT_TABS = [
  { id: 'rx', label: 'Prescriptions' },
  { id: 'labs', label: 'Lab Reports' },
  { id: 'er', label: 'Emergency Logs' },
] as const;

const ANANTHAPUR = { lat: 14.6819, lng: 77.6006 };

export const HomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { appointments, vitals, vaultRecords } = useCare();
  const ihsUid = route.params?.ihsUid ?? 'IHS-MEMBER';

  const [holding, setHolding] = useState(false);
  const [dispatchActive, setDispatchActive] = useState(false);
  const [etaSeconds, setEtaSeconds] = useState(4 * 60 + 18);
  const [vaultTab, setVaultTab] = useState<(typeof VAULT_TABS)[number]['id']>('rx');
  const [chipOpen, setChipOpen] = useState<number | null>(null);

  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const sosLock = useRef(false);

  const hr = vitals.find((v) => v.metric === 'hr');
  const spo2 = vitals.find((v) => v.metric === 'spo2');
  const bp = vitals.find((v) => v.metric === 'bp');
  const upcomingCount = appointments.filter((a) => a.status === 'upcoming').length;

  const filteredVault = useMemo(() => {
    if (vaultTab === 'rx') {
      return vaultRecords.filter(
        (r) => !!r.medicines?.length || r.category.toLowerCase().includes('pharm'),
      );
    }
    if (vaultTab === 'labs') {
      return vaultRecords.filter((r) =>
        /lab|diagnostic|blood/i.test(`${r.category} ${r.title}`),
      );
    }
    return vaultRecords.filter((r) =>
      /emerg|sos|dispatch|trauma/i.test(`${r.category} ${r.title} ${r.summary}`),
    );
  }, [vaultRecords, vaultTab]);

  useEffect(() => {
    if (!dispatchActive) return;
    const t = setInterval(() => {
      setEtaSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [dispatchActive]);

  const etaLabel = useMemo(() => {
    const m = Math.floor(etaSeconds / 60);
    const s = etaSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [etaSeconds]);

  const openTracking = useCallback(() => {
    const params = {
      ihsUid,
      patientLat: ANANTHAPUR.lat,
      patientLng: ANANTHAPUR.lng,
      dispatchStatus: 'PILOT_GRID_ACTIVE',
    };
    const rootNav = navigation.getParent() as NavigationProp<RootStackParamList> | undefined;
    rootNav?.navigate('AmbulanceTracking', params);
  }, [ihsUid, navigation]);

  const fireSos = useCallback(() => {
    if (sosLock.current) return;
    sosLock.current = true;
    setHolding(false);
    holdAnim.current?.stop();
    holdProgress.setValue(0);
    setDispatchActive(true);
    setEtaSeconds(4 * 60 + 18);
    Alert.alert(
      'Emergency Signal Sent',
      'Nearest ALS ambulance dispatched. ER trauma bay notified. Tracking is live.',
      [
        { text: 'Open Live Tracker', onPress: openTracking },
        { text: 'Stay on Vault', style: 'cancel' },
      ],
    );
    setTimeout(() => {
      sosLock.current = false;
    }, 2000);
  }, [holdProgress, openTracking]);

  const startHold = () => {
    setHolding(true);
    holdProgress.setValue(0);
    holdAnim.current = Animated.timing(holdProgress, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: false,
    });
    holdAnim.current.start(({ finished }) => {
      if (finished) fireSos();
    });
  };

  const cancelHold = () => {
    if (dispatchActive) return;
    setHolding(false);
    holdAnim.current?.stop();
    holdProgress.setValue(0);
  };

  const openService = (target: (typeof SERVICES)[number]['target']) => {
    if (target === 'home') {
      navigation.navigate('DoctorVisit', { mode: 'home' });
      return;
    }
    if (target === 'tele') {
      navigation.navigate('DoctorVisit', { mode: 'tele' });
      return;
    }
    navigation.navigate('DoctorVisit', { service: 'labs' });
  };

  const progressWidth = holdProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* A. Frosted Header */}
      <View style={styles.header}>
        <View style={styles.brandBlock}>
          <Text style={styles.brandTitle}>IHS Initiative</Text>
          <Text style={styles.brandSub}>Patient Vault</Text>
          <View style={styles.pulseRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.pulseText}>PILOT GRID ACTIVE · ANANTHAPUR 50KM</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.headerChip, pressed && styles.pressed]}
            onPress={() => Linking.openURL(PHONE_TEL)}
          >
            <Text style={styles.headerChipText}>📞 24/7</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.headerChip, pressed && styles.pressed]}
            onPress={() => Linking.openURL(WHATSAPP)}
          >
            <Text style={styles.headerChipText}>💬</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
            onPress={() => navigation.getParent()?.navigate('Settings')}
          >
            <Text style={styles.avatarText}>RM</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.profileName}>Ramu M. · {ihsUid}</Text>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 130 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* B. SOS Hero */}
        <View style={styles.sosCard}>
          <Text style={styles.serifH}>1-Tap Emergency SOS</Text>
          <Text style={styles.sosSub}>
            Hold for 1.5s to dispatch nearest ALS ambulance &amp; notify ER trauma bay.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency SOS. Hold for one and a half seconds."
            onPressIn={startHold}
            onPressOut={cancelHold}
            onLongPress={fireSos}
            delayLongPress={1500}
            style={({ pressed }) => [
              styles.sosButton,
              holding && styles.sosHolding,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.sosButtonLabel}>{holding ? 'HOLD…' : 'SOS'}</Text>
            <View style={styles.holdTrack}>
              <Animated.View style={[styles.holdFill, { width: progressWidth }]} />
            </View>
          </Pressable>

          <View style={styles.gpsCard}>
            <Text style={styles.gpsKicker}>LIVE GPS TELEMETRY</Text>
            <Text style={styles.gpsTitle}>Ananthapur Urban · Grid Node 01</Text>
            <Text style={styles.gpsMeta}>
              {ANANTHAPUR.lat.toFixed(4)}° N · {ANANTHAPUR.lng.toFixed(4)}° E · Pilot radius active
            </Text>
          </View>
        </View>

        {/* C. Live Dispatch */}
        {dispatchActive ? (
          <View style={styles.dispatchCard}>
            <View style={styles.dispatchHead}>
              <Text style={styles.dispatchLive}>● LIVE DISPATCH</Text>
              <Pressable onPress={openTracking}>
                <Text style={styles.dispatchLink}>Open map →</Text>
              </Pressable>
            </View>
            <Text style={styles.etaValue}>{etaLabel}</Text>
            <Text style={styles.etaUnit}>Mins to on-scene</Text>
            <View style={styles.dispatchMeta}>
              <View style={styles.dispatchMetaItem}>
                <Text style={styles.metaLabel}>Paramedic</Text>
                <Text style={styles.metaValue}>Arjun Rao</Text>
              </View>
              <View style={styles.dispatchMetaItem}>
                <Text style={styles.metaLabel}>Vehicle</Text>
                <Text style={styles.metaValue}>AP39 EM 2041</Text>
              </View>
              <Pressable
                style={styles.dispatchMetaItem}
                onPress={() => Linking.openURL(PHONE_TEL)}
              >
                <Text style={styles.metaLabel}>Driver</Text>
                <Text style={[styles.metaValue, { color: colors.primary }]}>📞 Call live</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* D. Care Services */}
        <Text style={styles.serifSection}>Care Services</Text>
        <View style={styles.serviceGrid}>
          {SERVICES.map((s) => (
            <Pressable
              key={s.id}
              style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}
              onPress={() => openService(s.target)}
            >
              <View style={styles.glassBadge}>
                <Text style={styles.glassBadgeText}>{s.badge}</Text>
              </View>
              <Text style={styles.serviceGlyph}>{s.glyph}</Text>
              <Text style={styles.serviceTitle}>{s.title}</Text>
              <Text style={styles.serviceBody}>{s.body}</Text>
            </Pressable>
          ))}
        </View>

        {/* E. Vitals + Vault */}
        <Text style={styles.serifSection}>Family Health Vault</Text>
        <Pressable
          onPress={() => navigation.navigate('HealthVault', { focus: 'vitals' })}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <View style={styles.vitalsRow}>
            <VitalRing
              label="Heart Rate"
              value={hr?.value ?? 72}
              unit="bpm"
              meta={hr?.recordedAt ?? 'Live ring'}
              progress={Math.min(100, (Number(hr?.value ?? 72) / 120) * 100)}
              tone="pink"
            />
            <VitalRing
              label="SpO₂"
              value={spo2?.value ?? 98}
              unit="%"
              meta={spo2?.recordedAt ?? 'Healthy'}
              progress={Number(spo2?.value ?? 98)}
              tone="mint"
            />
            <VitalRing
              label="Blood Pressure"
              value={bp?.value ?? '120/80'}
              unit="mmHg"
              meta={bp?.recordedAt ?? 'Resting'}
              progress={78}
              tone="olive"
              size={100}
            />
          </View>
        </Pressable>

        <View style={styles.vaultCard}>
          <View style={styles.vaultTabs}>
            {VAULT_TABS.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setVaultTab(t.id)}
                style={[styles.vaultTab, vaultTab === t.id && styles.vaultTabActive]}
              >
                <Text style={[styles.vaultTabText, vaultTab === t.id && styles.vaultTabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {(filteredVault.length ? filteredVault : vaultRecords).slice(0, 3).map((r) => (
            <Pressable
              key={r.id}
              style={styles.vaultRow}
              onPress={() => navigation.navigate('HealthVault', { focus: 'records' })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.vaultRowTitle}>{r.title}</Text>
                <Text style={styles.vaultRowMeta}>
                  {r.category} · {r.dateLabel}
                  {r.wormLocked ? ' · 🔒 Encrypted' : ''}
                </Text>
              </View>
              <Text style={styles.vaultChevron}>›</Text>
            </Pressable>
          ))}
          {upcomingCount > 0 ? (
            <Text style={styles.vaultHint}>{upcomingCount} upcoming visits · open Visits tab</Text>
          ) : null}
        </View>

        {/* F. AI Concierge */}
        <Text style={styles.serifSection}>AI Health Concierge</Text>
        <Text style={styles.lede}>Tap a thought chip for instant help.</Text>
        <View style={styles.chipCloud}>
          {AI_CHIPS.map((chip, idx) => (
            <Pressable
              key={chip.q}
              style={({ pressed }) => [styles.thoughtChip, pressed && styles.pressed]}
              onPress={() => setChipOpen(idx)}
            >
              <Text style={styles.thoughtText}>💬 {chip.q}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {chipOpen !== null ? (
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setChipOpen(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{AI_CHIPS[chipOpen]!.q}</Text>
            <Text style={styles.modalBody}>{AI_CHIPS[chipOpen]!.a}</Text>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => {
                if (chipOpen === 1) navigation.navigate('HealthVault', { focus: 'records' });
                setChipOpen(null);
              }}
            >
              <Text style={styles.primaryBtnText}>
                {chipOpen === 1 ? 'Open Prescriptions' : 'Got it'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: Platform.OS === 'web' ? 'rgba(253,251,247,0.88)' : colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  brandBlock: {
    flex: 1,
    minWidth: 0,
  },
  brandTitle: {
    fontFamily: fontSerif,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 1,
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pulseText: {
    fontFamily: fontSans,
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12,
  },
  profileName: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    fontFamily: fontSans,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sosCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
  },
  serifH: {
    fontFamily: fontSerif,
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  sosSub: {
    fontFamily: fontSans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  sosButton: {
    backgroundColor: colors.danger,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: colors.danger,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  sosHolding: {
    backgroundColor: '#9B2C2C',
  },
  sosButtonLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 2,
  },
  holdTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  holdFill: {
    height: 4,
    backgroundColor: '#fff',
  },
  gpsCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.mintSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gpsKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primary,
    marginBottom: 4,
  },
  gpsTitle: {
    fontFamily: fontSans,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  gpsMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  dispatchCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(13,92,77,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
  },
  dispatchHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dispatchLive: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  dispatchLink: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  etaValue: {
    fontFamily: fontSans,
    fontSize: 44,
    fontWeight: '800',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  etaUnit: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
  },
  dispatchMeta: {
    flexDirection: 'row',
    gap: 10,
  },
  dispatchMetaItem: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 10,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  serifSection: {
    fontFamily: fontSerif,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 8,
    marginBottom: 12,
  },
  lede: {
    marginTop: -6,
    marginBottom: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  serviceGrid: {
    gap: 12,
    marginBottom: 8,
  },
  serviceCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    position: 'relative',
    overflow: 'hidden',
  },
  glassBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  glassBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  serviceGlyph: {
    fontSize: 22,
    color: colors.primary,
    marginBottom: 8,
  },
  serviceTitle: {
    fontFamily: fontSerif,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: 6,
    paddingRight: 100,
  },
  serviceBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    maxWidth: '92%',
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  vaultCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  vaultTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  vaultTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  vaultTabActive: {
    backgroundColor: colors.primarySoft,
  },
  vaultTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  vaultTabTextActive: {
    color: colors.primary,
  },
  vaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  vaultRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  vaultRowMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  vaultChevron: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '700',
  },
  vaultHint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thoughtChip: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  thoughtText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.94,
  },
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
  },
  modalTitle: {
    fontFamily: fontSerif,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
