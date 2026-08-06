// ============================================================================
// FILE: src/components/map/MapComponent.tsx
// CONTEXT: Dual-Pin map — Leaflet/OSM (client-only, no Mapbox token)
// ============================================================================

'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface GpsPin {
  lat: number;
  lng: number;
}

interface MapComponentProps {
  bluePin: GpsPin;
  redPin: GpsPin;
}

/**
 * Interactive dual-pin map using Leaflet + Carto/OSM tiles.
 * Works without a Mapbox token. Blue = home base, Red = live GPS.
 */
export const MapComponent: React.FC<MapComponentProps> = ({ bluePin, redPin }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mount map once on the client (Leaflet touches `window` at import time)
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
        }).setView([bluePin.lat, bluePin.lng], 14);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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

  // Update markers whenever pins change
  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) return;

    void (async () => {
      const leaflet = await import('leaflet');
      const L = leaflet.default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();

      const makeIcon = (color: string, title: string) =>
        L.divIcon({
          className: 'ihs-map-pin',
          html: `<div title="${title}" style="
            width:16px;height:16px;border-radius:9999px;
            background:${color};border:2px solid #fff;
            box-shadow:0 0 0 2px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.45);
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

      L.marker([bluePin.lat, bluePin.lng], {
        icon: makeIcon('#3B82F6', 'Blue Pin — Registered Home'),
        title: 'Registered Home Base',
      })
        .bindPopup(
          `<strong>Home Base</strong><br/>${bluePin.lat.toFixed(5)}, ${bluePin.lng.toFixed(5)}`,
        )
        .addTo(layer);

      L.marker([redPin.lat, redPin.lng], {
        icon: makeIcon('#EF4444', 'Red Pin — Live GPS'),
        title: 'Live Patient GPS',
      })
        .bindPopup(
          `<strong>Live GPS</strong><br/>${redPin.lat.toFixed(5)}, ${redPin.lng.toFixed(5)}`,
        )
        .addTo(layer);

      L.polyline(
        [
          [bluePin.lat, bluePin.lng],
          [redPin.lat, redPin.lng],
        ],
        { color: '#FBBF24', weight: 2, opacity: 0.85, dashArray: '6 6' },
      ).addTo(layer);

      const bounds = L.latLngBounds([
        [bluePin.lat, bluePin.lng],
        [redPin.lat, redPin.lng],
      ]);
      map.fitBounds(bounds.pad(0.4), { maxZoom: 16, animate: true });
      window.setTimeout(() => map.invalidateSize(), 40);
    })();
  }, [ready, bluePin.lat, bluePin.lng, redPin.lat, redPin.lng]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#F2F2F7] text-[#FF9500] font-mono text-sm p-6 text-center">
        MAP UNAVAILABLE — {error}
        <span className="text-[#8E8E93] mt-2 block">
          Blue: {bluePin.lat.toFixed(5)}, {bluePin.lng.toFixed(5)} · Red:{' '}
          {redPin.lat.toFixed(5)}, {redPin.lng.toFixed(5)}
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#E8E8ED]">
      <div ref={containerRef} className="h-full w-full z-0" />
      <div className="absolute bottom-3 left-3 z-[1000] rounded-2xl bg-white/90 backdrop-blur-xl border border-black/5 px-3 py-2 text-xs font-mono text-[#1C1C1E] space-y-1 pointer-events-none shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#007AFF] border border-white" />
          Home base
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-[#FF2D55] border border-white" />
          Live GPS
        </div>
        <div className="text-[#8E8E93] pt-1">OpenStreetMap · Leaflet</div>
      </div>
    </div>
  );
};
