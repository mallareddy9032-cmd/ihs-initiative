import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { GeospatialRadar, PILOT_LOCATIONS } from './GeospatialRadar';
import { LiveImpactConsole } from './LiveImpactConsole';
import { CareAdvantageTable } from './CareAdvantageTable';

const PHONE_DISPLAY = '+91 9032600410';
const PHONE_TEL = 'tel:+919032600410';
const WHATSAPP =
  'https://wa.me/919032600410?text=Hello%20IHS%20Initiative,%20I%20would%20like%20to%20book%20care%20in%20the%20Ananthapuramu%20pilot%20zone.';
const EMAILS = ['bsc.consulting123@gmail.com', 'contact@IHSGlobalservices.com'] as const;
const PATIENT_VAULT =
  import.meta.env.VITE_PATIENT_VAULT_URL?.trim() || 'http://localhost:3000';

const SOCIAL_PLACEHOLDERS = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    title: 'IHS Initiative on LinkedIn — profile provisioning',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    title: 'IHS Initiative on Facebook — profile provisioning',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    title: 'IHS Initiative on Instagram — profile provisioning',
  },
] as const;

const NAV = [
  { id: 'features', label: 'Features' },
  { id: 'care', label: 'Synchronized Care' },
  { id: 'pilot', label: 'Pilot Zone' },
  { id: 'roi', label: 'ROI' },
  { id: 'advantage', label: 'Advantage' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'contact', label: 'Contact' },
] as const;

const PRICING_HREF = '/pricing';

const CARE_NODES = [
  {
    id: 'sos',
    orbit: 'inner' as const,
    angle: 0,
    icon: '🚨',
    short: 'SOS',
    color: '#DC2626',
    title: '1-Tap Emergency SOS & Vault',
    desc: 'Instant GPS telemetry & encrypted health history sync.',
  },
  {
    id: 'fleet',
    orbit: 'inner' as const,
    angle: 120,
    icon: '🛰️',
    short: 'Dispatch',
    color: '#0D5C4D',
    title: '24/7 Smart GPS Fleet Dispatch',
    desc: 'Locates and locks the nearest active ALS ambulance.',
  },
  {
    id: 'nav',
    orbit: 'inner' as const,
    angle: 240,
    icon: '🚑',
    short: 'ALS',
    color: '#6366F1',
    title: 'Live ALS Ambulance Navigation',
    desc: 'Turn-by-turn paramedic routing to patient doorstep.',
  },
  {
    id: 'er',
    orbit: 'outer' as const,
    angle: 40,
    icon: '🏥',
    short: 'ER',
    color: '#0284C7',
    title: 'Pre-Arrival ER & Trauma Bay',
    desc: 'Reserves hospital bed and streams vitals before arrival.',
  },
  {
    id: 'ops',
    orbit: 'outer' as const,
    angle: 160,
    icon: '📊',
    short: 'Ops',
    color: '#D97706',
    title: 'Regional Grid Operations',
    desc: '24/7 safety oversight & SLA compliance monitoring.',
  },
  {
    id: 'gp',
    orbit: 'outer' as const,
    angle: 280,
    icon: '🩺',
    short: 'Doctor',
    color: '#10B981',
    title: 'Verified Doctor & E-Rx Sync',
    desc: 'Doorstep GP visits & instant teleconsultations.',
  },
] as const;

const FAQ_CHIPS = [
  {
    q: 'How fast will an ambulance reach Dharmavaram or Gooty?',
    a: 'Within the Ananthapuramu 50km pilot radius, IHS targets sub-5-minute ALS dispatch acknowledgment with live ETA tracking. Exact arrival depends on the nearest active unit—typically aligning to our 4.3-minute on-scene target for covered mandals including Dharmavaram and Gooty.',
  },
  {
    q: 'Can I book a GP home visit for my elderly parents in Ananthapur?',
    a: 'Yes. From the Patient Vault, choose Home Doctor Visit, set the care address within Ananthapuramu or Sri Sathya Sai districts, and confirm. A verified MBBS clinician arrives with e-prescription sync to your family vault.',
  },
  {
    q: 'How does the 1-Tap SOS work?',
    a: 'Hold the SOS control in the Patient Vault for 1.5 seconds. IHS captures live GPS, opens a dispatch case, syncs vault medical history, and routes the nearest ALS ambulance while you watch ETA in real time.',
  },
  {
    q: 'What is covered under my family subscription?',
    a: 'Plans include emergency dispatch coordination, included teleconsults, doorstep GP visits within quota, and a centralized encrypted Health Vault for your family across the pilot zone.',
  },
  {
    q: 'Is my family medical vault encrypted?',
    a: 'Yes. Health Vault records use AES-256 encryption at rest and TLS 1.3 in transit, with integrity hashing (SHA-256) and access scoped by IHS UID. Only authenticated care teams on an active case can view relevant clinical context.',
  },
] as const;

