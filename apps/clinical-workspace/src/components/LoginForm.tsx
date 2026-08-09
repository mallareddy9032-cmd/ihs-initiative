'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  buildLoginRequest,
  isValidPinFormat,
  isValidUidFormat,
  LOCAL_DEV_PHYSICIAN_UID,
  normalizeUid,
} from '@ihs/auth-client';
import { SpotlightCard, SpringButton } from '@/components/ui/motion';

type LoginSuccessPayload = {
  success?: boolean;
  error?: string;
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

export function LoginForm({ surfaceLabel }: { surfaceLabel: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uid, setUid] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const body = buildLoginRequest(uid, pin);
      let { res, data } = await postLogin(body);

      if (!res.ok || !data.success) {
        ({ res, data } = await postLogin({ ...body, local_fallback: true }));
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Verify credentials.');
      }

      const callback = searchParams.get('callbackUrl') || '/';
      router.replace(callback.startsWith('/') ? callback : '/');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      if (
        normalizeUid(uid) === LOCAL_DEV_PHYSICIAN_UID &&
        isCloudUnreachableError(message)
      ) {
        setError('Unable to establish local clinical session. Use DOC-101 with PIN 123456.');
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
    <SpotlightCard className="w-full max-w-md !rounded-3xl">
      <p className="ihs-micro text-center">Clinical Desk</p>
      <h1 className="mt-2 text-center font-serif text-3xl text-[#0F172A]">{surfaceLabel}</h1>
      <p className="mt-2 text-center text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
        Clinician UID · PIN
      </p>
      <p className="mt-3 text-center text-xs text-[#4B5563]">
        Local pilot: <span className="font-mono text-[#143525]">DOC-101 / 123456</span>
      </p>

      {error ? (
        <div
          className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-center text-sm font-semibold text-rose-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <label className="ihs-micro block">
          Clinician UID
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="e.g., DOC-101"
            className="ihs-input uppercase"
            value={uid}
            onChange={(e) => setUid(e.target.value.toUpperCase())}
          />
        </label>

        <label className="ihs-micro block">
          Secure PIN
          <input
            type="password"
            required
            inputMode="numeric"
            maxLength={6}
            autoComplete="current-password"
            placeholder="••••••"
            className="ihs-input text-center tracking-[0.4em]"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </label>

        <SpringButton type="submit" disabled={!canSubmit} className="w-full">
          {loading ? 'Authenticating…' : 'Enter Workspace'}
        </SpringButton>
      </form>
    </SpotlightCard>
  );
}
