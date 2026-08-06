// ============================================================================
// FILE: src/screens/HealthVaultScreen.tsx
// CONTEXT: WORM records, vitals, and interactive e-prescription ordering
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCare, type VaultRecord } from '../context/CareContext';
import {
  Screen,
  Card,
  SectionLabel,
  ChipRow,
  Field,
  PrimaryButton,
  StatusPill,
  GhostButton,
} from '../components/ui';
import { colors } from '../theme/colors';
import type { MainTabParamList } from '../navigation/BottomTabs';
import { Phase3HealthSchemeBanner } from '../components/Phase3HealthSchemeBanner';

type Props = BottomTabScreenProps<MainTabParamList, 'HealthVault'>;

const TABS = [
  { id: 'rx', label: 'E-Prescriptions' },
  { id: 'records', label: 'Records' },
  { id: 'orders', label: 'Orders' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'add', label: 'Add reading' },
];

const METRICS = [
  { id: 'hr', label: 'Heart Rate', unit: 'bpm' },
  { id: 'spo2', label: 'SpO₂', unit: '%' },
  { id: 'bp', label: 'Blood Pressure', unit: 'mmHg' },
  { id: 'temp', label: 'Temperature', unit: '°F' },
  { id: 'glucose', label: 'Glucose', unit: 'mg/dL' },
] as const;

const DELIVERY_ADDRESSES = [
  { id: 'home', label: 'INCOIS Road, Prakasam Nagar' },
  { id: 'base', label: 'Registered Home Base' },
  { id: 'office', label: 'IHS Care Desk · Beach Road' },
  { id: 'custom', label: 'Other address…' },
];

