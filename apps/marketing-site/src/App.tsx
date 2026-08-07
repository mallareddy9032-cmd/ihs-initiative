import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

const PHONE_DISPLAY = '+91 9032600410';
const PHONE_TEL = 'tel:+919032600410';
const WHATSAPP =
  'https://wa.me/919032600410?text=Hello%20IHS%20Initiative,%20I%20would%20like%20to%20book%20care%20in%20the%20Ananthapuramu%20pilot%20zone.';
const EMAILS = ['bsc.consulting123@gmail.com', 'contact@IHSGlobalservices.com'] as const;
const PATIENT_VAULT = 'http://localhost:3000';

const NAV = [
  { id: 'features', label: 'Features' },
  { id: 'care', label: 'Synchronized Care' },
  { id: 'pilot', label: 'Pilot Zone' },
  { id: 'roi', label: 'ROI' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'contact', label: 'Contact' },
] as const;

const PORTALS = [
  { label: 'Patient Concierge', href: 'http://localhost:3000' },
  { label: 'Command Center', href: 'http://localhost:3001' },
  { label: 'Fleet Driver', href: 'http://localhost:3002' },
  { label: 'Trauma ER', href: 'http://localhost:3003' },
  { label: 'Executive Analytics', href: 'http://localhost:3004' },
  { label: 'Doctor Studio', href: 'http://localhost:3005' },
] as const;

const CARE_NODES = [
  {
    id: 'sos',
    color: '#0D5C4D',
    title: '1-Tap Emergency SOS & Vault',
    desc: 'Instant GPS & medical history sync',
  },
  {
    id: 'fleet',
    color: '#2B6CB0',
    title: '24/7 Smart GPS Fleet Dispatch',
    desc: 'Locates nearest active ALS ambulance',
  },
  {
    id: 'nav',
    color: '#6B46C1',
    title: 'Live ALS Ambulance Navigation',
    desc: 'Turn-by-turn routing to your doorstep',
  },
  {
    id: 'er',
    color: '#C53030',
    title: 'Pre-Arrival ER & Trauma Bay Booking',
    desc: 'Reserves hospital bed before arrival',
  },
  {
    id: 'ops',
    color: '#B7791F',
    title: 'Regional Grid Operations Center',
    desc: '24/7 safety oversight across Ananthapur region',
  },
  {
    id: 'gp',
    color: '#0D5C4D',
    title: 'Verified Doctor & E-Prescription Sync',
    desc: 'Doorstep GP visits & teleconsults',
  },
] as const;