function AppStoreBadge({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="store-badge ios-press" onClick={onClick} aria-label="Download on the App Store">
      <svg width="140" height="42" viewBox="0 0 140 42" fill="none" aria-hidden="true">
        <rect width="140" height="42" rx="8" fill="#1C1C1E" />
        <path
          d="M24.2 12.4c1.1-1.4 1.9-3.3 1.7-5.2-1.6.1-3.6 1.1-4.7 2.5-1.1 1.2-2 3.2-1.7 5 .1 0 .2 0 .3 0 1.7-.1 3.5-1 4.4-2.3Zm4.3 10.2c-.1-3.1 2.5-4.6 2.6-4.7-1.5-2.1-3.7-2.4-4.5-2.4-1.9-.2-3.7 1.1-4.7 1.1-1 0-2.5-1.1-4.1-1.1-2.1 0-4.1 1.2-5.2 3.1-2.2 3.9-.6 9.6 1.6 12.7 1.1 1.5 2.4 3.3 4.1 3.2 1.6-.1 2.3-1.1 4.2-1.1 2 0 2.5 1.1 4.2 1 1.8-.1 2.9-1.5 3.9-3.1 1.3-1.8 1.8-3.5 1.8-3.6-.1 0-3.4-1.3-3.9-5.1Z"
          fill="#fff"
        />
        <text x="42" y="16" fill="#A1A1A6" fontSize="8" fontFamily="Inter,system-ui,sans-serif">
          Download on the
        </text>
        <text x="42" y="30" fill="#fff" fontSize="15" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">
          App Store
        </text>
      </svg>
    </button>
  );
}

function GooglePlayBadge({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="store-badge ios-press" onClick={onClick} aria-label="Get it on Google Play">
      <svg width="156" height="42" viewBox="0 0 156 42" fill="none" aria-hidden="true">
        <rect width="156" height="42" rx="8" fill="#1C1C1E" />
        <path d="M18 11.2 28.8 21 18 30.8V11.2Z" fill="#EA4335" />
        <path d="M18 11.2 23.2 16.4 29.2 13.2 18 11.2Z" fill="#FBBC04" />
        <path d="M18 30.8 29.2 28.8 23.2 25.6 18 30.8Z" fill="#34A853" />
        <path d="M29.8 21.2 23.2 25.6l-5.2-4.4 5.2-4.4 6.6 4.4Z" fill="#4285F4" />
        <text x="40" y="16" fill="#A1A1A6" fontSize="8" fontFamily="Inter,system-ui,sans-serif">
          GET IT ON
        </text>
        <text x="40" y="30" fill="#fff" fontSize="15" fontWeight="700" fontFamily="Inter,system-ui,sans-serif">
          Google Play
        </text>
      </svg>
    </button>
  );
}

