import { useState, useMemo, useEffect, useRef } from 'react';
import { I18nProvider, useI18n } from './lib/i18n.jsx';
import Header from './components/Header.jsx';
import AddressBar from './components/AddressBar.jsx';
import StatusCard from './components/StatusCard.jsx';
import MapView from './components/MapView.jsx';
import GuidancePanel from './components/GuidancePanel.jsx';
import Checklist from './components/Checklist.jsx';
import SheltersList from './components/SheltersList.jsx';
import LanguagePicker from './components/LanguagePicker.jsx';
import VoiceAssistant from './components/VoiceAssistant.jsx';
import { classifyPoint, nearestSafeShelter, haversine } from './lib/zones.js';
import { getRoute } from './lib/directions.js';
import { generateChecklist } from './lib/gemini.js';

// Base URL for the HazAlert backend. In dev the Vite proxy forwards "/api/*"
// to localhost:3001; in a static deploy point VITE_API_BASE_URL at the
// deployed backend (e.g. "https://hazalert-api.up.railway.app"). Trailing
// slash stripped so callers can always do `${API_BASE}/api/incidents`.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// How often the dashboard re-pulls the live incident list + selected snapshot.
// Matches the backend scheduler cadence so we never lag more than ~2 ticks.
const POLL_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// Resilient fetch: auto-abort after timeoutMs so the UI never hangs.
// ---------------------------------------------------------------------------
const FETCH_TIMEOUT_MS = 5_000;

// Dev-only diagnostic log — collects every API call so we can trace failures.
const __apiLog = [];
if (import.meta.env.DEV) {
  window.__hazalertApiLog = __apiLog;   // accessible from console
}

