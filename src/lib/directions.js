// Google Maps Directions API via the JS client (which is already loaded for the map).
// Computes the fastest driving route from origin → destination, optionally avoiding
// a polygon (the mandatory evacuation zone) by checking the resulting polyline.

import { loadGoogleMaps } from './mapsLoader.js';
import { pointInPolygon } from './zones.js';

export async function getRoute({ origin, destination, avoidPolygon }) {
  const google = await loadGoogleMaps();
  const service = new google.maps.DirectionsService();

  // Try the primary route first.
  const primary = await new Promise((resolve, reject) => {
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result, status) => {
        if (status === 'OK') resolve(result);
        else reject(new Error(`Directions: ${status}`));
      },
    );
  });

  // Pick the first route whose path doesn't cross the avoid polygon.
  const routes = primary.routes || [];
  const safe = routes.find((r) => !pathCrossesPolygon(r, avoidPolygon)) || routes[0];
  if (!safe) return null;

  const path = safe.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
  const leg = safe.legs?.[0];
  return {
    path,
    summary: safe.summary,
    distance: leg?.distance?.text,
    duration: leg?.duration?.text,
  };
}

function pathCrossesPolygon(route, polygon) {
  if (!polygon || !polygon.length) return false;
  const path = route.overview_path || [];
  // Sample every N points to keep this cheap.
  const step = Math.max(1, Math.floor(path.length / 50));
  for (let i = 0; i < path.length; i += step) {
    const p = { lat: path[i].lat(), lng: path[i].lng() };
    if (pointInPolygon(p, polygon)) return true;
  }
  return false;
}
