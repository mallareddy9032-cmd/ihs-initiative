'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  buildLoginRequest,
  isValidPinFormat,
  isValidUidFormat,
  LOCAL_DEV_SUPER_ADMIN_UID,
  normalizeUid,
} from '@ihs/auth-client';

type LoginSuccessPayload = {
  success?: boolean;
  error?: string;
  operator?: { uid?: string; role?: string };
  session?: {
    role?: string;
    aal?: string | number;
    source?: string;
  };
};

function isCloudUnreachableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('cloud engine unreachable') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed')
  );
}

function parseAal(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (value === 'AAL3' || value === '3') return 3;
  if (value === 'AAL2' || value === '2') return 2;
  return 1;
}

export function LoginForm({ surfaceLabel }: { surfaceLabel: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uid, setUid] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl = useMemo(() => {
    const raw = searchParams.get('callbackUrl');
    if (raw && raw.startsWith('/')) return raw;
    return null;
  }, [searchParams]);

  const resolveDestination = (data: LoginSuccessPayload, isSuperLocal: boolean): string => {
    const preferred = callbackUrl || (isSuperLocal ? '/admin/super' : '/');
    const role = data.operator?.role || data.session?.role;
    const aal = parseAal(data.session?.aal);
    const targetsSuper =
      preferred.startsWith('/admin/super') || preferred.startsWith('/api/super');

    if (role === 'Super_Admin' && aal < 3 && targetsSuper) {
      return `/auth/step-up?callbackUrl=${encodeURIComponent(preferred)}&reason=aal3`;
    }
    return preferred;
  };

  const postLogin = async (body: {
    ihs_uid: string;
    pin: string;
    local_fallback?: boolean;
  }): Promise<{ res: Response; data: LoginSuccessPayload }> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    let data: LoginSuccessPayload = {};
    try {
      data = (await res.json()) as LoginSuccessPayload;
    } catch {
      data = { error: 'Authentication response was not valid JSON.' };
    }
    return { res, data };
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const normalized = normalizeUid(uid);
      const isSuperLocal = normalized === LOCAL_DEV_SUPER_ADMIN_UID;
      const body = buildLoginRequest(uid, pin);

      // 1) Post only to the local Next.js auth endpoint.
      let { res, data } = await postLogin(body);

      // 2) SUPER-001: if the first attempt failed (e.g. Cloud Engine down), force local mock (__ihs_at).
      if (isSuperLocal && (!res.ok || !data.success)) {
        ({ res, data } = await postLogin({ ...body, local_fallback: true }));
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Verify credentials.');
      }

      // 3) Redirect to /admin/super or /auth/step-up — never show engine outage copy.
      router.replace(resolveDestination(data, isSuperLocal));
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      if (
        normalizeUid(uid) === LOCAL_DEV_SUPER_ADMIN_UID &&
        isCloudUnreachableError(message)
      ) {
        setError('Unable to establish local Super Admin session. Use SUPER-001 with a 6-digit PIN.');
      } else {
        setError(message);
      }
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    isValidUidFormat(normalizeUid(uid)) && isValidPinFormat(pin) && !loading;

  return (
    <div className="glass-panel w-full max-w-md rounded-2xl p-8">
      <h1 className="text-center font-serif text-2xl text-ihs-text">{surfaceLabel}</h1>
      <p className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-ihs-muted">
        Operator UID · PIN
      </p>

      {error ? (
        <div
          className="mt-6 rounded-lg border border-ihs-danger/50 bg-ihs-danger/15 px-3 py-3 text-center text-sm font-semibold text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <label className="block text-xs font-bold uppercase tracking-wide text-ihs-muted">
          Operator UID
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="e.g., SUPER-001"
            className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-3 uppercase text-ihs-text outline-none focus:border-ihs-warning"
            value={uid}
            onChange={(e) => setUid(e.target.value.toUpperCase())}
          />
        </label>

        <label className="block text-xs font-bold uppercase tracking-wide text-ihs-muted">
          Secure PIN
          <input
            type="password"
            required
            inputMode="numeric"
            maxLength={6}
            autoComplete="current-password"
            placeholder="••••••"
            className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-3 text-center tracking-[0.4em] text-ihs-text outline-none focus:border-ihs-warning"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="ios-press w-full rounded-xl bg-ihs-danger px-4 py-3 text-sm font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:bg-ihs-elevated disabled:text-ihs-muted"
        >
          {loading ? 'Authenticating…' : 'Access Command'}
        </button>
      </form>
    </div>
  );
}
