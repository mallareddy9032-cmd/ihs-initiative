import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="ambient-spot flex min-h-screen items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-sm text-ihs-muted">Loading secure login…</div>}>
        <LoginForm surfaceLabel="IHS Patient Vault" />
      </Suspense>
    </div>
  );
}
