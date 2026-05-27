/**
 * HazAlert — Ingestion Scheduler
 *
 * The polling loop that keeps incident state fresh. In production this
 * runs as a Cloud Scheduler -> Cloud Function pair firing every 60s.
 * Locally it can be invoked via `runOnce()` for testing.
 */

import {
  fetchIpawsAlerts,
  fetchCountyGisLayer,
  diffSnapshots,
} from './sources';
import * as storage from '../storage/firestore';
import { notifyZoneTransition } from '../notifications/dispatcher';
import type { ZoneSnapshot, UserSubscription, LatLng } from '../../types/incident';

const POLL_INTERVAL_MS = 60_000;

/**
 * Main poll loop. Iterates every active incident, pulls the latest state
 * from every configured source, diffs against the most recent snapshot,
 * and — if anything changed — writes a new snapshot and fans out
 * notifications.
 *
 * Cloud-Scheduler config (terraform sketch):
 *   resource "google_cloud_scheduler_job" "hazalert_poll" {
 *     schedule  = "* * * * *"      # every minute
 *     time_zone = "America/Los_Angeles"
 *     http_target { uri = "${cloud_function_url}/pollActiveIncidents" }
 *   }
 */
export async function pollActiveIncidents(): Promise<void> {
  const active = await storage.listActiveIncidents();

  for (const incident of active) {
    // 1. Fetch latest state from every source in parallel.
    //    Each source returns 0..n snapshots — IPAWS may have many alerts,
    //    a county feed returns exactly one current snapshot per county.
    const [ipaws, countyLayer] = await Promise.all([
      fetchIpawsAlerts(),
      fetchCountyGisLayer(incident.facility ?? 'orange'),
    ]);

    // 2. Pick the most authoritative snapshot for this incident. Priority:
    //    county_gis > ipaws > news_extraction. (Counties publish polygons
    //    of record; IPAWS alerts are coarser; news extraction is fuzziest.)
    const candidate = pickAuthoritative(incident.id, [...countyLayer, ...ipaws]);
    if (!candidate) continue;

    // 3. Diff against the last stored snapshot.
    const previous = await storage.getLatestSnapshot(incident.id);
    const diff = diffSnapshots(previous, candidate);
    if (!diff.hasChanges) continue;

    // 4. Persist the new snapshot (immutable — never overwrite the old one).
    await storage.saveZoneSnapshot(candidate);

    // 5. Log a zone_change event for the activity timeline.
    await storage.saveEvent({
      id: `evt_${incident.id}_${Date.now()}`,
      incidentId: incident.id,
      timestamp: new Date().toISOString(),
      type: 'zone_change',
      source: candidate.source,
      payload: { diff, newSnapshotId: candidate.id },
    });

    // 6. Fan out notifications to affected users.
    await notifySubscribers(candidate, previous);
  }
}

/**
 * For every user subscribed to this incident, re-run point-in-polygon
 * against the new snapshot. If their zone level changed (e.g. watch ->
 * mandatory), fire a notification on each enabled channel.
 *
 * Performance note: in production this is a parallel batch — for a
 * county-wide evacuation we may notify 50k+ users in a single tick. The
 * dispatcher batches Firebase Cloud Messaging into groups of 500 and
 * uses Twilio's bulk SMS API.
 */
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

      // Update subscriber state
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

/**
 * High-fidelity point-in-polygon zone checks.
 */
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

function pickAuthoritative(
  incidentId: string,
  candidates: ZoneSnapshot[],
): ZoneSnapshot | null {
  const filtered = candidates.filter((c) => c.incidentId === incidentId);
  if (filtered.length === 0) return null;
  const priority: Record<string, number> = {
    county_gis: 0,
    ipaws: 1,
    news_extraction: 2,
    manual: 3,
  };
  return filtered.sort(
    (a, b) => (priority[a.source] ?? 99) - (priority[b.source] ?? 99),
  )[0];
}

/**
 * Convenience entrypoint for local testing.
 *   npx tsx src/server/ingestion/scheduler.ts
 */
export async function runOnce(): Promise<void> {
  console.log('[scheduler] running single pass…');
  await pollActiveIncidents();
  console.log('[scheduler] done.');
}

/**
 * Long-running mode for local dev (in production, Cloud Scheduler handles
 * cadence and the function is stateless).
 */
export function startLocalLoop(): NodeJS.Timeout {
  // eslint-disable-next-line no-console
  console.log(`[scheduler] starting local loop @ ${POLL_INTERVAL_MS}ms`);
  return setInterval(() => {
    pollActiveIncidents().catch((err) => console.error('[scheduler]', err));
  }, POLL_INTERVAL_MS);
}