function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  const entry = {
    url,
    startedAt: new Date().toISOString(),
    durationMs: null,
    status: null,
    error: null,
    timedOut: false,
  };
  __apiLog.push(entry);
  // Keep log bounded
  if (__apiLog.length > 200) __apiLog.splice(0, __apiLog.length - 100);

  return fetch(url, { ...options, signal: controller.signal })
    .then((res) => {
      entry.durationMs = Math.round(performance.now() - t0);
      entry.status = res.status;
      if (import.meta.env.DEV) {
        console.debug(`[API] ${res.status} ${url} (${entry.durationMs}ms)`);
      }
      return res;
    })
    .catch((err) => {
      entry.durationMs = Math.round(performance.now() - t0);
      entry.timedOut = err.name === 'AbortError';
      entry.error = entry.timedOut
        ? `TIMEOUT after ${timeoutMs}ms`
        : err.message;
      if (import.meta.env.DEV) {
        console.warn(
          `[API] FAIL ${url} — ${entry.error} (${entry.durationMs}ms)`,
        );
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

// Dynamic shelters database for different locations
const SHELTERS_BY_INCIDENT = {
  inc_gg_mma_2026_05_21: [
    { name: 'Magnolia High School', address: '2450 W Ball Rd, Anaheim, CA', petFriendly: true, adaAccessible: true, lat: 33.8250, lng: -117.9670 },
    { name: 'Garden Grove Community Center', address: '11300 Stanford Ave, Garden Grove, CA', petFriendly: false, adaAccessible: true, lat: 33.7740, lng: -117.9410 },
    { name: 'Stanton Recreation Center', address: '7800 Katella Ave, Stanton, CA', petFriendly: true, adaAccessible: true, lat: 33.8020, lng: -118.0030 }
  ],
  inc_riverside_fire_2026_05_24: [
    { name: 'Riverside Convention Center', address: '3637 5th St, Riverside, CA', petFriendly: true, adaAccessible: true, lat: 33.9822, lng: -117.3732 },
    { name: 'Box Springs Recreation Center', address: '2155 Chicago Ave, Riverside, CA', petFriendly: false, adaAccessible: true, lat: 33.9555, lng: -117.3502 }
  ],
  inc_sac_flood_2026_03_15: [
    { name: 'Watt Avenue Community Park', address: '810 Watt Ave, Sacramento, CA', petFriendly: true, adaAccessible: true, lat: 38.5911, lng: -121.3912 },
    { name: 'Sacramento State Rec Center', address: '6000 J St, Sacramento, CA', petFriendly: false, adaAccessible: true, lat: 38.5611, lng: -121.4212 }
  ],
};

function getSheltersForIncident(incidentOrId) {
  if (!incidentOrId) return [];

  const incidentId = typeof incidentOrId === 'string' ? incidentOrId : incidentOrId.id;

  if (SHELTERS_BY_INCIDENT[incidentId]) {
    return SHELTERS_BY_INCIDENT[incidentId];
  }

  // Dynamic fallback for dynamically ingested or parsed incidents (like a flood in Florida) using its centroid!
  if (typeof incidentOrId === 'object' && incidentOrId.centroid) {
    const { lat, lng } = incidentOrId.centroid;
    const name = incidentOrId.name || 'Local Alert';
    // Extract a realistic location prefix (e.g. Florida, Riverside, etc.)
    const area = name
      .replace(/\b(chemical leak|wildfire|flood|levee overtopping|accident|incident|leak|fire|spill|alert|ingestion|gis|news)\b/ig, '')
      .trim() || 'Emergency';

    const nameSuffix = incidentOrId.type === 'flood' ? 'Flood Evacuation Center' : 
                       incidentOrId.type === 'wildfire' ? 'Wildfire Relief Shelter' : 
                       'Emergency Shelter';

    return [
      { 
        name: `${area} Primary ${nameSuffix}`, 
        address: `1.2 miles NE of Incident origin, ${area}`, 
        petFriendly: true, 
        adaAccessible: true, 
        lat: lat + 0.015, 
        lng: lng + 0.015 
      },
      { 
        name: `${area} Secondary ${nameSuffix}`, 
        address: `2.5 miles NW of Incident origin, ${area}`, 
        petFriendly: false, 
        adaAccessible: true, 
        lat: lat + 0.025, 
        lng: lng - 0.020 
      }
    ];
  }

  return SHELTERS_BY_INCIDENT['inc_gg_mma_2026_05_21'];
}

function AppInner() {
  const { t, hasSelectedLanguage, lang } = useI18n();
  const [assistantMuted, setAssistantMuted] = useState(false);
  const [userPoint, setUserPoint] = useState(null);
  const [tab, setTab] = useState('guidance');
  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState(null);

  // Scaled incidents state
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [currentSnapshot, setCurrentSnapshot] = useState(null);
  const [loadingIncidents, setLoadingIncidents] = useState(true);

  // Lifted household and highlight/toast states
  const [household, setHousehold] = useState(() => {
    try {
      const stored = localStorage.getItem('hazalert_household');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn('[App] failed to parse stored household:', err);
    }
    return {
      pets: 'none',
      children: 'none',
      elderly: 'no',
      medications: 'no',
      time: '30_minutes',
    };
  });
  const [highlightedFields, setHighlightedFields] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  // Lifted checklist states to persist across tab switches
  const [checklistItems, setChecklistItems] = useState([]);
  const [checklistChecked, setChecklistChecked] = useState({});
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [checklistError, setChecklistError] = useState(null);

  // Clear checklist items when changing incidents
  useEffect(() => {
    setChecklistItems([]);
    setChecklistChecked({});
  }, [selectedIncident?.id]);

  const generateChecklistItems = async (currentHousehold = household) => {
    // Prevent React SyntheticEvent or native event objects from overriding standard household state
    const targetHousehold = (currentHousehold && (currentHousehold.target || currentHousehold.nativeEvent)) 
      ? household 
      : currentHousehold;

    setLoadingChecklist(true);
    setChecklistError(null);
    try {
      const result = await generateChecklist(targetHousehold, selectedIncident);
      setChecklistItems(result);
      setChecklistChecked({});
    } catch (err) {
      console.error('[App] checklist generation failed:', err);
      setChecklistError(err.message);
    } finally {
      setLoadingChecklist(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hazalert_household', JSON.stringify(household));
    }
  }, [household]);

  const handleExtractedDetails = async ({ householdUpdates, addressPoint, triggerChecklist }) => {
    const fieldsUpdated = [];
    const newHighlights = {};

    // 1. Process addressPoint if provided
    if (addressPoint) {
      handleResolved(addressPoint);
      newHighlights.address = true;
      fieldsUpdated.push('Address');
    }

    // 2. Process household updates
    let updatedHousehold = { ...household };
    if (householdUpdates && Object.keys(householdUpdates).length > 0) {
      updatedHousehold = { ...household, ...householdUpdates };
      setHousehold(updatedHousehold);
      Object.keys(householdUpdates).forEach((key) => {
        newHighlights[key] = true;
        const labelMap = {
          pets: 'Pets',
          children: 'Children',
          elderly: 'Elderly',
          medications: 'Medications',
          time: 'Evacuation Time',
        };
        fieldsUpdated.push(labelMap[key] || key);
      });
    }

    // 3. Trigger highlights, Toast, and auto-checklist generation
    if (fieldsUpdated.length > 0 || triggerChecklist) {
      if (fieldsUpdated.length > 0) {
        setHighlightedFields(newHighlights);
        setToastMessage(`Voice assistant populated ${fieldsUpdated.length} field${fieldsUpdated.length > 1 ? 's' : ''}: ${fieldsUpdated.join(', ')}`);
      }

      if (triggerChecklist) {
        setTab('checklist');
        generateChecklistItems(updatedHousehold);
      } else {
        // Just switch to checklist tab if household fields were updated by voice
        const hasHouseholdField = Object.keys(householdUpdates).some(k => ['pets', 'children', 'elderly', 'medications', 'time'].includes(k));
        if (hasHouseholdField) {
          setTab('checklist');
        }
      }

      // Clear highlights and toast
      setTimeout(() => {
        setHighlightedFields({});
      }, 3500);

      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    }
  };

  const incidentsRef = useRef([]);
  const selectedIncidentRef = useRef(null);

  useEffect(() => {
    incidentsRef.current = incidents;
  }, [incidents]);

  useEffect(() => {
    selectedIncidentRef.current = selectedIncident;
  }, [selectedIncident]);

  // Fetch active incidents on mount
  useEffect(() => {
    async function loadIncidents() {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/incidents`);
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();
        setIncidents(data.incidents || []);
        
        // Auto-select incident from URL or default to first
        const urlParams = new URLSearchParams(window.location.search);
        const incidentId = urlParams.get('incident');
        const found = data.incidents.find((i) => i.id === incidentId) || data.incidents[0];
        if (found) {
          await handleSelectIncident(found);
        }
      } catch (err) {
        console.warn('[App] Fetching incidents failed, using mock seeds:', err.message);
        // Fallback local incidents
        const localIncidents = [
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
            summary: 'Industrial chemical release at GKN Aerospace; SW winds carrying plume NE toward residential Garden Grove.',
          }
        ];
        setIncidents(localIncidents);
        const urlParams = new URLSearchParams(window.location.search);
        const incidentId = urlParams.get('incident');
        const found = localIncidents.find((i) => i.id === incidentId) || localIncidents[0];
        if (found) {
          await handleSelectIncident(found);
        }
      } finally {
        setLoadingIncidents(false);
      }
    }
    loadIncidents();
  }, []);

  // Background refresh every POLL_INTERVAL_MS: re-pull the incident list and,
  // if an incident is selected, re-pull its current snapshot. Paused while the
  // tab is hidden; immediate re-fetch on tab focus.
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const listRes = await fetchWithTimeout(`${API_BASE}/api/incidents`);
        if (!listRes.ok) throw new Error(`incidents fetch ${listRes.status}`);
        const listData = await listRes.json();
        if (cancelled) return;

        const next = listData.incidents || [];
        setIncidents(next);

        const selectedId = selectedIncidentRef.current?.id;
        if (selectedId) {
          const stillThere = next.find((i) => i.id === selectedId);
          if (!stillThere) {
            console.info('[App] selected incident disappeared from feed; clearing selection');
            return;
          }
          const detailRes = await fetchWithTimeout(`${API_BASE}/api/incidents/${selectedId}`);
          if (!detailRes.ok) return;
          const detailData = await detailRes.json();
          if (cancelled) return;
          if (detailData.currentSnapshot) {
            setCurrentSnapshot(detailData.currentSnapshot);
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[App] background refresh failed:', err.message);
        }
      }
    }

    const id = setInterval(refresh, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Fetch full incident details & zones snapshot
  async function handleSelectIncident(incident, keepUserPoint = false) {
    setSelectedIncident(incident);
    if (!keepUserPoint) {
      setUserPoint(null);
    }
    setRoute(null);
    setRouteError(null);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('incident', incident.id);
      window.history.pushState({}, '', url.toString());
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/incidents/${incident.id}`);
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      setCurrentSnapshot(data.currentSnapshot || null);
    } catch (err) {
      console.warn('[App] Fetching snapshot details failed, using mock seeds:', err.message);
      const localSnapshots = {
        inc_gg_mma_2026_05_21: {
          id: 'snap_gg_mma_2026_05_21T1400',
          incidentId: 'inc_gg_mma_2026_05_21',
          timestamp: '2026-05-21T14:00:00-07:00',
          source: 'county_gis',
          zones: [
            {
              level: 'mandatory',
              color: '#DC2626',
              label: 'Mandatory Evacuation',
              guidance: 'Leave immediately. Head northeast, away from the plume. Take pets, medications, and ID.',
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
              guidance: 'Stay indoors. Close windows and doors. Seal vents with damp towels. Turn off HVAC.',
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
              guidance: 'Pack a go-bag with medications, IDs, and pet supplies. Monitor official updates.',
              polygon: [
                { lat: 33.82, lng: -117.99 },
                { lat: 33.82, lng: -117.92 },
                { lat: 33.745, lng: -117.92 },
                { lat: 33.745, lng: -117.99 },
              ],
            },
          ],
        },
      };
      setCurrentSnapshot(localSnapshots[incident.id] || null);
    }
  }

  const activeShelters = useMemo(
    () => (selectedIncident ? getSheltersForIncident(selectedIncident) : []),
    [selectedIncident]
  );

  const activeZones = useMemo(
    () => (currentSnapshot && currentSnapshot.zones ? currentSnapshot.zones : []),
    [currentSnapshot]
  );

  const classification = useMemo(
    () => (userPoint ? classifyPoint(userPoint, activeZones) : { level: 'none', zone: null }),
    [userPoint, activeZones]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'hazalert_user_state',
        JSON.stringify({
          address: userPoint?.formattedAddress || '',
          lat: userPoint?.lat || null,
          lng: userPoint?.lng || null,
          level: classification?.level || 'none',
          routeSummary: route?.summary || '',
          routeDistance: route?.distance || '',
          routeDuration: route?.duration || '',
        })
      );
    }
  }, [userPoint, classification, route]);

  // Auto-route when location or active incident zones/shelters change
  useEffect(() => {
    if (!userPoint) {
      setRoute(null);
      setRouteError(null);
      return;
    }
    const { level } = classifyPoint(userPoint, activeZones);
    if (level === 'mandatory' || level === 'shelter_in_place') {
      const shelter = nearestSafeShelter(userPoint, activeShelters, activeZones);
      if (shelter) {
        computeRoute(userPoint, shelter);
      } else {
        setRoute(null);
      }
    } else {
      setRoute(null);
    }
  }, [userPoint, activeZones, activeShelters]);

  async function handleResolved(point) {
    setUserPoint(point);
    setRoute(null);
    setRouteError(null);

    let nearestInc = null;

    // Dynamic Geolocation-Aware auto-detection of closest active incident
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/incidents/near?lat=${point.lat}&lng=${point.lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.nearest && data.nearest.incident) {
          nearestInc = data.nearest.incident;
        }
      }
    } catch (err) {
      console.warn('[App] Auto-detection of closest incident failed, calculating locally:', err.message);
    }

    const currentIncidents = incidentsRef.current;
    if (!nearestInc && currentIncidents.length > 0) {
      const nearest = currentIncidents
        .map((i) => ({ incident: i, dist: haversine(point, i.centroid) }))
        .sort((a, b) => a.dist - b.dist)[0];
      if (nearest) {
        nearestInc = nearest.incident;
      }
    }

    if (nearestInc) {
      const matched = currentIncidents.find((i) => i.id === nearestInc.id) || nearestInc;

      // Check if the user is actually inside an active warning/evacuation zone of this closest incident
      let isUserInDangerZone = false;
      try {
        const detailRes = await fetchWithTimeout(`${API_BASE}/api/incidents/${matched.id}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const snap = detailData.currentSnapshot;
          if (snap && snap.zones) {
            const checkClass = classifyPoint(point, snap.zones);
            if (checkClass && checkClass.level !== 'none' && checkClass.level !== 'safe') {
              isUserInDangerZone = true;
            }
          }
        }
      } catch (err) {
        console.warn('[App] Failed to check danger zone classification for closest incident:', err.message);
      }

      // Automatically lock onto the hazard if it directly threatens the user's location.
      // Otherwise, the manually selected or default hazard remains active!
      if (isUserInDangerZone) {
        if (selectedIncidentRef.current?.id !== matched.id) {
          await handleSelectIncident(matched, true); // Keep user point!
        }
      }
    }
  }

  async function computeRoute(origin, shelter) {
    const mandatory = activeZones.find((z) => z.level === 'mandatory');
    try {
      const r = await getRoute({
        origin,
        destination: { lat: shelter.lat, lng: shelter.lng },
        avoidPolygon: mandatory?.polygon,
      });
      setRoute(r);
    } catch (err) {
      console.warn('Directions failed:', err.message);
      setRouteError(err.message);
    }
  }

  function onRouteToShelter(shelter) {
    if (!userPoint) return;
    setTab('shelters');
    computeRoute(userPoint, shelter);
  }

  if (!hasSelectedLanguage) {
    return <LanguagePicker />;
  }

  // Premium loading screen to block rendering until selected incident resolves
  if (loadingIncidents || !selectedIncident) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-300">
        <div className="relative inline-flex mb-4">
          <span className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin" />
        </div>
        <div className="font-mono text-sm tracking-widest uppercase animate-pulse">
          Loading HazAlert dashboard…
        </div>
        {import.meta.env.DEV && <DevApiDiagnostics alwaysOpen />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border-2 border-sky-500 text-sky-200 px-5 py-3 rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.3)] flex items-center gap-3 animate-bounce font-medium text-sm max-w-md text-center">
          <span className="w-2.5 h-2.5 bg-sky-400 rounded-full animate-ping shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
      <Header
        voiceOn={!assistantMuted}
        onToggleVoice={() => setAssistantMuted((m) => !m)}
        incidents={incidents}
        selectedIncident={selectedIncident}
        onSelectIncident={handleSelectIncident}
        hasLocation={Boolean(userPoint)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 pb-48 sm:pb-32">
        {/* Hero band */}
        <section className="grid lg:grid-cols-2 gap-4 items-stretch">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
            <h1 className="font-mono text-lg text-slate-300 mb-3">
              Am I safe, and what do I do?
            </h1>
            <AddressBar
              onResolved={handleResolved}
              currentAddress={userPoint?.formattedAddress || ''}
              highlighted={highlightedFields.address}
            />
          </div>
          <StatusCard
            level={classification.level === 'none' ? null : classification.level}
            address={userPoint?.formattedAddress}
          />
        </section>

        {/* Main grid: map + side panel */}
        <section className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-[420px] lg:h-[560px]">
            <MapView
              userPoint={userPoint}
              level={classification.level}
              route={route}
              incident={selectedIncident}
              zones={activeZones}
              shelters={activeShelters}
            />
            {route && (
              <div className="mt-2 text-xs text-sky-300 font-mono">
                Route → {route.summary} · {route.distance} · {route.duration}
              </div>
            )}
            {routeError && (
              <div className="mt-2 text-xs text-amber-300">
                Could not compute route: {routeError}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col min-h-[560px]">
            <div role="tablist" className="flex border-b border-slate-800">
              <TabBtn active={tab === 'guidance'} onClick={() => setTab('guidance')}>
                {t.tabGuidance}
              </TabBtn>
              <TabBtn active={tab === 'checklist'} onClick={() => setTab('checklist')}>
                {t.tabChecklist}
              </TabBtn>
              <TabBtn active={tab === 'shelters'} onClick={() => setTab('shelters')}>
                {t.tabShelters}
              </TabBtn>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {tab === 'guidance' && <GuidancePanel level={classification.level} zones={activeZones} />}
              {tab === 'checklist' && (
                <Checklist
                  incident={selectedIncident}
                  household={household}
                  setHousehold={setHousehold}
                  highlightedFields={highlightedFields}
                  items={checklistItems}
                  setItems={setChecklistItems}
                  checked={checklistChecked}
                  setChecked={setChecklistChecked}
                  loading={loadingChecklist}
                  error={checklistError}
                  onGenerate={generateChecklistItems}
                />
              )}
              {tab === 'shelters' && (
                <SheltersList
                  userPoint={userPoint}
                  onRoute={onRouteToShelter}
                  shelters={activeShelters}
                />
              )}
            </div>
          </div>
        </section>

        <footer className="text-xs text-slate-500 text-center py-6 border-t border-slate-900 font-mono">
          HazAlert · Scaled Multi-disaster Alert System · Powered by Google & FEMA feeds
        </footer>
      </main>

      <VoiceAssistant
        level={classification.level === 'none' ? null : classification.level}
        address={userPoint?.formattedAddress}
        hasLocation={Boolean(userPoint)}
        route={route}
        muted={assistantMuted}
        onToggleMute={() => setAssistantMuted((m) => !m)}
        incident={selectedIncident}
        shelters={activeShelters}
        onExtractDetails={handleExtractedDetails}
      />
      {import.meta.env.DEV && <DevApiDiagnostics />}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 px-3 py-3 text-sm font-medium min-h-[44px] ${
        active
          ? 'text-sky-300 border-b-2 border-sky-400 bg-slate-800/60'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Dev-only: API diagnostics overlay (tree-shaken out in production builds)
// ---------------------------------------------------------------------------
function DevApiDiagnostics({ alwaysOpen = false }) {
  const [open, setOpen] = useState(alwaysOpen);
  const [, forceUpdate] = useState(0);

  // Re-render every second to show live log updates
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  const apiBase = API_BASE || '(empty — using same origin)';
  const resolvedBase = API_BASE || window.location.origin;
  const totalCalls = __apiLog.length;
  const failures = __apiLog.filter((e) => e.error);
  const timeouts = __apiLog.filter((e) => e.timedOut);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 z-[9999] bg-amber-500/90 hover:bg-amber-400 text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
        title="Open API Diagnostics"
      >
        🔧 API Diag ({failures.length} err)
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] max-h-[50vh] overflow-y-auto bg-gray-950/95 backdrop-blur border-t-2 border-amber-500 text-xs font-mono text-slate-300 shadow-2xl">
      <div className="sticky top-0 bg-gray-950 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
        <span className="text-amber-400 font-bold text-sm">🔧 DEV API DIAGNOSTICS</span>
        {!alwaysOpen && (
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white px-2">
            ✕ Close
          </button>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Config summary */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-slate-500">VITE_API_BASE_URL</span>
          <span className={API_BASE ? 'text-green-400' : 'text-red-400 font-bold'}>
            {apiBase}
          </span>
          <span className="text-slate-500">Resolved target</span>
          <span className="text-sky-300">{resolvedBase}/api/*</span>
          <span className="text-slate-500">Fetch timeout</span>
          <span>{FETCH_TIMEOUT_MS}ms</span>
          <span className="text-slate-500">Total API calls</span>
          <span>{totalCalls}</span>
          <span className="text-slate-500">Failures</span>
          <span className={failures.length ? 'text-red-400 font-bold' : 'text-green-400'}>
            {failures.length}
          </span>
          <span className="text-slate-500">Timeouts</span>
          <span className={timeouts.length ? 'text-amber-400 font-bold' : 'text-green-400'}>
            {timeouts.length}
          </span>
        </div>

        {/* Warnings */}
        {!API_BASE && (
          <div className="bg-red-900/40 border border-red-700 rounded px-3 py-2 text-red-300">
            ⚠ <strong>VITE_API_BASE_URL is empty.</strong> All /api/* calls target the current origin
            ({window.location.origin}). If no backend is running there, every call will fail or timeout.
            Set this in <code className="bg-red-900 px-1 rounded">.env</code> and restart Vite.
          </div>
        )}

        {timeouts.length > 0 && (
          <div className="bg-amber-900/40 border border-amber-700 rounded px-3 py-2 text-amber-300">
            ⏱ <strong>{timeouts.length} request(s) timed out</strong> — the backend at{' '}
            <code className="bg-amber-900 px-1 rounded">{resolvedBase}</code> is likely unreachable.
            Check: Is the backend server running? Is the port correct? Is CORS configured?
          </div>
        )}

        {/* Request log table */}
        {totalCalls > 0 && (
          <div>
            <div className="text-slate-500 mb-1">Request log (newest first):</div>
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="pr-2 py-1">Time</th>
                  <th className="pr-2 py-1">URL</th>
                  <th className="pr-2 py-1">Status</th>
                  <th className="pr-2 py-1">Duration</th>
                  <th className="py-1">Error</th>
                </tr>
              </thead>
              <tbody>
                {[...__apiLog].reverse().map((e, i) => (
                  <tr key={i} className={`border-b border-slate-800/50 ${e.error ? 'text-red-400' : ''}`}>
                    <td className="pr-2 py-1 whitespace-nowrap">{e.startedAt.split('T')[1]?.slice(0, 8)}</td>
                    <td className="pr-2 py-1 max-w-[300px] truncate" title={e.url}>
                      {e.url.replace(resolvedBase, '')}
                    </td>
                    <td className="pr-2 py-1">
                      {e.timedOut ? '⏱ TIMEOUT' : e.status ?? '…'}
                    </td>
                    <td className="pr-2 py-1">
                      {e.durationMs != null ? `${e.durationMs}ms` : '…'}
                    </td>
                    <td className="py-1 max-w-[200px] truncate" title={e.error || ''}>
                      {e.error || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-slate-600 text-[10px]">
          Tip: Full log available in console via <code>window.__hazalertApiLog</code>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
