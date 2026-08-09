'use client';

import { useState } from 'react';
import { SpringButton } from '@/components/ui/motion';
import type { BillingInterval, PlanTier } from '@ihs/types';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function RazorpayCheckoutButton({
  planTier,
  interval = 'monthly',
  userId = 'IHS-8802',
  label = 'Subscribe',
  onComplete,
}: {
  planTier: PlanTier;
  interval?: BillingInterval;
  userId?: string;
  label?: string;
  onComplete?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const startCheckout = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier, interval, userId }),
      });
      const data = (await res.json()) as {
        error?: string;
        checkout?: {
          keyId: string;
          subscriptionId: string;
          amountPaise: number;
          currency: string;
          name: string;
          description: string;
          mock: boolean;
          notes: Record<string, string>;
        };
        message?: string;
      };
      if (!res.ok || !data.checkout) {
        throw new Error(data.error || 'Checkout failed.');
      }

      if (data.checkout.mock) {
        setMessage(data.message || 'Pilot subscription activated (mock Razorpay).');
        onComplete?.();
        return;
      }

      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        throw new Error('Unable to load Razorpay Checkout.');
      }

      const rzp = new window.Razorpay({
        key: data.checkout.keyId,
        subscription_id: data.checkout.subscriptionId,
        name: data.checkout.name,
        description: data.checkout.description,
        currency: data.checkout.currency,
        notes: data.checkout.notes,
        theme: { color: '#143525' },
        modal: { backdropclose: true },
        handler: () => {
          setMessage('Payment authenticated. Entitlements syncing…');
          onComplete?.();
        },
      });
      rzp.open();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <SpringButton type="button" disabled={loading} onClick={() => void startCheckout()} className="w-full">
        {loading ? 'Opening checkout…' : label}
      </SpringButton>
      {message ? (
        <p className="text-xs font-semibold text-[#143525]">{message}</p>
      ) : (
        <p className="text-[11px] text-[#4B5563]">
          UPI AutoPay · Cards · NetBanking · +18% GST shown at checkout
        </p>
      )}
    </div>
  );
}
