/**
 * HazAlert — Production Data Model
 *
 * Defines the schema for the multi-incident architecture. The MVP frontend
 * currently consumes a single hardcoded incident (see src/data/mockData.json);
 * these types describe the generic shape the system migrates toward, where
 * any number of incidents of any hazard type can be ingested, stored as
 * time-series snapshots, and pushed to subscribed users.
 */

export type IncidentType =
  | 'chemical'
  | 'wildfire'
  | 'flood'
  | 'active_shooter'
  | 'earthquake';

export type IncidentStatus = 'active' | 'contained' | 'closed';

export type ZoneLevel =
  | 'mandatory'        // mandatory evacuation
  | 'shelter_in_place' // stay indoors, seal openings
  | 'watch'            // pack a go-bag, monitor
  | 'advisory';        // informational only

export type DataSource =
  | 'ipaws'            // FEMA Integrated Public Alert & Warning System
  | 'county_gis'       // County emergency management GeoJSON feeds
  | 'news_extraction'  // Gemini-extracted from press releases / news
  | 'manual';          // Operator-entered (admin console)

export type NotificationChannel = 'web_push' | 'sms' | 'email';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Top-level Incident document. The parent record. Subcollections under
 * each Incident hold the time-series data (zoneSnapshots) and the
 * activity log (events).
 */
export interface Incident {
  id: string;
  name: string;
  type: IncidentType;

  /** Free-text description of the hazardous substance, fire name, etc. */
  hazardSubstance?: string;

  /** Originating facility, fire perimeter name, flooded river, etc. */
  facility?: string;

  /** ISO 8601 timestamp when the incident began. */
  startedAt: string;

  status: IncidentStatus;

  /** Approximate center point — used for "nearest incident" geo queries. */
  centroid: LatLng;

  /** Pointer to the most recent ZoneSnapshot in the subcollection. */
  currentSnapshotId: string;

  /** Human-readable summary, surfaced in the UI header. */
  summary?: string;
}

/**
 * A point-in-time snapshot of the incident's evacuation zones. A new
 * snapshot is written every time the polygons change — old snapshots are
 * never overwritten. This is what enables full incident playback and
 * after-action timeline reconstruction.
 */
export interface ZoneSnapshot {
  id: string;
  incidentId: string;

  /** ISO 8601 timestamp when this snapshot was created. */
  timestamp: string;

  zones: Array<{
    level: ZoneLevel;
    /** GeoJSON-style ring (lat/lng pairs forming a closed polygon). */
    polygon: LatLng[];
    /** Human-readable instructions shown to users in this zone. */
    guidance: string;
    /** Hex color for the map overlay. */
    color: string;
    /** Display label, e.g. "Mandatory Evacuation". */
    label: string;
  }>;

  /** Which upstream source produced this snapshot. */
  source: DataSource;

  /** Optional pointer to the previous snapshot (for diff reconstruction). */
  previousSnapshotId?: string;
}

/**
 * Activity-log entry. Anything noteworthy that happens to an incident
 * gets an event — used to render the timeline view and to drive
 * downstream notifications.
 */
export interface IncidentEvent {
  id: string;
  incidentId: string;
  timestamp: string;

  type:
    | 'press_release'
    | 'sensor_reading'
    | 'shelter_opened'
    | 'road_closure'
    | 'zone_change';

  source: DataSource;

  /**
   * Type-discriminated payload. Kept loose here for the skeleton — in
   * production each event type has a strict typed sub-interface.
   */
  payload: Record<string, unknown>;
}

/**
 * A user's subscription to one or more incidents. Created the moment
 * a user enters their address into HazAlert. The location is used for
 * point-in-polygon checks on every new ZoneSnapshot.
 */
export interface UserSubscription {
  id: string;

  /** Anonymous session ID (no account required). */
  sessionId: string;

  /** Subscribed location — typically the user's home address. */
  lat: number;
  lng: number;

  /** Incidents this user is being tracked against. */
  incidentIds: string[];

  /** Where to send notifications when status changes. */
  notificationChannels: NotificationChannel[];

  /** Last known zone status for the user (used to detect transitions). */
  lastKnownZoneLevel?: ZoneLevel | 'safe';

  /** ISO 8601 timestamp of last notification sent (for rate limiting). */
  lastNotifiedAt?: string;
}
