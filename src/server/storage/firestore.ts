/**
 * HazAlert — Firestore Storage Layer
 *
 * Typed wrapper around the production Firestore client. The skeleton
 * does not initialize a real connection — every function returns mock
 * data so the rest of the system can be built and reviewed end-to-end.
 *
 * Production wiring:
 *   import { initializeApp, applicationDefault } from 'firebase-admin/app';
 *   import { getFirestore } from 'firebase-admin/firestore';
 *   const app = initializeApp({ credential: applicationDefault() });
 *   const db  = getFirestore(app);
 *
 * Collection layout:
 *   incidents/{incidentId}
 *   incidents/{incidentId}/zoneSnapshots/{snapshotId}
 *   incidents/{incidentId}/events/{eventId}
 *   subscriptions/{subscriptionId}      (top-level; queried by geo + incident)
 */

import type {
  Incident,
  ZoneSnapshot,
  IncidentEvent,
  UserSubscription,
} from '../../types/incident';

// ----------------------------------------------------------------------------
// Incidents
// ----------------------------------------------------------------------------

/**
 * Production query:
 *   db.collection('incidents').doc(incident.id).set(incident, { merge: true })
 */
export async function saveIncident(incident: Incident): Promise<void> {
  void incident;
}

/**
 * Production query:
 *   const snap = await db.collection('incidents').doc(id).get();
 *   return snap.exists ? (snap.data() as Incident) : null;
 */
export async function getIncident(id: string): Promise<Incident | null> {
  void id;
  return null;
}

/**
 * Production query:
 *   db.collection('incidents')
 *     .where('status', '==', 'active')
 *     .orderBy('startedAt', 'desc')
 *     .get()
 */
export async function listActiveIncidents(): Promise<Incident[]> {
  return [];
}

// ----------------------------------------------------------------------------
// Zone Snapshots (time-series — immutable, append-only)
// ----------------------------------------------------------------------------

/**
 * Production query:
 *   db.collection('incidents').doc(snapshot.incidentId)
 *     .collection('zoneSnapshots').doc(snapshot.id).set(snapshot)
 *
 *   // Then atomically update the parent's currentSnapshotId pointer:
 *   db.collection('incidents').doc(snapshot.incidentId)
 *     .update({ currentSnapshotId: snapshot.id })
 *
 * Both ops live in a single transaction so readers never observe a
 * parent pointer that lags the subcollection write.
 */
export async function saveZoneSnapshot(snapshot: ZoneSnapshot): Promise<void> {
  void snapshot;
}

/**
 * Production query:
 *   const inc = await db.collection('incidents').doc(incidentId).get();
 *   const ptr = inc.data()?.currentSnapshotId;
 *   if (!ptr) return null;
 *   const snap = await inc.ref.collection('zoneSnapshots').doc(ptr).get();
 *   return snap.exists ? (snap.data() as ZoneSnapshot) : null;
 */
export async function getLatestSnapshot(
  incidentId: string,
): Promise<ZoneSnapshot | null> {
  void incidentId;
  return null;
}

/**
 * Production query — full history, newest first:
 *   db.collection('incidents').doc(incidentId)
 *     .collection('zoneSnapshots')
 *     .orderBy('timestamp', 'desc')
 *     .limit(500)
 *     .get()
 */
export async function listSnapshotHistory(
  incidentId: string,
): Promise<ZoneSnapshot[]> {
  void incidentId;
  return [];
}

// ----------------------------------------------------------------------------
// Events (activity log)
// ----------------------------------------------------------------------------

/**
 * Production query:
 *   db.collection('incidents').doc(event.incidentId)
 *     .collection('events').doc(event.id).set(event)
 */
export async function saveEvent(event: IncidentEvent): Promise<void> {
  void event;
}

/**
 * Production query:
 *   db.collection('incidents').doc(incidentId)
 *     .collection('events')
 *     .orderBy('timestamp', 'desc')
 *     .limit(200)
 *     .get()
 */
export async function listEvents(
  incidentId: string,
): Promise<IncidentEvent[]> {
  void incidentId;
  return [];
}

// ----------------------------------------------------------------------------
// Subscriptions (users tracked against incidents)
// ----------------------------------------------------------------------------

/**
 * Production query:
 *   db.collection('subscriptions').doc(sub.id).set(sub, { merge: true })
 *
 * On write, a Firestore trigger maintains a geohash index for fast
 * "subscriptions within N km of point" lookups.
 */
export async function saveSubscription(sub: UserSubscription): Promise<void> {
  void sub;
}

/**
 * Production query — every subscription tracked against this incident.
 * For large-scale fanout (50k+ subs) this returns a Firestore async
 * iterator and the caller batches writes.
 *
 *   db.collection('subscriptions')
 *     .where('incidentIds', 'array-contains', incidentId)
 *     .stream()
 */
export async function getSubscriptionsNear(
  incidentId: string,
): Promise<UserSubscription[]> {
  void incidentId;
  return [];
}
