// Google Maps Geocoding API (REST).
// Docs: https://developers.google.com/maps/documentation/geocoding/overview

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export async function geocode(query) {
  if (!query) return null;
  if (!KEY) throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY');

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', KEY);
  // Bias to Orange County, CA for hackathon demo addresses
  url.searchParams.set('region', 'us');
  url.searchParams.set(
    'bounds',
    '33.65,-118.10|33.90,-117.80',
  );

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    if (data.status === 'ZERO_RESULTS') return null;
    throw new Error(`Geocoding error: ${data.status} ${data.error_message || ''}`);
  }
  const top = data.results[0];
  return {
    lat: top.geometry.location.lat,
    lng: top.geometry.location.lng,
    formattedAddress: top.formatted_address,
  };
}

// Reverse-geocoding for "Use my location"
export async function reverseGeocode({ lat, lng }) {
  if (!KEY) throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY');
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', KEY);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Reverse geocode HTTP ${res.status}`);
  const data = await res.json();
  return data.results?.[0]?.formatted_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
