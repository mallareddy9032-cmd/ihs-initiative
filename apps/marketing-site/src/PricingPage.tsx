import { useMemo, useState } from 'react';

const PATIENT_VAULT =
  import.meta.env.VITE_PATIENT_VAULT_URL?.trim() || 'http://localhost:3000';
const CLINICAL =
  import.meta.env.VITE_CLINICAL_URL?.trim() || 'http://localhost:3002';
const CONTACT_EMAIL = 'mailto:contact@IHSGlobalservices.com?subject=Enterprise%20Ops%20Quote';

type Interval = 'monthly' | 'annual';

type PlanCard = {
  id: string;
  name: string;
  tagline: string;
  monthly: number | null;
  annual: number | null;
  seat: string;
  cta: string;
  href: string;
  featured?: boolean;
  custom?: boolean;
  highlights: string[];
};

const PLANS: PlanCard[] = [
  {
    id: 'essential',
    name: 'Patient Essential',
    tagline: 'Individual Vault + Standard Tele-Triage',
    monthly: 199,
    annual: 1910,
    seat: '1 patient',
    cta: 'Start Essential',
    href: `${PATIENT_VAULT}/settings/billing`,
    highlights: ['5 GB Encrypted Vault', 'Standard Tele-Triage', 'GST invoices'],
  },
  {
    id: 'shield',
    name: 'Patient Shield',
    tagline: 'Up to 6 Family Members + Priority P1 Dispatch + 50GB Vault',
    monthly: 499,
    annual: 4790,
    seat: 'Up to 6 family',
    cta: 'Upgrade to Shield',
    href: `${PATIENT_VAULT}/settings/billing`,
    featured: true,
    highlights: ['50 GB Family Vault', 'Priority P1 Dispatch', '6 family seats'],
  },
  {
    id: 'clinical',
    name: 'Clinical Pro',
    tagline: 'Full EHR SOAP Charting + e-Rx Engine + Patient Queue',
    monthly: 1499,
    annual: 14390,
    seat: 'Per doctor / mo',
    cta: 'Activate Clinical Pro',
    href: `${CLINICAL}/settings/subscription`,
    highlights: ['SOAP Charting', 'e-Rx Engine (500/mo)', 'Consultation Queue'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Ops',
    tagline: 'Full GIS Dispatch HUD + Sub-30s SLA + Fleet ERP',
    monthly: null,
    annual: null,
    seat: 'Tenant license',
    cta: 'Request Quote',
    href: CONTACT_EMAIL,
    custom: true,
    highlights: ['GIS Dispatch HUD', 'Sub-30s SLA', 'Fleet ERP seats'],
  },
];

const MATRIX = [
  {
    feature: 'Vault Storage Caps',
    essential: '5 GB',
    shield: '50 GB',
    clinical: '100 GB',
    enterprise: '1 TB',
  },
  {
    feature: 'Emergency SLAs',
    essential: 'Standard (~15m ack)',
    shield: 'Priority P1 (~5m)',
    clinical: 'Clinical queue',
    enterprise: 'Sub-30s SLA',
  },
  {
    feature: 'SOAP Charting',
    essential: '—',
    shield: '—',
    clinical: 'Full EHR SOAP',
    enterprise: 'Multi-clinic SOAP',
  },
  {
    feature: 'Dispatch seats',
    essential: '—',
    shield: 'Priority routing',
    clinical: '—',
    enterprise: '40 fleet units',
  },
] as const;

function formatInr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export function PricingPage() {
  const [interval, setInterval] = useState<Interval>('monthly');

  const priceLabel = useMemo(() => {
    return (plan: PlanCard) => {
      if (plan.custom) return 'Custom Quote';
      const value = interval === 'annual' ? plan.annual : plan.monthly;
      if (value == null) return 'Custom Quote';
      return interval === 'annual' ? `${formatInr(value)}/yr` : `${formatInr(value)}/mo`;
    };
  }, [interval]);

  return (
    <div className="pricing-page">
      <header className="pricing-nav">
        <div className="pricing-nav-inner">
          <a href="/" className="pricing-brand">
            <span className="pricing-mark">IHS</span>
            <span>
              <strong>IHS Initiative</strong>
              <small>Clinical Bio-Tech · Pricing</small>
            </span>
          </a>
          <nav aria-label="Pricing">
            <a href="/">Home</a>
            <a href="#compare">Compare</a>
            <a href={PATIENT_VAULT}>Patient Vault</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="pricing-hero">
          <p className="pricing-eyebrow">Commercial care grid</p>
          <h1>Plans built for vault, clinic, and fleet.</h1>
          <p className="pricing-lead">
            GST-inclusive list pricing for the Ananthapuramu pilot. Checkout shows the 18% GST
            breakdown with HSN/SAC 998313.
          </p>

          <div className="billing-toggle" role="group" aria-label="Billing interval">
            <button
              type="button"
              className={interval === 'monthly' ? 'is-active' : undefined}
              onClick={() => setInterval('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={interval === 'annual' ? 'is-active' : undefined}
              onClick={() => setInterval('annual')}
            >
              Annual
            </button>
            {interval === 'annual' ? (
              <span className="savings-badge">20% OFF — Annual Savings</span>
            ) : null}
          </div>
        </section>

        <section className="pricing-bento" aria-label="Pricing plans">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`pricing-card${plan.featured ? ' is-featured' : ''}`}
            >
              {plan.featured ? <span className="featured-pill">Most chosen</span> : null}
              <h2>{plan.name}</h2>
              <p className="plan-tagline">{plan.tagline}</p>
              <p className="plan-price">{priceLabel(plan)}</p>
              <p className="plan-seat">{plan.seat}</p>
              <p className="gst-note">+ 18% GST applicable at checkout</p>
              <ul>
                {plan.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <a className="pricing-cta" href={plan.href}>
                {plan.cta}
              </a>
            </article>
          ))}
        </section>

        <section className="pricing-matrix" id="compare">
          <div className="matrix-sticky">
            <h2>Feature comparison</h2>
            <p>Vault caps, emergency SLAs, SOAP charting, and dispatch seats across tiers.</p>
          </div>
          <div className="matrix-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Capability</th>
                  <th scope="col">Essential</th>
                  <th scope="col">Shield</th>
                  <th scope="col">Clinical Pro</th>
                  <th scope="col">Enterprise Ops</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.feature}>
                    <th scope="row">{row.feature}</th>
                    <td>{row.essential}</td>
                    <td>{row.shield}</td>
                    <td>{row.clinical}</td>
                    <td>{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
