import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/mapsLoader.js';
import { useI18n } from '../lib/i18n.jsx';

const ZONE_STYLE = {
  mandatory: { fillColor: '#DC2626', strokeColor: '#FCA5A5' },
  shelter_in_place: { fillColor: '#F59E0B', strokeColor: '#FCD34D' },
  watch: { fillColor: '#FB923C', strokeColor: '#FDBA74' },
};

export default function MapView({ userPoint, level, route, incident, zones, shelters }) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const shelterMarkersRef = useRef([]);
  const closureMarkersRef = useRef([]);
  const zonesRef = useRef([]);
  const routeLineRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  // 1. Load the Maps JS API once.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !containerRef.current) return;
        const initialCentroid = incident?.centroid || { lat: 33.78, lng: -117.955 };
        const map = new google.maps.Map(containerRef.current, {
          center: initialCentroid,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: DARK_MAP_STYLE,
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError(err.message || 'Failed to load map');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Draw zones, shelters, and closures dynamically when selected incident or datasets change.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = window.google;
    const map = mapRef.current;

    // Clear existing overlays
    zonesRef.current.forEach((z) => z.setMap(null));
    zonesRef.current = [];
    shelterMarkersRef.current.forEach((s) => s.setMap(null));
    shelterMarkersRef.current = [];
    closureMarkersRef.current.forEach((c) => c.setMap(null));
    closureMarkersRef.current = [];

    // Recenter and zoom to epicenter only if there's no userPoint
    if (!userPoint && incident?.centroid) {
      map.panTo(incident.centroid);
      map.setZoom(incident.type === 'flood' ? 12 : 13);
    }

    // Render new zones
    if (zones && zones.length > 0) {
      for (const zone of zones) {
        const style = ZONE_STYLE[zone.level] || { fillColor: '#3B82F6', strokeColor: '#93C5FD' };
        const poly = new google.maps.Polygon({
          paths: zone.polygon,
          fillColor: style.fillColor,
          fillOpacity: 0.32,
          strokeColor: style.strokeColor,
          strokeOpacity: 0.95,
          strokeWeight: 2,
          map,
        });
        const info = new google.maps.InfoWindow({
          content: `<div style="color:#0f172a;font-weight:600">${zone.label}</div><div style="color:#334155;max-width:240px">${zone.guidance}</div>`,
        });
        poly.addListener('click', (e) => {
          info.setPosition(e.latLng);
          info.open(map);
        });
        zonesRef.current.push(poly);
      }
    }

    // Render new shelters
    if (shelters && shelters.length > 0) {
      for (const s of shelters) {
        const marker = new google.maps.Marker({
          position: { lat: s.lat, lng: s.lng },
          map,
          title: s.name,
          label: { text: 'S', color: 'white', fontWeight: '700' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: '#0ea5e9',
            fillOpacity: 1,
            strokeColor: '#bae6fd',
            strokeWeight: 2,
          },
        });
        const info = new google.maps.InfoWindow({
          content: `<div style="color:#0f172a"><strong>${s.name}</strong><br/>${s.address}<br/>${
            s.petFriendly ? '🐾 ' + t.petFriendly + '<br/>' : ''
          }${s.adaAccessible ? '♿ ' + t.adaAccessible : ''}</div>`,
        });
        marker.addListener('click', () => info.open(map, marker));
        shelterMarkersRef.current.push(marker);
      }
    }

    // Render new closures (mocked dynamically per incident location)
    const activeClosures =
      incident?.id === 'inc_riverside_fire_2026_05_24'
        ? [{ name: 'CA-60 EB at Pigeon Pass', lat: 33.97, lng: -117.30 }]
        : incident?.id === 'inc_sac_flood_2026_03_15'
        ? [{ name: 'Watt Ave Bridge Overpass', lat: 38.581, lng: -121.396 }]
        : [{ name: 'Brookhurst & Garden Grove Blvd', lat: 33.7820, lng: -117.9540 }, { name: 'Magnolia & Trask', lat: 33.7755, lng: -117.9620 }];

    for (const c of activeClosures) {
      const marker = new google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        map,
        title: `${t.roadClosure}: ${c.name}`,
        label: { text: '✕', color: 'white', fontWeight: '700' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#7f1d1d',
          fillOpacity: 1,
          strokeColor: '#fecaca',
          strokeWeight: 2,
        },
      });
      closureMarkersRef.current.push(marker);
    }
  }, [ready, incident?.id, zones, shelters, userPoint, t.petFriendly, t.adaAccessible, t.roadClosure]);

  // 2. Update user marker + recenter when userPoint changes.
  useEffect(() => {
    if (!ready || !userPoint || !mapRef.current) return;
    const google = window.google;
    const position = { lat: userPoint.lat, lng: userPoint.lng };

    if (userMarkerRef.current) {
      userMarkerRef.current.setPosition(position);
    } else {
      userMarkerRef.current = new google.maps.Marker({
        position,
        map: mapRef.current,
        title: t.yourLocation,
        zIndex: 999,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#dbeafe',
          strokeWeight: 4,
        },
      });
    }

    mapRef.current.panTo(position);
    if (mapRef.current.getZoom() < 13) mapRef.current.setZoom(14);
  }, [userPoint, ready, t.yourLocation, incident?.id]);

  // 3. Draw route polyline when provided.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (routeLineRef.current) {
      routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }
    if (!route || !route.path?.length) return;
    const google = window.google;
    routeLineRef.current = new google.maps.Polyline({
      path: route.path,
      strokeColor: '#22d3ee',
      strokeOpacity: 0.95,
      strokeWeight: 5,
      map: mapRef.current,
    });
    const bounds = new google.maps.LatLngBounds();
    route.path.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, 80);
  }, [route, ready]);

  if (error) {
    return (
      <div className="gmap-container flex items-center justify-center p-6 text-center text-red-300 border border-red-900 bg-red-950/40">
        {t.mapError}
        <br />
        <span className="text-xs text-red-200/70 mt-2">{error}</span>
      </div>
    );
  }

  return (
    <div className="relative gmap-container border border-slate-800">
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          {t.mapLoading}
        </div>
      )}
      {/* Legend */}
      {ready && (
        <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-700 rounded-md p-3 text-xs space-y-1 backdrop-blur">
          <div className="font-semibold text-slate-200 mb-1">{t.legend}</div>
          <LegendDot color="#DC2626" label={t.mandatory} />
          <LegendDot color="#F59E0B" label={t.shelterPlace} />
          <LegendDot color="#FB923C" label={t.watch} />
          <LegendDot color="#3b82f6" label={t.yourLocation} />
          <LegendDot color="#0ea5e9" label={t.shelter} />
        </div>
      )}
      {/* Wind indicator */}
      {ready && (
        <div className="absolute top-3 right-3 bg-slate-900/90 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono">
          {t.windDirection}
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-full" style={{ background: color }} />
      <span className="text-slate-300">{label}</span>
    </div>
  );
}

// Subtle dark map style to fit the slate background.
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];
