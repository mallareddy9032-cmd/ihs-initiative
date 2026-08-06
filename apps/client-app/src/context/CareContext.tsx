// ============================================================================
// FILE: src/context/CareContext.tsx
// CONTEXT: In-memory concierge state for bookings, vault, vitals, family
// ============================================================================

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const ENGINE_HTTP = 'http://localhost:8080';
const ENGINE_WS = 'ws://localhost:8080';
const PATIENT_UID = 'IHS-ADMIN-00001';

export type VisitStatus = 'upcoming' | 'completed' | 'cancelled';
export type VisitType = 'home_visit' | 'teleconsult' | 'nursing' | 'labs' | 'pharmacy' | 'rehab' | 'ambulance';

export interface Appointment {
  id: string;
  type: VisitType;
  title: string;
  clinician: string;
  whenLabel: string;
  whenIso: string;
  location: string;
  status: VisitStatus;
  notes?: string;
}

export interface PrescriptionMedicine {
  name: string;
  dose: string;
  duration: string;
  quantity: number;
  refills?: number;
}

export interface VaultRecord {
  id: string;
  title: string;
  category: string;
  dateLabel: string;
  wormLocked: boolean;
  summary: string;
  /** When set, record is an orderable e-prescription */
  medicines?: PrescriptionMedicine[];
  prescribedBy?: string;
}

export type MedicineOrderStatus = 'placed' | 'packing' | 'out_for_delivery' | 'delivered';

export interface MedicineOrder {
  id: string;
  prescriptionId: string;
  prescriptionTitle: string;
  medicines: PrescriptionMedicine[];
  address: string;
  placedAt: string;
  status: MedicineOrderStatus;
  etaLabel: string;
  totalInr: number;
}

export interface VitalReading {
  id: string;
  metric: 'hr' | 'spo2' | 'bp' | 'temp' | 'glucose';
  label: string;
  value: string;
  unit: string;
  recordedAt: string;
  source: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  ihsUid: string;
}

export interface CarePlan {
  name: string;
  renewsOn: string;
  visitsUsed: number;
  visitsQuota: number;
  teleUsed: number;
  teleQuota: number;
  insurer: string;
  policyId: string;
}

interface CareContextValue {
  appointments: Appointment[];
  vaultRecords: VaultRecord[];
  vitals: VitalReading[];
  family: FamilyMember[];
  carePlan: CarePlan;
  medicineOrders: MedicineOrder[];
  bookAppointment: (input: Omit<Appointment, 'id' | 'status'> & { status?: VisitStatus }) => Appointment;
  cancelAppointment: (id: string) => void;
  rescheduleAppointment: (id: string, whenLabel: string, whenIso: string) => void;
  addVital: (input: Omit<VitalReading, 'id'>) => void;
  addFamilyMember: (input: Omit<FamilyMember, 'id'>) => void;
  removeFamilyMember: (id: string) => void;
  placeMedicineOrder: (input: {
    prescriptionId: string;
    address: string;
  }) => MedicineOrder;
  getPrescription: (id: string) => VaultRecord | undefined;
  ingestPrescription: (record: VaultRecord) => void;
}

const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    type: 'home_visit',
    title: 'GP Home Visit',
    clinician: 'Dr. Ananya Rao',
    whenLabel: 'Tomorrow · 10:30 AM',
    whenIso: '2026-08-07T10:30:00+05:30',
    location: 'INCOIS Road, Prakasam Nagar',
    status: 'upcoming',
    notes: 'Fever follow-up',
  },
  {
    id: 'apt-2',
    type: 'teleconsult',
    title: 'Teleconsult',
    clinician: 'Dr. Vikram Sethi',
    whenLabel: 'Fri · 6:00 PM',
    whenIso: '2026-08-08T18:00:00+05:30',
    location: 'Video · IHS Concierge',
    status: 'upcoming',
  },
  {
    id: 'apt-3',
    type: 'labs',
    title: 'Home Sample Collection',
    clinician: 'IHS Phlebotomy',
    whenLabel: 'Completed · 2 Aug',
    whenIso: '2026-08-02T08:00:00+05:30',
    location: 'Registered Home Base',
    status: 'completed',
    notes: 'CBC + HbA1c',
  },
  {
    id: 'apt-4',
    type: 'nursing',
    title: 'Wound Care Visit',
    clinician: 'Nurse Priya Nair',
    whenLabel: 'Completed · 28 Jul',
    whenIso: '2026-07-28T11:00:00+05:30',
    location: 'INCOIS Road, Prakasam Nagar',
    status: 'completed',
  },
];

