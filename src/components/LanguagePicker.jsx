import { useEffect, useState } from 'react';
import { AlertTriangle, Volume2, Check } from 'lucide-react';
import { LANGUAGES, BASE_STRINGS, useI18n } from '../lib/i18n.jsx';
import { translateText } from '../lib/translate.js';
import { speak, cancel } from '../lib/tts.js';

// Welcome screen shown on first visit. Lets a user pick their language before
// they see the rest of the app. Each option has a speaker button that plays
// a greeting *in that language* so people who cannot read can still identify
// their language by ear.
export default function LanguagePicker() {
  const { lang, setLang, confirmLanguage } = useI18n();
  const [selected, setSelected] = useState(lang);
  const [labels, setLabels] = useState({
    title: BASE_STRINGS.welcomeTitle,
    subtitle: BASE_STRINGS.welcomeSubtitle,
    hint: BASE_STRINGS.welcomeHint,
    continueBtn: BASE_STRINGS.continueBtn,
    playSample: BASE_STRINGS.welcomePlaySample,
  });

  // Translate the picker's own labels into the currently-highlighted language
  // so the user sees the welcome strings in the language they're about to pick.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (selected === 'en') {
        setLabels({
          title: BASE_STRINGS.welcomeTitle,
          subtitle: BASE_STRINGS.welcomeSubtitle,
          hint: BASE_STRINGS.welcomeHint,
          continueBtn: BASE_STRINGS.continueBtn,
          playSample: BASE_STRINGS.welcomePlaySample,
        });
        return;
      }
      const [title, subtitle, hint, continueBtn, playSample] = await Promise.all([
        translateText(BASE_STRINGS.welcomeTitle, selected),
        translateText(BASE_STRINGS.welcomeSubtitle, selected),
        translateText(BASE_STRINGS.welcomeHint, selected),
        translateText(BASE_STRINGS.continueBtn, selected),
        translateText(BASE_STRINGS.welcomePlaySample, selected),
      ]);
      if (!cancelled) setLabels({ title, subtitle, hint, continueBtn, playSample });
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  useEffect(() => () => cancel(), []);

  function onPick(code) {
    setSelected(code);
    setLang(code);
  }

  function onPlaySample(e, l) {
    e.stopPropagation();
    speak(l.sample, l.code);
  }

  function onContinue() {
    cancel();
    confirmLanguage(selected);
    // Greet the user once the app appears.
    setTimeout(() => {
      translateText(BASE_STRINGS.voiceWelcomeMessage, selected).then((msg) => {
        speak(msg, selected);
      });
    }, 300);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-picker-title"
      className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl my-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="relative inline-flex">
            <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
            <span className="absolute inset-0 rounded-full border-2 border-red-500/60 animate-pulse-ring" />
          </span>
          <h1 id="lang-picker-title" className="font-mono font-bold text-2xl">
            {labels.title}
          </h1>
        </div>

        <p className="text-lg text-slate-200 mb-1">{labels.subtitle}</p>
        <p className="text-sm text-slate-400 mb-5">{labels.hint}</p>

        <ul className="space-y-3" role="radiogroup" aria-label={labels.subtitle}>
          {LANGUAGES.map((l) => {
            const isSelected = selected === l.code;
            return (
              <li key={l.code}>
                <div
                  className={`flex items-stretch gap-2 rounded-xl border-2 transition-colors ${
                    isSelected
                      ? 'border-sky-400 bg-sky-950/40'
                      : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                  }`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onPick(l.code)}
                    className="flex-1 text-left px-4 py-4 min-h-[64px] flex items-center gap-3 focus-visible:ring-2 focus-visible:ring-sky-400 rounded-l-xl"
                  >
                    <span
                      className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center shrink-0 ${
                        isSelected ? 'border-sky-300 bg-sky-400' : 'border-slate-500'
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected && <Check className="w-4 h-4 text-slate-900" />}
                    </span>
                    <span className="text-xl font-semibold text-slate-100">
                      {l.nativeLabel}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onPlaySample(e, l)}
                    aria-label={`${labels.playSample}: ${l.nativeLabel}`}
                    className="px-4 my-2 mr-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 inline-flex items-center justify-center min-h-[48px] min-w-[56px] focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <Volume2 className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={onContinue}
          className="mt-6 w-full px-6 py-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-lg min-h-[56px] focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          {labels.continueBtn}
        </button>
      </div>
    </div>
  );
}
