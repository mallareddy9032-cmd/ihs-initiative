// ============================================================================
// FILE: src/app/login/page.tsx
// CONTEXT: Public authentication entry point
// ============================================================================

'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/ui/LoginForm';
import { AuthApi } from '@/services/api';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleAuthenticate = async (uid: string, pin: string) => {
    const result = await AuthApi.login(uid, pin);

    const callbackUrl = searchParams.get('callbackUrl');
    if (callbackUrl && callbackUrl.startsWith('/')) {
      router.replace(callbackUrl);
      return;
    }

    if (result.operator.role === 'PHYSICIAN') {
      router.replace('/physician/console');
    } else {
      router.replace('/dispatcher/dashboard');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#F2F2F7] px-4">
      <div className="mb-8 text-center">
        <div className="inline-block bg-[#FF2D55] text-white font-black px-4 py-2 rounded-2xl tracking-widest text-sm mb-4">
          IHS
        </div>
        <p className="text-[#8E8E93] text-sm font-mono">AP-SOUTH-2 · Operator Access</p>
      </div>

      <LoginForm onAuthenticate={handleAuthenticate} />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F2F2F7] text-[#1C1C1E] font-mono">
          Loading secure login…
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
