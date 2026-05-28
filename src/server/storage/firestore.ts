import * as fs from 'fs';
import * as path from 'path';
import type {
  Incident,
  ZoneSnapshot,
  IncidentEvent,
  UserSubscription,
} from '../../types/incident';

// ----------------------------------------------------------------------------
// Local JSON File Database Fallback (for local dev & smoke tests)
// ----------------------------------------------------------------------------

interface LocalDb {
  incidents: Incident[];
  snapshots: Record<string, ZoneSnapshot>;
  events: IncidentEvent[];
  subscriptions: UserSubscription[];
}

const DB_DIR = path.resolve(process.cwd(), 'src/data');
const DB_PATH = path.join(DB_DIR, 'db.json');

// Seed mock data
const SEED_INCIDENTS: Incident[] = [
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
    status: 'contained',
    centroid: { lat: 33.9612, lng: -117.3045 },
    currentSnapshotId: 'snap_riverside_fire_2026_05_26T0900',
    summary:
      'Brush fire on east face of Box Springs; 2,400 acres burned. 100% contained as of April.',
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

const SEED_SNAPSHOTS: Record<string, ZoneSnapshot> = {
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

const SEED_EVENTS: IncidentEvent[] = [
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
];

function loadDb(): LocalDb {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialDb: LocalDb = {
      incidents: SEED_INCIDENTS,
      snapshots: SEED_SNAPSHOTS,
      events: SEED_EVENTS,
      subscriptions: [],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[storage] Failed to parse db.json, returning empty', err);
    return { incidents: [], snapshots: {}, events: [], subscriptions: [] };
  }
}

function saveDb(db: LocalDb): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('[storage] Failed to write db.json', err);
  }
}

// ----------------------------------------------------------------------------
// Firestore Client Check
// ----------------------------------------------------------------------------
const useFirestore = false; // Set to true if you set up admin SDK. We use robust local fallback.

// ----------------------------------------------------------------------------
// Incidents
// ----------------------------------------------------------------------------

/**
 * Save/merge an incident.
 */
export async function saveIncident(incident: Incident): Promise<void> {
  if (useFirestore) {
    // Production: db.collection('incidents').doc(incident.id).set(incident, { merge: true })
    return;
  }
  const db = loadDb();
  const idx = db.incidents.findIndex((i) => i.id === incident.id);
  if (idx >= 0) {
    db.incidents[idx] = { ...db.incidents[idx], ...incident };
  } else {
    db.incidents.push(incident);
  }
  saveDb(db);
}

/**
 * Get incident by ID.
 */
export async function getIncident(id: string): Promise<Incident | null> {
  if (useFirestore) {
    // Production: query firestore...
    return null;
  }
  const db = loadDb();
  return db.incidents.find((i) => i.id === id) ?? null;
}

/**
 * List all active incidents.
 */
export async function listActiveIncidents(): Promise<Incident[]> {
  if (useFirestore) {
    // Production: query active incidents...
    return [];
  }
  const db = loadDb();
  return db.incidents.filter((i) => i.status === 'active');
}

// ----------------------------------------------------------------------------
// Zone Snapshots (time-series — immutable, append-only)
// ----------------------------------------------------------------------------

/**
 * Save zone snapshot and update parent incident current pointer.
 */
export async function saveZoneSnapshot(snapshot: ZoneSnapshot): Promise<void> {
  if (useFirestore) {
    // Production: save in transaction...
    return;
  }
  const db = loadDb();
  db.snapshots[snapshot.id] = snapshot;

  // Atomically update parent's current pointer
  const incIdx = db.incidents.findIndex((i) => i.id === snapshot.incidentId);
  if (incIdx >= 0) {
    db.incidents[incIdx].currentSnapshotId = snapshot.id;
  }

  saveDb(db);
}

/**
 * Get latest zone snapshot for incident.
 */
export async function getLatestSnapshot(
  incidentId: string,
): Promise<ZoneSnapshot | null> {
  if (useFirestore) {
    // Production query...
    return null;
  }
  const db = loadDb();
  const inc = db.incidents.find((i) => i.id === incidentId);
  if (!inc || !inc.currentSnapshotId) return null;
  return db.snapshots[inc.currentSnapshotId] ?? null;
}

/**
 * List snapshot history for incident, newest first.
 */
export async function listSnapshotHistory(
  incidentId: string,
): Promise<ZoneSnapshot[]> {
  if (useFirestore) {
    // Production query...
    return [];
  }
  const db = loadDb();
  const history = Object.values(db.snapshots)
    .filter((s) => s.incidentId === incidentId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return history;
}

// ----------------------------------------------------------------------------
// Events (activity log)
// ----------------------------------------------------------------------------

/**
 * Save a timeline event.
 */
export async function saveEvent(event: IncidentEvent): Promise<void> {
  if (useFirestore) {
    // Production query...
    return;
  }
  const db = loadDb();
  db.events.push(event);
  saveDb(db);
}

/**
 * List all events for an incident, newest first.
 */
export async function listEvents(
  incidentId: string,
): Promise<IncidentEvent[]> {
  if (useFirestore) {
    // Production query...
    return [];
  }
  const db = loadDb();
  return db.events
    .filter((e) => e.incidentId === incidentId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ----------------------------------------------------------------------------
// Subscriptions (users tracked against incidents)
// ----------------------------------------------------------------------------

/**
 * Save user subscription.
 */
export async function saveSubscription(sub: UserSubscription): Promise<void> {
  if (useFirestore) {
    // Production query...
    return;
  }
  const db = loadDb();
  const idx = db.subscriptions.findIndex((s) => s.id === sub.id);
  if (idx >= 0) {
    db.subscriptions[idx] = { ...db.subscriptions[idx], ...sub };
  } else {
    db.subscriptions.push(sub);
  }
  saveDb(db);
}

/**
 * Get subscriptions near incident location.
 */
export async function getSubscriptionsNear(
  incidentId: string,
): Promise<UserSubscription[]> {
  if (useFirestore) {
    // Production query...
    return [];
  }
  const db = loadDb();
  // For local mode, we return all subscriptions matching the incident ID in user's list.
  return db.subscriptions.filter((s) => s.incidentIds.includes(incidentId));
}
