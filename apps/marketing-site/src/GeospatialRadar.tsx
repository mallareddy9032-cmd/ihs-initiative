import { useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface PilotRadarNode {
  id: string;
  name: string;
  /** Distance from Ananthapur Core in km (0–50) */
  radiusKm: number;
  /** Degrees clockwise from north */
  bearingDeg: number;
  alsUnits: number;
  etaMins: number;
}

/** 20 tactical nodes — fixed mock telemetry for stable hover UI */
export const PILOT_RADAR_NODES: PilotRadarNode[] = [
  { id: 'n01', name: 'Ananthapur Urban', radiusKm: 6, bearingDeg: 20, alsUnits: 3, etaMins: 2 },
  { id: 'n02', name: 'Ananthapur Rural', radiusKm: 14, bearingDeg: 55, alsUnits: 2, etaMins: 3 },
  { id: 'n03', name: 'Raptadu', radiusKm: 18, bearingDeg: 95, alsUnits: 1, etaMins: 4 },
  { id: 'n04', name: 'B.K. Samudram', radiusKm: 22, bearingDeg: 130, alsUnits: 2, etaMins: 3 },
  { id: 'n05', name: 'Garladinne', radiusKm: 28, bearingDeg: 165, alsUnits: 1, etaMins: 5 },
  { id: 'n06', name: 'Kudair', radiusKm: 24, bearingDeg: 200, alsUnits: 2, etaMins: 4 },
  { id: 'n07', name: 'Atmakur', radiusKm: 32, bearingDeg: 235, alsUnits: 1, etaMins: 5 },
  { id: 'n08', name: 'Singanamala', radiusKm: 26, bearingDeg: 270, alsUnits: 2, etaMins: 3 },
  { id: 'n09', name: 'Narpala', radiusKm: 30, bearingDeg: 305, alsUnits: 1, etaMins: 4 },
  { id: 'n10', name: 'Bathalapalle', radiusKm: 34, bearingDeg: 340, alsUnits: 2, etaMins: 5 },
  { id: 'n11', name: 'Dharmavaram', radiusKm: 38, bearingDeg: 40, alsUnits: 3, etaMins: 4 },
  { id: 'n12', name: 'Chennekothapalle', radiusKm: 42, bearingDeg: 80, alsUnits: 1, etaMins: 6 },
  { id: 'n13', name: 'Kanakal', radiusKm: 40, bearingDeg: 115, alsUnits: 1, etaMins: 6 },
  { id: 'n14', name: 'Uravakonda', radiusKm: 44, bearingDeg: 150, alsUnits: 2, etaMins: 5 },
  { id: 'n15', name: 'Pamidi', radiusKm: 36, bearingDeg: 185, alsUnits: 2, etaMins: 4 },
  { id: 'n16', name: 'Gooty', radiusKm: 46, bearingDeg: 220, alsUnits: 2, etaMins: 5 },
  { id: 'n17', name: 'Peddavadugur', radiusKm: 41, bearingDeg: 255, alsUnits: 1, etaMins: 6 },
  { id: 'n18', name: 'Putluru', radiusKm: 39, bearingDeg: 290, alsUnits: 1, etaMins: 5 },
  { id: 'n19', name: 'Beluguppa', radiusKm: 43, bearingDeg: 325, alsUnits: 1, etaMins: 6 },
  { id: 'n20', name: 'Bukkarayasamudram', radiusKm: 16, bearingDeg: 350, alsUnits: 3, etaMins: 2 },
];

/** Keep form/select options in sync with radar nodes */
export const PILOT_LOCATIONS = PILOT_RADAR_NODES.map((n) => n.name);

const MAX_KM = 50;
/** Plotting radius as % of canvas (half-size) — leave margin for nodes */
const PLOT_PCT = 42;

function toCanvasPercent(node: PilotRadarNode): { x: number; y: number } {
  const r = (node.radiusKm / MAX_KM) * PLOT_PCT;
  const rad = ((node.bearingDeg - 90) * Math.PI) / 180; // 0° = north
  return {
    x: 50 + r * Math.cos(rad),
    y: 50 + r * Math.sin(rad),
  };
}

function popupStyle(x: number, y: number): CSSProperties {
  const preferRight = x < 55;
  const preferBelow = y < 55;
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(${preferRight ? '14px' : 'calc(-100% - 14px)'}, ${preferBelow ? '14px' : 'calc(-100% - 14px)'})`,
  };
}

export function GeospatialRadar() {
  const [activeId, setActiveId] = useState<string | null>(null);

  const plotted = useMemo(
    () =>
      PILOT_RADAR_NODES.map((node) => ({
        node,
        ...toCanvasPercent(node),
      })),
    [],
  );

  const active = plotted.find((p) => p.node.id === activeId) ?? null;

  return (
    <div className="card radar-card">
      <div className="pilot-meta">
        <span className="pulse-dot" />
        <span>ACTIVE · 50KM RADIUS · ANANTHAPURAMU · 20 NODES</span>
      </div>

      {/* Desktop / tablet radar */}
      <div
        className="radar-stage"
        onMouseLeave={() => setActiveId(null)}
        role="group"
        aria-label="Geospatial intelligence radar of the Ananthapuramu 50km pilot grid"
      >
        <div className="radar-ring radar-ring-10" data-label="10km" />
        <div className="radar-ring radar-ring-30" data-label="30km" />
        <div className="radar-ring radar-ring-50" data-label="50km" />

        <div className="radar-sweep" aria-hidden="true" />

        <div className="radar-core">
          <strong>Ananthapur</strong>
          <span>Core</span>
        </div>

        <svg className="radar-beams" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <AnimatePresence>
            {active ? (
              <motion.line
                key={`beam-${active.node.id}`}
                x1="50"
                y1="50"
                x2={active.x}
                y2={active.y}
                stroke="#0D5C4D"
                strokeWidth="0.35"
                strokeDasharray="1.2 1.1"
                strokeOpacity="0.85"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              />
            ) : null}
          </AnimatePresence>
        </svg>

        {plotted.map(({ node, x, y }) => {
          const isActive = activeId === node.id;
          const short =
            node.name.length > 14 ? `${node.name.slice(0, 12)}…` : node.name;
          return (
            <div
              key={node.id}
              className="radar-node-anchor"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <motion.button
                type="button"
                className={`radar-node${isActive ? ' is-active' : ''}`}
                aria-label={`${node.name}, active, ${node.alsUnits} ALS units, ETA ${node.etaMins} minutes`}
                onMouseEnter={() => setActiveId(node.id)}
                onFocus={() => setActiveId(node.id)}
                onClick={() => setActiveId(node.id)}
                initial={false}
                animate={{
                  scale: isActive ? 1.25 : 1,
                  boxShadow: isActive
                    ? '0 0 18px rgba(13, 92, 77, 0.85), 0 0 0 3px rgba(13, 92, 77, 0.25)'
                    : '0 0 10px #0D5C4D, 0 0 0 3px rgba(13, 92, 77, 0.12)',
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                whileHover={{ scale: 1.25 }}
              />
              <span className="radar-node-label">{short}</span>
            </div>
          );
        })}

        <AnimatePresence>
          {active ? (
            <motion.div
              key={`popup-${active.node.id}`}
              className="radar-popup"
              style={popupStyle(active.x, active.y)}
              initial={{ opacity: 0, scale: 0.92, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.18 }}
              role="status"
            >
              <strong>{active.node.name}</strong>
              <span className="radar-popup-status">🟢 Active</span>
              <span>ALS Units: {active.node.alsUnits}</span>
              <span>ETA: {active.node.etaMins} mins</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="radar-legend" aria-hidden="true">
          <span>10km</span>
          <span>30km</span>
          <span>50km</span>
        </div>
      </div>

      {/* Mobile sector list */}
      <ul className="radar-sector-list">
        {PILOT_RADAR_NODES.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              className={`radar-sector-row${activeId === node.id ? ' is-active' : ''}`}
              onClick={() => setActiveId((id) => (id === node.id ? null : node.id))}
            >
              <span className="radar-sector-dot" />
              <span className="radar-sector-name">{node.name}</span>
              <span className="radar-sector-meta">
                🟢 Active · ALS {node.alsUnits} · ETA {node.etaMins}m
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
