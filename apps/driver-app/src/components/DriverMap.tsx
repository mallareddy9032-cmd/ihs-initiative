import { useEffect, useRef } from 'react';
import type { Gps } from '../types';

interface DriverMapProps {
  driver: Gps;
  patient: Gps;
}

export function DriverMap({ driver, patient }: DriverMapProps) {
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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      resizeHandler = () => map.invalidateSize();
      window.addEventListener('resize', resizeHandler);
      window.setTimeout(resizeHandler, 60);
      window.setTimeout(resizeHandler, 250);
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

      const pin = (color: string) =>
        L.divIcon({
          className: 'ihs-driver-pin',
          html: `<div style="width:18px;height:18px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

      L.marker([driver.lat, driver.lng], { icon: pin('#34C759'), title: 'Ambulance' })
        .bindPopup('<strong>Your unit</strong>')
        .addTo(layer);

      L.marker([patient.lat, patient.lng], { icon: pin('#FF2D55'), title: 'Patient' })
        .bindPopup('<strong>Patient</strong>')
        .addTo(layer);

      L.polyline(
        [
          [driver.lat, driver.lng],
          [patient.lat, patient.lng],
        ],
        { color: '#007AFF', weight: 4, opacity: 0.95 },
      ).addTo(layer);

      const bounds = L.latLngBounds([
        [driver.lat, driver.lng],
        [patient.lat, patient.lng],
      ]);
      map.fitBounds(bounds.pad(0.4), { maxZoom: 16, animate: true });
      window.setTimeout(() => map.invalidateSize(), 40);
    })();
  }, [driver.lat, driver.lng, patient.lat, patient.lng]);

  return (
    <div className="map-shell">
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
      <div className="map-legend">
        ● Green = your unit
        <br />● Red = patient
      </div>
    </div>
  );
}
