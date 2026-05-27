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
  // Language picker (welcome screen)
  welcomeTitle: 'HazAlert',
  welcomeSubtitle: 'Please choose your language',
  welcomeHint: 'Tap the speaker to hear each language. Then tap Continue.',
  welcomePlaySample: 'Play sample',
  continueBtn: 'Continue',
  changeLanguage: 'Change language',
  // Voice assistant
  voiceAssistant: 'Voice assistant',
  voiceHelpMe: 'Help me',
  voiceHelpMeHint: 'Tap to hear what to do now',
  voiceListening: 'Listening…',
  voiceSpeaking: 'Speaking…',
  voiceMute: 'Mute assistant',
  voiceUnmute: 'Unmute assistant',
  voiceAskQuestion: 'Ask a question',
  voiceStop: 'Stop speaking',
  voiceStopAndMute: 'Stop & mute',
  voiceUnavailable: 'Voice input is not supported in this browser.',
  voiceErrNetwork:
    'Voice recognition needs an internet connection. Please check your network and try again.',
  voiceErrNotAllowed:
    'Microphone access was blocked. Please allow microphone access in your browser settings.',
  voiceErrNoMic: 'No microphone was detected.',
  voiceErrNoSpeech: 'I did not hear anything. Please try again.',
  voiceErrGeneric: 'Voice input failed. Please try again or type your question.',
  voiceRecording: 'Recording — tap to stop',
  voiceTranscribing: 'Transcribing…',
  voiceChat: 'Chat',
  voiceCloseChat: 'Close chat',
  voiceTypeMessage: 'Type a message…',
  voiceClearChat: 'Clear conversation',
  voiceChatEmpty: 'Ask anything about your situation. I will remember our conversation.',
  voiceYou: 'You',
  // Spoken-only guidance (read aloud by the assistant)
  voiceWelcomeMessage:
    'Welcome to HazAlert. I am your voice assistant. To check if you are safe, enter your address or tap Use my location. I will tell you what to do next.',
  voiceNoLocation:
    'I do not have your location yet. Please enter your address, or tap the Use my location button to share your location.',
  voiceNextStepEnterAddress: 'Next step: enter your address above.',
  voiceNextStepFollowGuidance: 'Next step: follow the guidance shown on the screen.',
  voiceRouteReady: 'A route to the nearest safe shelter is ready on the map.',
  voiceTabHint: 'You can tap Guidance, Checklist, Shelters, or Assistant for more help.',
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

// `nativeLabel` is shown on the language picker so a user can recognize their
// own language visually even when the rest of the UI is still in English.
// `sample` is read aloud (in that language) when the speaker button is tapped,
// so users who cannot read the label can still identify their language by ear.
export const LANGUAGES = [
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    sample: 'Welcome to HazAlert. Tap Continue to use English.',
  },
  {
    code: 'es',
    label: 'Español',
    nativeLabel: 'Español',
    sample: 'Bienvenido a HazAlert. Toque Continuar para usar el español.',
  },
  {
    code: 'vi',
    label: 'Tiếng Việt',
    nativeLabel: 'Tiếng Việt',
    sample: 'Chào mừng đến với HazAlert. Nhấn Tiếp tục để dùng tiếng Việt.',
  },
  {
    code: 'ko',
    label: '한국어',
    nativeLabel: '한국어',
    sample: 'HazAlert에 오신 것을 환영합니다. 한국어를 사용하려면 계속을 누르세요.',
  },
  {
    code: 'fil',
    label: 'Tagalog',
    nativeLabel: 'Tagalog',
    sample: 'Maligayang pagdating sa HazAlert. Pindutin ang Magpatuloy para gamitin ang Tagalog.',
  },
];

const STORAGE_KEY = 'hazalert.lang';

const I18nContext = createContext({
  t: BASE_STRINGS,
  lang: 'en',
  setLang: () => {},
  hasSelectedLanguage: false,
  confirmLanguage: () => {},
});

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    return window.localStorage.getItem(STORAGE_KEY) || 'en';
  });
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  });
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

  function confirmLanguage(code) {
    const next = code || lang;
    setLang(next);
    setHasSelectedLanguage(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }

  return (
    <I18nContext.Provider
      value={{
        t: strings,
        lang,
        setLang,
        translating,
        hasSelectedLanguage,
        confirmLanguage,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
