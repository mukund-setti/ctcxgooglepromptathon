/**
 * HazAlert — Incidents API Router
 *
 * Express router exposing the generic /api/incidents surface area. In the
 * current demo build this returns mock JSON; in production each handler
 * reads from Firestore via the storage layer (../storage/firestore.ts).
 *
 * Mount in the main server with:
 *   import { incidentsRouter } from './server/incidents/router';
 *   app.use('/api/incidents', incidentsRouter);
 */

import { Router, type Request, type Response } from 'express';
import type {
  Incident,
  ZoneSnapshot,
  IncidentEvent,
  LatLng,
} from '../../types/incident';

export const incidentsRouter = Router();

// ----------------------------------------------------------------------------
// Mock data — replace with Firestore reads in production.
// ----------------------------------------------------------------------------

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'inc_gg_mma_2026_05_21',
    name: 'Garden Grove Chemical Leak',
    type: 'chemical',
    hazardSubstance: 'Methyl Methacrylate (MMA)',
    facility: 'GKN Aerospace',
    startedAt: '2026-05-21T10:00:00-07:00',
    status: 'active',
    centroid: { lat: 33.78, lng: -117.955 },
    currentSnapshotId: 'snap_gg_mma_2026_05_21T1400',
    summary:
      'Industrial chemical release at GKN Aerospace; SW winds carrying plume NE toward residential Garden Grove.',
  },
  {
    id: 'inc_riverside_fire_2026_05_24',
    name: 'Box Springs Wildfire',
    type: 'wildfire',
    facility: 'Box Springs Mountain Reserve',
    startedAt: '2026-05-24T13:42:00-07:00',
    status: 'active',
    centroid: { lat: 33.9612, lng: -117.3045 },
    currentSnapshotId: 'snap_riverside_fire_2026_05_26T0900',
    summary:
      'Brush fire on east face of Box Springs; 2,400 acres burned, 18% contained. Mandatory evacuation for east Riverside foothills.',
  },
  {
    id: 'inc_sac_flood_2026_03_15',
    name: 'American River Levee Overtopping',
    type: 'flood',
    facility: 'American River — Watt Ave bridge',
    startedAt: '2026-03-15T04:20:00-07:00',
    status: 'contained',
    centroid: { lat: 38.5811, lng: -121.395 },
    currentSnapshotId: 'snap_sac_flood_2026_03_18T1000',
    summary:
      'Levee overtopping along American River reach; waters receded as of 2026-03-18. Damage assessment ongoing.',
  },
];

const MOCK_SNAPSHOTS: Record<string, ZoneSnapshot> = {
  snap_gg_mma_2026_05_21T1400: {
    id: 'snap_gg_mma_2026_05_21T1400',
    incidentId: 'inc_gg_mma_2026_05_21',
    timestamp: '2026-05-21T14:00:00-07:00',
    source: 'county_gis',
    zones: [
      {
        level: 'mandatory',
        color: '#DC2626',
        label: 'Mandatory Evacuation',
        guidance:
          'Leave immediately. Head northeast, away from the plume. Take pets, medications, and ID.',
        polygon: [
          { lat: 33.79, lng: -117.965 },
          { lat: 33.79, lng: -117.945 },
          { lat: 33.77, lng: -117.945 },
          { lat: 33.77, lng: -117.965 },
        ],
      },
      {
        level: 'shelter_in_place',
        color: '#F59E0B',
        label: 'Shelter-in-Place',
        guidance:
          'Stay indoors. Close windows and doors. Seal vents with damp towels. Turn off HVAC.',
        polygon: [
          { lat: 33.805, lng: -117.975 },
          { lat: 33.805, lng: -117.935 },
          { lat: 33.76, lng: -117.935 },
          { lat: 33.76, lng: -117.975 },
        ],
      },
      {
        level: 'watch',
        color: '#FB923C',
        label: 'Watch Zone — Be Ready',
        guidance:
          'Pack a go-bag with medications, IDs, and pet supplies. Monitor official updates.',
        polygon: [
          { lat: 33.82, lng: -117.99 },
          { lat: 33.82, lng: -117.92 },
          { lat: 33.745, lng: -117.92 },
          { lat: 33.745, lng: -117.99 },
        ],
      },
    ],
  },
  snap_riverside_fire_2026_05_26T0900: {
    id: 'snap_riverside_fire_2026_05_26T0900',
    incidentId: 'inc_riverside_fire_2026_05_24',
    timestamp: '2026-05-26T09:00:00-07:00',
    source: 'ipaws',
    zones: [
      {
        level: 'mandatory',
        color: '#DC2626',
        label: 'Mandatory Evacuation — Zones RIV-E-12, RIV-E-13',
        guidance:
          'Leave now via westbound I-215 or 60. Do not delay. Embers may travel 1+ miles ahead of the fire front.',
        polygon: [
          { lat: 33.98, lng: -117.31 },
          { lat: 33.98, lng: -117.28 },
          { lat: 33.94, lng: -117.28 },
          { lat: 33.94, lng: -117.31 },
        ],
      },
      {
        level: 'watch',
        color: '#FB923C',
        label: 'Evacuation Warning — Zone RIV-E-14',
        guidance:
          'Be prepared to leave. Move vehicles facing out. Charge phones. Confirm out-of-area contact.',
        polygon: [
          { lat: 34.0, lng: -117.33 },
          { lat: 34.0, lng: -117.26 },
          { lat: 33.92, lng: -117.26 },
          { lat: 33.92, lng: -117.33 },
        ],
      },
    ],
  },
  snap_sac_flood_2026_03_18T1000: {
    id: 'snap_sac_flood_2026_03_18T1000',
    incidentId: 'inc_sac_flood_2026_03_15',
    timestamp: '2026-03-18T10:00:00-07:00',
    source: 'county_gis',
    zones: [
      {
        level: 'advisory',
        color: '#3B82F6',
        label: 'Flood Advisory — Residual',
        guidance:
          'Waters have receded. Avoid flooded basements and report damage to Sacramento OES.',
        polygon: [
          { lat: 38.6, lng: -121.41 },
          { lat: 38.6, lng: -121.37 },
          { lat: 38.56, lng: -121.37 },
          { lat: 38.56, lng: -121.41 },
        ],
      },
    ],
  },
};

