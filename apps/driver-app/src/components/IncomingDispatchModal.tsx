import type { DispatchAssignment } from '../types';

interface Props {
  job: DispatchAssignment;
  onAccept: () => void;
  onDismiss: () => void;
}

export function IncomingDispatchModal({ job, onAccept, onDismiss }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal dark-card">
        <div className="modal-eyebrow">PRIORITY · LIVE DISPATCH</div>
        <h2 className="serif">{job.patient_name}</h2>
        <div className="uid">{job.ihs_uid}</div>

        <dl>
          <div>
            <dt>Chief complaint</dt>
            <dd>{job.chief_complaint}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{job.sector || 'Ananthapur Urban · Sector 04'}</dd>
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
              <dd>
                {job.hospital_name}
                {job.hospital_bay ? ` · ${job.hospital_bay}` : ''}
              </dd>
            </div>
          )}
        </dl>

        <button type="button" className="btn btn-danger trip-btn ios-press" onClick={onAccept}>
          1. ACKNOWLEDGE DISPATCH
        </button>
        <button type="button" className="btn btn-ghost ios-press" onClick={onDismiss}>
          Acknowledge later
        </button>
      </div>
    </div>
  );
}
