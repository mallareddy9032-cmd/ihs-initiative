// ============================================================================
// FILE: src/components/map/MapComponent.tsx
// CONTEXT: Dark GIS HUD — Ananthapur pilot nodes + fleet telematics pins
// ============================================================================

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FLEET_ROSTER, PILOT_NODES, type FleetUnit } from '@/data/fleetRoster';

export interface GpsPin {
  lat: number;
  lng: number;
}

interface MapComponentProps {
  bluePin?: GpsPin | null;
  redPin?: GpsPin | null;
  fleet?: FleetUnit[];
  center?: GpsPin;
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: '#0D5C4D',
  EN_ROUTE: '#2563EB',
  ON_SCENE: '#D97706',
  TRANSPORTING: '#DC2626',
  RETURNING: '#6B46C1',
  OFFLINE: '#64748B',
};

export const MapComponent: React.FC<MapComponentProps> = ({
  bluePin,
  redPin,
  fleet = FLEET_ROSTER,
  center = { lat: 14.6819, lng: 77.6006 },
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let resizeHandler: (() => void) | undefined;

    void (async () => {
      try {
        const leaflet = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        const L = leaflet.default;

        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([center.lat, center.lng], 10);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
        }).addTo(map);

        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setReady(true);
        setError(null);

        resizeHandler = () => map.invalidateSize();
        window.addEventListener('resize', resizeHandler);
        window.setTimeout(resizeHandler, 50);
        window.setTimeout(resizeHandler, 250);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load map');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers whenever pins / fleet change (fleet identity by status+coords)
  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) return;

    void (async () => {
      const leaflet = await import('leaflet');
      const L = leaflet.default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();

      const pulseIcon = (color: string, label: string, size = 14) =>
        L.divIcon({
          className: 'ihs-map-pin',
          html: `<div title="${label}" style="
            width:${size}px;height:${size}px;border-radius:9999px;
            background:${color};border:2px solid rgba(255,255,255,0.9);
            box-shadow:0 0 0 3px ${color}55, 0 0 16px ${color}88;
          "></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

      PILOT_NODES.forEach((node) => {
        L.marker([node.lat, node.lng], {
          icon: pulseIcon('#34C759', node.name, 10),
          title: node.name,
        })
          .bindPopup(`<strong>${node.name}</strong><br/>Pilot grid node · LIVE`)
          .addTo(layer);
      });

      fleet.forEach((unit) => {
        const color = STATUS_COLOR[unit.status] || '#94A3B8';
        L.marker([unit.lat, unit.lng], {
          icon: pulseIcon(color, unit.fleetId, 16),
          title: `${unit.fleetId} · ${unit.vehicleReg}`,
        })
          .bindPopup(
            `<strong>${unit.fleetId}</strong> · ${unit.vehicleReg}<br/>
             ${unit.driver}<br/>
             ${unit.status.replace('_', ' ')} · ${unit.speedKmh} km/h · HDG ${unit.headingDeg}°<br/>
             Station: ${unit.station}`,
          )
          .addTo(layer);
      });

      if (bluePin) {
        L.marker([bluePin.lat, bluePin.lng], {
          icon: pulseIcon('#60A5FA', 'Home base', 14),
        })
          .bindPopup(
            `<strong>Home Base</strong><br/>${bluePin.lat.toFixed(5)}, ${bluePin.lng.toFixed(5)}`,
          )
          .addTo(layer);
      }

      if (redPin) {
        L.marker([redPin.lat, redPin.lng], {
          icon: pulseIcon('#DC2626', 'Live SOS', 18),
        })
          .bindPopup(
            `<strong>Live SOS GPS</strong><br/>${redPin.lat.toFixed(5)}, ${redPin.lng.toFixed(5)}`,
          )
          .addTo(layer);

        if (bluePin) {
          L.polyline(
            [
              [bluePin.lat, bluePin.lng],
              [redPin.lat, redPin.lng],
            ],
            { color: '#D97706', weight: 2, opacity: 0.85, dashArray: '6 6' },
          ).addTo(layer);
        }
      }

      if (redPin && bluePin) {
        const bounds = L.latLngBounds([
          [bluePin.lat, bluePin.lng],
          [redPin.lat, redPin.lng],
        ]);
        map.fitBounds(bounds.pad(0.45), { maxZoom: 14, animate: true });
      } else {
        map.setView([center.lat, center.lng], 10);
      }
      window.setTimeout(() => map.invalidateSize(), 40);
      window.setTimeout(() => map.invalidateSize(), 300);
    })();
  }, [
    ready,
    bluePin?.lat,
    bluePin?.lng,
    redPin?.lat,
    redPin?.lng,
    center.lat,
    center.lng,
    // Re-draw when fleet status/position fingerprint changes
    fleet.map((u) => `${u.fleetId}:${u.status}:${u.lat}:${u.lng}`).join('|'),
  ]);

  return (
    <div className="relative h-full min-h-[280px] w-full bg-[#0F172A] rounded-3xl overflow-hidden border border-black/10 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
      {error ? (
        <div className="absolute inset-0 z-[2] flex items-center justify-center text-[#D97706] font-mono-ops text-sm p-6 text-center">
          MAP UNAVAILABLE — {error}
        </div>
      ) : null}
      <div ref={containerRef} className="h-full w-full min-h-[280px] z-0" />
      <div className="absolute top-3 left-3 z-[1000] rounded-2xl bg-[#1C1C1E]/88 backdrop-blur-xl border border-white/10 px-3 py-2 text-[11px] font-mono-ops text-[#FDFBF7] pointer-events-none">
        GIS HUD · ANANTHAPUR 50KM · DARK VECTOR
      </div>
      <div className="absolute bottom-3 left-3 z-[1000] rounded-2xl bg-[#1C1C1E]/88 backdrop-blur-xl border border-white/10 px-3 py-2 text-[11px] font-mono-ops text-[#CBD5E1] space-y-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#34C759]" /> Pilot nodes
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#0D5C4D]" /> Available
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2563EB]" /> En route
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#DC2626]" /> SOS / Transport
        </div>
      </div>
    </div>
  );
};