export const HealthVaultScreen: React.FC<Props> = ({ route }) => {
  const { vaultRecords, vitals, addVital, medicineOrders, placeMedicineOrder } = useCare();
  const initialTab =
    route.params?.focus === 'vitals'
      ? 'vitals'
      : route.params?.focus === 'orders'
        ? 'orders'
        : 'rx';
  const [tab, setTab] = useState(initialTab);
  const [metric, setMetric] = useState<(typeof METRICS)[number]['id']>('hr');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState('all');
  const [rxFlashId, setRxFlashId] = useState<string | null>(null);

  const [orderingRx, setOrderingRx] = useState<VaultRecord | null>(null);
  const [addressId, setAddressId] = useState('home');
  const [customAddress, setCustomAddress] = useState('');

  useEffect(() => {
    if (route.params?.focus === 'vitals') setTab('vitals');
    if (route.params?.focus === 'records') setTab('records');
    if (route.params?.focus === 'orders') setTab('orders');
  }, [route.params?.focus]);

  const ePrescriptions = useMemo(
    () => vaultRecords.filter((r) => !!r.medicines?.length || r.category.toLowerCase() === 'pharmacy'),
    [vaultRecords],
  );

  useEffect(() => {
    const newest = ePrescriptions[0];
    if (!newest || newest.dateLabel !== 'Just now') return;
    setTab('rx');
    setRxFlashId(newest.id);
    const t = setTimeout(() => setRxFlashId(null), 5000);
    return () => clearTimeout(t);
  }, [ePrescriptions]);

  const filteredRecords = useMemo(() => {
    if (category === 'all') return vaultRecords;
    return vaultRecords.filter((r) => r.category.toLowerCase() === category);
  }, [vaultRecords, category]);

  const selectedMetric = METRICS.find((m) => m.id === metric)!;

  const selectedAddress = useMemo(() => {
    if (addressId === 'custom') return customAddress.trim();
    return DELIVERY_ADDRESSES.find((a) => a.id === addressId)?.label ?? '';
  }, [addressId, customAddress]);

  const estimatedTotal = useMemo(() => {
    if (!orderingRx?.medicines?.length) return 0;
    return orderingRx.medicines.reduce((sum, m) => sum + m.quantity * 12, 0) + 49;
  }, [orderingRx]);

  const saveReading = () => {
    if (!value.trim()) {
      Alert.alert('Missing value', 'Enter a measurement before saving.');
      return;
    }
    addVital({
      metric,
      label: selectedMetric.label,
      value: value.trim(),
      unit: selectedMetric.unit,
      recordedAt: 'Just now',
      source: 'Manual entry',
    });
    setValue('');
    setTab('vitals');
    Alert.alert('Saved', `${selectedMetric.label} recorded in your vault.`);
  };

  const startOrder = (rec: VaultRecord) => {
    setOrderingRx(rec);
    setAddressId('home');
    setCustomAddress('');
  };

  const confirmOrder = () => {
    if (!orderingRx) return;
    if (!selectedAddress || selectedAddress.length < 6) {
      Alert.alert('Address required', 'Select or enter a delivery address.');
      return;
    }

    try {
      const order = placeMedicineOrder({
        prescriptionId: orderingRx.id,
        address: selectedAddress,
      });
      setOrderingRx(null);
      setTab('orders');
      Alert.alert(
        'Order placed',
        `${order.prescriptionTitle}\n₹${order.totalInr} · ${order.etaLabel}\nDelivering to: ${order.address}`,
      );
    } catch (error) {
      Alert.alert('Order failed', error instanceof Error ? error.message : 'Try again.');
    }
  };

  if (orderingRx) {
    return (
      <Screen
        title="Order Medicine"
        subtitle={orderingRx.title}
        rightSlot={
          <GhostButton
            label="Cancel"
            onPress={() => setOrderingRx(null)}
          />
        }
      >
        <Card>
          <Text style={styles.prescriber}>
            Prescribed by {orderingRx.prescribedBy ?? 'IHS Clinician'} · {orderingRx.dateLabel}
          </Text>
          <SectionLabel>Medicines</SectionLabel>
          {orderingRx.medicines?.map((med) => (
            <View key={med.name} style={styles.medRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{med.name}</Text>
                <Text style={styles.medMeta}>
                  {med.dose} · {med.duration}
                </Text>
              </View>
              <Text style={styles.medQty}>×{med.quantity}</Text>
            </View>
          ))}
        </Card>

        <SectionLabel>Delivery address</SectionLabel>
        <ChipRow
          options={DELIVERY_ADDRESSES.map((a) => ({
            id: a.id,
            label: a.id === 'custom' ? 'Other…' : a.label.split('·')[0].trim().slice(0, 22),
          }))}
          value={addressId}
          onChange={setAddressId}
        />

        {addressId === 'custom' ? (
          <Field
            label="Full delivery address"
            value={customAddress}
            onChangeText={setCustomAddress}
            placeholder="Flat / street / landmark / city"
            multiline
          />
        ) : (
          <Card>
            <Text style={styles.addressPreview}>{selectedAddress}</Text>
          </Card>
        )}

        <Card>
          <Text style={styles.summaryLine}>Doorstep pharmacy · stock-aware fill</Text>
          <Text style={styles.summaryLine}>Delivery fee · ₹49</Text>
          <Text style={styles.totalLine}>Estimated total · ₹{estimatedTotal}</Text>
          <PrimaryButton label="Place order" tone="accent" onPress={confirmOrder} />
          <PrimaryButton label="Back to vault" tone="slate" onPress={() => setOrderingRx(null)} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title="Health Vault"
      subtitle="WORM-locked records, e-prescriptions, and live metrics"
    >
      <Phase3HealthSchemeBanner />
      <ChipRow options={TABS} value={tab} onChange={setTab} />

      {tab === 'rx' ? (
        <>
          <SectionLabel>E-Prescriptions · live from Doctor Console</SectionLabel>
          {ePrescriptions.length === 0 ? (
            <Card>
              <Text style={styles.summary}>
                No e-prescriptions yet. When Dr. Ananya Rao issues a script in the Doctor Console,
                it appears here instantly.
              </Text>
            </Card>
          ) : (
            ePrescriptions.map((rec) => {
              const alreadyOrdered = medicineOrders.some((o) => o.prescriptionId === rec.id);
              const isLive = rec.id === rxFlashId || rec.dateLabel === 'Just now';
              return (
                <Card key={rec.id} style={isLive ? styles.rxLiveCard : undefined}>
                  <View style={styles.rowTop}>
                    <Text style={styles.title}>{rec.title}</Text>
                    <StatusPill
                      label={isLive ? 'NEW' : rec.wormLocked ? 'WORM' : 'ACTIVE'}
                      tone={isLive ? 'warn' : 'ok'}
                    />
                  </View>
                  <Text style={styles.meta}>
                    {rec.dateLabel}
                    {rec.prescribedBy ? ` · ${rec.prescribedBy}` : ''}
                  </Text>
                  <Text style={styles.summary}>{rec.summary}</Text>
                  <View style={styles.rxBlock}>
                    {(rec.medicines || []).map((med) => (
                      <Text key={`${rec.id}-${med.name}`} style={styles.rxLine}>
                        • {med.name} — {med.dose}
                        {med.duration ? ` · ${med.duration}` : ''}
                        {med.refills != null ? ` · Refills: ${med.refills}` : ''}
                      </Text>
                    ))}
                    {alreadyOrdered ? <StatusPill label="ORDERED" tone="ok" /> : null}
                    <PrimaryButton
                      label={alreadyOrdered ? 'Order again' : 'Order Medicine Delivery'}
                      tone="accent"
                      onPress={() => startOrder(rec)}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </>
      ) : null}

      {tab === 'records' ? (
        <>
          <ChipRow
            options={[
              { id: 'all', label: 'All' },
              { id: 'diagnostics', label: 'Diagnostics' },
              { id: 'pharmacy', label: 'Pharmacy' },
              { id: 'clinical', label: 'Clinical' },
            ]}
            value={category}
            onChange={setCategory}
          />
          {filteredRecords.map((rec) => {
            const isRx = !!rec.medicines?.length;
            const alreadyOrdered = medicineOrders.some((o) => o.prescriptionId === rec.id);
            return (
              <Card key={rec.id}>
                <View style={styles.rowTop}>
                  <Text style={styles.title}>{rec.title}</Text>
                  <StatusPill
                    label={rec.wormLocked ? 'WORM' : 'PENDING'}
                    tone={rec.wormLocked ? 'ok' : 'warn'}
                  />
                </View>
                <Text style={styles.meta}>
                  {rec.category} · {rec.dateLabel}
                  {rec.prescribedBy ? ` · ${rec.prescribedBy}` : ''}
                </Text>
                <Text style={styles.summary}>{rec.summary}</Text>

                {isRx ? (
                  <View style={styles.rxBlock}>
                    {rec.medicines!.map((med) => (
                      <Text key={med.name} style={styles.rxLine}>
                        • {med.name} — {med.dose}
                      </Text>
                    ))}
                    {alreadyOrdered ? (
                      <StatusPill label="ORDERED" tone="ok" />
                    ) : null}
                    <PrimaryButton
                      label={alreadyOrdered ? 'Order again' : 'Order Medicine Delivery'}
                      tone="accent"
                      onPress={() => startOrder(rec)}
                    />
                  </View>
                ) : (
                  <GhostButton
                    label="View details"
                    onPress={() =>
                      Alert.alert(
                        rec.title,
                        `${rec.summary}\n\n${
                          rec.wormLocked
                            ? 'Immutable WORM object · Day-31 Glacier pointer queued.'
                            : 'Awaiting clinician countersign before WORM seal.'
                        }`,
                      )
                    }
                  />
                )}
              </Card>
            );
          })}
        </>
      ) : null}

      {tab === 'orders' ? (
        <>
          <SectionLabel>Medicine orders</SectionLabel>
          {medicineOrders.length === 0 ? (
            <Card>
              <Text style={styles.summary}>
                No pharmacy orders yet. Open a Pharmacy e-prescription and tap Order Medicine.
              </Text>
              <PrimaryButton
                label="Browse prescriptions"
                tone="slate"
                onPress={() => {
                  setCategory('pharmacy');
                  setTab('records');
                }}
              />
            </Card>
          ) : (
            medicineOrders.map((order) => (
              <Card key={order.id}>
                <View style={styles.rowTop}>
                  <Text style={styles.title}>{order.prescriptionTitle}</Text>
                  <StatusPill label={order.status.replace(/_/g, ' ').toUpperCase()} />
                </View>
                <Text style={styles.meta}>
                  {order.placedAt} · ₹{order.totalInr} · {order.etaLabel}
                </Text>
                <Text style={styles.summary}>Deliver to: {order.address}</Text>
                {order.medicines.map((m) => (
                  <Text key={m.name} style={styles.rxLine}>
                    • {m.name} ×{m.quantity}
                  </Text>
                ))}
              </Card>
            ))
          )}
        </>
      ) : null}

      {tab === 'vitals' ? (
        <>
          <SectionLabel>Latest readings</SectionLabel>
          <View style={styles.vitalsGrid}>
            {vitals.slice(0, 4).map((v) => (
              <Card key={v.id} style={styles.vitalCard}>
                <Text style={styles.vitalLabel}>{v.label}</Text>
                <Text style={styles.vitalValue}>
                  {v.value}
                  <Text style={styles.vitalUnit}> {v.unit}</Text>
                </Text>
                <Text style={styles.vitalMeta}>{v.recordedAt}</Text>
              </Card>
            ))}
          </View>
          <SectionLabel>History</SectionLabel>
          {vitals.map((v) => (
            <Card key={`hist-${v.id}`}>
              <View style={styles.rowTop}>
                <Text style={styles.title}>{v.label}</Text>
                <Text style={styles.valueInline}>
                  {v.value} {v.unit}
                </Text>
              </View>
              <Text style={styles.meta}>
                {v.recordedAt} · {v.source}
              </Text>
            </Card>
          ))}
          <PrimaryButton label="Add new reading" tone="accent" onPress={() => setTab('add')} />
        </>
      ) : null}

      {tab === 'add' ? (
        <Card>
          <SectionLabel>Metric</SectionLabel>
          <ChipRow
            options={METRICS.map((m) => ({ id: m.id, label: m.label }))}
            value={metric}
            onChange={(id) => setMetric(id as typeof metric)}
          />
          <Field
            label={`Value (${selectedMetric.unit})`}
            value={value}
            onChangeText={setValue}
            placeholder={metric === 'bp' ? '120/80' : 'Enter reading'}
          />
          <PrimaryButton label="Save to Health Vault" onPress={saveReading} />
          <PrimaryButton label="Cancel" tone="slate" onPress={() => setTab('vitals')} />
        </Card>
      ) : null}
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
    fontSize: 15,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  summary: {
    color: colors.darkSlate,
    lineHeight: 20,
    fontSize: 13,
  },
  rxBlock: {
    marginTop: 10,
    gap: 4,
  },
  rxLiveCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  rxLine: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  prescriber: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 8,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  medName: {
    color: colors.darkSlate,
    fontWeight: '800',
    fontSize: 14,
  },
  medMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  medQty: {
    color: colors.primary,
    fontWeight: '800',
  },
  addressPreview: {
    color: colors.darkSlate,
    fontWeight: '700',
    fontSize: 14,
  },
  summaryLine: {
    color: colors.textSecondary,
    marginBottom: 4,
  },
  totalLine: {
    color: colors.darkSlate,
    fontWeight: '800',
    fontSize: 16,
    marginVertical: 8,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  vitalCard: {
    width: '48%',
  },
  vitalLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  vitalValue: {
    color: colors.darkSlate,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  vitalUnit: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  vitalMeta: {
    marginTop: 6,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  valueInline: {
    color: colors.primary,
    fontWeight: '800',
  },
});
