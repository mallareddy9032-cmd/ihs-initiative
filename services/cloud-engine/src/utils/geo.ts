// ============================================================================
// FILE: src/utils/geo.ts
// CONTEXT: Geospatial routing and Dual-Pin Geofencing
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calculates the great-circle distance between two GPS coordinates.
 * Returns the exact distance in meters.
 */
export function calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  if (
    typeof coord1?.lat !== 'number' ||
    typeof coord1?.lng !== 'number' ||
    typeof coord2?.lat !== 'number' ||
    typeof coord2?.lng !== 'number' ||
    Number.isNaN(coord1.lat) ||
    Number.isNaN(coord1.lng) ||
    Number.isNaN(coord2.lat) ||
    Number.isNaN(coord2.lng)
  ) {
    throw new Error('CRITICAL: Invalid GPS coordinates supplied to Haversine calculator.');
  }

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

  // Output distance in meters
  return EARTH_RADIUS_METERS * c;
}

/**
 * Alias used by Command Center Dual-Pin UI components.
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  return calculateHaversineDistance(coord1, coord2);
}
