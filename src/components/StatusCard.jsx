import { AlertOctagon, Home, Eye, ShieldCheck, Volume2 } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';
import { speak } from '../lib/tts.js';

const STYLES = {
  mandatory: {
    bg: 'bg-gradient-to-br from-red-700 to-red-600 text-white border-red-400',
    pulse: 'animate-pulse',
    Icon: AlertOctagon,
    pattern: 'zone-stripe-red',
  },
  shelter_in_place: {
    bg: 'bg-gradient-to-br from-amber-500 to-amber-400 text-slate-900 border-amber-300',
    Icon: Home,
  },
  watch: {
    bg: 'bg-gradient-to-br from-orange-500 to-orange-400 text-slate-900 border-orange-300',
    Icon: Eye,
  },
  safe: {
    bg: 'bg-gradient-to-br from-emerald-700 to-emerald-600 text-white border-emerald-400',
    Icon: ShieldCheck,
  },
  none: {
    bg: 'bg-slate-800 text-slate-300 border-slate-700',
    Icon: AlertOctagon,
  },
};

export default function StatusCard({ level, address }) {
  const { t, lang } = useI18n();
  const key = level || 'none';
  const style = STYLES[key];
  const { Icon } = style;

  const titleMap = {
    mandatory: t.statusMandatory,
    shelter_in_place: t.statusShelter,
    watch: t.statusWatch,
    safe: t.statusSafe,
    none: t.noAddress,
  };
  const actionMap = {
    mandatory: t.statusMandatoryAction,
    shelter_in_place: t.statusShelterAction,
    watch: t.statusWatchAction,
    safe: t.statusSafeAction,
    none: '',
  };

  const title = titleMap[key];
  const action = actionMap[key];

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`relative overflow-hidden rounded-xl border-2 ${style.bg} p-5 shadow-lg`}
    >
      {style.pattern && <div className={`absolute inset-0 ${style.pattern} pointer-events-none`} aria-hidden="true" />}
      <div className="relative flex items-start gap-4">
        <Icon className={`w-12 h-12 shrink-0 ${style.pulse || ''}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
            {title}
          </div>
          {action && <div className="mt-2 text-base sm:text-lg opacity-95">{action}</div>}
          {address && <div className="mt-2 text-sm opacity-80 truncate">{address}</div>}
        </div>
        {key !== 'none' && (
          <button
            type="button"
            onClick={() => speak(`${title}. ${action}`, lang)}
            className="ml-auto p-2 rounded-md bg-black/20 hover:bg-black/30 min-h-[44px] min-w-[44px]"
            aria-label="Read aloud"
          >
            <Volume2 className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
