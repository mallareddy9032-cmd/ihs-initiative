import type { DispatchAssignment } from '../types';

interface Props {
  job: DispatchAssignment;
  onAccept: () => void;
  onDismiss: () => void;
}

export function IncomingDispatchModal({ job, onAccept, onDismiss }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-eyebrow">PRIORITY · LIVE DISPATCH</div>
        <h2>{job.patient_name}</h2>
        <div className="uid">{job.ihs_uid}</div>

        <dl>
          <div>
            <dt>Chief complaint</dt>
            <dd>{job.chief_complaint}</dd>
          </div>
          <div>
            <dt>Live GPS</dt>
            <dd>
              {job.live_gps.lat.toFixed(5)}, {job.live_gps.lng.toFixed(5)}
            </dd>
          </div>
          <div>
            <dt>Registered base</dt>
            <dd>
              {job.home_gps.lat.toFixed(5)}, {job.home_gps.lng.toFixed(5)}
            </dd>
          </div>
          <div>
            <dt>Distance · ETA</dt>
            <dd>
              {job.distance_km.toFixed(1)} km · ~{job.eta_minutes} min
            </dd>
          </div>
          {job.hospital_name && (
            <div>
              <dt>Receiving hospital</dt>
              <dd>{job.hospital_name}</dd>
            </div>
          )}
        </dl>

        <button type="button" className="btn btn-danger trip-btn" onClick={onAccept}>
          ACCEPT DISPATCH
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%', marginTop: 8 }}
          onClick={onDismiss}
        >
          Acknowledge later
        </button>
      </div>
    </div>
  );
}