const MOCK_EVENTS: Record<string, IncidentEvent[]> = {
  inc_gg_mma_2026_05_21: [
    {
      id: 'evt_gg_001',
      incidentId: 'inc_gg_mma_2026_05_21',
      timestamp: '2026-05-21T10:04:00-07:00',
      type: 'sensor_reading',
      source: 'county_gis',
      payload: { sensor: 'OC-AQMD-GG-04', ppm: 41, threshold: 25 },
    },
    {
      id: 'evt_gg_002',
      incidentId: 'inc_gg_mma_2026_05_21',
      timestamp: '2026-05-21T10:12:00-07:00',
      type: 'press_release',
      source: 'news_extraction',
      payload: {
        agency: 'OC Fire Authority',
        headline: 'Hazmat response active at GKN Aerospace facility',
      },
    },
    {
      id: 'evt_gg_003',
      incidentId: 'inc_gg_mma_2026_05_21',
      timestamp: '2026-05-21T10:45:00-07:00',
      type: 'shelter_opened',
      source: 'manual',
      payload: {
        name: 'Magnolia High School',
        address: '2450 W Ball Rd, Anaheim, CA',
        petFriendly: true,
      },
    },
    {
      id: 'evt_gg_004',
      incidentId: 'inc_gg_mma_2026_05_21',
      timestamp: '2026-05-21T14:00:00-07:00',
      type: 'zone_change',
      source: 'county_gis',
      payload: {
        change: 'mandatory_expanded',
        newSnapshotId: 'snap_gg_mma_2026_05_21T1400',
      },
    },
  ],
  inc_riverside_fire_2026_05_24: [
    {
      id: 'evt_rv_001',
      incidentId: 'inc_riverside_fire_2026_05_24',
      timestamp: '2026-05-24T13:42:00-07:00',
      type: 'press_release',
      source: 'ipaws',
      payload: { agency: 'CAL FIRE', headline: 'Box Springs Fire — Initial Attack' },
    },
    {
      id: 'evt_rv_002',
      incidentId: 'inc_riverside_fire_2026_05_24',
      timestamp: '2026-05-25T22:10:00-07:00',
      type: 'road_closure',
      source: 'county_gis',
      payload: { road: 'CA-60 EB at Pigeon Pass', reason: 'Active fire over roadway' },
    },
  ],
  inc_sac_flood_2026_03_15: [],
};

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

/** GET /api/incidents — list all active incidents */
incidentsRouter.get('/', (_req: Request, res: Response) => {
  // Production: storage.listActiveIncidents()
  const active = MOCK_INCIDENTS.filter((i) => i.status === 'active');
  res.json({ incidents: active });
});

/** GET /api/incidents/near?lat=&lng= — find nearest active incident */
incidentsRouter.get('/near', (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng query params required' });
  }
  // Production: a Firestore geo-bounded query plus haversine sort.
  const active = MOCK_INCIDENTS.filter((i) => i.status === 'active');
  const nearest = active
    .map((i) => ({ incident: i, distanceKm: haversineKm({ lat, lng }, i.centroid) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
  res.json({ nearest: nearest ?? null });
});

/** GET /api/incidents/:id — incident detail with current zones */
incidentsRouter.get('/:id', (req: Request, res: Response) => {
  const incident = MOCK_INCIDENTS.find((i) => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'incident not found' });
  const currentSnapshot = MOCK_SNAPSHOTS[incident.currentSnapshotId] ?? null;
  res.json({ incident, currentSnapshot });
});

/** GET /api/incidents/:id/snapshots — zone snapshot history (time series) */
incidentsRouter.get('/:id/snapshots', (req: Request, res: Response) => {
  // Production: storage.listSnapshotHistory(req.params.id) ordered by timestamp DESC.
  const snapshots = Object.values(MOCK_SNAPSHOTS).filter(
    (s) => s.incidentId === req.params.id,
  );
  if (snapshots.length === 0)
    return res.status(404).json({ error: 'no snapshots for incident' });
  res.json({ snapshots });
});

/** GET /api/incidents/:id/events — activity log */
incidentsRouter.get('/:id/events', (req: Request, res: Response) => {
  const events = MOCK_EVENTS[req.params.id] ?? [];
  res.json({ events });
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
