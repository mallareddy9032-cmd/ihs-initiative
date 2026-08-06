export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function etaMinutesFromKm(km: number): number {
  return Math.max(4, Math.round(km * 2.8));
}

export function googleMapsNavUrl(dest: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`;
}

export function wazeNavUrl(dest: { lat: number; lng: number }): string {
  return `https://waze.com/ul?ll=${dest.lat}%2C${dest.lng}&navigate=yes`;
}
