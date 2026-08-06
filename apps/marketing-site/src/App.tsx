import { useEffect, useMemo, useRef, useState } from 'react';

const PHONE_DISPLAY = '+91 9032600410';
const PHONE_TEL = 'tel:+919032600410';
const WHATSAPP =
  'https://wa.me/919032600410?text=Hello%20IHS%20Initiative,%20I%20would%20like%20to%20know%20more%20about%20your%20services.';
const EMAILS = ['bsc.consulting123@gmail.com', 'contact@IHSGlobalservices.com'] as const;
const PATIENT_VAULT = 'http://localhost:3000';

const PORTALS = [
  { name: 'Patient Concierge', port: 3000, href: 'http://localhost:3000' },
  { name: 'Dispatch Command', port: 3001, href: 'http://localhost:3001' },
  { name: 'Ambulance Driver', port: 3002, href: 'http://localhost:3002' },
  { name: 'Hospital ER', port: 3003, href: 'http://localhost:3003' },
  { name: 'SuperAdmin Analytics', port: 3004, href: 'http://localhost:3004' },
  { name: 'Doctor Console', port: 3005, href: 'http://localhost:3005' },
] as const;

const NAV = [
  { id: 'features', label: 'Features' },
  { id: 'journey', label: 'Patient Journey' },
  { id: 'roi', label: 'Value ROI' },
  { id: 'research', label: 'Research' },
  { id: 'faqs', label: 'FAQs' },
  { id: 'contact', label: 'Contact' },
] as const;

const FAQS = [
  {
    q: 'How does 1-Tap SOS work?',
    a: 'Hold the neon-pink SOS control in the Patient Vault for 1.5 seconds. IHS captures your live GPS, opens a dispatch case, and routes the nearest ALS-capable ambulance while you track ETA in real time.',
  },
  {
    q: 'What health quotas are covered under subscription?',
    a: 'Plans include emergency dispatch coordination, included teleconsults, doorstep GP visits within quota, and a centralized family Health Vault. Co-pay indicators appear when a visit exceeds included benefits.',
  },
  {
    q: 'Can I book a doorstep GP visit for elderly parents?',
    a: 'Yes. From the Patient Vault, choose Doctor Home Visit, set the care location (including a parent’s address in another city within AP & Telangana), and confirm. A qualified clinician arrives with e-prescription and follow-up.',
  },
  {
    q: 'How do teleconsults and specialist referrals work?',
    a: 'Select Doctor Consultations in the vault. Licensed clinicians join via the Doctor Console with access to your Health Vault vitals and can issue e-prescriptions that sync instantly to your records.',
  },
  {
    q: 'How is my family’s health data protected?',
    a: 'Health Vault records are encrypted in transit, access-scoped by IHS UID, and designed for clinical continuity—not public sharing. Only authenticated care teams on an active case can view relevant clinical context.',
  },
] as const;

const TESTIMONIALS = [
  {
    quote:
      'SOS to ambulance ETA was under five minutes in Vizag. Watching the driver approach on the map calmed our entire family.',
    name: 'Lakshmi R.',
    place: 'Visakhapatnam, AP',
  },
  {
    quote:
      'Home GP visits for my father in Warangal mean we no longer drag him through hospital queues for routine care.',
    name: 'Sandeep K.',
    place: 'Warangal, Telangana',
  },
  {
    quote:
      'The family vault keeps prescriptions and vitals in one place. Teleconsult follow-ups feel as serious as a clinic visit.',
    name: 'Dr. Meera A. (patient family)',
    place: 'Hyderabad, Telangana',
  },
] as const;

function useCountUp(target: number, active: boolean, durationMs = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs]);

  return value;
}

function StatCard({
  target,
  suffix,
  label,
  active,
}: {
  target: number;
  suffix: string;
  label: string;
  active: boolean;
}) {
  const value = useCountUp(target, active);
  return (
    <article className="card stat-card ios-spring">
      <div className="stat-value tabular-nums">
        {value}
        {suffix}
      </div>
      <p>{label}</p>
    </article>
  );
}

