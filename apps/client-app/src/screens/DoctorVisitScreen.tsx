// ============================================================================
// FILE: src/screens/DoctorVisitScreen.tsx
// CONTEXT: Active booking for home visit, teleconsult, and care services
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCare, type VisitType } from '../context/CareContext';
import {
  Screen,
  Card,
  SectionLabel,
  ChipRow,
  Field,
  PrimaryButton,
  StatusPill,
} from '../components/ui';
import { colors } from '../theme/colors';
import type { MainTabParamList } from '../navigation/BottomTabs';

type Props = BottomTabScreenProps<MainTabParamList, 'DoctorVisit'>;

const DOCTORS = [
  { id: 'd1', name: 'Dr. Ananya Rao', specialty: 'Family Medicine · 12 yrs', eta: 'Doorstep 45–70 min' },
  { id: 'd2', name: 'Dr. Vikram Sethi', specialty: 'Internal Medicine · 9 yrs', eta: 'Tele ready now' },
  { id: 'd3', name: 'Dr. Leela Krishnan', specialty: 'Pediatrics · 15 yrs', eta: 'Doorstep 60–90 min' },
];

const SLOTS = [
  'Today · 5:30 PM',
  'Tomorrow · 10:30 AM',
  'Tomorrow · 4:00 PM',
  'Sat · 9:30 AM',
  'Sat · 12:00 PM',
];

const SERVICE_META: Record<
  string,
  { title: string; type: VisitType; clinician: string; blurb: string }
> = {
  home: {
    title: 'GP Home Visit',
    type: 'home_visit',
    clinician: 'Dr. Ananya Rao',
    blurb: 'Qualified GP at your doorstep with e-prescription.',
  },
  tele: {
    title: 'Teleconsult',
    type: 'teleconsult',
    clinician: 'Dr. Vikram Sethi',
    blurb: 'Stock-aware video consult with Rx when clinically indicated.',
  },
  consult: {
    title: 'Doctor Consultation',
    type: 'teleconsult',
    clinician: 'Dr. Vikram Sethi',
    blurb: 'Book a clinician consult pathway.',
  },
  nursing: {
    title: 'Nursing Services',
    type: 'nursing',
    clinician: 'Nurse Priya Nair',
    blurb: 'Wound care, injections, vitals, and elder support at home.',
  },
  labs: {
    title: 'Diagnostics & Labs',
    type: 'labs',
    clinician: 'IHS Phlebotomy',
    blurb: 'Home sample collection with WORM-locked results.',
  },
  pharmacy: {
    title: 'Pharmacy & Medicine',
    type: 'pharmacy',
    clinician: 'IHS Pharmacy Desk',
    blurb: 'Refill or request doorstep medicine delivery.',
  },
  rehab: {
    title: 'Rehab & Physical Therapy',
    type: 'rehab',
    clinician: 'PT Kabir Menon',
    blurb: 'In-home physiotherapy sessions.',
  },
  ambulance: {
    title: 'Emergency Ambulance',
    type: 'ambulance',
    clinician: 'IHS Dispatch',
    blurb: 'Non-panic transport request. Use SOS FAB for true emergencies.',
  },
};

