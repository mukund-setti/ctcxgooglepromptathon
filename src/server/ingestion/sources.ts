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

// Simulated active IPAWS feed of public CAP 1.2 alerts
const MOCK_IPAWS_FEED = [
  `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>IPAWS-2026-WILDFIRE-987</identifier>
  <sender>calfire-riverside@ca.gov</sender>
  <sent>2026-05-27T00:01:00-07:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Safety</category>
    <event>Santa Ana Canyon Wildfire</event>
    <urgency>Immediate</urgency>
    <severity>Extreme</severity>
    <certainty>Observed</certainty>
    <headline>URGENT: MANDATORY EVACUATION ORDER FOR SANTA ANA CANYON</headline>
    <description>Fast-moving brush fire pushed by Santa Ana winds towards eastern canyon foothills.</description>
    <instruction>Evacuate immediately toward the west via Highway 91. Take essential go-bags, pets, and medicine.</instruction>
    <area>
      <areaDesc>Santa Ana Canyon Foothills</areaDesc>
      <polygon>33.8800,-117.7500 33.8800,-117.7000 33.8400,-117.7000 33.8400,-117.7500 33.8800,-117.7500</polygon>
    </area>
  </info>
</alert>`,
  `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>IPAWS-2026-FLOOD-441</identifier>
  <sender>nws-sacramento@noaa.gov</sender>
  <sent>2026-05-27T00:01:30-07:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Safety</category>
    <event>Severe River Flood</event>
    <urgency>Immediate</urgency>
    <severity>Severe</severity>
    <certainty>Likely</certainty>
    <headline>SHELTER IN PLACE ORDER: AMERICAN RIVER FLOODING</headline>
    <description>Rapidly rising river levels causing dangerous overflow along riverbank streets.</description>
    <instruction>Move to high ground or higher floors. Seal lower doorways. Turn off utilities if directed.</instruction>
    <area>
      <areaDesc>American River lowlands</areaDesc>
      <polygon>38.6100,-121.4300 38.6100,-121.3900 38.5800,-121.3900 38.5800,-121.4300 38.6100,-121.4300</polygon>
    </area>
  </info>
</alert>`,
];

/**
 * Fetch active alerts from FEMA's Integrated Public Alert & Warning System.
 * In local environment, parses our simulated CAP 1.2 XML alerts.
 */
export async function fetchIpawsAlerts(): Promise<ZoneSnapshot[]> {
  const snapshots: ZoneSnapshot[] = [];
  for (const xml of MOCK_IPAWS_FEED) {
    const snap = parseCapXml(xml);
    if (snap) snapshots.push(snap);
  }
  return snapshots;
}

// ----------------------------------------------------------------------------
// County GIS feeds — live evacuation polygons
// ----------------------------------------------------------------------------

/**
 * Fetch the current evacuation-zone GeoJSON layer from a county GIS server.
 * In local environment, generates simulated county GIS GeoJSON features.
 */
export async function fetchCountyGisLayer(
  countyName: string,
): Promise<ZoneSnapshot[]> {
  // A county GIS server publishes GeoJSON. Let's simulate a standard ArcGIS REST query response:
  const mockGeoJson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          level: 'mandatory' as ZoneLevel,
          label: `${countyName.toUpperCase()} Mandatory Evacuation`,
          guidance: `Evacuate now under ${countyName} county authority orders.`,
          color: '#DC2626',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-117.965, 33.79],
              [-117.945, 33.79],
              [-117.945, 33.77],
              [-117.965, 33.77],
              [-117.965, 33.79],
            ],
          ],
        },
      },
    ],
  };

  const zones: ZoneSnapshot['zones'] = [];

  for (const feat of mockGeoJson.features) {
    const coords = feat.geometry.coordinates[0];
    const polygon: LatLng[] = coords.map((c) => ({
      // Swapping coordinate order: GeoJSON is [lng, lat] -> we convert to {lat, lng}
      lat: c[1],
      lng: c[0],
    }));

    zones.push({
      level: feat.properties.level,
      polygon,
      guidance: feat.properties.guidance,
      color: feat.properties.color,
      label: feat.properties.label,
    });
  }

  return [
    {
      id: `snap_gis_${countyName}_${Date.now()}`,
      incidentId: `inc_gg_mma_2026_05_21`, // Link to Garden Grove chemical leak
      timestamp: new Date().toISOString(),
      source: 'county_gis',
      zones,
    },
  ];
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
