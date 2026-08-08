import type { IhsLoginRequest } from '@ihs/types';

const UID_PATTERN = /^[A-Z]{2,12}-[A-Z0-9]{2,16}$/;
const PIN_PATTERN = /^\d{4,6}$/;

export function normalizeUid(uid: string): string {
  return uid.trim().toUpperCase();
}

export function isValidUidFormat(uid: string): boolean {
  return UID_PATTERN.test(normalizeUid(uid));
}

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function buildLoginRequest(uid: string, pin: string): IhsLoginRequest {
  const ihs_uid = normalizeUid(uid);
  if (!isValidUidFormat(ihs_uid)) {
    throw new Error('Invalid Operator UID format. Expected PREFIX-IDENTIFIER (e.g., IHS-8802).');
  }
  if (!isValidPinFormat(pin)) {
    throw new Error('Secure PIN must be 4–6 digits.');
  }
  return { ihs_uid, pin };
}
