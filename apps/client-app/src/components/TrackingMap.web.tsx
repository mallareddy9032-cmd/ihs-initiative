// ============================================================================
// FILE: src/components/TrackingMap.web.tsx
// CONTEXT: Leaflet / OpenStreetMap live ambulance + patient pins (Chrome)
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export interface TrackingMapProps {
  patientLat: number;
  patientLng: number;
  vehicleLat: number;
  vehicleLng: number;
  height?: number;
}

export const TrackingMap: React.FC<TrackingMapProps> = ({
  patientLat,
  patientLng,
  vehicleLat,
  vehicleLng,
  height = 280,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let resizeHandler: (() => void) | undefined;

    void (async () => {
      try {
        const leaflet = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        const L = leaflet.default;
        if (cancelled || !hostRef.current || mapRef.current) return;

        const map = L.map(hostRef.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([patientLat, patientLng], 14);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
        }).addTo(map);

        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setReady(true);

        resizeHandler = () => map.invalidateSize();
        window.addEventListener('resize', resizeHandler);
        window.setTimeout(resizeHandler, 60);
        window.setTimeout(resizeHandler, 250);
      } catch (err) {
        console.error('Leaflet map failed', err);
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

  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) return;

    void (async () => {
      const leaflet = await import('leaflet');
      const L = leaflet.default;
      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();

      const icon = (color: string, title: string) =>
        L.divIcon({
          className: 'ihs-track-pin',
          html: `<div title="${title}" style="width:16px;height:16px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

      L.marker([patientLat, patientLng], {
        icon: icon('#3B82F6', 'You'),
        title: 'Your location',
      })
        .bindPopup('<strong>You</strong>')
        .addTo(layer);

      L.marker([vehicleLat, vehicleLng], {
        icon: icon('#EF4444', 'Ambulance'),
        title: 'Ambulance',
      })
        .bindPopup('<strong>Ambulance AMB-VSKP-07</strong>')
        .addTo(layer);

      L.polyline(
        [
          [vehicleLat, vehicleLng],
          [patientLat, patientLng],
        ],
        { color: '#BEF264', weight: 3, opacity: 0.9, dashArray: '6 6' },
      ).addTo(layer);

      const bounds = L.latLngBounds([
        [patientLat, patientLng],
        [vehicleLat, vehicleLng],
      ]);
      map.fitBounds(bounds.pad(0.45), { maxZoom: 16, animate: true });
      window.setTimeout(() => map.invalidateSize(), 40);
    })();
  }, [ready, patientLat, patientLng, vehicleLat, vehicleLng]);

  return (
    <View style={[styles.wrap, { height }]}>
      <View
        // RNW View is a real HTMLDivElement — required by Leaflet
        ref={hostRef as unknown as React.RefObject<View>}
        style={styles.mapHost}
      />
      <View style={styles.legend} pointerEvents="none">
        <Text style={styles.legendText}>● You (blue) · ● Ambulance (red)</Text>
        <Text style={styles.legendSub}>OpenStreetMap · Leaflet</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    position: 'relative',
  },
  mapHost: {
    ...StyleSheet.absoluteFillObject,
  },
  legend: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 500,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  legendSub: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
});
