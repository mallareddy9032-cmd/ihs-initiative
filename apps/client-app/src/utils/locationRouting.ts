// ============================================================================
// FILE: src/utils/locationRouting.ts
// CONTEXT: Tier 2 Dual-Pin + Tier 3 NRI Proxy dispatch pin selection
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const EARTH_RADIUS_METERS = 6371000;
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

export const evaluateLocationPayload = (
  isProxySponsor: boolean,
  liveDeviceGps: Coordinates,
  registeredHomeGps: Coordinates,
) => {
  if (isProxySponsor) {
    return {
      dispatch_pin: registeredHomeGps,
      is_proxy_dispatch: true,
      warning_flag: 'PROXY_INITIATED_REMOTE' as const,
      deviation_meters: 0,
    };
  }

  const distanceMeters = calculateHaversineDistance(liveDeviceGps, registeredHomeGps);

  if (distanceMeters > 100) {
    return {
      dispatch_pin: liveDeviceGps,
      is_proxy_dispatch: false,
      warning_flag: 'DUAL_PIN_MISMATCH_ALERT' as const,
      deviation_meters: distanceMeters,
    };
  }

  return {
    dispatch_pin: registeredHomeGps,
    is_proxy_dispatch: false,
    warning_flag: null,
    deviation_meters: distanceMeters,
  };
};
