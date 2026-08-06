// ============================================================================
// FILE: src/screens/MyCareScreen.tsx
// CONTEXT: Capitation, care plans, family, insurance concierge
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCare } from '../context/CareContext';
import {
  Screen,
  Card,
  SectionLabel,
  ChipRow,
  Field,
  PrimaryButton,
  GhostButton,
  StatusPill,
} from '../components/ui';
import { colors } from '../theme/colors';
import type { MainTabParamList } from '../navigation/BottomTabs';

type Props = BottomTabScreenProps<MainTabParamList, 'MyCare'>;

const TABS = [
  { id: 'plan', label: 'Care plan' },
  { id: 'family', label: 'Family' },
  { id: 'insurance', label: 'Insurance' },
];

export const MyCareScreen: React.FC<Props> = ({ navigation, route }) => {
  const { carePlan, family, addFamilyMember, removeFamilyMember } = useCare();
  const [tab, setTab] = useState(route.params?.focus || 'plan');
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('Spouse');
  const [memberUid, setMemberUid] = useState('');

  useEffect(() => {
    if (route.params?.focus) setTab(route.params.focus);
  }, [route.params?.focus]);

  const visitPct = Math.round((carePlan.visitsUsed / carePlan.visitsQuota) * 100);
  const telePct = Math.round((carePlan.teleUsed / carePlan.teleQuota) * 100);

  const saveMember = () => {
    if (name.trim().length < 2) {
      Alert.alert('Name required', 'Enter the family member name.');
      return;
    }
    const uid =
      memberUid.trim().toUpperCase() ||
      `IHS-ANTP-${String(10000 + family.length + 1).padStart(5, '0')}`;
    addFamilyMember({ name: name.trim(), relation, ihsUid: uid });
    setName('');
    setMemberUid('');
    Alert.alert('Added', `${name.trim()} linked to your care circle.`);
  };

  return (
    <Screen title="My Care" subtitle="Capitation quota, family circle, and insurance">
      <ChipRow
        options={TABS}
        value={tab}
        onChange={(id) => setTab(id as 'plan' | 'family' | 'insurance')}
      />

      {tab === 'plan' ? (
        <>
          <Card style={styles.planHero}>
            <StatusPill label="ACTIVE" />
            <Text style={styles.planName}>{carePlan.name}</Text>
            <Text style={styles.planMeta}>Renews {carePlan.renewsOn}</Text>
          </Card>

          <SectionLabel>Quota usage</SectionLabel>
          <Card>
            <Text style={styles.quotaTitle}>Home / doorstep visits</Text>
            <Text style={styles.quotaValue}>
              {carePlan.visitsUsed} / {carePlan.visitsQuota}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${visitPct}%` }]} />
            </View>
            <Text style={styles.quotaTitle}>Teleconsults</Text>
            <Text style={styles.quotaValue}>
              {carePlan.teleUsed} / {carePlan.teleQuota}
            </Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${telePct}%` }]} />
            </View>
            <PrimaryButton
              label="Book against quota"
              tone="accent"
              onPress={() => navigation.navigate('DoctorVisit', { mode: 'home' })}
            />
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Care pathways included</Text>
            <Text style={styles.bullet}>• GP home visits & teleconsults</Text>
            <Text style={styles.bullet}>• Nursing & phlebotomy doorstep</Text>
            <Text style={styles.bullet}>• Stock-aware e-prescriptions</Text>
            <Text style={styles.bullet}>• Emergency SOS dispatch (always on)</Text>
            <GhostButton
              label="Open Health Vault metrics"
              onPress={() => navigation.navigate('HealthVault', { focus: 'vitals' })}
            />
          </Card>
        </>
      ) : null}

      {tab === 'family' ? (
        <>
          <SectionLabel>Care circle</SectionLabel>
          {family.map((m) => (
            <Card key={m.id}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{m.name}</Text>
                  <Text style={styles.memberMeta}>
                    {m.relation} · {m.ihsUid}
                  </Text>
                </View>
                <GhostButton
                  label="Remove"
                  danger
                  onPress={() =>
                    Alert.alert('Remove member?', m.name, [
                      { text: 'Keep', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => removeFamilyMember(m.id),
                      },
                    ])
                  }
                />
              </View>
            </Card>
          ))}

          <SectionLabel>Add family member</SectionLabel>
          <Card>
            <Field label="Full name" value={name} onChangeText={setName} placeholder="Name" />
            <ChipRow
              options={[
                { id: 'Spouse', label: 'Spouse' },
                { id: 'Child', label: 'Child' },
                { id: 'Parent', label: 'Parent' },
                { id: 'Other', label: 'Other' },
              ]}
              value={relation}
              onChange={setRelation}
            />
            <Field
              label="IHS UID (optional)"
              value={memberUid}
              onChangeText={setMemberUid}
              placeholder="IHS-ANTP-00014"
            />
            <PrimaryButton label="Add to care circle" onPress={saveMember} />
          </Card>
        </>
      ) : null}

      {tab === 'insurance' ? (
        <>
          <Card style={styles.planHero}>
            <StatusPill label="LINKED" />
            <Text style={styles.planName}>{carePlan.insurer}</Text>
            <Text style={styles.planMeta}>Policy {carePlan.policyId}</Text>
          </Card>
          <Card>
            <Text style={styles.cardTitle}>Concierge actions</Text>
            <PrimaryButton
              label="Request pre-auth letter"
              onPress={() =>
                Alert.alert(
                  'Pre-auth requested',
                  'IHS concierge will file a draft pre-authorization against POL-IHS-77821.',
                )
              }
            />
            <PrimaryButton
              label="Download e-card"
              tone="slate"
              onPress={() =>
                Alert.alert('E-card ready', 'Mock insurance e-card saved to Health Vault exports.')
              }
            />
            <PrimaryButton
              label="File reimbursement claim"
              tone="slate"
              onPress={() =>
                Alert.alert(
                  'Claim started',
                  'Upload receipts from Health Vault · claim ID CLM-8821 queued.',
                )
              }
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  planHero: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  planName: {
    color: colors.textInverse,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
  },
  planMeta: {
    color: 'rgba(248,250,252,0.75)',
    marginTop: 4,
    fontSize: 13,
  },
  memberMeta: {
    color: colors.textSecondary,
    marginTop: 4,
    fontSize: 13,
  },
  quotaTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  quotaValue: {
    color: colors.darkSlate,
    fontWeight: '800',
    fontSize: 22,
    marginVertical: 4,
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    height: 8,
    backgroundColor: colors.primary,
  },
  cardTitle: {
    color: colors.darkSlate,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 8,
  },
  bullet: {
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
