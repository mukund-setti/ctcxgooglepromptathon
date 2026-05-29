/**
 * HazAlert — Data Source Adapters
 *
 * Each function in this module is responsible for pulling data from one
 * upstream source and returning it in our normalized shape. The scheduler
 * (./scheduler.ts) invokes these on a 60s loop. Diff logic lives at the
 * bottom of this file so all snapshot-related code stays co-located.
 */

import type { ZoneSnapshot, Incident, LatLng, ZoneLevel } from '../../types/incident';

// ----------------------------------------------------------------------------
// FEMA IPAWS — federal alert feed (CAP 1.2 XML Parser & Simulator)
// ----------------------------------------------------------------------------

// A robust helper to parse simple XML tags without external dependencies
function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractAllXmlTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

/**
 * Parse a standard CAP 1.2 XML alert into a ZoneSnapshot.
 */
export function parseCapXml(xml: string): ZoneSnapshot | null {
  try {
    const identifier = extractXmlTag(xml, 'identifier');
    if (!identifier) return null;

    const infoBlock = extractXmlTag(xml, 'info');
    if (!infoBlock) return null;

    const event = extractXmlTag(infoBlock, 'event');
    const headline = extractXmlTag(infoBlock, 'headline');
    const description = extractXmlTag(infoBlock, 'description');
    const instruction = extractXmlTag(infoBlock, 'instruction');
    const severity = extractXmlTag(infoBlock, 'severity').toLowerCase();
    const sent = extractXmlTag(xml, 'sent') || new Date().toISOString();

    const areaBlock = extractXmlTag(infoBlock, 'area');
    const polygonStr = extractXmlTag(areaBlock, 'polygon');

    const polygon: LatLng[] = [];
    if (polygonStr) {
      // CAP polygon is a space-separated list of lat,lng pairs: "lat,lng lat,lng ..."
      const pairs = polygonStr.split(/\s+/);
      for (const pair of pairs) {
        const [latVal, lngVal] = pair.split(',').map(Number);
        if (Number.isFinite(latVal) && Number.isFinite(lngVal)) {
          polygon.push({ lat: latVal, lng: lngVal });
        }
      }
    }

    // Determine warning level based on CAP severity
    let level: ZoneLevel = 'advisory';
    let color = '#3B82F6';
    let label = 'FEMA Advisory';
    if (severity === 'extreme') {
      level = 'mandatory';
      color = '#DC2626';
      label = 'Mandatory Evacuation (FEMA)';
    } else if (severity === 'severe') {
      level = 'shelter_in_place';
      color = '#F59E0B';
      label = 'Shelter-in-Place (FEMA)';
    } else if (severity === 'moderate') {
      level = 'watch';
      color = '#FB923C';
      label = 'Watch Zone (FEMA)';
    }

    // Build unique incident ID based on headline/event
    const incidentId = `inc_fema_${event.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    return {
      id: `snap_fema_${identifier}_${Date.now()}`,
      incidentId,
      timestamp: sent,
      source: 'ipaws',
      zones: [
        {
          level,
          polygon,
          guidance: `${instruction || description}\nFEMA Source: ${headline}`,
          color,
          label,
        },
      ],
    };
  } catch (err) {
    console.error('[sources] Failed to parse CAP XML:', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// NWS / NOAA — live CAP-derived alert feed (api.weather.gov)
// ----------------------------------------------------------------------------

const NWS_USER_AGENT =
  process.env.HAZALERT_USER_AGENT ||
  'HazAlert/0.1 (https://github.com/ctcxgooglepromptathon; contact: ops@hazalert.local)';

const NWS_ACTIVE_ALERTS_URL = 'https://api.weather.gov/alerts/active';
const NWS_MAX_ALERTS = 250;

interface NwsFeatureProperties {
  id?: string;
  event?: string;
  headline?: string;
  description?: string;
  instruction?: string | null;
  severity?: string;
  certainty?: string;
  urgency?: string;
  sent?: string;
  effective?: string;
  onset?: string;
  expires?: string;
  ends?: string | null;
  status?: string;
  messageType?: string;
  category?: string;
  areaDesc?: string;
  senderName?: string;
}

interface NwsGeometry {
  type: string;
  coordinates: number[][][] | number[][][][] | number[][];
}

interface NwsFeature {
  id?: string;
  type: 'Feature';
  geometry: NwsGeometry | null;
  properties: NwsFeatureProperties;
}

interface NwsFeatureCollection {
  type: 'FeatureCollection';
  features: NwsFeature[];
}

function nwsSeverityToZone(severity: string | undefined): {
  level: ZoneLevel;
  color: string;
  label: string;
} {
  switch ((severity || '').toLowerCase()) {
    case 'extreme':
      return { level: 'mandatory', color: '#DC2626', label: 'Mandatory Action (NWS Extreme)' };
    case 'severe':
      return { level: 'shelter_in_place', color: '#F59E0B', label: 'Shelter-in-Place (NWS Severe)' };
    case 'moderate':
      return { level: 'watch', color: '#FB923C', label: 'Watch (NWS Moderate)' };
    default:
      return { level: 'advisory', color: '#3B82F6', label: 'Advisory (NWS)' };
  }
}

function nwsEventToIncidentType(event: string | undefined): IncidentType {
  const e = (event || '').toLowerCase();
  if (e.includes('fire') || e.includes('red flag') || e.includes('smoke')) return 'wildfire';
  if (
    e.includes('flood') ||
    e.includes('tsunami') ||
    e.includes('surge') ||
    e.includes('hurricane') ||
    e.includes('tropical')
  )
    return 'flood';
  if (e.includes('earthquake')) return 'earthquake';
  if (e.includes('hazardous materials') || e.includes('hazmat') || e.includes('chemical'))
    return 'chemical';
  if (e.includes('civil') || e.includes('shelter in place') || e.includes('law enforcement'))
    return 'active_shooter';
  if (e.includes('tornado') || e.includes('thunderstorm') || e.includes('wind')) return 'wildfire';
  return 'flood';
}

function nwsGeometryToPolygon(geom: NwsGeometry | null): LatLng[] {
  if (!geom) return [];
  const flatten = (coords: any): LatLng[] => {
    if (!Array.isArray(coords)) return [];
    if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
      return coords
        .filter(
          (pt: any) =>
            Array.isArray(pt) &&
            Number.isFinite(pt[0]) &&
            Number.isFinite(pt[1]),
        )
        .map((pt: any) => ({ lat: pt[1], lng: pt[0] }));
    }
    return [];
  };

  if (geom.type === 'Polygon') {
    return flatten((geom.coordinates as number[][][])[0]);
  }
  if (geom.type === 'MultiPolygon') {
    const polys = (geom.coordinates as number[][][][]).map((p) => flatten(p[0]));
    return polys.sort((a, b) => b.length - a.length)[0] || [];
  }
  return [];
}

function centroidOf(polygon: LatLng[]): LatLng {
  if (polygon.length === 0) return { lat: 0, lng: 0 };
  let lat = 0;
  let lng = 0;
  for (const p of polygon) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / polygon.length, lng: lng / polygon.length };
}

export interface NwsAlertParsed {
  incident: Incident;
  snapshot: ZoneSnapshot;
}

function alertToIncidentAndSnapshot(feature: NwsFeature): NwsAlertParsed | null {
  const props = feature.properties || {};
  const rawId = props.id || feature.id;
  if (!rawId) return null;

  const polygon = nwsGeometryToPolygon(feature.geometry);
  if (polygon.length < 3) return null;

  const { level, color, label } = nwsSeverityToZone(props.severity);
  const guidance =
    [props.instruction, props.description, props.headline]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join('\n\n') || 'Follow guidance from your local emergency management agency.';

  const stableId = `inc_nws_${String(rawId).replace(/[^a-zA-Z0-9]/g, '_')}`;
  const startedAt = props.onset || props.effective || props.sent || new Date().toISOString();

  const snapshot: ZoneSnapshot = {
    id: `snap_nws_${stableId}_${new Date(props.sent || Date.now()).getTime()}`,
    incidentId: stableId,
    timestamp: props.sent || new Date().toISOString(),
    source: 'nws',
    zones: [
      {
        level,
        polygon,
        guidance,
        color,
        label: props.event ? `${label}: ${props.event}` : label,
      },
    ],
  };

  const incident: Incident = {
    id: stableId,
    name: props.event || props.headline || 'NWS Alert',
    type: nwsEventToIncidentType(props.event),
    facility: props.areaDesc,
    startedAt,
    status: 'active',
    centroid: centroidOf(polygon),
    currentSnapshotId: snapshot.id,
    summary:
      props.headline ||
      (props.areaDesc ? `${props.event} affecting ${props.areaDesc}` : props.event) ||
      'Active alert from NWS.',
  };

  return { incident, snapshot };
}

export async function fetchNwsActiveAlerts(): Promise<NwsAlertParsed[]> {
  try {
    const res = await fetch(NWS_ACTIVE_ALERTS_URL, {
      headers: {
        Accept: 'application/geo+json',
        'User-Agent': NWS_USER_AGENT,
      },
    });

    if (!res.ok) {
      console.error(
        `[sources] NWS active-alerts fetch failed: ${res.status} ${res.statusText}`,
      );
      return [];
    }

    const data = (await res.json()) as NwsFeatureCollection;
    if (!data || !Array.isArray(data.features)) {
      console.warn('[sources] NWS response had no features array');
      return [];
    }

    const parsed: NwsAlertParsed[] = [];
    for (const feature of data.features) {
      const props = feature.properties || {};
      const status = (props.status || '').toLowerCase();
      const msgType = (props.messageType || '').toLowerCase();
      if (status === 'test' || status === 'exercise' || status === 'draft') continue;
      if (msgType === 'cancel') continue;

      const item = alertToIncidentAndSnapshot(feature);
      if (item) parsed.push(item);
      if (parsed.length >= NWS_MAX_ALERTS) break;
    }
    return parsed;
  } catch (err) {
    console.error('[sources] NWS active-alerts fetch threw:', err);
    return [];
  }
}

/**
 * Back-compat shim. Legacy mock IPAWS feed has been replaced by the live NWS
 * feed; preserves the old return shape (ZoneSnapshot[]).
 */
export async function fetchIpawsAlerts(): Promise<ZoneSnapshot[]> {
  const parsed = await fetchNwsActiveAlerts();
  return parsed.map((p) => p.snapshot);
}

// ----------------------------------------------------------------------------
// County GIS feeds — live evacuation polygons
// ----------------------------------------------------------------------------

/**
 * County GIS feeds vary per-jurisdiction. The production system loads a
 * per-county adapter; for the multi-source live pipeline we rely on NWS,
 * which republishes the county-issued IPAWS polygons that matter for
 * evacuation. Empty array here preserves the scheduler signature.
 */
export async function fetchCountyGisLayer(
  _countyName: string,
): Promise<ZoneSnapshot[]> {
  return [];
}

// ----------------------------------------------------------------------------
// News extraction — unstructured text → structured incident
// ----------------------------------------------------------------------------

/**
 * Extract incident details from a news article or press release using
 * Gemini's structured-output mode.
 */
export async function extractIncidentFromNews(
  articleText: string,
): Promise<Partial<Incident> | null> {
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[sources] Missing VITE_GEMINI_API_KEY. News extraction skipped.');
    return null;
  }

  const model = process.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemPrompt = `You are an emergency-management analyst. Extract structured incident data from the press release/news article provided by the user. If a field cannot be determined from the text, return null. Do not infer or guess coordinates. Start times should be returned in ISO 8601 format. Return strict JSON matching the requested schema.`;

  const responseSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name of the incident, e.g., Box Springs Wildfire' },
      type: { type: 'string', enum: ['chemical', 'wildfire', 'flood', 'active_shooter', 'earthquake'] },
      hazardSubstance: { type: 'string', description: 'Chemical substance involved, or brush/fire details' },
      facility: { type: 'string', description: 'Facility or location where the incident originated' },
      startedAt: { type: 'string', format: 'date-time', description: 'ISO 8601 timestamp of incident start' },
      summary: { type: 'string', description: 'A 1-2 sentence plain-language summary of the incident' },
      centroid: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
        required: ['lat', 'lng'],
      },
    },
    required: ['name', 'type', 'centroid', 'summary'],
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: articleText }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[sources] Gemini API error: ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    return JSON.parse(text) as Partial<Incident>;
  } catch (err) {
    console.error('[sources] News extraction failed:', err);
    return null;
  }
}

// ----------------------------------------------------------------------------
// Diff logic — what changed between two snapshots?
// ----------------------------------------------------------------------------

export interface SnapshotDiff {
  hasChanges: boolean;
  expanded: string[];
  contracted: string[];
  added: string[];
  removed: string[];
}

/**
 * Compare two snapshots and return a structured diff.
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
