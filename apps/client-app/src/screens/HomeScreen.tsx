// ============================================================================
// FILE: src/screens/HomeScreen.tsx
// CONTEXT: IHS Healthcare Concierge — primary hub
// ============================================================================

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NavigationProp } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useCare } from '../context/CareContext';
import { VitalRing } from '../components/VitalRing';
import type { MainTabParamList } from '../navigation/BottomTabs';
import type { RootStackParamList } from '../types/navigation';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

const SERVICES = [
  { id: 'consult', label: 'Doctor\nConsultations', glyph: '✚', tone: 'blue' as const, target: 'consult' as const },
  { id: 'home-visit', label: 'Doctor\nHome Visit', glyph: '⌂', tone: 'mint' as const, target: 'home' as const },
  { id: 'nursing', label: 'Nursing\nServices', glyph: '♡', tone: 'pink' as const, target: 'nursing' as const },
  { id: 'labs', label: 'Diagnostics\n& Labs', glyph: '◎', tone: 'purple' as const, target: 'labs' as const },
  { id: 'pharmacy', label: 'Pharmacy &\nMedicine', glyph: '◇', tone: 'amber' as const, target: 'pharmacy' as const },
  { id: 'rehab', label: 'Rehab &\nPhysical Therapy', glyph: '↻', tone: 'mint' as const, target: 'rehab' as const },
  { id: 'ambulance', label: 'Emergency\nAmbulance', glyph: '⚡', tone: 'pink' as const, target: 'ambulance' as const },
  { id: 'vitals', label: 'Vitals &\nBLE Sync', glyph: '⌁', tone: 'blue' as const, target: 'vitals' as const },
  { id: 'plans', label: 'Care Plans\n& Insurance', glyph: '☰', tone: 'purple' as const, target: 'plans' as const },
] as const;

const TILE_TONE = {
  blue: {
    bg: ['rgba(0,122,255,0.12)', 'rgba(0,122,255,0.04)'] as const,
    fg: '#007AFF',
  },
  mint: {
    bg: ['rgba(52,199,89,0.12)', 'rgba(52,199,89,0.04)'] as const,
    fg: '#34C759',
  },
  purple: {
    bg: ['rgba(88,86,214,0.12)', 'rgba(88,86,214,0.04)'] as const,
    fg: '#5856D6',
  },
  amber: {
    bg: ['rgba(255,149,0,0.14)', 'rgba(255,149,0,0.04)'] as const,
    fg: '#FF9500',
  },
  pink: {
    bg: ['rgba(255,45,85,0.14)', 'rgba(255,45,85,0.04)'] as const,
    fg: '#FF2D55',
  },
} as const;

