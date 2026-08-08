'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { SpotlightCard, SpringButton, springSoft } from '@/components/ui/motion';

function StepUpMfaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [method, setMethod] = useState<'totp' | 'webauthn'>('totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl = useMemo(() => {
    const raw = searchParams.get('callbackUrl') || '/admin/super';
    return raw.startsWith('/') ? raw : '/admin/super';
  }, [searchParams]);

  const reason = searchParams.get('reason');
  const reasonCopy =
    reason === 'scope'
      ? 'Your session is missing the superadmin:tenant:write scope.'
      : 'Super Admin mutations require Authenticator Assurance Level 3 (AAL3).';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          code: method === 'totp' ? code : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Step-up verification failed.');
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Step-up verification failed.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const onWebAuthn = async () => {
    setMethod('webauthn');
    setError(null);
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      const res = await fetch('/api/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'webauthn' }),
      });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Hardware key verification failed.');
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hardware key verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SpotlightCard className="w-full max-w-md p-8">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
        Step-Up MFA · AAL3
      </p>
      <h1 className="mt-2 text-center font-serif text-3xl text-ihs-text">Verify Privileged Access</h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-ihs-muted">{reasonCopy}</p>

      {error ? (
        <div
          className="mt-5 rounded-xl border border-ihs-danger/50 bg-ihs-danger/15 px-3 py-3 text-center text-sm font-semibold text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="relative mt-6 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/35 p-1">
        <motion.div
          className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-lg bg-ihs-olive shadow-glow"
          animate={{ left: method === 'totp' ? 4 : 'calc(50% + 0px)' }}
          transition={springSoft}
          aria-hidden
        />
        <button
          type="button"
          className={`relative z-[1] rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider ${
            method === 'totp' ? 'text-white' : 'text-ihs-muted'
          }`}
          onClick={() => setMethod('totp')}
        >
          TOTP
        </button>
        <button
          type="button"
          className={`relative z-[1] rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider ${
            method === 'webauthn' ? 'text-white' : 'text-ihs-muted'
          }`}
          onClick={() => setMethod('webauthn')}
        >
          Hardware Key
        </button>
      </div>

      {method === 'totp' ? (
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <label className="block text-xs font-bold uppercase tracking-wide text-ihs-muted">
            Authenticator Code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-center font-mono text-lg tracking-[0.35em] text-ihs-text outline-none focus:border-ihs-mint/50"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </label>
          <SpringButton
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-xl bg-ihs-olive px-4 py-3 text-sm font-bold uppercase tracking-widest text-white shadow-glow disabled:cursor-not-allowed disabled:bg-ihs-elevated disabled:text-ihs-muted disabled:shadow-none"
          >
            {loading ? 'Verifying…' : 'Elevate to AAL3'}
          </SpringButton>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-sm leading-relaxed text-ihs-muted">
            Insert or tap your registered security key. This pilot path simulates WebAuthn assertion
            and then mints an AAL3 session with{' '}
            <code className="text-ihs-mint">superadmin:tenant:write</code>.
          </p>
          <SpringButton
            type="button"
            disabled={loading}
            onClick={() => void onWebAuthn()}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold uppercase tracking-widest text-ihs-text disabled:opacity-60"
          >
            {loading ? 'Waiting for key…' : 'Use Hardware Security Key'}
          </SpringButton>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ihs-muted">
        Return to{' '}
        <Link href="/" className="text-ihs-mint underline-offset-2 hover:underline">
          Operations Hub
        </Link>
      </p>
    </SpotlightCard>
  );
}

export default function StepUpMfaPage() {
  return (
    <div className="ambient-spot flex min-h-screen items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-sm text-ihs-muted">Preparing step-up challenge…</div>}>
        <StepUpMfaForm />
      </Suspense>
    </div>
  );
}
