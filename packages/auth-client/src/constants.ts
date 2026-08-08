/** HTTP-only session cookie for Phase 2 Next.js apps (Operations Hub Super Admin). */
export const AUTH_COOKIE_NAME = '__ihs_at';

/** Matches Cloud Engine HS256 session TTL (12 hours). */
export const AUTH_TTL_SECONDS = 12 * 60 * 60;

export const AUTH_ALGORITHMS = ['HS256'] as const;

/**
 * Stable HS256 secret used only when JWT_SECRET_KEY is unset in local development.
 * Must match across login minting and Edge middleware verification.
 */
export const LOCAL_DEV_JWT_SECRET = 'IHS_LOCAL_DEV_JWT_SECRET_DO_NOT_USE_IN_PROD';

/** Local-development Super Admin operator UID (any 6-digit PIN). */
export const LOCAL_DEV_SUPER_ADMIN_UID = 'SUPER-001';
