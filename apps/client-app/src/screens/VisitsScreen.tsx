// ============================================================================
// FILE: src/screens/VisitsScreen.tsx
// CONTEXT: Upcoming / past appointments with cancel & reschedule
// ============================================================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCare, type Appointment } from '../context/CareContext';
import {
  Screen,
  Card,
  SectionLabel,
  ChipRow,
  PrimaryButton,
  GhostButton,
  StatusPill,
  EmptyState,
} from '../components/ui';
import { colors } from '../theme/colors';
import type { MainTabParamList } from '../navigation/BottomTabs';

type Props = BottomTabScreenProps<MainTabParamList, 'Visits'>;

const FILTERS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'History' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
];

const NEXT_SLOTS = [
  { label: 'Tomorrow · 11:00 AM', iso: '2026-08-07T11:00:00+05:30' },
  { label: 'Tomorrow · 4:30 PM', iso: '2026-08-07T16:30:00+05:30' },
  { label: 'Sat · 9:00 AM', iso: '2026-08-09T09:00:00+05:30' },
];

function statusTone(status: Appointment['status']): 'ok' | 'muted' | 'danger' {
  if (status === 'upcoming') return 'ok';
  if (status === 'cancelled') return 'danger';
  return 'muted';
}

export const VisitsScreen: React.FC<Props> = ({ navigation }) => {
  const { appointments, cancelAppointment, rescheduleAppointment } = useCare();
  const [filter, setFilter] = useState('upcoming');

  const list = useMemo(() => {
    if (filter === 'all') return appointments;
    return appointments.filter((a) => a.status === filter);
  }, [appointments, filter]);

  const onCancel = (apt: Appointment) => {
    Alert.alert('Cancel visit?', `${apt.title} with ${apt.clinician}`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel visit',
        style: 'destructive',
        onPress: () => {
          cancelAppointment(apt.id);
          Alert.alert('Cancelled', 'The visit was moved to Cancelled.');
        },
      },
    ]);
  };

  const onReschedule = (apt: Appointment) => {
    Alert.alert('Reschedule visit', 'Pick a new slot', [
      ...NEXT_SLOTS.map((slot) => ({
        text: slot.label,
        onPress: () => {
          rescheduleAppointment(apt.id, slot.label, slot.iso);
          Alert.alert('Rescheduled', `Moved to ${slot.label}`);
        },
      })),
      { text: 'Close', style: 'cancel' },
    ]);
  };

  return (
    <Screen
      title="Visits"
      subtitle="Doorstep visits, teleconsults, and TAT history"
      rightSlot={
        <Pressable
          onPress={() => navigation.navigate('DoctorVisit', { mode: 'home' })}
          style={{
            backgroundColor: colors.accent,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            marginTop: 18,
          }}
        >
          <Text style={{ color: colors.darkSlate, fontWeight: '800', fontSize: 12 }}>+ Book</Text>
        </Pressable>
      }
    >
      <ChipRow options={FILTERS} value={filter} onChange={setFilter} />

      {list.length === 0 ? (
        <EmptyState
          title="No visits here"
          body="Book a GP home visit or teleconsult to populate this list."
          actionLabel="Open Doctor Visit"
          onAction={() => navigation.navigate('DoctorVisit', { mode: 'home' })}
        />
      ) : (
        list.map((apt) => (
          <Card key={apt.id}>
            <View style={styles.rowTop}>
              <Text style={styles.title}>{apt.title}</Text>
              <StatusPill label={apt.status.toUpperCase()} tone={statusTone(apt.status)} />
            </View>
            <Text style={styles.clinician}>{apt.clinician}</Text>
            <Text style={styles.meta}>{apt.whenLabel}</Text>
            <Text style={styles.meta}>{apt.location}</Text>
            {apt.notes ? <Text style={styles.notes}>{apt.notes}</Text> : null}

            {apt.status === 'upcoming' ? (
              <View style={styles.actions}>
                <GhostButton label="Reschedule" onPress={() => onReschedule(apt)} />
                <GhostButton label="Cancel" danger onPress={() => onCancel(apt)} />
              </View>
            ) : null}

            {apt.status === 'completed' ? (
              <GhostButton
                label="View in Health Vault"
                onPress={() => navigation.navigate('HealthVault', { focus: 'records' })}
              />
            ) : null}
          </Card>
        ))
      )}

      <SectionLabel>Quick actions</SectionLabel>
      <Card>
        <PrimaryButton
          label="Book GP Home Visit"
          onPress={() => navigation.navigate('DoctorVisit', { mode: 'home' })}
        />
        <PrimaryButton
          label="Start Teleconsult Booking"
          tone="slate"
          onPress={() => navigation.navigate('DoctorVisit', { mode: 'tele' })}
        />
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    color: colors.darkSlate,
    fontWeight: '800',
    fontSize: 16,
  },
  clinician: {
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  notes: {
    marginTop: 8,
    color: colors.darkSlate,
    fontSize: 13,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
