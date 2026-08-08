import { createHash, randomUUID } from 'crypto';
import type {
  ClinicalChart,
  ClinicalChartWithRx,
  DispatchRecord,
  EPrescription,
  Patient,
  TriageCase,
  TriageCaseWithDispatch,
  TriageServiceType,
  VaultObject,
} from './types';

function now(): Date {
  return new Date();
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

type MockStore = {
  patients: Patient[];
  vaultObjects: VaultObject[];
  triageCases: TriageCase[];
  dispatchRecords: DispatchRecord[];
  clinicalCharts: ClinicalChart[];
  prescriptions: EPrescription[];
};

function seedStore(): MockStore {
  const patientId = 'pat-local-8802';
  const triageId = 'triage-local-1001';
  const stamp = now();

  const patient: Patient = {
    id: patientId,
    ihsUid: 'IHS-8802',
    firstName: 'Lakshmi',
    lastName: 'Reddy',
    phone: '+919032600410',
    homeLat: 14.6819,
    homeLng: 77.6006,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const triage: TriageCase = {
    id: triageId,
    patientId,
    ihsUid: patient.ihsUid,
    serviceType: 'EMERGENCY',
    status: 'DISPATCHED',
    priority: 'P1',
    sector: 'Ananthapur Urban',
    latitude: 14.6891,
    longitude: 77.6072,
    notes: 'Chest pain · ALS standby requested',
    createdAt: stamp,
    updatedAt: stamp,
  };

  const dispatch: DispatchRecord = {
    id: 'dispatch-local-1001',
    triageCaseId: triageId,
    fleetId: 'AP-02-EX-2214',
    callsign: 'ALS-ANP-02',
    status: 'EN_ROUTE',
    lat: 14.6924,
    lng: 77.6011,
    etaMins: 4,
    lastTelemetryAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
  };

  return {
    patients: [patient],
    vaultObjects: [
      {
        id: 'vault-local-1',
        patientId,
        title: 'Baseline ECG Summary',
        mimeType: 'application/json',
        ciphertext: Buffer.from('{"hr":78,"rhythm":"sinus"}').toString('base64'),
        iv: 'local-dev-iv',
        integrityHash: sha256('{"hr":78,"rhythm":"sinus"}'),
        createdAt: stamp,
      },
    ],
    triageCases: [triage],
    dispatchRecords: [dispatch],
    clinicalCharts: [],
    prescriptions: [],
  };
}

const globalStore = globalThis as typeof globalThis & {
  __IHS_DB_MOCK__?: MockStore;
};

function store(): MockStore {
  if (!globalStore.__IHS_DB_MOCK__) {
    globalStore.__IHS_DB_MOCK__ = seedStore();
  }
  return globalStore.__IHS_DB_MOCK__;
}

function ensurePatient(ihsUid: string): Patient {
  const db = store();
  const existing = db.patients.find((p) => p.ihsUid === ihsUid);
  if (existing) return existing;
  const stamp = now();
  const created: Patient = {
    id: randomUUID(),
    ihsUid,
    firstName: 'Pilot',
    lastName: 'Patient',
    phone: null,
    homeLat: 14.6819,
    homeLng: 77.6006,
    createdAt: stamp,
    updatedAt: stamp,
  };
  db.patients.push(created);
  return created;
}

export type IhsDbClient = {
  mode: 'mock' | 'prisma';
  patient: {
    findUnique: (args: { where: { ihsUid: string } }) => Promise<Patient | null>;
    upsertByUid: (args: {
      ihsUid: string;
      firstName?: string;
      lastName?: string;
    }) => Promise<Patient>;
  };
  vaultObject: {
    findMany: (args: { where: { patientId: string } }) => Promise<VaultObject[]>;
    create: (args: {
      data: Omit<VaultObject, 'id' | 'createdAt'> & { id?: string };
    }) => Promise<VaultObject>;
  };
  triageCase: {
    create: (args: {
      data: {
        ihsUid: string;
        serviceType: TriageServiceType;
        priority?: string;
        sector?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        notes?: string | null;
        autoDispatch?: boolean;
      };
    }) => Promise<TriageCaseWithDispatch>;
    findManyWithDispatch: () => Promise<TriageCaseWithDispatch[]>;
    findUnique: (args: { where: { id: string } }) => Promise<TriageCaseWithDispatch | null>;
  };
  dispatchRecord: {
    findMany: () => Promise<DispatchRecord[]>;
    touchTelemetry: (args: {
      id: string;
      lat: number;
      lng: number;
      etaMins?: number | null;
      status?: DispatchRecord['status'];
    }) => Promise<DispatchRecord | null>;
  };
  clinicalChart: {
    create: (args: {
      data: {
        patientIhsUid: string;
        triageCaseId?: string | null;
        clinicianUid: string;
        subjective: string;
        objective: string;
        assessment: string;
        plan: string;
        prescriptions?: Array<{
          drugName: string;
          dosage: string;
          duration: string;
          instructions?: string | null;
        }>;
      };
    }) => Promise<ClinicalChartWithRx>;
    findMany: (args?: { where?: { clinicianUid?: string } }) => Promise<ClinicalChartWithRx[]>;
  };
};

export function createMockDbClient(): IhsDbClient {
  return {
    mode: 'mock',
    patient: {
      async findUnique({ where }) {
        return store().patients.find((p) => p.ihsUid === where.ihsUid) ?? null;
      },
      async upsertByUid({ ihsUid, firstName, lastName }) {
        const existing = ensurePatient(ihsUid);
        if (firstName) existing.firstName = firstName;
        if (lastName) existing.lastName = lastName;
        existing.updatedAt = now();
        return existing;
      },
    },
    vaultObject: {
      async findMany({ where }) {
        return store()
          .vaultObjects.filter((v) => v.patientId === where.patientId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      },
      async create({ data }) {
        const row: VaultObject = {
          id: data.id ?? randomUUID(),
          patientId: data.patientId,
          title: data.title,
          mimeType: data.mimeType,
          ciphertext: data.ciphertext,
          iv: data.iv,
          integrityHash: data.integrityHash,
          createdAt: now(),
        };
        store().vaultObjects.push(row);
        return row;
      },
    },
    triageCase: {
      async create({ data }) {
        const patient = ensurePatient(data.ihsUid);
        const stamp = now();
        const triage: TriageCase = {
          id: randomUUID(),
          patientId: patient.id,
          ihsUid: patient.ihsUid,
          serviceType: data.serviceType,
          status: data.autoDispatch === false ? 'QUEUED' : 'DISPATCHED',
          priority: data.priority ?? (data.serviceType === 'EMERGENCY' ? 'P1' : 'P2'),
          sector: data.sector ?? 'Ananthapur Urban',
          latitude: data.latitude ?? patient.homeLat,
          longitude: data.longitude ?? patient.homeLng,
          notes: data.notes ?? null,
          createdAt: stamp,
          updatedAt: stamp,
        };
        store().triageCases.push(triage);

        let dispatch: DispatchRecord | null = null;
        if (data.autoDispatch !== false) {
          dispatch = {
            id: randomUUID(),
            triageCaseId: triage.id,
            fleetId: 'AP-02-EX-2214',
            callsign: 'ALS-ANP-02',
            status: 'ASSIGNED',
            lat: (triage.latitude ?? patient.homeLat) + 0.004,
            lng: (triage.longitude ?? patient.homeLng) - 0.003,
            etaMins: data.serviceType === 'EMERGENCY' ? 5 : 18,
            lastTelemetryAt: stamp,
            createdAt: stamp,
            updatedAt: stamp,
          };
          store().dispatchRecords.push(dispatch);
        }

        return {
          ...triage,
          dispatch,
          patient: {
            id: patient.id,
            ihsUid: patient.ihsUid,
            firstName: patient.firstName,
            lastName: patient.lastName,
          },
        };
      },
      async findManyWithDispatch() {
        const db = store();
        return db.triageCases
          .map((triage) => {
            const patient = db.patients.find((p) => p.id === triage.patientId);
            const dispatch = db.dispatchRecords.find((d) => d.triageCaseId === triage.id) ?? null;
            return {
              ...triage,
              dispatch,
              patient: patient
                ? {
                    id: patient.id,
                    ihsUid: patient.ihsUid,
                    firstName: patient.firstName,
                    lastName: patient.lastName,
                  }
                : undefined,
            };
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      },
      async findUnique({ where }) {
        const rows = await this.findManyWithDispatch();
        return rows.find((row) => row.id === where.id) ?? null;
      },
    },
    dispatchRecord: {
      async findMany() {
        return [...store().dispatchRecords].sort(
          (a, b) => b.lastTelemetryAt.getTime() - a.lastTelemetryAt.getTime(),
        );
      },
      async touchTelemetry({ id, lat, lng, etaMins, status }) {
        const row = store().dispatchRecords.find((d) => d.id === id);
        if (!row) return null;
        row.lat = lat;
        row.lng = lng;
        if (typeof etaMins === 'number' || etaMins === null) row.etaMins = etaMins;
        if (status) row.status = status;
        row.lastTelemetryAt = now();
        row.updatedAt = now();
        return row;
      },
    },
    clinicalChart: {
      async create({ data }) {
        const patient = ensurePatient(data.patientIhsUid);
        const stamp = now();
        const chart: ClinicalChart = {
          id: randomUUID(),
          patientId: patient.id,
          triageCaseId: data.triageCaseId ?? null,
          clinicianUid: data.clinicianUid,
          subjective: data.subjective,
          objective: data.objective,
          assessment: data.assessment,
          plan: data.plan,
          createdAt: stamp,
          updatedAt: stamp,
        };
        store().clinicalCharts.push(chart);

        const prescriptions: EPrescription[] = (data.prescriptions ?? []).map((rx) => {
          const row: EPrescription = {
            id: randomUUID(),
            chartId: chart.id,
            drugName: rx.drugName,
            dosage: rx.dosage,
            duration: rx.duration,
            instructions: rx.instructions ?? null,
            issuedAt: stamp,
          };
          store().prescriptions.push(row);
          return row;
        });

        return { ...chart, prescriptions };
      },
      async findMany(args) {
        const db = store();
        return db.clinicalCharts
          .filter((chart) =>
            args?.where?.clinicianUid ? chart.clinicianUid === args.where.clinicianUid : true,
          )
          .map((chart) => ({
            ...chart,
            prescriptions: db.prescriptions.filter((rx) => rx.chartId === chart.id),
          }))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      },
    },
  };
}