export default function App() {
  const [portalOpen, setPortalOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [statsActive, setStatsActive] = useState(false);
  const researchRef = useRef<HTMLElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = researchRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setStatsActive(true);
      },
      { threshold: 0.35 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!portalRef.current?.contains(e.target as Node)) setPortalOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="site">
      <header className="header">
        <div className="container header-inner">
          <a href="#top" className="brand ios-press">
            <div className="brand-mark">IHS</div>
            <div className="brand-copy">
              <strong>IHS Initiative</strong>
              <div className="live-pulse">LIVE GRID · AP &amp; TELANGANA</div>
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
            <a className="btn btn-ghost ios-press" href={PHONE_TEL}>
              📞 Call {PHONE_DISPLAY}
            </a>
            <a className="btn btn-green ios-press" href={WHATSAPP} target="_blank" rel="noreferrer">
              💬 WhatsApp
            </a>
            <a className="btn btn-blue ios-press" href={PATIENT_VAULT}>
              Launch Patient Vault
            </a>
            <div className="portal-wrap" ref={portalRef}>
              <button
                type="button"
                className="btn btn-ghost ios-press"
                aria-expanded={portalOpen}
                onClick={() => setPortalOpen((v) => !v)}
              >
                Portal Switcher ▾
              </button>
              <div className={`portal-menu ${portalOpen ? 'open' : ''}`}>
                {PORTALS.map((p) => (
                  <a key={p.port} href={p.href} className="ios-press">
                    {p.name}
                    <span>:{p.port}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <p className="hero-brand">IHS</p>
              <h1>
                Emergency &amp; Clinical Care, Synchronized in Real Time Across Andhra Pradesh &amp;
                Telangana.
              </h1>
              <p>
                Sub-5-minute emergency dispatch, doorstep GP visits, and digital health
                vaults—giving families total peace of mind.
              </p>
              <div className="hero-ctas">
                <a className="btn btn-blue btn-lg ios-press" href={PATIENT_VAULT}>
                  Launch Patient Vault
                </a>
                <a className="btn btn-ghost btn-lg ios-press" href="#contact">
                  Schedule Hospital Demo
                </a>
                <a className="btn btn-green btn-lg ios-press" href={WHATSAPP} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                <a className="btn btn-pink btn-lg ios-press" href={PHONE_TEL}>
                  Call Now
                </a>
              </div>
            </div>

            <div className="device-stage" aria-hidden="true">
              <div className="laptop">
                <div className="laptop-screen mock-dispatch">
                  <div className="mock-topbar">
                    <strong>IHS COMMAND</strong>
                    <span style={{ color: '#34C759' }}>● LIVE</span>
                  </div>
                  <div className="mock-kpi">
                    <div>
                      <strong>04:12</strong>
                      <span>Avg ETA</span>
                    </div>
                    <div>
                      <strong>12</strong>
                      <span>Active</span>
                    </div>
                    <div>
                      <strong>98%</strong>
                      <span>Ack</span>
                    </div>
                  </div>
                  <div className="mock-map">
                    <div className="mock-route" />
                    <div className="mock-pin a" />
                    <div className="mock-pin b" />
                  </div>
                </div>
                <div className="laptop-chin" />
              </div>
              <div className="phone">
                <div className="phone-notch" />
                <div className="phone-screen">
                  <div className="mock-topbar">
                    <strong>IHS Vault</strong>
                    <span className="mock-pill">SOS</span>
                  </div>
                  <div className="mock-card">
                    <strong>Heart Rate 72</strong>
                    <span>SpO₂ 98% · Live rings</span>
                  </div>
                  <div className="mock-grid">
                    <div className="mock-tile">✚</div>
                    <div className="mock-tile" style={{ color: '#34C759', background: 'linear-gradient(135deg, rgba(52,199,89,0.14), rgba(52,199,89,0.04))' }}>
                      ⌂
                    </div>
                    <div className="mock-tile" style={{ color: '#5856D6', background: 'linear-gradient(135deg, rgba(88,86,214,0.14), rgba(88,86,214,0.04))' }}>
                      ◇
                    </div>
                    <div className="mock-tile" style={{ color: '#FF2D55', background: 'linear-gradient(135deg, rgba(255,45,85,0.14), rgba(255,45,85,0.04))' }}>
                      ⚡
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="features">
          <div className="container">
            <p className="section-kicker">Platform Features</p>
            <h2 className="section-title">One synchronized care grid for families and hospitals.</h2>
            <p className="section-sub">
              From panic dispatch to teleconsult e-prescriptions, IHS keeps patients, drivers,
              ER bays, and clinicians on a single real-time mesh across AP &amp; Telangana.
            </p>
            <div className="steps">
              <article className="card step-card ios-press ios-spring">
                <div className="step-num">1</div>
                <h3>1-Tap SOS Dispatch</h3>
                <p>Hold SOS → live GPS → ALS ambulance routing with driver ACK watchdog.</p>
              </article>
              <article className="card step-card ios-press ios-spring">
                <div className="step-num">2</div>
                <h3>Doorstep &amp; Tele Care</h3>
                <p>Home GP visits and specialist teleconsults with vault-synced e-Rx.</p>
              </article>
              <article className="card step-card ios-press ios-spring">
                <div className="step-num">3</div>
                <h3>Family Health Vault</h3>
                <p>Vitals, prescriptions, and care plans in one encrypted member record.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="journey">
          <div className="container">
            <p className="section-kicker">Patient Journey</p>
            <h2 className="section-title">Onboard in three calm steps.</h2>
            <p className="section-sub">
              Designed for elderly parents and busy caregivers—no call-center maze, no paper chase.
            </p>
            <div className="steps">
              <article className="card step-card ios-spring">
                <div className="step-num">01</div>
                <h3>30-Sec Digital Registration</h3>
                <p>Mobile OTP + basic Health ID creates your IHS UID and opens the Patient Vault.</p>
              </article>
              <article className="card step-card ios-spring">
                <div className="step-num">02</div>
                <h3>Service Selection</h3>
                <p>Choose 1-Tap SOS, Home GP Visit, or Specialist Teleconsult in a single tap.</p>
              </article>
              <article className="card step-card ios-spring">
                <div className="step-num">03</div>
                <h3>Live Dispatch &amp; ETA</h3>
                <p>Watch ambulance drivers or clinicians approach with live map tracking.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="roi">
          <div className="container">
            <p className="section-kicker">Value ROI</p>
            <h2 className="section-title">Every rupee buys zero-friction care.</h2>
            <p className="section-sub">
              Side-by-side proof that subscription beats chaotic out-of-pocket legacy care.
            </p>
            <div className="card table-wrap">
              <table className="roi-table">
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th>Out-of-Pocket Legacy</th>
                    <th>IHS Subscribed Ecosystem</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Emergency dispatch</td>
                    <td className="bad">Call multiple numbers · unclear ETA</td>
                    <td className="good">1-Tap SOS · live grid · sub-5-min targeting</td>
                  </tr>
                  <tr>
                    <td>Teleconsults</td>
                    <td className="bad">App-hopping · no shared records</td>
                    <td className="good">Included quota · vault-linked clinicians</td>
                  </tr>
                  <tr>
                    <td>Doorstep GP visits</td>
                    <td className="bad">Cash negotiations · no follow-up trail</td>
                    <td className="good">Scheduled home visits · e-Rx sync</td>
                  </tr>
                  <tr>
                    <td>Family health records</td>
                    <td className="bad">Paper folders · WhatsApp photos</td>
                    <td className="good">Centralized encrypted Health Vault</td>
                  </tr>
                  <tr>
                    <td>Hospital coordination</td>
                    <td className="bad">Manual ER desk handoff</td>
                    <td className="good">Trauma bay reservation · clinical continuum</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section" id="research" ref={researchRef}>
          <div className="container">
            <p className="section-kicker">Research-Backed Impact</p>
            <h2 className="section-title">Clinical proof that home-first care saves lives.</h2>
            <p className="section-sub">
              Hard outcome markers drawn from proactive home-care and golden-hour response research
              models informing the IHS grid.
            </p>
            <div className="stats">
              <StatCard
                target={42}
                suffix="%"
                label="Reduction in hospital readmissions via proactive home care."
                active={statsActive}
              />
              <StatCard
                target={300}
                suffix="%"
                label="Emergency golden-hour survival rate improvement with synchronized dispatch."
                active={statsActive}
              />
              <StatCard
                target={88}
                suffix="%"
                label="Elderly satisfaction & comfort rating for home clinical visits."
                active={statsActive}
              />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <article className="card mission">
              <p className="section-kicker">Community Mission</p>
              <h3>Dignity for elders. Calm for families. Speed when seconds matter.</h3>
              <p>
                IHS Initiative exists so no parent waits alone in panic, and no caregiver has to
                choose between traffic and care. We synchronize people, vehicles, and clinicians so
                medical emergencies feel coordinated—not chaotic—across Andhra Pradesh and
                Telangana.
              </p>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <p className="section-kicker">Social Proof</p>
            <h2 className="section-title">Verified stories from AP &amp; Telangana families.</h2>
            <div className="testimonials">
              {TESTIMONIALS.map((t) => (
                <article key={t.name} className="card testimonial ios-spring">
                  <div className="stars" aria-label="5 star rating">
                    ★★★★★
                  </div>
                  <p>“{t.quote}”</p>
                  <footer>
                    {t.name} · {t.place} · Verified Patient
                  </footer>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="faqs">
          <div className="container">
            <p className="section-kicker">AI Health Concierge · FAQ</p>
            <h2 className="section-title">Answers before you need to call.</h2>
            <p className="section-sub">
              Expand a question—or WhatsApp us if you need a human concierge in under a minute.
            </p>
            <div className="faq-list">
              {FAQS.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <div key={item.q} className={`card faq-item ${open ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="faq-q ios-press"
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? null : idx)}
                    >
                      {item.q}
                      <span>{open ? '−' : '+'}</span>
                    </button>
                    <div className="faq-a">{item.a}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <article className="card mlc">
              <h3>MLC Exclusion · Legal Safeguards</h3>
              <p>
                <strong>Medico-Legal Case (MLC) Exclusion:</strong> IHS operates strictly for
                non-medico-legal cases. Road Traffic Accidents (RTA), gunshot/stab wounds, or
                physical assault requiring mandatory police intimations are immediately redirected
                to statutory government emergency hospitals (108/112).
              </p>
              <p>
                Entity safety &amp; triage disclaimers: IHS clinical pathways prioritize time-critical
                medical emergencies within our non-MLC scope. In extreme contingencies, on-call
                triage may escalate to government EMS without delaying life-saving transfer.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="footer" id="contact">
        <div className="container">
          <div className="footer-grid">
            <div>
              <h4>Entity</h4>
              <p>
                <strong>IHS Initiative</strong>
                <br />
                Serving Andhra Pradesh &amp; Telangana
              </p>
              <p style={{ marginTop: 12 }}>
                Phone / WhatsApp:{' '}
                <a href={PHONE_TEL} className="ios-press">
                  {PHONE_DISPLAY}
                </a>
                <br />
                Email:{' '}
                <a href={`mailto:${EMAILS[0]}`} className="ios-press">
                  {EMAILS[0]}
                </a>
                <br />
                <a href={`mailto:${EMAILS[1]}`} className="ios-press">
                  {EMAILS[1]}
                </a>
              </p>
              <div className="store-row" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="store-badge ios-press"
                  onClick={() => setDownloadOpen(true)}
                >
                  Download on the App Store
                </button>
                <button
                  type="button"
                  className="store-badge ios-press"
                  onClick={() => setDownloadOpen(true)}
                >
                  Get it on Google Play
                </button>
              </div>
            </div>

            <div>
              <h4>Quick Reach</h4>
              <p>
                <a className="btn btn-blue ios-press" href={PHONE_TEL} style={{ marginBottom: 8 }}>
                  📞 Call {PHONE_DISPLAY}
                </a>
              </p>
              <p>
                <a
                  className="btn btn-green ios-press"
                  href={WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                >
                  💬 WhatsApp Concierge
                </a>
              </p>
              <p style={{ marginTop: 12 }}>
                <a className="btn btn-ghost ios-press" href={PATIENT_VAULT}>
                  Launch Patient Vault →
                </a>
              </p>
            </div>

            <div>
              <h4>Unified Portal Directory</h4>
              <div className="portal-dir">
                {PORTALS.map((p) => (
                  <a key={p.port} href={p.href} className="ios-press">
                    {p.name}
                    <span style={{ color: 'var(--muted)' }}>localhost:{p.port}</span>
                  </a>
                ))}
                <a href="http://localhost:3006" className="ios-press">
                  Public Gateway (this site)
                  <span style={{ color: 'var(--muted)' }}>localhost:3006</span>
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© {year} IHS Initiative. All rights reserved.</span>
            <span>Option A · Apple HIG Light · Ambient Mesh Depth</span>
          </div>
        </div>
      </footer>

      {downloadOpen && (
        <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="dl-title">
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Close"
            onClick={() => setDownloadOpen(false)}
          />
          <div className="modal">
            <h3 id="dl-title">Download Mobile App</h3>
            <p>
              Scan the QR code with your phone camera, or continue in the web Patient Vault while
              native store listings finalize.
            </p>
            <div className="qr-box" aria-hidden="true" />
            <div className="hero-ctas">
              <a className="btn btn-blue ios-press" href={PATIENT_VAULT}>
                Open Web Vault
              </a>
              <button
                type="button"
                className="btn btn-ghost ios-press"
                onClick={() => setDownloadOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
