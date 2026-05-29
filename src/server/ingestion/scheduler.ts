/**
 * HazAlert — Ingestion Scheduler
 *
 * Polls the live NWS active-alerts feed every 60s, upserts each alert as an
 * Incident + ZoneSnapshot, diffs against the previously stored snapshot, and
 * fires the notify pipeline on real changes. Seeded demo incidents are
 * preserved so the walkthrough still works alongside live data.
 */

import { fetchNwsActiveAlerts, diffSnapshots } from './sources';
import * as storage from '../storage/firestore';
import { notifyZoneTransition } from '../notifications/dispatcher';
import type { ZoneSnapshot, UserSubscription, LatLng, Incident } from '../../types/incident';

const POLL_INTERVAL_MS = 60_000;

/**
 * NWS-ingested incidents are namespaced with this prefix. Only incidents
 * bearing this prefix are auto-expired when their alert drops off the feed;
 * seeded demo incidents and operator-entered ones are left alone.
 */
const NWS_INCIDENT_PREFIX = 'inc_nws_';

export async function pollActiveIncidents(): Promise<void> {
  const parsed = await fetchNwsActiveAlerts();
  const seenLiveIncidentIds = new Set<string>();
  let upserts = 0;
  let snapshotChanges = 0;

  for (const { incident, snapshot } of parsed) {
    seenLiveIncidentIds.add(incident.id);

    const existing = await storage.getIncident(incident.id);
    if (!existing) {
      await storage.saveIncident(incident);
      upserts++;
    } else if (existing.status !== 'closed') {
      await storage.saveIncident({ ...incident, startedAt: existing.startedAt });
    }

    const previous = await storage.getLatestSnapshot(incident.id);
    const diff = diffSnapshots(previous, snapshot);
    if (!diff.hasChanges) continue;

    await storage.saveZoneSnapshot(snapshot);
    snapshotChanges++;

    await storage.saveEvent({
      id: `evt_${incident.id}_${Date.now()}`,
      incidentId: incident.id,
      timestamp: new Date().toISOString(),
      type: 'zone_change',
      source: snapshot.source,
      payload: { diff, newSnapshotId: snapshot.id },
    });

    await notifySubscribers(snapshot, previous);
  }

  await expireMissingLiveIncidents(seenLiveIncidentIds);

  console.log(
    `[scheduler] tick: ${parsed.length} active NWS alerts, ${upserts} new incidents, ${snapshotChanges} snapshot changes`,
  );
}

async function expireMissingLiveIncidents(seen: Set<string>): Promise<void> {
  const active = await storage.listActiveIncidents();
  for (const inc of active) {
    if (!inc.id.startsWith(NWS_INCIDENT_PREFIX)) continue;
    if (seen.has(inc.id)) continue;
    await storage.saveIncident({ ...inc, status: 'contained' } as Incident);
    await storage.saveEvent({
      id: `evt_${inc.id}_expired_${Date.now()}`,
      incidentId: inc.id,
      timestamp: new Date().toISOString(),
      type: 'zone_change',
      source: 'nws',
      payload: { change: 'alert_dropped_from_feed' },
    });
  }
}

async function notifySubscribers(
  newSnapshot: ZoneSnapshot,
  oldSnapshot: ZoneSnapshot | null,
): Promise<void> {
  const subs = await storage.getSubscriptionsNear(newSnapshot.incidentId);
  await Promise.all(
    subs.map(async (sub: UserSubscription) => {
      const oldLevel = pointInZones(sub, oldSnapshot);
      const newLevel = pointInZones(sub, newSnapshot);
      if (oldLevel === newLevel) return;
      await notifyZoneTransition(sub, oldLevel, newLevel, newSnapshot.incidentId);

      sub.lastKnownZoneLevel = newLevel === 'safe' ? undefined : newLevel;
      sub.lastNotifiedAt = new Date().toISOString();
      await storage.saveSubscription(sub);
    }),
  );
}

function pointInPolygon(point: { lat: number; lng: number }, polygon: LatLng[]): boolean {
  const { lat, lng } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInZones(
  sub: UserSubscription,
  snapshot: ZoneSnapshot | null,
): 'mandatory' | 'shelter_in_place' | 'watch' | 'advisory' | 'safe' {
  if (!snapshot || !snapshot.zones) return 'safe';

  const levels: Array<'mandatory' | 'shelter_in_place' | 'watch' | 'advisory'> = [
    'mandatory',
    'shelter_in_place',
    'watch',
    'advisory',
  ];

  for (const lvl of levels) {
    const zone = snapshot.zones.find((z) => z.level === lvl);
    if (zone && pointInPolygon({ lat: sub.lat, lng: sub.lng }, zone.polygon)) {
      return lvl;
    }
  }

  return 'safe';
}

export async function runOnce(): Promise<void> {
  console.log('[scheduler] running single pass…');
  await pollActiveIncidents();
  console.log('[scheduler] done.');
}

export function startLocalLoop(): NodeJS.Timeout {
  console.log(`[scheduler] starting local loop @ ${POLL_INTERVAL_MS}ms`);
  pollActiveIncidents().catch((err) => console.error('[scheduler]', err));
  return setInterval(() => {
    pollActiveIncidents().catch((err) => console.error('[scheduler]', err));
  }, POLL_INTERVAL_MS);
}