const INITIAL_VAULT: VaultRecord[] = [
  {
    id: 'vr-1',
    title: 'CBC Panel',
    category: 'Diagnostics',
    dateLabel: '2 Aug 2026',
    wormLocked: true,
    summary: 'WBC 7.2 · Hb 13.4 · Platelets normal. SHA-256 sealed.',
  },
  {
    id: 'vr-2',
    title: 'E-Prescription — Amoxicillin',
    category: 'Pharmacy',
    dateLabel: '28 Jul 2026',
    wormLocked: true,
    summary: 'Stock-aware Rx · 5 days · ready for doorstep pharmacy order.',
    prescribedBy: 'Dr. Ananya Rao',
    medicines: [
      { name: 'Amoxicillin 500mg', dose: '1 capsule · thrice daily', duration: '5 days', quantity: 15 },
      { name: 'Paracetamol 650mg', dose: '1 tablet · SOS fever', duration: '5 days', quantity: 10 },
    ],
  },
  {
    id: 'vr-5',
    title: 'E-Prescription — Hypertension Kit',
    category: 'Pharmacy',
    dateLabel: '12 Jul 2026',
    wormLocked: true,
    summary: 'Chronic refill · stock confirmed at IHS Pharmacy VSKP.',
    prescribedBy: 'Dr. Vikram Sethi',
    medicines: [
      { name: 'Amlodipine 5mg', dose: '1 tablet · once daily', duration: '30 days', quantity: 30 },
      { name: 'Aspirin 75mg', dose: '1 tablet · after dinner', duration: '30 days', quantity: 30 },
    ],
  },
  {
    id: 'vr-3',
    title: 'GP Encounter Note',
    category: 'Clinical',
    dateLabel: '28 Jul 2026',
    wormLocked: true,
    summary: 'Viral fever pathway · advise fluids · Day-31 cold vault queued.',
  },
  {
    id: 'vr-4',
    title: 'ECG Snapshot',
    category: 'Diagnostics',
    dateLabel: '12 Jul 2026',
    wormLocked: false,
    summary: 'Sinus rhythm · pending clinician countersign.',
  },
];

const INITIAL_VITALS: VitalReading[] = [
  {
    id: 'v-1',
    metric: 'hr',
    label: 'Heart Rate',
    value: '72',
    unit: 'bpm',
    recordedAt: 'Today · 7:40 AM',
    source: 'Profile sync',
  },
  {
    id: 'v-2',
    metric: 'spo2',
    label: 'SpO₂',
    value: '98',
    unit: '%',
    recordedAt: 'Today · 7:40 AM',
    source: 'BLE pulse ox',
  },
  {
    id: 'v-3',
    metric: 'bp',
    label: 'Blood Pressure',
    value: '118/76',
    unit: 'mmHg',
    recordedAt: 'Yesterday · 9:10 PM',
    source: 'Manual entry',
  },
  {
    id: 'v-4',
    metric: 'glucose',
    label: 'Glucose',
    value: '104',
    unit: 'mg/dL',
    recordedAt: '1 Aug · fasting',
    source: 'Home glucometer',
  },
];

const INITIAL_FAMILY: FamilyMember[] = [
  { id: 'f-1', name: 'Meera Admin', relation: 'Spouse', ihsUid: 'IHS-ANTP-00012' },
  { id: 'f-2', name: 'Arjun Admin', relation: 'Son', ihsUid: 'IHS-ANTP-00013' },
];

const INITIAL_PLAN: CarePlan = {
  name: 'IHS Family Capitation — Gold',
  renewsOn: '31 Mar 2027',
  visitsUsed: 3,
  visitsQuota: 12,
  teleUsed: 5,
  teleQuota: 24,
  insurer: 'IHS Mutual / Star Health bridge',
  policyId: 'POL-IHS-77821',
};