function SocialIcon({ id }: { id: (typeof SOCIAL_PLACEHOLDERS)[number]['id'] }) {
  if (id === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M6.94 6.5A1.94 1.94 0 1 1 3.06 6.5a1.94 1.94 0 0 1 3.88 0ZM4 9.25h2.9V20H4V9.25Zm5.35 0H12.1v1.46h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.6V20H15.7v-5.2c0-1.24-.02-2.84-1.73-2.84-1.74 0-2 1.35-2 2.75V20H9.35V9.25Z"
        />
      </svg>
    );
  }
  if (id === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M13.5 20v-6.2h2.08l.31-2.4H13.5V9.86c0-.7.2-1.17 1.22-1.17h1.3V6.54c-.22-.03-.99-.1-1.88-.1-1.86 0-3.14 1.13-3.14 3.21v1.79H8.7v2.4h2.3V20h2.5Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 7.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Zm0 6.93a2.73 2.73 0 1 1 0-5.46 2.73 2.73 0 0 1 0 5.46Zm5.36-7.1a.98.98 0 1 1-1.96 0 .98.98 0 0 1 1.96 0Zm2.78 1a4.74 4.74 0 0 0-1.29-3.36 4.78 4.78 0 0 0-3.36-1.3c-1.32-.07-5.28-.07-6.6 0a4.76 4.76 0 0 0-3.36 1.3A4.74 4.74 0 0 0 3.86 8.63c-.08 1.32-.08 5.28 0 6.6a4.74 4.74 0 0 0 1.3 3.36 4.78 4.78 0 0 0 3.36 1.29c1.32.08 5.28.08 6.6 0a4.74 4.74 0 0 0 3.36-1.3 4.78 4.78 0 0 0 1.29-3.35c.08-1.32.08-5.28 0-6.6Zm-1.75 8.01a2.79 2.79 0 0 1-1.57 1.57c-1.09.43-3.67.33-4.87.33s-3.79.09-4.87-.33a2.79 2.79 0 0 1-1.57-1.57c-.43-1.09-.33-3.67-.33-4.87s-.09-3.79.33-4.87a2.79 2.79 0 0 1 1.57-1.57c1.09-.43 3.67-.33 4.87-.33s3.79-.09 4.87.33a2.79 2.79 0 0 1 1.57 1.57c.43 1.09.33 3.67.33 4.87s.1 3.78-.33 4.87Z"
      />
    </svg>
  );
}

