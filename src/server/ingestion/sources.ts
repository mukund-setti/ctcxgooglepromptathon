/**
 * HazAlert — Data Source Adapters
 *
 * Each function in this module is responsible for pulling data from one
 * upstream source and returning it in our normalized shape. The scheduler
 * (./scheduler.ts) invokes these on a 60s loop. Diff logic lives at the
 * bottom of this file so all snapshot-related code stays co-located.
 */

import type { ZoneSnapshot, Incident, LatLng } from '../../types/incident';

// ----------------------------------------------------------------------------
// FEMA IPAWS — federal alert feed
// ----------------------------------------------------------------------------

/**
 * Fetch active alerts from FEMA's Integrated Public Alert & Warning System.
 *
 * Production implementation:
 *   - Endpoint: https://apps.fema.gov/IPAWSOPEN_EAS_SERVICE/rest/update
 *   - Auth: PIN-based, issued by FEMA after IPAWS-OPEN agreement
 *   - Returns CAP 1.2 XML; we parse <info> blocks into our ZoneSnapshot shape
 *   - Geographic filter applied client-side using <area><polygon> elements
 *   - Cache the last `requestTime` cursor so we only pull deltas
 */
export async function fetchIpawsAlerts(): Promise<ZoneSnapshot[]> {
  // TODO: implement CAP XML fetch + parse. Returning empty array for skeleton.
  return [];
}

// ----------------------------------------------------------------------------
// County GIS feeds — live evacuation polygons
// ----------------------------------------------------------------------------

/**
 * Fetch the current evacuation-zone GeoJSON layer from a county GIS server.
 *
 * Orange County publishes at:
 *   https://ocgis.com/arcpub/rest/services/Safety/Evacuation_Zones/MapServer/0/query
 *     ?where=status='active'&outFields=*&f=geojson
 *
 * Production:
 *   - Each county has its own ArcGIS REST URL (config table per county)
 *   - GeoJSON FeatureCollection → array of ZoneSnapshot.zones entries
 *   - Coordinate order: GeoJSON is [lng, lat]; we swap to {lat, lng}
 *   - Some counties use EPSG:3857 (web mercator) — reproject to WGS84
 */
export async function fetchCountyGisLayer(
  countyName: string,
): Promise<ZoneSnapshot[]> {
  // TODO: fetch + reproject + normalize. Returning empty for skeleton.
  void countyName;
  return [];
}

// ----------------------------------------------------------------------------
// News extraction — unstructured text → structured incident
// ----------------------------------------------------------------------------

/**
 * Extract incident details from a news article or press release using
 * Gemini's structured-output mode.
 *
 * Production prompt skeleton (see src/lib/gemini.js for existing client
 * pattern — this would live server-side instead):
 *
 *   model: gemini-2.0-flash
 *   responseSchema: { type: 'object', properties: {
 *     incidentType: { enum: ['chemical', 'wildfire', 'flood', ...] },
 *     hazardSubstance: { type: 'string' },
 *     facility: { type: 'string' },
 *     startedAt: { type: 'string', format: 'date-time' },
 *     epicenter: { type: 'object', properties: { lat, lng } },
 *     affectedAreas: { type: 'array', items: { type: 'string' } },
 *     evacuationGuidance: { type: 'string' },
 *   }}
 *
 *   System prompt: "You are an emergency-management analyst. Extract
 *   structured incident data from the press release below. If a field
 *   cannot be determined, return null. Do not infer or guess locations."
 *
 * Geocoding of the extracted addresses happens in a follow-up step via
 * src/lib/geocode.js (Google Maps Geocoding API).
 */
export async function extractIncidentFromNews(
  articleText: string,
): Promise<Partial<Incident> | null> {
  // TODO: call Gemini with structured-output schema. Skeleton returns null.
  void articleText;
  return null;
}

// ----------------------------------------------------------------------------
// Diff logic — what changed between two snapshots?
// ----------------------------------------------------------------------------

export interface SnapshotDiff {
  hasChanges: boolean;
  /** Zone levels that expanded (added polygon area). */
  expanded: string[];
  /** Zone levels that contracted. */
  contracted: string[];
  /** Zone levels added that didn't exist in the old snapshot. */
  added: string[];
  /** Zone levels removed (downgraded to safe). */
  removed: string[];
}

/**
 * Compare two snapshots and return a structured diff. Drives:
 *   1. Whether to write a new snapshot at all (skip if no changes)
 *   2. What zone_change event to log
 *   3. Whether to fire user notifications
 *
 * Production implementation uses turf.js (`@turf/area`, `@turf/boolean-contains`)
 * to compute true polygon-area deltas, not just zone-level presence checks.
 */
export function diffSnapshots(
  oldSnapshot: ZoneSnapshot | null,
  newSnapshot: ZoneSnapshot,
): SnapshotDiff {
  if (!oldSnapshot) {
    return {
      hasChanges: true,
      expanded: [],
      contracted: [],
      added: newSnapshot.zones.map((z) => z.level),
      removed: [],
    };
  }

  const oldLevels = new Set(oldSnapshot.zones.map((z) => z.level));
  const newLevels = new Set(newSnapshot.zones.map((z) => z.level));

  const added: string[] = [];
  const removed: string[] = [];
  for (const lvl of newLevels) if (!oldLevels.has(lvl)) added.push(lvl);
  for (const lvl of oldLevels) if (!newLevels.has(lvl)) removed.push(lvl);

  // Production: per-level polygon area comparison via @turf/area.
  // Skeleton stub: treat any vertex-count change as expansion.
  const expanded: string[] = [];
  const contracted: string[] = [];
  for (const z of newSnapshot.zones) {
    const prev = oldSnapshot.zones.find((p) => p.level === z.level);
    if (!prev) continue;
    if (vertexCount(z.polygon) > vertexCount(prev.polygon)) expanded.push(z.level);
    else if (vertexCount(z.polygon) < vertexCount(prev.polygon))
      contracted.push(z.level);
  }

  return {
    hasChanges:
      added.length + removed.length + expanded.length + contracted.length > 0,
    expanded,
    contracted,
    added,
    removed,
  };
}

function vertexCount(polygon: LatLng[]): number {
  return polygon.length;
}