const CareContext = createContext<CareContextValue | null>(null);

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`;
}

export const CareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [vaultRecords, setVaultRecords] = useState<VaultRecord[]>(INITIAL_VAULT);
  const [vitals, setVitals] = useState<VitalReading[]>(INITIAL_VITALS);
  const [family, setFamily] = useState<FamilyMember[]>(INITIAL_FAMILY);
  const [carePlan] = useState<CarePlan>(INITIAL_PLAN);
  const [medicineOrders, setMedicineOrders] = useState<MedicineOrder[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const ingestPrescription = useCallback((record: VaultRecord) => {
    setVaultRecords((prev) => {
      if (prev.some((r) => r.id === record.id)) return prev;
      return [record, ...prev];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(`${ENGINE_WS}/v1/patient/stream?ihs_uid=${PATIENT_UID}`);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            event?: string;
            payload?: {
              id?: string;
              patient_id?: string;
              ihs_uid?: string;
              title?: string;
              category?: string;
              dateLabel?: string;
              wormLocked?: boolean;
              summary?: string;
              prescribedBy?: string;
              physician?: string;
              timestamp?: string;
              instructions?: string;
              refills?: number;
              medication?: PrescriptionMedicine & { name?: string };
              medicines?: PrescriptionMedicine[];
            };
          };
          if (msg.event !== 'PRESCRIPTION_ISSUED' || !msg.payload?.id) return;
          const p = msg.payload;
          const patientId = (p.patient_id || p.ihs_uid || '').toUpperCase();
          if (patientId && patientId !== PATIENT_UID) return;

          const medicines: PrescriptionMedicine[] =
            p.medicines && p.medicines.length
              ? p.medicines
              : p.medication?.name
                ? [
                    {
                      name: p.medication.name,
                      dose: p.medication.dose || '',
                      duration: p.medication.duration || '',
                      quantity: p.medication.quantity || 1,
                      refills: p.medication.refills ?? p.refills ?? 0,
                    },
                  ]
                : [];

          ingestPrescription({
            id: p.id!,
            title: p.title || `E-Prescription — ${medicines[0]?.name || 'Medication'}`,
            category: 'Pharmacy',
            dateLabel: p.dateLabel || 'Just now',
            wormLocked: p.wormLocked !== false,
            summary:
              p.summary ||
              p.instructions ||
              `Issued ${p.timestamp || 'just now'} by ${p.physician || p.prescribedBy || 'clinician'}.`,
            prescribedBy: p.physician || p.prescribedBy || 'Dr. Ananya Rao',
            medicines,
          });
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        const delay = Math.min(8000, 600 * 2 ** attempt);
        attempt += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [ingestPrescription]);

  const bookAppointment = useCallback(
    (input: Omit<Appointment, 'id' | 'status'> & { status?: VisitStatus }) => {
      const created: Appointment = {
        ...input,
        id: uid('apt'),
        status: input.status ?? 'upcoming',
      };
      setAppointments((prev) => [created, ...prev]);

      if (input.type === 'teleconsult' || input.type === 'home_visit') {
        void fetch(`${ENGINE_HTTP}/v1/clinical/appointments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ihs_uid: PATIENT_UID,
            type: input.type,
            clinician: input.clinician,
            when_label: input.whenLabel,
            when_iso: input.whenIso,
            notes: input.notes,
          }),
        }).catch(() => {
          /* engine optional while offline */
        });
      }

      return created;
    },
    [],
  );

  const cancelAppointment = useCallback((id: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' as const } : a)),
    );
  }, []);

  const rescheduleAppointment = useCallback((id: string, whenLabel: string, whenIso: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, whenLabel, whenIso, status: 'upcoming' } : a)),
    );
  }, []);

  const addVital = useCallback((input: Omit<VitalReading, 'id'>) => {
    setVitals((prev) => [{ ...input, id: uid('v') }, ...prev]);
  }, []);

  const addFamilyMember = useCallback((input: Omit<FamilyMember, 'id'>) => {
    setFamily((prev) => [...prev, { ...input, id: uid('f') }]);
  }, []);

  const removeFamilyMember = useCallback((id: string) => {
    setFamily((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const getPrescription = useCallback(
    (id: string) => vaultRecords.find((r) => r.id === id && !!r.medicines?.length),
    [vaultRecords],
  );

  const placeMedicineOrder = useCallback(
    (input: { prescriptionId: string; address: string }) => {
      const rx = vaultRecords.find((r) => r.id === input.prescriptionId);
      if (!rx?.medicines?.length) {
        throw new Error('Prescription not found or has no medicines.');
      }
      const totalInr = rx.medicines.reduce((sum, m) => sum + m.quantity * 12, 0) + 49;
      const created: MedicineOrder = {
        id: uid('rxo'),
        prescriptionId: rx.id,
        prescriptionTitle: rx.title,
        medicines: rx.medicines,
        address: input.address,
        placedAt: new Date().toLocaleString(),
        status: 'placed',
        etaLabel: 'Doorstep in 90–120 min',
        totalInr,
      };
      setMedicineOrders((prev) => [created, ...prev]);
      return created;
    },
    [vaultRecords],
  );

  const value = useMemo(
    () => ({
      appointments,
      vaultRecords,
      vitals,
      family,
      carePlan,
      medicineOrders,
      bookAppointment,
      cancelAppointment,
      rescheduleAppointment,
      addVital,
      addFamilyMember,
      removeFamilyMember,
      placeMedicineOrder,
      getPrescription,
      ingestPrescription,
    }),
    [
      appointments,
      vaultRecords,
      vitals,
      family,
      carePlan,
      medicineOrders,
      bookAppointment,
      cancelAppointment,
      rescheduleAppointment,
      addVital,
      addFamilyMember,
      removeFamilyMember,
      placeMedicineOrder,
      getPrescription,
      ingestPrescription,
    ],
  );

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
};

export function useCare(): CareContextValue {
  const ctx = useContext(CareContext);
  if (!ctx) {
    throw new Error('useCare must be used within CareProvider');
  }
  return ctx;
}
