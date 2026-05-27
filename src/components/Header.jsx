import { AlertTriangle, Volume2, VolumeX, Globe } from 'lucide-react';
import { useI18n, LANGUAGES } from '../lib/i18n.jsx';
import IncidentSelector from './IncidentSelector.jsx';

export default function Header({ voiceOn, onToggleVoice, incidents, selectedIncident, onSelectIncident }) {
  const { t, lang, setLang, translating } = useI18n();

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex">
            <AlertTriangle className="w-7 h-7 text-red-500" aria-hidden="true" />
            <span className="absolute inset-0 rounded-full border-2 border-red-500/60 animate-pulse-ring" />
          </span>
          <span className="font-mono font-bold text-xl tracking-tight hidden sm:inline">{t.appName}</span>
        </div>

        <div className="flex items-center justify-center">
          <IncidentSelector
            incidents={incidents}
            selectedIncident={selectedIncident}
            onSelectIncident={onSelectIncident}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span className="sr-only">{t.language}</span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-sky-400"
              aria-label={t.language}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            {translating && (
              <span className="text-xs text-slate-400" role="status">…</span>
            )}
          </label>

          <button
            type="button"
            onClick={onToggleVoice}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm min-h-[44px]"
            aria-pressed={voiceOn}
            aria-label={voiceOn ? t.voiceOn : t.voiceOff}
          >
            {voiceOn ? (
              <Volume2 className="w-4 h-4 text-sky-400" aria-hidden="true" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{voiceOn ? t.voiceOn : t.voiceOff}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
