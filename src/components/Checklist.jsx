import { useState, useEffect } from 'react';
import { Volume2, CheckCircle2, Circle } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';
import { generateChecklist } from '../lib/gemini.js';
import { speak } from '../lib/tts.js';

export default function Checklist() {
  const { t, lang } = useI18n();
  const [household, setHousehold] = useState(() => {
    try {
      const stored = localStorage.getItem('hazalert_household');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn('[checklist] failed to parse stored household:', err);
    }
    return {
      pets: 'none',
      children: 'none',
      elderly: 'no',
      medications: 'no',
      time: '30_minutes',
    };
  });
  const [items, setItems] = useState([]);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hazalert_household', JSON.stringify(household));
    }
  }, [household]);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateChecklist(household);
      setItems(result);
      setChecked({});
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const progress = items.length ? (Object.values(checked).filter(Boolean).length / items.length) * 100 : 0;

  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="text-sm text-slate-400">{t.checklistIntro}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.pets}>
          <select
            className="select"
            value={household.pets}
            onChange={(e) => setHousehold({ ...household, pets: e.target.value })}
          >
            <option value="none">{t.none}</option>
            <option value="dogs">Dogs</option>
            <option value="cats">Cats</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label={t.children}>
          <select
            className="select"
            value={household.children}
            onChange={(e) => setHousehold({ ...household, children: e.target.value })}
          >
            <option value="none">{t.none}</option>
            <option value="infant">Infant</option>
            <option value="toddler">Toddler</option>
            <option value="school_age">School age</option>
            <option value="teen">Teen</option>
          </select>
        </Field>
        <Field label={t.elderly}>
          <select
            className="select"
            value={household.elderly}
            onChange={(e) => setHousehold({ ...household, elderly: e.target.value })}
          >
            <option value="no">{t.no}</option>
            <option value="yes">{t.yes}</option>
          </select>
        </Field>
        <Field label={t.medications}>
          <select
            className="select"
            value={household.medications}
            onChange={(e) => setHousehold({ ...household, medications: e.target.value })}
          >
            <option value="no">{t.no}</option>
            <option value="yes">{t.yes}</option>
          </select>
        </Field>
        <Field label={t.timeAvailable} className="col-span-2">
          <select
            className="select"
            value={household.time}
            onChange={(e) => setHousehold({ ...household, time: e.target.value })}
          >
            <option value="10_minutes">{t.tenMin}</option>
            <option value="30_minutes">{t.thirtyMin}</option>
            <option value="shelter_in_place">{t.shelterInPlace}</option>
          </select>
        </Field>
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={loading}
        className="w-full px-4 py-3 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-semibold min-h-[44px]"
      >
        {loading ? t.generating : t.generate}
      </button>

      {error && (
        <div className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-md p-3">
          {t.checklistError}
          <div className="text-xs mt-1 opacity-70">{error}</div>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
            />
          </div>
          <ul className="space-y-2">
            {items.map((item, i) => {
              const isChecked = !!checked[i];
              return (
                <li
                  key={i}
                  className={`rounded-lg border p-3 flex items-start gap-3 ${
                    isChecked
                      ? 'bg-emerald-950/30 border-emerald-800'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setChecked({ ...checked, [i]: !isChecked })}
                    className="mt-0.5 min-h-[44px] min-w-[44px] flex items-start justify-center"
                    aria-label={`Mark ${item.task} ${isChecked ? 'incomplete' : 'complete'}`}
                  >
                    {isChecked ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-500" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold ${isChecked ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                      {item.task}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{item.why}</div>
                    {item.estimatedTime && (
                      <div className="text-xs text-sky-300 mt-1">~{item.estimatedTime}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => speak(`${item.task}. ${item.why}`, lang)}
                    className="p-2 rounded-md bg-slate-900/60 hover:bg-slate-900 min-h-[44px] min-w-[44px]"
                    aria-label="Read item aloud"
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <style>{`
        .select {
          width: 100%;
          background: rgb(30 41 59);
          border: 1px solid rgb(51 65 85);
          border-radius: 6px;
          padding: 8px 10px;
          color: rgb(226 232 240);
          min-height: 44px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-slate-400 ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