export const HomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { appointments, vitals } = useCare();
  const ihsUid = route.params?.ihsUid ?? 'IHS-MEMBER';
  const [careLocation, setCareLocation] = useState('INCOIS Road, Prakasam Nagar');

  const initials = useMemo(() => {
    const parts = ihsUid.replace(/^IHS-/, '').split('-');
    return (parts[0]?.slice(0, 2) || 'IH').toUpperCase();
  }, [ihsUid]);

  const upcomingCount = appointments.filter((a) => a.status === 'upcoming').length;
  const hr = vitals.find((v) => v.metric === 'hr');
  const spo2 = vitals.find((v) => v.metric === 'spo2');

  const openLocationPicker = () => {
    Alert.alert('Care Location', 'Select where care should be delivered.', [
      {
        text: 'INCOIS Road, Prakasam Nagar',
        onPress: () => setCareLocation('INCOIS Road, Prakasam Nagar'),
      },
      {
        text: 'Registered Home Base',
        onPress: () => setCareLocation('Registered Home Base'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openLiveTracker = () => {
    const params = {
      ihsUid,
      patientLat: 17.7231,
      patientLng: 83.3012,
      dispatchStatus: 'DEMO_TRACKER',
    };
    const rootNav = navigation.getParent() as
      | NavigationProp<RootStackParamList>
      | undefined;
    if (rootNav?.navigate) {
      rootNav.navigate('AmbulanceTracking', params);
      return;
    }
    Alert.alert('Tracker unavailable', 'Live Ambulance Tracker could not open from this screen.');
  };

  const openService = (target: (typeof SERVICES)[number]['target']) => {
    if (target === 'vitals') {
      navigation.navigate('HealthVault', { focus: 'vitals' });
      return;
    }
    if (target === 'plans') {
      navigation.navigate('MyCare', { focus: 'plan' });
      return;
    }
    if (target === 'pharmacy') {
      navigation.navigate('HealthVault', { focus: 'orders' });
      return;
    }
    if (target === 'ambulance') {
      Alert.alert(
        'Emergency Ambulance',
        'Hold the red SOS button for a real panic dispatch, or open the Live Ambulance Tracker demo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Live Tracker', onPress: openLiveTracker },
          {
            text: 'Book non-urgent',
            onPress: () => navigation.navigate('DoctorVisit', { service: 'ambulance' }),
          },
        ],
      );
      return;
    }
    if (target === 'home') {
      navigation.navigate('DoctorVisit', { mode: 'home' });
      return;
    }
    if (target === 'consult') {
      navigation.navigate('DoctorVisit', { mode: 'tele' });
      return;
    }
    navigation.navigate('DoctorVisit', { service: target });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.locationHit} onPress={openLocationPicker}>
            <Text style={styles.locationEyebrow}>Care at</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationChevron}>›</Text>
              <Text style={styles.locationText} numberOfLines={1}>
                {careLocation}
              </Text>
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconButton}
              onPress={() =>
                Alert.alert(
                  'Notifications',
                  upcomingCount
                    ? `You have ${upcomingCount} upcoming visit${upcomingCount === 1 ? '' : 's'}.`
                    : 'No new clinical alerts.',
                  [
                    {
                      text: 'Open Visits',
                      onPress: () => navigation.navigate('Visits'),
                    },
                    { text: 'Dismiss', style: 'cancel' },
                  ],
                )
              }
            >
              <Text style={styles.iconGlyph}>🔔</Text>
              {upcomingCount > 0 ? <View style={styles.notifDot} /> : null}
            </Pressable>
            <Pressable
              style={styles.profileBadge}
              onPress={() => {
                const parent = navigation.getParent();
                if (parent) {
                  parent.navigate('Settings');
                }
              }}
            >
              <Text style={styles.profileInitials}>{initials}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.brandMark}>IHS</Text>
        <Text style={styles.greeting}>Your healthcare concierge</Text>

        <Pressable onPress={() => navigation.navigate('Visits')}>
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>{upcomingCount} upcoming visits</Text>
            <Text style={styles.bannerBody}>Tap to manage schedule · reschedule · cancel</Text>
          </View>
        </Pressable>

        <View style={styles.heroCard}>
          <View style={styles.heroAccentBar} />
          <Text style={styles.heroKicker}>FEATURED CARE</Text>
          <Text style={styles.heroTitle}>Doctor Home Visit</Text>
          <Text style={styles.heroBody}>
            A qualified GP at your doorstep — examination, e-prescription, and follow-up in one
            visit.
          </Text>
          <Pressable
            style={styles.bookButton}
            onPress={() => navigation.navigate('DoctorVisit', { mode: 'home' })}
          >
            <Text style={styles.bookButtonText}>Book Now ›</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => navigation.navigate('HealthVault', { focus: 'vitals' })}
          style={({ pressed }) => [styles.vitalsPress, pressed && styles.pressed]}
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
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>Care Services</Text>
        <View style={styles.grid}>
          {SERVICES.map((service) => (
            <Pressable
              key={service.id}
              style={({ pressed }) => [styles.gridItem, pressed && styles.pressed]}
              onPress={() => openService(service.target)}
            >
              <View
                style={[
                  styles.gridIconWrap,
                  { backgroundColor: TILE_TONE[service.tone].bg[0] },
                  Platform.OS === 'web'
                    ? ({
                        backgroundImage: `linear-gradient(135deg, ${TILE_TONE[service.tone].bg[0]}, ${TILE_TONE[service.tone].bg[1]})`,
                      } as object)
                    : null,
                ]}
              >
                <Text style={[styles.gridGlyph, { color: TILE_TONE[service.tone].fg }]}>
                  {service.glyph}
                </Text>
              </View>
              <Text style={styles.gridLabel}>{service.label}</Text>
            </Pressable>
          ))}
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
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 18,
  },
  locationHit: {
    flex: 1,
    paddingRight: 12,
  },
  locationEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationChevron: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
    marginRight: 4,
  },
  locationText: {
    color: colors.darkSlate,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 16,
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  profileBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  brandMark: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 15,
    marginBottom: 14,
  },
  banner: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  bannerTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  bannerBody: {
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
  },
  heroAccentBar: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primarySoft,
    opacity: 1,
  },
  heroKicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
    maxWidth: '92%',
  },
  bookButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  bookButtonText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  vitalsPress: {
    marginBottom: 22,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.92,
  },
  sectionTitle: {
    color: colors.darkSlate,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '31.5%',
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 0,
  },
  gridIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridGlyph: {
    fontSize: 20,
    fontWeight: '300',
  },
  gridLabel: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
});
