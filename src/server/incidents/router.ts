/**
 * HazAlert — Incidents API Router
 *
 * Express router exposing the generic /api/incidents surface area. In the
 * current demo build this reads from our persistent Firestore / local JSON DB
 * via the storage layer (../storage/firestore.ts).
 */

import { Router, type Request, type Response } from 'express';
import * as storage from '../storage/firestore';
import { parseCapXml, extractIncidentFromNews } from '../ingestion/sources';
import type {
  Incident,
  ZoneSnapshot,
  IncidentEvent,
  UserSubscription,
  LatLng,
} from '../../types/incident';

export const incidentsRouter = Router();

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------

/** GET /api/incidents — list all active incidents */
incidentsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const active = await storage.listActiveIncidents();
    res.json({ incidents: active });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/incidents/near?lat=&lng= — find nearest active incident */
incidentsRouter.get('/near', async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng query params required' });
  }

  try {
    const active = await storage.listActiveIncidents();
    if (active.length === 0) {
      return res.json({ nearest: null });
    }

    const nearest = active
      .map((i) => ({ incident: i, distanceKm: haversineKm({ lat, lng }, i.centroid) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];

    res.json({ nearest: nearest ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/incidents/:id — incident detail with current zones */
incidentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const incident = await storage.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ error: 'incident not found' });
    const currentSnapshot = await storage.getLatestSnapshot(incident.id);
    res.json({ incident, currentSnapshot });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/incidents/:id/snapshots — zone snapshot history (time series) */
incidentsRouter.get('/:id/snapshots', async (req: Request, res: Response) => {
  try {
    const snapshots = await storage.listSnapshotHistory(req.params.id);
    if (snapshots.length === 0) {
      return res.status(404).json({ error: 'no snapshots for incident' });
    }
    res.json({ snapshots });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/incidents/:id/events — activity log */
incidentsRouter.get('/:id/events', async (req: Request, res: Response) => {
  try {
    const events = await storage.listEvents(req.params.id);
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/incidents/:id/subscribe — subscribe a user session to dynamic alert transitions */
incidentsRouter.post('/:id/subscribe', async (req: Request, res: Response) => {
  const incidentId = req.params.id;
  const { sessionId, lat, lng, channels } = req.body;

  if (!sessionId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'sessionId, lat, and lng are required' });
  }

  try {
    const sub: UserSubscription = {
      id: `sub_${sessionId}_${incidentId}`,
      sessionId,
      lat,
      lng,
      incidentIds: [incidentId],
      notificationChannels: channels || ['web_push'],
    };

    await storage.saveSubscription(sub);
    res.json({ success: true, subscription: sub });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/incidents/ingest — manually trigger ingestion of CAP XML or raw press release text */
incidentsRouter.post('/ingest', async (req: Request, res: Response) => {
  const { capXml, articleText } = req.body;

  try {
    if (capXml) {
      // 1. FEMA CAP XML Ingestion
      const snapshot = parseCapXml(capXml);
      if (!snapshot) {
        return res.status(400).json({ error: 'Failed to parse CAP XML' });
      }

      // Check if incident exists, if not create a stub
      let incident = await storage.getIncident(snapshot.incidentId);
      if (!incident) {
        incident = {
          id: snapshot.incidentId,
          name: snapshot.zones[0]?.label || 'FEMA Ingested Alert',
          type: 'chemical', // Default fallback type
          startedAt: snapshot.timestamp,
          status: 'active',
          centroid: snapshot.zones[0]?.polygon[0] || { lat: 0, lng: 0 },
          currentSnapshotId: snapshot.id,
          summary: `Ingested federal CAP warning.`,
        };
        // Infer hazard type from title
        const lowerLabel = incident.name.toLowerCase();
        if (lowerLabel.includes('fire') || lowerLabel.includes('wildfire')) {
          incident.type = 'wildfire';
        } else if (lowerLabel.includes('flood') || lowerLabel.includes('water')) {
          incident.type = 'flood';
        }
        await storage.saveIncident(incident);
      }

      await storage.saveZoneSnapshot(snapshot);

      // Log a timeline event
      await storage.saveEvent({
        id: `evt_ingest_${snapshot.id}`,
        incidentId: incident.id,
        timestamp: new Date().toISOString(),
        type: 'zone_change',
        source: 'ipaws',
        payload: { headline: incident.name, newSnapshotId: snapshot.id },
      });

      return res.json({ success: true, incident, snapshot });
    }

    if (articleText) {
      // 2. Gemini News Extraction Ingestion
      const parsedIncident = await extractIncidentFromNews(articleText);
      if (!parsedIncident || !parsedIncident.name || !parsedIncident.type) {
        return res.status(400).json({ error: 'Failed to extract structured incident data' });
      }

      const id = `inc_gemini_${parsedIncident.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const incident: Incident = {
        id,
        name: parsedIncident.name,
        type: parsedIncident.type,
        hazardSubstance: parsedIncident.hazardSubstance,
        facility: parsedIncident.facility,
        startedAt: parsedIncident.startedAt || new Date().toISOString(),
        status: 'active',
        centroid: parsedIncident.centroid || { lat: 33.78, lng: -117.955 },
        currentSnapshotId: `snap_gis_${id}_initial`,
        summary: parsedIncident.summary,
      };

      await storage.saveIncident(incident);

      // Generate a mock initial snapshot for this newly parsed incident
      const initialSnapshot: ZoneSnapshot = {
        id: incident.currentSnapshotId,
        incidentId: incident.id,
        timestamp: incident.startedAt,
        source: 'news_extraction',
        zones: [
          {
            level: 'mandatory',
            color: '#DC2626',
            label: 'Mandatory Evacuation Zone',
            guidance: 'Leave the area immediately. Pack essentials, pets, and medications.',
            polygon: [
              { lat: incident.centroid.lat + 0.01, lng: incident.centroid.lng - 0.01 },
              { lat: incident.centroid.lat + 0.01, lng: incident.centroid.lng + 0.01 },
              { lat: incident.centroid.lat - 0.01, lng: incident.centroid.lng + 0.01 },
              { lat: incident.centroid.lat - 0.01, lng: incident.centroid.lng - 0.01 },
            ],
          },
        ],
      };

      await storage.saveZoneSnapshot(initialSnapshot);

      // Log a timeline event
      await storage.saveEvent({
        id: `evt_ingest_${incident.id}`,
        incidentId: incident.id,
        timestamp: new Date().toISOString(),
        type: 'press_release',
        source: 'news_extraction',
        payload: { agency: incident.facility || 'Official Release', headline: incident.name },
      });

      return res.json({ success: true, incident, snapshot: initialSnapshot });
    }

    return res.status(400).json({ error: 'Provide capXml or articleText parameter' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