function CareMeshDiagram() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const paused = activeId !== null;
  const innerNodes = CARE_NODES.filter((n) => n.orbit === 'inner');
  const outerNodes = CARE_NODES.filter((n) => n.orbit === 'outer');

  return (
    <div className={`orbit-shell card${paused ? ' is-paused' : ''}`} id="features">
      <div
        className="orbit-canvas"
        role="group"
        aria-label="IHS synchronized core with six orbiting ecosystem nodes"
      >
        <div className="orbit-pulse" aria-hidden="true" />
        <div className="orbit-pulse orbit-pulse-delay" aria-hidden="true" />

        <div className="orbit-track orbit-track-inner" aria-hidden="true" />
        <div className="orbit-track orbit-track-outer" aria-hidden="true" />

        <div className={`orbit-ring orbit-ring-inner${paused ? ' is-paused' : ''}`}>
          {innerNodes.map((node) => (
            <OrbitSpoke
              key={node.id}
              node={node}
              active={activeId === node.id}
              onActivate={() => setActiveId(node.id)}
              onDeactivate={() => setActiveId((id) => (id === node.id ? null : id))}
            />
          ))}
        </div>

        <div className={`orbit-ring orbit-ring-outer${paused ? ' is-paused' : ''}`}>
          {outerNodes.map((node) => (
            <OrbitSpoke
              key={node.id}
              node={node}
              active={activeId === node.id}
              onActivate={() => setActiveId(node.id)}
              onDeactivate={() => setActiveId((id) => (id === node.id ? null : id))}
            />
          ))}
        </div>

        <div className="orbit-core">
          <strong>IHS</strong>
          <span>Synchronized Core</span>
        </div>
      </div>

      <div className="orbit-cards">
        {CARE_NODES.map((node) => (
          <article
            key={node.id}
            className={`orbit-card${activeId === node.id ? ' is-active' : ''}`}
            style={{ ['--accent' as string]: node.color }}
            onMouseEnter={() => setActiveId(node.id)}
            onMouseLeave={() => setActiveId((id) => (id === node.id ? null : id))}
            onFocus={() => setActiveId(node.id)}
            onBlur={() => setActiveId((id) => (id === node.id ? null : id))}
            tabIndex={0}
          >
            <div className="orbit-card-head">
              <span className="orbit-card-icon" aria-hidden="true">
                {node.icon}
              </span>
              <span className="orbit-card-dot" style={{ background: node.color }} />
              <strong>{node.title}</strong>
            </div>
            <p>{node.desc}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function OrbitSpoke({
  node,
  active,
  onActivate,
  onDeactivate,
}: {
  node: (typeof CARE_NODES)[number];
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  return (
    <div
      className={`orbit-spoke${active ? ' is-active' : ''}`}
      style={{
        ['--angle' as string]: `${node.angle}deg`,
        ['--accent' as string]: node.color,
      }}
    >
      <span className="orbit-beam" aria-hidden="true" />
      <div className="orbit-sat-spin">
        <button
          type="button"
          className={`orbit-sat${active ? ' is-active' : ''}`}
          style={{ ['--accent' as string]: node.color }}
          aria-label={node.title}
          aria-pressed={active}
          onMouseEnter={onActivate}
          onMouseLeave={onDeactivate}
          onFocus={onActivate}
          onBlur={onDeactivate}
        >
          <span className="orbit-sat-icon" aria-hidden="true">
            {node.icon}
          </span>
          <span className="orbit-sat-label">{node.short}</span>
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [service, setService] = useState('Home Doctor Visit');
  const [location, setLocation] = useState<string>(PILOT_LOCATIONS[0] ?? 'Ananthapur Urban');
  const [contactPhone, setContactPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const year = useMemo(() => new Date().getFullYear(), []);
  const faqCloseRef = useRef<HTMLButtonElement | null>(null);
  const downloadCloseRef = useRef<HTMLButtonElement | null>(null);
  const activeFaq = faqOpen !== null ? FAQ_CHIPS[faqOpen] : undefined;

  useEffect(() => {
    if (faqOpen === null && !downloadOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (faqOpen !== null) setFaqOpen(null);
      if (downloadOpen) setDownloadOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [faqOpen, downloadOpen]);

  useEffect(() => {
    if (faqOpen === null) return;
    faqCloseRef.current?.focus();
  }, [faqOpen]);

  useEffect(() => {
    if (!downloadOpen) return;
    downloadCloseRef.current?.focus();
  }, [downloadOpen]);

  const onRequest = (e: FormEvent) => {
    e.preventDefault();
    const digits = contactPhone.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
      setPhoneError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setPhoneError(null);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const ref = `IHS-REQ-2026-${suffix}`;
    setRequestId(ref);
    setFormSent(true);
    const msg = encodeURIComponent(
      `Hello IHS Initiative — Pilot triage request\n` +
        `Ref: ${ref}\n` +
        `Service: ${service}\n` +
        `Location: ${location}\n` +
        `WhatsApp/Contact: +91 ${digits}\n` +
        `Pilot Zone: Ananthapuramu 50km`,
    );
    window.open(`https://wa.me/919032600410?text=${msg}`, '_blank', 'noreferrer');
  };

  return (
    <div className="site">
      <header className="header">
        <div className="container header-inner">
          <a href="#top" className="brand ios-press">
            <div className="brand-mark">IHS</div>
            <div className="brand-copy">
              <strong>IHS Initiative</strong>
              <div className="live-pulse">● ACTIVE PILOT GRID · ANANTHAPUR 50KM RADIUS</div>
            </div>
          </a>

          <nav className="nav-anchors" aria-label="Primary">
            <a href={PRICING_HREF} className="ios-press">
              Pricing
            </a>
            {NAV.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="ios-press">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <a className="btn btn-ghost ios-press" href={PRICING_HREF}>
              View Plans
            </a>
            <a className="btn btn-ghost ios-press" href={WHATSAPP} target="_blank" rel="noreferrer">
              💬 WhatsApp
            </a>
            <a className="btn btn-ghost ios-press phone-cta" href={PHONE_TEL}>
              📞 Call {PHONE_DISPLAY}
            </a>
            <a className="btn btn-primary ios-press" href={PATIENT_VAULT}>
              Launch Patient Vault
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="pill-tag">
                ⚡ India&apos;s First Sub-300s Synchronized Emergency &amp; Care Grid
              </span>
              <h1>When Every Second Counts, An Entire Medical Grid Responds.</h1>
              <p className="hero-lead">
                Unifying 1-tap SOS panic triggers, real-time GPS fleet dispatch, streaming hospital ER
                pre-arrival vitals, and doorstep MBBS doctor visits across the Ananthapuramu 50km
                pilot corridor.
              </p>
              <div className="hero-ctas">
                <a className="btn btn-primary btn-lg ios-press" href="#contact">
                  Request Doorstep GP
                </a>
                <a className="btn btn-outline btn-lg ios-press" href={WHATSAPP} target="_blank" rel="noreferrer">
                  Chat with Triage Desk
                </a>
              </div>
            </div>

            <div className="hero-stage" aria-hidden="true">
              <div className="float-badge badge-tl">
                🛡️ Encrypted Vault · 24/7 Verified MBBS Tele-Triage
              </div>
              <div className="phone-frame">
                <div className="phone-glass" />
                <div className="phone-notch" />
                <div className="phone-screen">
                  <div className="mock-bar">
                    <strong>IHS Lifeline · Ananthapur Sector</strong>
                    <span className="sos-pill">SOS</span>
                  </div>
                  <div className="mock-vital">
                    <strong>🟢 Unit AP-02-EX-2214 En Route · ETA 03:40 Mins</strong>
                    <span>Live ALS dispatch · Ananthapuramu pilot</span>
                  </div>
                  <div className="mock-tiles">
                    <div>SOS</div>
                    <div>Home GP</div>
                    <div>Tele</div>
                    <div>Vault</div>
                  </div>
                  <div className="mock-eta">
                    <span>Nearest ALS</span>
                    <strong>ETA 03:40</strong>
                  </div>
                </div>
              </div>
              <div className="float-badge badge-br">
                📡 Live ALS Dispatch Locked · Target ETA &lt; 04:30m
              </div>
            </div>
          </div>
        </section>

        {/* 70/30 layout */}
        <section className="split-section">
          <div className="container split-grid">
            <div className="primary-stream">
              {/* Care Mesh */}
              <article className="block" id="care">
                <p className="kicker">Synchronized Care</p>
                <h2>How One Tap Mobilizes an Entire Healthcare Network in Seconds</h2>
                <p className="lede">
                  From critical alert to synchronized response—six specialized ecosystem nodes orbit
                  the IHS Core across the Ananthapuramu 50km pilot grid.
                </p>
                <CareMeshDiagram />
              </article>

              {/* Pilot Zone — Geospatial Intelligence Radar */}
              <article className="block" id="pilot">
                <p className="kicker">Pilot Zone</p>
                <h2>IHS Real-Time Emergency Command: 50km Pilot Grid</h2>
                <p className="lede">
                  Visualizing live readiness across 20 tactical nodes in Ananthapuramu &amp; Sri
                  Sathya Sai districts. Interact to inspect unit availability and response ETAs.
                </p>
                <GeospatialRadar />
              </article>

              {/* Journey */}
              <article className="block" id="journey">
                <p className="kicker">Onboarding</p>
                <h2>Three Calm Steps to Live Care.</h2>
                <div className="journey-grid">
                  <div className="card journey-card">
                    <span className="step">01</span>
                    <h3>30s OTP Signup</h3>
                    <p>Mobile OTP creates your IHS UID and opens the Patient Vault.</p>
                  </div>
                  <div className="card journey-card">
                    <span className="step">02</span>
                    <h3>Select SOS or Home Visit</h3>
                    <p>Choose emergency dispatch, doorstep GP, or teleconsult in one tap.</p>
                  </div>
                  <div className="card journey-card">
                    <span className="step">03</span>
                    <h3>Live GPS ETA Tracking</h3>
                    <p>Watch ambulance or clinician approach with real-time map ETA.</p>
                  </div>
                </div>
              </article>

              {/* FAQ Cloud */}
              <article className="block" id="faqs">
                <p className="kicker">AI Concierge</p>
                <h2>Answers Before You Need to Ask.</h2>
                <p className="lede">Tap a thought chip for an instant answer—no call-center maze.</p>
                <div className="faq-cloud">
                  {FAQ_CHIPS.map((item, idx) => (
                    <button
                      key={item.q}
                      type="button"
                      className="thought-chip ios-press"
                      aria-haspopup="dialog"
                      aria-expanded={faqOpen === idx}
                      onClick={() => setFaqOpen(idx)}
                    >
                      💬 {item.q}
                    </button>
                  ))}
                </div>
              </article>

              {/* Live Impact Console / ROI */}
              <article className="block" id="roi">
                <p className="kicker">ROI · Impact</p>
                <h2>Live Impact Console</h2>
                <p className="lede">
                  Real-time operational signal across response speed, SLA uptime, clinical sync
                  volume, and logistics efficiency for the Ananthapuramu pilot grid.
                </p>
                <LiveImpactConsole />
              </article>

              {/* Care Advantage — public comparison (replaces internal portal directory) */}
              <article className="block" id="advantage">
                <p className="kicker">Care Advantage</p>
                <h2>The IHS Care Advantage: Legacy vs. Synchronized Grid</h2>
                <p className="lede">
                  Why institutional synchronization outperforms fragmented traditional healthcare in
                  semi-urban corridors.
                </p>
                <CareAdvantageTable />
              </article>

              {/* MLC */}
              <article className="block" id="safety">
                <div className="card mlc-box">
                  <h3>Safety, Compliance &amp; Medico-Legal (MLC) Exclusion</h3>
                  <p>
                    <strong>MLC Exclusion:</strong> IHS operates strictly for non-medico-legal cases.
                    Road Traffic Accidents (RTA), gunshot/stab wounds, or physical assault requiring
                    mandatory police intimations are immediately redirected to statutory government
                    emergency services (108/112).
                  </p>
                </div>
              </article>

              {/* Live Operational Telemetry Bar */}
              <section className="block telemetry-wrap" aria-label="Live operational telemetry">
                <div className="telemetry-bar">
                  <div className="telemetry-metric">
                    <span className="telemetry-status" aria-hidden="true">
                      <i className="telemetry-pulse" />
                    </span>
                    <div>
                      <strong>Active Nodes</strong>
                      <span>20 / 20 Operational</span>
                    </div>
                  </div>
                  <div className="telemetry-metric">
                    <span className="telemetry-icon" aria-hidden="true">
                      📡
                    </span>
                    <div>
                      <strong>Telemetry Sync</strong>
                      <span>&lt; 120ms Latency</span>
                    </div>
                  </div>
                  <div className="telemetry-metric">
                    <span className="telemetry-icon" aria-hidden="true">
                      🚑
                    </span>
                    <div>
                      <strong>Fleet Readiness</strong>
                      <span>14 ALS Units on Standby</span>
                    </div>
                  </div>
                  <div className="telemetry-metric">
                    <span className="telemetry-icon" aria-hidden="true">
                      ⚡
                    </span>
                    <div>
                      <strong>Avg Response</strong>
                      <span>03:42m (Ananthapur Sector)</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Sticky sidebar */}
            <aside className="sticky-col" id="contact">
              <div className="sidebar-widget">
                <p className="sidebar-kicker">24/7 Direct Helpline</p>
                <a className="btn btn-primary sidebar-btn ios-press" href={PHONE_TEL}>
                  📞 Call {PHONE_DISPLAY}
                </a>
                <a
                  className="btn btn-outline sidebar-btn ios-press"
                  href={WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 1-Click WhatsApp Concierge
                </a>
                <a className="btn btn-ghost sidebar-btn ios-press" href={PATIENT_VAULT}>
                  Launch Patient Vault →
                </a>

                <form className="appt-form" onSubmit={onRequest}>
                  <div className="appt-form-head">
                    <h3>Contact &amp; Consultation Booking</h3>
                    <p className="appt-live-status" role="status">
                      🟢 Triage Desk Online · Average Response &lt; 2 Minutes
                    </p>
                  </div>
                  <label>
                    Select Service
                    <select value={service} onChange={(e) => setService(e.target.value)} required>
                      <option>Home Doctor Visit</option>
                      <option>Emergency Dispatch Inquiry</option>
                      <option>Corporate / Institutional Pilot</option>
                      <option>Patient Vault Support</option>
                    </select>
                  </label>
                  <label>
                    Pilot Node Location
                    <select value={location} onChange={(e) => setLocation(e.target.value)} required>
                      {PILOT_LOCATIONS.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Contact Number / WhatsApp
                    <div className={`phone-field${phoneError ? ' has-error' : ''}`}>
                      <span className="phone-cc" aria-hidden="true">
                        +91
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="90326 00410"
                        maxLength={12}
                        value={contactPhone}
                        onChange={(e) => {
                          setPhoneError(null);
                          setContactPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, 12));
                        }}
                        required
                        aria-invalid={phoneError ? true : undefined}
                        aria-describedby={phoneError ? 'phone-error' : undefined}
                        aria-label="Indian mobile number"
                      />
                    </div>
                    {phoneError ? (
                      <span id="phone-error" className="field-error" role="alert">
                        {phoneError}
                      </span>
                    ) : null}
                  </label>
                  <button type="submit" className="btn-triage-submit sidebar-btn">
                    Submit Triage Request
                  </button>
                  {formSent && requestId ? (
                    <div className="form-confirm" role="status">
                      <strong>Request encrypted &amp; queued</strong>
                      <span>
                        Reference ID: <code>{requestId}</code>
                      </span>
                      <span className="form-confirm-hint">
                        WhatsApp opened for triage desk confirmation. Keep this ID for follow-up.
                      </span>
                    </div>
                  ) : null}
                </form>

                <div className="sidebar-meta">
                  <span>Pilot Zone</span>
                  <strong>Ananthapuramu &amp; Sri Sathya Sai</strong>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <h4>Entity</h4>
            <p>
              <strong>IHS Initiative</strong>
              <br />
              Serving Ananthapuramu &amp; Sri Sathya Sai Pilot Zone
            </p>
            <p className="footer-contact">
              <a href={PHONE_TEL}>{PHONE_DISPLAY}</a>
              <br />
              <a href={`mailto:${EMAILS[0]}`}>{EMAILS[0]}</a>
              <br />
              <a href={`mailto:${EMAILS[1]}`}>{EMAILS[1]}</a>
            </p>
            <div className="store-row">
              <AppStoreBadge onClick={() => setDownloadOpen(true)} />
              <GooglePlayBadge onClick={() => setDownloadOpen(true)} />
            </div>
            <div className="footer-social" aria-label="Social profiles (provisioning)">
              <p className="footer-social-label">Follow IHS</p>
              <div className="footer-social-row">
                {SOCIAL_PLACEHOLDERS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="social-squircle"
                    title={s.title}
                    aria-label={`${s.label} — profile coming soon`}
                    aria-disabled="true"
                    disabled
                  >
                    <SocialIcon id={s.id} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h4>Direct Contact</h4>
            <div className="footer-reach">
              <a className="btn btn-primary ios-press" href={PHONE_TEL}>
                📞 {PHONE_DISPLAY}
              </a>
              <a className="btn btn-outline ios-press" href={WHATSAPP} target="_blank" rel="noreferrer">
                💬 WhatsApp
              </a>
              <a className="btn btn-ghost ios-press" href={PATIENT_VAULT}>
                Launch Patient Vault
              </a>
            </div>
          </div>

          <div>
            <h4>Patient Care</h4>
            <p className="footer-care-copy">
              1-Tap SOS, doorstep MBBS visits, tele-triage, and an encrypted Family Health Vault —
              synchronized across the Ananthapuramu 50km pilot corridor.
            </p>
            <div className="footer-care-actions">
              <a className="btn btn-outline ios-press" href="#advantage">
                See Care Advantage →
              </a>
              <a className="btn btn-ghost ios-press footer-care-micro" href={WHATSAPP} target="_blank" rel="noreferrer">
                WhatsApp Concierge
              </a>
              <a className="btn btn-ghost ios-press footer-care-micro" href={PHONE_TEL}>
                Call Triage Desk
              </a>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {year} IHS Initiative. All rights reserved.</span>
          <span>Ananthapuramu Pilot · Doorstep Care Gateway</span>
        </div>
      </footer>

      {activeFaq ? (
        <div
          className="modal-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="faq-dialog-title"
        >
          <button type="button" className="modal-backdrop" aria-label="Close" onClick={() => setFaqOpen(null)} />
          <div className="modal">
            <h3 id="faq-dialog-title">{activeFaq.q}</h3>
            <p>{activeFaq.a}</p>
            <button
              type="button"
              ref={faqCloseRef}
              className="btn btn-primary ios-press"
              onClick={() => setFaqOpen(null)}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      {downloadOpen ? (
        <div
          className="modal-root"
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-dialog-title"
        >
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Close"
            onClick={() => setDownloadOpen(false)}
          />
          <div className="modal">
            <h3 id="download-dialog-title">Download Mobile App</h3>
            <p>Scan the QR, or continue in the web Patient Vault while store listings finalize.</p>
            <div className="qr-box" aria-hidden="true" />
            <div className="hero-ctas">
              <a className="btn btn-primary ios-press" href={PATIENT_VAULT}>
                Open Web Vault
              </a>
              <button
                type="button"
                ref={downloadCloseRef}
                className="btn btn-outline ios-press"
                onClick={() => setDownloadOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
