import { createContext, useContext, useEffect, useState } from 'react';
import { translateBundle } from './translate.js';

// Source-of-truth English UI strings. Anything user-visible should live here.
export const BASE_STRINGS = {
  // Header
  appName: 'HazAlert',
  liveIncident: 'LIVE — Garden Grove Chemical Leak',
  voiceOn: 'Voice on',
  voiceOff: 'Voice off',
  language: 'Language',
  // Address input
  addressPlaceholder: 'Enter your address or ZIP',
  useMyLocation: 'Use my location',
  check: 'Check',
  geocoding: 'Looking up address…',
  // Status card
  statusMandatory: 'MANDATORY EVACUATION',
  statusMandatoryAction: 'Leave the area now. Tap to see your fastest safe route.',
  statusShelter: 'SHELTER IN PLACE',
  statusShelterAction: 'Stay indoors. Close all windows and seal vents.',
  statusWatch: 'WATCH ZONE — BE READY',
  statusWatchAction: 'Pack a go-bag. Monitor official updates.',
  statusSafe: 'YOU ARE OUTSIDE THE DANGER ZONE',
  statusSafeAction: 'Stay alert. Conditions can change quickly.',
  noAddress: 'Enter an address above to check your status.',
  // Tabs
  tabGuidance: 'Guidance',
  tabChecklist: 'Checklist',
  tabShelters: 'Shelters',
  tabAssistant: 'Assistant',
  // Shelters
  petFriendly: 'Pet-friendly',
  adaAccessible: 'ADA accessible',
  routeMe: 'Route me here',
  miles: 'mi',
  // Checklist
  checklistIntro: 'Tell us about your household to get a personalized checklist.',
  pets: 'Pets',
  children: 'Children',
  elderly: 'Elderly or mobility needs',
  medications: 'Daily medications',
  timeAvailable: 'Time available',
  none: 'None',
  yes: 'Yes',
  no: 'No',
  tenMin: '10 minutes',
  thirtyMin: '30 minutes',
  shelterInPlace: 'Shelter in place',
  generate: 'Generate checklist',
  generating: 'Generating with Gemini…',
  checklistError: 'Could not generate checklist. Check your Gemini API key.',
  // Chatbot
  chatPlaceholder: 'Ask anything…',
  send: 'Send',
  thinking: 'Thinking…',
  suggested1: 'Is my street in the zone?',
  suggested2: 'What does MMA smell like?',
  suggested3: 'Where can I take my dog?',
  chatError: 'Chatbot unavailable. Check your Gemini API key.',
  // Map
  windDirection: 'Wind: SW → NE',
  mapLoading: 'Loading map…',
  mapError: 'Map failed to load. Check your Google Maps API key.',
  legend: 'Legend',
  mandatory: 'Mandatory evacuation',
  shelterPlace: 'Shelter in place',
  watch: 'Watch zone',
  yourLocation: 'Your location',
  shelter: 'Shelter',
  roadClosure: 'Road closure',
};

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ko', label: '한국어' },
  { code: 'fil', label: 'Tagalog' },
];

const I18nContext = createContext({ t: BASE_STRINGS, lang: 'en', setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('en');
  const [strings, setStrings] = useState(BASE_STRINGS);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (lang === 'en') {
      setStrings(BASE_STRINGS);
      return;
    }
    setTranslating(true);
    translateBundle(BASE_STRINGS, lang).then((out) => {
      if (!cancelled) {
        setStrings(out);
        setTranslating(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return (
    <I18nContext.Provider value={{ t: strings, lang, setLang, translating }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