export const DoctorVisitScreen: React.FC<Props> = ({ navigation, route }) => {
  const { bookAppointment } = useCare();
  const initialMode = route.params?.mode === 'tele' ? 'tele' : route.params?.service || 'home';
  const [serviceKey, setServiceKey] = useState(initialMode);
  const [doctorId, setDoctorId] = useState('d1');
  const [slot, setSlot] = useState(SLOTS[1]);
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('INCOIS Road, Prakasam Nagar');

  useEffect(() => {
    if (route.params?.service === 'consult') {
      setServiceKey('tele');
    } else if (route.params?.service) {
      setServiceKey(route.params.service);
    } else if (route.params?.mode) {
      setServiceKey(route.params.mode);
    }
  }, [route.params?.mode, route.params?.service]);

  const meta = SERVICE_META[serviceKey] || SERVICE_META.home;
  const doctor = useMemo(
    () => DOCTORS.find((d) => d.id === doctorId) || DOCTORS[0],
    [doctorId],
  );

  const modeChips = [
    { id: 'home', label: 'Home Visit' },
    { id: 'tele', label: 'Teleconsult' },
    { id: 'nursing', label: 'Nursing' },
    { id: 'labs', label: 'Labs' },
    { id: 'pharmacy', label: 'Pharmacy' },
    { id: 'rehab', label: 'Rehab' },
  ];

  const confirmBooking = () => {
    if (!slot?.trim()) {
      Alert.alert('Select a time', 'Choose an appointment slot before confirming.');
      return;
    }
    if (meta.type !== 'teleconsult' && address.trim().length < 6) {
      Alert.alert('Address required', 'Enter a valid care delivery address (min 6 characters).');
      return;
    }
    if (serviceKey === 'pharmacy') {
      Alert.alert(
        'E-Pharmacy',
        'For prescription delivery, order from Health Vault → Order Medicine. Continue booking a pharmacy desk visit instead?',
        [
          {
            text: 'Open E-Pharmacy',
            onPress: () => navigation.navigate('HealthVault', { focus: 'orders' }),
          },
          { text: 'Book desk visit', onPress: () => finalize() },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    if (serviceKey === 'ambulance') {
      Alert.alert(
        'Ambulance request',
        'For life-threatening emergencies hold the red SOS button for 1.5s. Continue with non-urgent transport?',
        [
          { text: 'Use SOS instead', style: 'cancel' },
          {
            text: 'Request transport',
            onPress: () => finalize('Non-urgent ambulance transport'),
          },
        ],
      );
      return;
    }
    finalize();
  };

  const finalize = (forcedNotes?: string) => {
    const clinician =
      meta.type === 'home_visit' || meta.type === 'teleconsult' ? doctor.name : meta.clinician;
    const created = bookAppointment({
      type: meta.type,
      title: meta.title,
      clinician,
      whenLabel: slot,
      whenIso: new Date().toISOString(),
      location: meta.type === 'teleconsult' ? 'Video · IHS Concierge' : address.trim(),
      notes: forcedNotes || notes || undefined,
    });

    Alert.alert('Booking confirmed', `${created.title} · ${created.whenLabel}`, [
      {
        text: 'View in Visits',
        onPress: () => navigation.navigate('Visits'),
      },
      { text: 'Stay here', style: 'cancel' },
    ]);
    setNotes('');
  };

  return (
    <Screen title="Doctor Visit" subtitle={meta.blurb}>
      <SectionLabel>Care pathway</SectionLabel>
      <ChipRow options={modeChips} value={serviceKey} onChange={setServiceKey} />

      <Card style={styles.hero}>
        <StatusPill label={meta.type.replace('_', ' ').toUpperCase()} />
        <Text style={styles.heroTitle}>{meta.title}</Text>
        <Text style={styles.heroBody}>{meta.blurb}</Text>
      </Card>

      {(meta.type === 'home_visit' || meta.type === 'teleconsult') && (
        <>
          <SectionLabel>Choose clinician</SectionLabel>
          {DOCTORS.map((doc) => {
            const active = doc.id === doctorId;
            return (
              <Pressable key={doc.id} onPress={() => setDoctorId(doc.id)}>
                <Card style={active ? styles.cardActive : undefined}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  <Text style={styles.docMeta}>{doc.specialty}</Text>
                  <Text style={styles.docEta}>{doc.eta}</Text>
                </Card>
              </Pressable>
            );
          })}
        </>
      )}

      <SectionLabel>Select slot</SectionLabel>
      <ChipRow
        options={SLOTS.map((s) => ({ id: s, label: s }))}
        value={slot}
        onChange={setSlot}
      />

      {meta.type !== 'teleconsult' ? (
        <Field
          label="Care location"
          value={address}
          onChangeText={setAddress}
          placeholder="Doorstep address"
        />
      ) : null}

      <Field
        label="Symptoms / notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Fever since yesterday, mild cough…"
        multiline
      />

      <Card>
        <Text style={styles.summaryLabel}>Booking summary</Text>
        <Text style={styles.summaryLine}>{meta.title}</Text>
        <Text style={styles.summaryLine}>
          {meta.type === 'home_visit' || meta.type === 'teleconsult' ? doctor.name : meta.clinician}
        </Text>
        <Text style={styles.summaryLine}>{slot}</Text>
        <PrimaryButton label="Confirm booking" tone="accent" onPress={confirmBooking} />
        <PrimaryButton
          label="Open visit history"
          tone="slate"
          onPress={() => navigation.navigate('Visits')}
        />
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  heroTitle: {
    color: colors.textInverse,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  heroBody: {
    color: 'rgba(248,250,252,0.8)',
    lineHeight: 20,
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  docName: {
    color: colors.darkSlate,
    fontWeight: '800',
    fontSize: 15,
  },
  docMeta: {
    color: colors.textSecondary,
    marginTop: 4,
  },
  docEta: {
    color: colors.primary,
    marginTop: 6,
    fontWeight: '700',
    fontSize: 12,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  summaryLine: {
    color: colors.darkSlate,
    fontWeight: '600',
    marginBottom: 4,
  },
});
