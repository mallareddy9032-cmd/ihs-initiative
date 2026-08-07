const ROWS: Array<{
  dimension: string;
  legacy: string;
  ihsLead: string;
  ihsRest: string;
}> = [
  {
    dimension: 'Emergency Response',
    legacy: 'Fragmented calls to local numbers; 45m+ average delay.',
    ihsLead: '1-Tap Instant SOS',
    ihsRest: ' with automated GPS locking and sub-5m ALS dispatch.',
  },
  {
    dimension: 'Medical Records',
    legacy: 'Paper files or scattered records lost between clinics.',
    ihsLead: 'Encrypted Family Health Vault',
    ihsRest: ' accessible instantly by authorized ER doctors.',
  },
  {
    dimension: 'Doctor Access',
    legacy: 'Long travel queues to district hospitals for basic consultations.',
    ihsLead: 'Doorstep GP Visits & Tele-Triage',
    ihsRest: " delivered directly to the patient's home.",
  },
  {
    dimension: 'Hospital Handoff',
    legacy: 'Zero pre-arrival data; ER teams unprepared upon arrival.',
    ihsLead: 'Live Vitals & Bed Reservation',
    ihsRest: ' streamed directly to the Trauma Bay prior to arrival.',
  },
];

export function CareAdvantageTable() {
  return (
    <div className="card advantage-card">
      {/* Desktop / tablet table */}
      <div
        className="advantage-scroll"
        role="region"
        aria-label="Legacy versus IHS synchronized grid"
      >
        <table className="advantage-table">
          <thead>
            <tr>
              <th scope="col">Operational Dimension</th>
              <th scope="col">
                <span className="advantage-col-legacy">❌ Traditional Legacy Healthcare</span>
              </th>
              <th scope="col">
                <span className="advantage-col-ihs">✅ IHS Synchronized Grid</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.dimension}>
                <th scope="row">{row.dimension}</th>
                <td>{row.legacy}</td>
                <td className="advantage-ihs-cell">
                  <strong>{row.ihsLead}</strong>
                  {row.ihsRest}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards (<768px) */}
      <div className="advantage-mobile" aria-label="Legacy versus IHS synchronized grid">
        {ROWS.map((row) => (
          <article key={row.dimension} className="advantage-mobile-card">
            <h3>{row.dimension}</h3>
            <div className="advantage-mobile-compare">
              <div className="advantage-mobile-legacy">
                <span className="advantage-mobile-kicker">❌ Traditional Legacy</span>
                <p>{row.legacy}</p>
              </div>
              <div className="advantage-mobile-ihs">
                <span className="advantage-mobile-kicker">✅ IHS Synchronized Grid</span>
                <p>
                  <strong>{row.ihsLead}</strong>
                  {row.ihsRest}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
