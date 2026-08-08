'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildLoginRequest, isValidPinFormat, isValidUidFormat, normalizeUid } from '@ihs/auth-client';

export function LoginForm({ surfaceLabel }: { surfaceLabel: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uid, setUid] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = buildLoginRequest(uid, pin);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Verify credentials.');
      }
      const callback = searchParams.get('callbackUrl') || '/';
      router.replace(callback.startsWith('/') ? callback : '/');
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setError(message);
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
        Secure UID · PIN Login
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
          Patient UID
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="e.g., IHS-8802"
            className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-3 uppercase text-ihs-text outline-none focus:border-ihs-olive"
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
            className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-3 text-center tracking-[0.4em] text-ihs-text outline-none focus:border-ihs-olive"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="ios-press w-full rounded-xl bg-ihs-olive px-4 py-3 text-sm font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:bg-ihs-elevated disabled:text-ihs-muted"
        >
          {loading ? 'Authenticating…' : 'Open Vault'}
        </button>
      </form>
    </div>
  );
}
