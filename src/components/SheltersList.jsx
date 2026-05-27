import { PawPrint, Accessibility, Navigation } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';
import { haversine } from '../lib/zones.js';
import mockData from '../data/mockData.json';

export default function SheltersList({ userPoint, onRoute }) {
  const { t } = useI18n();
  const enriched = mockData.shelters
    .map((s) => ({
      ...s,
      distance: userPoint ? haversine(userPoint, s) : null,
    }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

  return (
    <ul className="space-y-3">
      {enriched.map((s) => (
        <li
          key={s.name}
          className="rounded-lg bg-slate-800 border border-slate-700 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-slate-100">{s.name}</div>
              <div className="text-xs text-slate-400 truncate">{s.address}</div>
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                {s.petFriendly && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800">
                    <PawPrint className="w-3 h-3" aria-hidden="true" />
                    {t.petFriendly}
                  </span>
                )}
                {s.adaAccessible && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-900/40 text-sky-300 border border-sky-800">
                    <Accessibility className="w-3 h-3" aria-hidden="true" />
                    {t.adaAccessible}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              {s.distance !== null && (
                <div className="text-sm font-mono text-slate-200">
                  {(s.distance / 1609.34).toFixed(1)} {t.miles}
                </div>
              )}
              <button
                type="button"
                onClick={() => onRoute?.(s)}
                className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-sky-600 hover:bg-sky-500 text-white min-h-[36px]"
              >
                <Navigation className="w-3 h-3" aria-hidden="true" />
                {t.routeMe}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
