// ============================================================================
// FILE: src/utils/geo.ts
// CONTEXT: Geospatial Dual-Pin distance helpers (client)
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export function calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);
  const lat1 = toRadians(coord1.lat);
  const lat2 = toRadians(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  return calculateHaversineDistance(coord1, coord2);
}
