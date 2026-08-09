import { SignJWT } from 'jose';
import {
  AUTH_ALGORITHMS,
  AUTH_TTL_SECONDS,
  LOCAL_DEV_JWT_SECRET,
  LOCAL_DEV_PATIENT_UID,
  LOCAL_DEV_PHYSICIAN_PIN,
  LOCAL_DEV_PHYSICIAN_UID,
  LOCAL_DEV_PHYSICIAN_UID_ALT,
  LOCAL_DEV_PHYSICIAN_PIN_ALT,
  LOCAL_DEV_SUPER_ADMIN_UID,
} from './constants';
import { isValidPinFormat, normalizeUid } from './credentials';

export const LOCAL_DEV_SUPER_ADMIN_SCOPES = [
  'superadmin:tenant:write',
  'ops:dispatch:read',
] as const;

export function isLocalDevSuperAdminLogin(uid: string, pin: string): boolean {
  return (
    normalizeUid(uid) === LOCAL_DEV_SUPER_ADMIN_UID &&
    /^\d{6}$/.test(pin) &&
    isValidPinFormat(pin)
  );
}

/**
 * Issues a mock Super_Admin session for local development / unreachable Cloud Engine.
 * Claims: role Super_Admin, scopes superadmin:tenant:write + ops:dispatch:read, AAL2.
 */
export async function mintLocalDevSuperAdminToken(
  secret: string = LOCAL_DEV_JWT_SECRET,
): Promise<string> {
  if (!secret) {
    throw new Error('Cannot mint local development session without a JWT secret.');
  }

  const scopes = [...LOCAL_DEV_SUPER_ADMIN_SCOPES];
  const key = new TextEncoder().encode(secret);

  return new SignJWT({
    role: 'Super_Admin',
    name: 'Local Super Admin',
    ihs_uid: LOCAL_DEV_SUPER_ADMIN_UID,
    scopes,
    scope: scopes.join(' '),
    aal: 'AAL2',
    acr: 'AAL2',
  })
    .setProtectedHeader({ alg: AUTH_ALGORITHMS[0] })
    .setSubject(LOCAL_DEV_SUPER_ADMIN_UID)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TTL_SECONDS}s`)
    .sign(key);
}

type LocalPhysicianAccount = {
  uid: string;
  pin: string;
  name: string;
};

const LOCAL_PHYSICIANS: readonly LocalPhysicianAccount[] = [
  {
    uid: LOCAL_DEV_PHYSICIAN_UID,
    pin: LOCAL_DEV_PHYSICIAN_PIN,
    name: 'Dr. Ananya Rao',
  },
  {
    uid: LOCAL_DEV_PHYSICIAN_UID_ALT,
    pin: LOCAL_DEV_PHYSICIAN_PIN_ALT,
    name: 'Dr. Ananya Rao',
  },
];

export function isLocalDevPhysicianLogin(uid: string, pin: string): boolean {
  const normalized = normalizeUid(uid);
  if (!/^\d{6}$/.test(pin) || !isValidPinFormat(pin)) return false;
  return LOCAL_PHYSICIANS.some((account) => account.uid === normalized && account.pin === pin);
}

export function resolveLocalDevPhysician(uid: string): LocalPhysicianAccount | null {
  const normalized = normalizeUid(uid);
  return LOCAL_PHYSICIANS.find((account) => account.uid === normalized) ?? null;
}

/** Issues a mock PHYSICIAN session for Clinical Workspace local pilot. */
export async function mintLocalDevPhysicianToken(
  uid: string = LOCAL_DEV_PHYSICIAN_UID,
  secret: string = LOCAL_DEV_JWT_SECRET,
): Promise<string> {
  if (!secret) {
    throw new Error('Cannot mint local physician session without a JWT secret.');
  }

  const account = resolveLocalDevPhysician(uid) ?? LOCAL_PHYSICIANS[0];
  const key = new TextEncoder().encode(secret);

  return new SignJWT({
    role: 'PHYSICIAN',
    name: account.name,
    ihs_uid: account.uid,
    aal: 'AAL1',
    acr: 'AAL1',
  })
    .setProtectedHeader({ alg: AUTH_ALGORITHMS[0] })
    .setSubject(account.uid)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TTL_SECONDS}s`)
    .sign(key);
}

export function isLocalDevPatientLogin(uid: string, pin: string): boolean {
  return (
    normalizeUid(uid) === LOCAL_DEV_PATIENT_UID &&
    pin === LOCAL_DEV_PHYSICIAN_PIN &&
    isValidPinFormat(pin)
  );
}

/** Issues a mock PATIENT session for Patient Portal local pilot. */
export async function mintLocalDevPatientToken(
  secret: string = LOCAL_DEV_JWT_SECRET,
): Promise<string> {
  if (!secret) {
    throw new Error('Cannot mint local patient session without a JWT secret.');
  }

  const key = new TextEncoder().encode(secret);

  return new SignJWT({
    role: 'PATIENT',
    name: 'Lakshmi R.',
    ihs_uid: LOCAL_DEV_PATIENT_UID,
    aal: 'AAL1',
    acr: 'AAL1',
  })
    .setProtectedHeader({ alg: AUTH_ALGORITHMS[0] })
    .setSubject(LOCAL_DEV_PATIENT_UID)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TTL_SECONDS}s`)
    .sign(key);
}
