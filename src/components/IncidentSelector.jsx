import { useState, useRef, useEffect } from 'react';
import { AlertCircle, Flame, Waves, ShieldAlert, ChevronDown } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';

const HAZARD_ICONS = {
  chemical: AlertCircle,
  wildfire: Flame,
  flood: Waves,
  active_shooter: ShieldAlert,
  earthquake: ShieldAlert,
};

const HAZARD_COLORS = {
  chemical: 'text-red-400 border-red-500/30 bg-red-950/20',
  wildfire: 'text-orange-400 border-orange-500/30 bg-orange-950/20',
  flood: 'text-sky-400 border-sky-500/30 bg-sky-950/20',
  active_shooter: 'text-rose-400 border-rose-500/30 bg-rose-950/20',
  earthquake: 'text-amber-400 border-amber-500/30 bg-amber-950/20',
};

export default function IncidentSelector({ incidents, selectedIncident, onSelectIncident }) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!incidents || incidents.length === 0) return null;

  const ActiveIcon = selectedIncident ? HAZARD_ICONS[selectedIncident.type] || AlertCircle : AlertCircle;
  const activeColorClass = selectedIncident ? HAZARD_COLORS[selectedIncident.type] || 'text-sky-400 border-slate-700 bg-slate-800' : 'text-slate-400';

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] min-h-[44px] ${activeColorClass}`}
        >
          <span className="relative flex h-3 w-3 items-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <ActiveIcon className="w-5 h-5 shrink-0" />
          <span className="font-mono text-sm font-semibold tracking-tight truncate max-w-[180px] sm:max-w-[280px]">
            {selectedIncident ? selectedIncident.name : 'Select Hazard'}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-72 origin-top-right rounded-xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50 divide-y divide-slate-800/60 overflow-hidden"
        >
          <div className="px-3 py-2 text-xs font-semibold font-mono text-slate-500 uppercase tracking-wider bg-slate-950/20">
            {t.changeLanguage || 'Active Hazards'}
          </div>
          {incidents.map((incident) => {
            const Icon = HAZARD_ICONS[incident.type] || AlertCircle;
            const isSelected = selectedIncident?.id === incident.id;
            const colorClass = HAZARD_COLORS[incident.type] || 'text-slate-400';

            return (
              <li key={incident.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectIncident(incident);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm flex items-start gap-3 transition-colors hover:bg-slate-800/80 min-h-[44px] ${
                    isSelected ? 'bg-slate-800 text-sky-400 font-medium' : 'text-slate-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${colorClass}`} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{incident.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">
                      {incident.hazardSubstance || incident.facility || 'Official alert'}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
