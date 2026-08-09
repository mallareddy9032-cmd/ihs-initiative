import { LOCAL_DEV_JWT_SECRET } from '@ihs/auth-client';

export function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET_KEY;
  if (configured && configured.trim().length > 0) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    return 'FATAL_UNCONFIGURED_SECRET';
  }
  return LOCAL_DEV_JWT_SECRET;
}

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
}

export function isLocalDevelopmentMode(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  const api = getApiBaseUrl();
  return api.includes('localhost') || api.includes('127.0.0.1');
}
