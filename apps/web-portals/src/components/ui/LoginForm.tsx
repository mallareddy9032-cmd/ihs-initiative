// ============================================================================
// FILE: src/components/ui/LoginForm.tsx
// CONTEXT: Next.js - Strict UID & PIN Authentication
// ============================================================================

'use client';

import React, { useState } from 'react';

export const LoginForm: React.FC<{
  onAuthenticate: (uid: string, pin: string) => Promise<void>;
}> = ({ onAuthenticate }) => {
  const [uid, setUid] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sanitizeUid = (raw: string) =>
    raw
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 20);

  const sanitizePin = (raw: string) => raw.replace(/\D/g, '').slice(0, 6);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await onAuthenticate(uid, pin);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed. Verify credentials.';
      setError(message);
      setPin(''); // Force PIN re-entry on failure
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-black/5 rounded-[28px] shadow-[0_10px_30px_rgba(0,0,0,0.03)] p-8 text-[#1C1C1E]">
      <h2 className="text-2xl font-black tracking-wide text-center mb-6 border-b border-black/5 pb-4">
        IHS SECURE LOGIN
      </h2>

      {error && (
        <div
          role="alert"
          className="bg-[#FF2D55]/10 border border-[#FF2D55]/30 text-[#FF2D55] p-3 rounded-2xl mb-6 text-sm font-bold text-center"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-bold text-[#8E8E93] mb-2 uppercase tracking-wide">
            Operator UID
          </label>
          <input
            type="text"
            placeholder="e.g., DSP-0442"
            required
            autoComplete="username"
            className="w-full bg-[#F2F2F7] border border-black/5 rounded-2xl p-3 text-[#1C1C1E] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 uppercase"
            value={uid}
            onChange={(e) => setUid(sanitizeUid(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[#8E8E93] mb-2 uppercase tracking-wide">
            Secure PIN
          </label>
          <input
            type="password"
            placeholder="••••••"
            maxLength={6}
            required
            inputMode="numeric"
            autoComplete="current-password"
            className="w-full bg-[#F2F2F7] border border-black/5 rounded-2xl p-3 text-[#1C1C1E] text-center tracking-[1em] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20"
            value={pin}
            onChange={(e) => setPin(sanitizePin(e.target.value))}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || uid.length < 4 || pin.length < 4}
          className="w-full bg-[#007AFF] hover:bg-[#0066d6] disabled:bg-[#F2F2F7] disabled:text-[#8E8E93] text-white font-bold py-4 rounded-2xl transition-colors tracking-wide ios-press"
        >
          {isLoading ? 'Authenticating...' : 'Access Console'}
        </button>

        <p className="text-center text-xs text-[#8E8E93] pt-2">
          Demo dispatcher: <span className="text-[#1C1C1E] font-mono">DSP-0442</span> / PIN{' '}
          <span className="text-[#1C1C1E] font-mono">123456</span>
        </p>
      </form>
    </div>
  );
};