const PILOT_LOCATIONS = [
  'Ananthapur Urban',
  'Ananthapur Rural',
  'Raptadu',
  'B.K. Samudram',
  'Garladinne',
  'Kudair',
  'Atmakur',
  'Singanamala',
  'Narpala',
  'Bathalapalle',
  'Dharmavaram',
  'Chennekothapalle',
  'Kanakal',
  'Uravakonda',
  'Pamidi',
  'Gooty',
  'Peddavadugur',
  'Putluru',
  'Beluguppa',
  'Bukkarayasamudram',
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
    a: 'Yes. Health Vault records use 256-bit SHA-256 encryption in transit and at rest, access-scoped by IHS UID. Only authenticated care teams on an active case can view relevant clinical context.',
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

function CareMeshDiagram() {
  const positions = [
    { x: 18, y: 22 },
    { x: 82, y: 22 },
    { x: 92, y: 55 },
    { x: 72, y: 86 },
    { x: 28, y: 86 },
    { x: 8, y: 55 },
  ];
  const cx = 50;
  const cy = 52;

  return (
    <div className="card mesh-card" id="features">
      <svg className="mesh-svg" viewBox="0 0 100 100" role="img" aria-label="IHS synchronized care mesh">
        <defs>
          <linearGradient id="coreGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0D5C4D" />
            <stop offset="100%" stopColor="#1A7A66" />
          </linearGradient>
        </defs>
        {CARE_NODES.map((node, i) => {
          const p = positions[i]!;
          const mx = (cx + p.x) / 2 + (i % 2 === 0 ? -6 : 6);
          const my = (cy + p.y) / 2 + (i % 3 === 0 ? 5 : -4);
          return (
            <path
              key={`line-${node.id}`}
              d={`M ${cx} ${cy} Q ${mx} ${my} ${p.x} ${p.y}`}
              fill="none"
              stroke={node.color}
              strokeWidth="0.55"
              strokeOpacity="0.35"
            />
          );
        })}
        <circle cx={cx} cy={cy} r="11" fill="url(#coreGrad)" />
        <circle cx={cx} cy={cy} r="11" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.4" />
        <text x={cx} y={cy - 1.5} textAnchor="middle" className="mesh-core-title">
          IHS
        </text>
        <text x={cx} y={cy + 3.2} textAnchor="middle" className="mesh-core-sub">
          Synchronized Core
        </text>
        {CARE_NODES.map((node, i) => {
          const p = positions[i]!;
          return <circle key={`dot-${node.id}`} cx={p.x} cy={p.y} r="2.2" fill={node.color} />;
        })}
      </svg>
      <div className="mesh-nodes">
        {CARE_NODES.map((node) => (
          <article key={node.id} className="mesh-node">
            <span className="mesh-dot" style={{ background: node.color }} />
            <div>
              <strong>{node.title}</strong>
              <p>{node.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [service, setService] = useState('Home Doctor Visit');
  const [location, setLocation] = useState<string>(PILOT_LOCATIONS[0]);
  const year = useMemo(() => new Date().getFullYear(), []);
  const sidebarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (faqOpen === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFaqOpen(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [faqOpen]);

  const onRequest = (e: FormEvent) => {
    e.preventDefault();
    setFormSent(true);
    const msg = encodeURIComponent(
      `Hello IHS Initiative — Appointment request:%0AService: ${service}%0ALocation: ${location}%0APilot Zone: Ananthapuramu`,
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
            {NAV.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="ios-press">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
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
              <span className="pill-tag">Your Family&apos;s Dedicated Emergency &amp; Home Care Partner</span>
              <h1>Hospital-Grade Healthcare, Delivered Right to Your Doorstep.</h1>
              <p className="hero-lead">
                Sub-5-minute emergency dispatches, qualified doctor home visits, and centralized
                health vaults across Ananthapuramu &amp; Sri Sathya Sai pilot zones.
              </p>
              <div className="hero-ctas">
                <a className="btn btn-primary btn-lg ios-press" href="#contact">
                  Book Doctor Visit Now
                </a>
                <a className="btn btn-outline btn-lg ios-press" href={WHATSAPP} target="_blank" rel="noreferrer">
                  💬 WhatsApp Us
                </a>
              </div>
            </div>

            <div className="hero-stage" aria-hidden="true">
              <div className="float-badge badge-tl">
                🛡️ Certified MBBS Doctors · Verified Home Care
              </div>
              <div className="phone-frame">
                <div className="phone-glass" />
                <div className="phone-notch" />
                <div className="phone-screen">
                  <div className="mock-bar">
                    <strong>IHS Vault</strong>
                    <span className="sos-pill">SOS</span>
                  </div>
                  <div className="mock-vital">
                    <strong>Heart Rate 72</strong>
                    <span>SpO₂ 98% · Family Vault</span>
                  </div>
                  <div className="mock-tiles">
                    <div>SOS</div>
                    <div>Home GP</div>
                    <div>Tele</div>
                    <div>Vault</div>
                  </div>
                  <div className="mock-eta">
                    <span>Nearest ALS</span>
                    <strong>ETA 04:18</strong>
                  </div>
                </div>
              </div>
              <div className="float-badge badge-br">⚡ 1-Tap SOS Active · Sub-5 Min Target</div>
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
                <h2>How One Tap Mobilizes an Entire Healthcare Network in Seconds.</h2>
                <p className="lede">
                  From panic to coordinated response—six patient-facing nodes orbit the IHS
                  Synchronized Core across the Ananthapuramu pilot.
                </p>
                <CareMeshDiagram />
              </article>

              {/* Pilot Zone */}
              <article className="block" id="pilot">
                <p className="kicker">Pilot Zone</p>
                <h2>Synchronized Emergency Coverage Within 50km Radius of Ananthapur.</h2>
                <p className="lede">
                  Twenty active dispatch nodes across Ananthapuramu &amp; Sri Sathya Sai districts—live
                  readiness for SOS and doorstep care.
                </p>
                <div className="card pilot-card">
                  <div className="pilot-meta">
                    <span className="pulse-dot" />
                    <span>ACTIVE · 50KM RADIUS · ANANTHAPURAMU</span>
                  </div>
                  <div className="location-grid">
                    {PILOT_LOCATIONS.map((loc) => (
                      <span key={loc} className="loc-chip">
                        {loc}
                      </span>
                    ))}
                  </div>
                </div>
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
                      onClick={() => setFaqOpen(idx)}
                    >
                      💬 {item.q}
                    </button>
                  ))}
                </div>
              </article>

              {/* Golden Hour / ROI */}
              <article className="block" id="roi">
                <p className="kicker">Golden Hour · ROI</p>
                <h2>From Panic Queue to On-Scene in Minutes.</h2>
                <div className="card timeline-card">
                  <div className="timeline-row">
                    <div className="timeline-label">
                      <span className="tag muted">Legacy</span>
                      <strong>Fragmented delay</strong>
                    </div>
                    <div className="timeline-track">
                      <div className="t-node">
                        <span>Min 0</span>
                        <i />
                        <b>Panic</b>
                      </div>
                      <hr />
                      <div className="t-node">
                        <span>Min 8</span>
                        <i />
                        <b>Call Queue</b>
                      </div>
                      <hr />
                      <div className="t-node">
                        <span>Min 18+</span>
                        <i />
                        <b>Arrival</b>
                      </div>
                    </div>
                  </div>
                  <div className="timeline-row ihs">
                    <div className="timeline-label">
                      <span className="tag green">IHS Grid</span>
                      <strong>4.3-min target</strong>
                    </div>
                    <div className="timeline-track">
                      <div className="t-node accent">
                        <span>Min 0</span>
                        <i />
                        <b>1-Tap</b>
                      </div>
                      <hr className="accent" />
                      <div className="t-node accent">
                        <span>Min 1</span>
                        <i />
                        <b>Auto-Dispatch</b>
                      </div>
                      <hr className="accent" />
                      <div className="t-node accent highlight">
                        <span>Min 4.3</span>
                        <i />
                        <b>On-Scene ⚡</b>
                      </div>
                    </div>
                  </div>
                </div>
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

              {/* Trust Band */}
              <article className="block trust-band-wrap">
                <div className="card trust-band">
                  <div className="trust-item">
                    <strong>Aarogyasri / PM-JAY</strong>
                    <span>Auto-verification readiness</span>
                  </div>
                  <div className="trust-item">
                    <strong>ABDHM / NDHM</strong>
                    <span>Digital Health Record compliance</span>
                  </div>
                  <div className="trust-item">
                    <strong>256-Bit SHA-256</strong>
                    <span>Encrypted family vaults</span>
                  </div>
                </div>
              </article>
            </div>

            {/* Sticky sidebar */}
            <aside className="sticky-col" ref={sidebarRef} id="contact">
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
                  <h3>Quick Appointment Request</h3>
                  <label>
                    Select Service
                    <select value={service} onChange={(e) => setService(e.target.value)}>
                      <option>Home Doctor Visit</option>
                      <option>SOS</option>
                      <option>Teleconsult</option>
                    </select>
                  </label>
                  <label>
                    Select Ananthapur Location
                    <select value={location} onChange={(e) => setLocation(e.target.value)}>
                      {PILOT_LOCATIONS.map((loc) => (
                        <option key={loc}>{loc}</option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="btn btn-primary sidebar-btn ios-press">
                    Instant Request
                  </button>
                  {formSent && <p className="form-note">Opening WhatsApp with your request…</p>}
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
            <h4>Portal Directory</h4>
            <div className="portal-dir">
              {PORTALS.map((p) => (
                <a key={p.href} href={p.href} className="ios-press">
                  {p.label}
                  <span>Launch →</span>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {year} IHS Initiative. All rights reserved.</span>
          <span>Ananthapuramu Pilot · Granola × Nuraform Editorial</span>
        </div>
      </footer>

      {faqOpen !== null && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <button type="button" className="modal-backdrop" aria-label="Close" onClick={() => setFaqOpen(null)} />
          <div className="modal">
            <h3>{FAQ_CHIPS[faqOpen]!.q}</h3>
            <p>{FAQ_CHIPS[faqOpen]!.a}</p>
            <button type="button" className="btn btn-primary ios-press" onClick={() => setFaqOpen(null)}>
              Got it
            </button>
          </div>
        </div>
      )}

      {downloadOpen && (
        <div className="modal-root" role="dialog" aria-modal="true">
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Close"
            onClick={() => setDownloadOpen(false)}
          />
          <div className="modal">
            <h3>Download Mobile App</h3>
            <p>Scan the QR, or continue in the web Patient Vault while store listings finalize.</p>
            <div className="qr-box" aria-hidden="true" />
            <div className="hero-ctas">
              <a className="btn btn-primary ios-press" href={PATIENT_VAULT}>
                Open Web Vault
              </a>
              <button type="button" className="btn btn-outline ios-press" onClick={() => setDownloadOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
