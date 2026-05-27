import { useState, useMemo } from 'react';
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
import { classifyPoint, nearestSafeShelter } from './lib/zones.js';
import { getRoute } from './lib/directions.js';
import mockData from './data/mockData.json';

function AppInner() {
  const { t, hasSelectedLanguage } = useI18n();
  // `assistantMuted` controls the proactive voice assistant. The Header's
  // existing voice toggle now maps to mute/unmute — the assistant is always
  // mounted once the user picks a language so they can ask for help anytime.
  const [assistantMuted, setAssistantMuted] = useState(false);
  const [userPoint, setUserPoint] = useState(null);
  const [tab, setTab] = useState('guidance');
  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState(null);

  const classification = useMemo(
    () => (userPoint ? classifyPoint(userPoint, mockData.zones) : { level: 'none', zone: null }),
    [userPoint],
  );

  async function handleResolved(point) {
    setUserPoint(point);
    setRoute(null);
    setRouteError(null);

    // Auto-route if user is in red or yellow zone
    const { level } = classifyPoint(point, mockData.zones);
    if (level === 'mandatory' || level === 'shelter_in_place') {
      const shelter = nearestSafeShelter(point, mockData.shelters, mockData.zones);
      if (shelter) {
        await computeRoute(point, shelter);
      }
    }
  }

  async function computeRoute(origin, shelter) {
    const mandatory = mockData.zones.find((z) => z.level === 'mandatory');
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        voiceOn={!assistantMuted}
        onToggleVoice={() => setAssistantMuted((m) => !m)}
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
            <MapView userPoint={userPoint} level={classification.level} route={route} />
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
              {tab === 'guidance' && <GuidancePanel level={classification.level} />}
              {tab === 'checklist' && <Checklist />}
              {tab === 'shelters' && (
                <SheltersList userPoint={userPoint} onRoute={onRouteToShelter} />
              )}
              {tab === 'assistant' && <Chatbot voiceOn={!assistantMuted} />}
            </div>
          </div>
        </section>

        <footer className="text-xs text-slate-500 text-center py-6">
          HazAlert · Built for CTC × Google Gemini Prompt-a-Thon 2026 · Demo data only
        </footer>
      </main>

      <VoiceAssistant
        level={classification.level === 'none' ? null : classification.level}
        address={userPoint?.formattedAddress}
        hasLocation={Boolean(userPoint)}
        route={route}
        muted={assistantMuted}
        onToggleMute={() => setAssistantMuted((m) => !m)}
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
