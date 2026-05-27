import { useState, useMemo, useEffect, useRef } from 'react';
import { I18nProvider, useI18n } from './lib/i18n.jsx';
import Header from './components/Header.jsx';
import AddressBar from './components/AddressBar.jsx';
import StatusCard from './components/StatusCard.jsx';
import MapView from './components/MapView.jsx';
import GuidancePanel from './components/GuidancePanel.jsx';
import Checklist from './components/Checklist.jsx';
import Chatbot from './components/Chatbot.jsx';
import SheltersList from './components/SheltersList.jsx';
import LanguagePicker from './components/LanguagePicker.jsx';
import VoiceAssistant from './components/VoiceAssistant.jsx';
import { classifyPoint, nearestSafeShelter, haversine } from './lib/zones.js';
import { getRoute } from './lib/directions.js';

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

function getSheltersForIncident(incidentId) {
  return SHELTERS_BY_INCIDENT[incidentId] || SHELTERS_BY_INCIDENT['inc_gg_mma_2026_05_21'];
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
        const res = await fetch('/api/incidents');
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
          },
          {
            id: 'inc_riverside_fire_2026_05_24',
            name: 'Box Springs Wildfire',
            type: 'wildfire',
            facility: 'Box Springs Mountain Reserve',
            startedAt: '2026-05-24T13:42:00-07:00',
            status: 'active',
            centroid: { lat: 33.9612, lng: -117.3045 },
            currentSnapshotId: 'snap_riverside_fire_2026_05_26T0900',
            summary: 'Brush fire on east face of Box Springs; 2,400 acres burned, 18% contained. Mandatory evacuation for east Riverside foothills.',
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
            summary: 'Levee overtopping along American River reach; waters receded as of 2026-03-18. Damage assessment ongoing.',
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
      const res = await fetch(`/api/incidents/${incident.id}`);
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
        inc_riverside_fire_2026_05_24: {
          id: 'snap_riverside_fire_2026_05_26T0900',
          incidentId: 'inc_riverside_fire_2026_05_24',
          timestamp: '2026-05-26T09:00:00-07:00',
          source: 'ipaws',
          zones: [
            {
              level: 'mandatory',
              color: '#DC2626',
              label: 'Mandatory Evacuation — Zones RIV-E-12, RIV-E-13',
              guidance: 'Leave now via westbound I-215 or 60. Do not delay. Embers may travel 1+ miles ahead of the fire front.',
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
              guidance: 'Be prepared to leave. Move vehicles facing out. Charge phones. Confirm out-of-area contact.',
              polygon: [
                { lat: 34.0, lng: -117.33 },
                { lat: 34.0, lng: -117.26 },
                { lat: 33.92, lng: -117.26 },
                { lat: 33.92, lng: -117.33 },
              ],
            },
          ],
        },
        inc_sac_flood_2026_03_15: {
          id: 'snap_sac_flood_2026_03_18T1000',
          incidentId: 'inc_sac_flood_2026_03_15',
          timestamp: '2026-03-18T10:00:00-07:00',
          source: 'county_gis',
          zones: [
            {
              level: 'advisory',
              color: '#3B82F6',
              label: 'Flood Advisory — Residual',
              guidance: 'Waters have receded. Avoid flooded basements and report damage to Sacramento OES.',
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
      setCurrentSnapshot(localSnapshots[incident.id] || null);
    }
  }

  const activeShelters = useMemo(
    () => (selectedIncident ? getSheltersForIncident(selectedIncident.id) : []),
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
      const res = await fetch(`/api/incidents/near?lat=${point.lat}&lng=${point.lng}`);
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
      if (selectedIncidentRef.current?.id !== matched.id) {
        await handleSelectIncident(matched, true); // Keep user point!
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
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        voiceOn={!assistantMuted}
        onToggleVoice={() => setAssistantMuted((m) => !m)}
        incidents={incidents}
        selectedIncident={selectedIncident}
        onSelectIncident={handleSelectIncident}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 pb-48 sm:pb-32">
        {/* Hero band */}
        <section className="grid lg:grid-cols-2 gap-4 items-stretch">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
            <h1 className="font-mono text-lg text-slate-300 mb-3">
              Am I safe, and what do I do?
            </h1>
            <AddressBar onResolved={handleResolved} />
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
              <TabBtn active={tab === 'assistant'} onClick={() => setTab('assistant')}>
                {t.tabAssistant}
              </TabBtn>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {tab === 'guidance' && <GuidancePanel level={classification.level} zones={activeZones} />}
              {tab === 'checklist' && <Checklist incident={selectedIncident} />}
              {tab === 'shelters' && (
                <SheltersList
                  userPoint={userPoint}
                  onRoute={onRouteToShelter}
                  shelters={activeShelters}
                />
              )}
              {tab === 'assistant' && (
                <Chatbot
                  voiceOn={!assistantMuted}
                  incident={selectedIncident}
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
      />
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

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
