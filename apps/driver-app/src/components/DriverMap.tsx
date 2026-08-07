import { useEffect, useRef } from 'react';
import type { Gps } from '../types';

interface DriverMapProps {
  driver: Gps;
  patient: Gps;
  hospital?: Gps | null;
  phase?: 'to_patient' | 'to_hospital';
}

export function DriverMap({
  driver,
  patient,
  hospital,
  phase = 'to_patient',
}: DriverMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    let resizeHandler: (() => void) | undefined;

    void (async () => {
      const leaflet = await import('leaflet');
      const L = leaflet.default;
      if (cancelled || !hostRef.current || mapRef.current) return;

      const map = L.map(hostRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([driver.lat, driver.lng], 14);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      resizeHandler = () => map.invalidateSize();
      window.addEventListener('resize', resizeHandler);
      window.setTimeout(resizeHandler, 60);
      window.setTimeout(resizeHandler, 280);
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

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    void (async () => {
      const leaflet = await import('leaflet');
      const L = leaflet.default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();

      const pin = (color: string, size = 16) =>
        L.divIcon({
          className: 'ihs-driver-pin',
          html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 3px ${color}55,0 4px 12px rgba(0,0,0,.45)"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

      L.marker([driver.lat, driver.lng], { icon: pin('#0D5C4D', 18), title: 'Ambulance' })
        .bindPopup('<strong>Your ALS unit</strong>')
        .addTo(layer);

      L.marker([patient.lat, patient.lng], { icon: pin('#DC2626', 16), title: 'Patient' })
        .bindPopup('<strong>Patient</strong>')
        .addTo(layer);

      if (hospital) {
        L.marker([hospital.lat, hospital.lng], { icon: pin('#D97706', 16), title: 'ER' })
          .bindPopup('<strong>GGH Ananthapuramu ER</strong>')
          .addTo(layer);
      }

      const routeColor = phase === 'to_hospital' ? '#D97706' : '#0D5C4D';
      const target = phase === 'to_hospital' && hospital ? hospital : patient;

      L.polyline(
        [
          [driver.lat, driver.lng],
          [target.lat, target.lng],
        ],
        { color: routeColor, weight: 5, opacity: 0.95 },
      ).addTo(layer);

      if (phase === 'to_hospital' && hospital) {
        L.polyline(
          [
            [patient.lat, patient.lng],
            [hospital.lat, hospital.lng],
          ],
          { color: '#64748B', weight: 3, opacity: 0.55, dashArray: '6 6' },
        ).addTo(layer);
      }

      const points: [number, number][] = [
        [driver.lat, driver.lng],
        [patient.lat, patient.lng],
      ];
      if (hospital) points.push([hospital.lat, hospital.lng]);

      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds.pad(0.35), { maxZoom: 15, animate: true });
      window.setTimeout(() => map.invalidateSize(), 40);
      window.setTimeout(() => map.invalidateSize(), 280);
    })();
  }, [
    driver.lat,
    driver.lng,
    patient.lat,
    patient.lng,
    hospital?.lat,
    hospital?.lng,
    phase,
  ]);

  return (
    <div className="map-shell">
      <div ref={hostRef} className="map-host" />
      <div className="map-legend">
        <span className="leg emerald">● Unit</span>
        <span className="leg red">● Patient</span>
        <span className="leg amber">● GGH ER</span>
      </div>
    </div>
  );
}
