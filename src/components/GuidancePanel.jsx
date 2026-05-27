import { Volume2 } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';
import { speak } from '../lib/tts.js';

export default function GuidancePanel({ level, zones = [] }) {
  const { t, lang } = useI18n();
  if (!level || level === 'safe' || level === 'none') {
    return (
      <div className="text-slate-400 text-sm">
        {level === 'safe' ? t.statusSafeAction : t.noAddress}
      </div>
    );
  }
  const zone = (zones || []).find((z) => z.level === level);
  if (!zone) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono font-semibold text-lg text-slate-100">{zone.label}</h3>
        <button
          type="button"
          onClick={() => speak(zone.guidance, lang)}
          className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 min-h-[44px] min-w-[44px]"
          aria-label="Read guidance aloud"
        >
          <Volume2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <p className="text-slate-200 leading-relaxed">{zone.guidance}</p>
    </div>
  );
}
