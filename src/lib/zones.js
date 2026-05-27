// Ray-casting point-in-polygon — replaces google.maps.geometry.poly.containsLocation
// polygon: array of { lat, lng }
export function pointInPolygon(point, polygon) {
  const { lat, lng } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Returns the strictest zone level matching the point, or 'safe'.
// Order matters: mandatory > shelter_in_place > watch > safe.
const SEVERITY = ['mandatory', 'shelter_in_place', 'watch'];

export function classifyPoint(point, zones) {
  for (const level of SEVERITY) {
    const zone = zones.find((z) => z.level === level);
    if (zone && pointInPolygon(point, zone.polygon)) {
      return { level, zone };
    }
  }
  return { level: 'safe', zone: null };
}

// Approximate haversine distance in meters
export function haversine(a, b) {
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Pick the nearest shelter that is NOT inside the mandatory polygon.
export function nearestSafeShelter(point, shelters, zones) {
  const mandatory = zones.find((z) => z.level === 'mandatory');
  const candidates = shelters.filter(
    (s) => !mandatory || !pointInPolygon({ lat: s.lat, lng: s.lng }, mandatory.polygon),
  );
  return candidates
    .map((s) => ({ ...s, distance: haversine(point, s) }))
    .sort((a, b) => a.distance - b.distance)[0];
}
