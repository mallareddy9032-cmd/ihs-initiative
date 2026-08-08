export function getJwtSecret(): string {
  return process.env.JWT_SECRET_KEY || 'FATAL_UNCONFIGURED_SECRET';
}

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
}
