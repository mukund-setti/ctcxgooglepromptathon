import { useEffect, useRef, useState } from 'react';
import {
  HelpCircle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
  Loader2,
  MessageCircle,
  Send,
  X,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';
import { speak, cancel, subscribeSpeaking } from '../lib/tts.js';
import { chatbotReply } from '../lib/gemini.js';
import { CloudRecorder, isCloudSttAvailable } from '../lib/stt.js';

// BCP-47 codes for browser SpeechRecognition. Mirrors VOICE_MAP in tts.js.
const RECOGNITION_LANG = {
  en: 'en-US',
  es: 'es-US',
  vi: 'vi-VN',
  ko: 'ko-KR',
  fil: 'fil-PH',
};

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const CLOUD_STT = isCloudSttAvailable();

// Build a context-aware spoken script based on the user's current situation.
// Used both by the "Help me" button and by the auto-narrate effect.
function buildScript({ t, level, address, hasLocation, route }) {
  if (!hasLocation) {
    return `${t.voiceWelcomeMessage} ${t.voiceNextStepEnterAddress}`;
  }
  const titleMap = {
    mandatory: t.statusMandatory,
    shelter_in_place: t.statusShelter,
    watch: t.statusWatch,
    safe: t.statusSafe,
  };
  const actionMap = {
    mandatory: t.statusMandatoryAction,
    shelter_in_place: t.statusShelterAction,
    watch: t.statusWatchAction,
    safe: t.statusSafeAction,
  };
  const title = titleMap[level];
  const action = actionMap[level];
  if (!title) return t.voiceNoLocation;

  const parts = [title + '.', action];
  if (address) parts.push(address + '.');
  if (route && (level === 'mandatory' || level === 'shelter_in_place')) {
    parts.push(t.voiceRouteReady);
  }
  if (level !== 'safe') parts.push(t.voiceTabHint);
  return parts.filter(Boolean).join(' ');
}

export default function VoiceAssistant({ level, address, hasLocation, route, muted, onToggleMute, incident, shelters }) {
  const { t, lang } = useI18n();
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const cloudRecorderRef = useRef(null);
  const prevSignatureRef = useRef('');
  const narrateTimerRef = useRef(null);
  const chatEndRef = useRef(null);
  const SpeechRecognition = getSpeechRecognition();
  const voiceInputSupported = CLOUD_STT || Boolean(SpeechRecognition);

  // Mirror tts speaking state into local UI.
  useEffect(() => subscribeSpeaking(setSpeaking), []);

  // Muting should silence whatever is currently being read aloud, not just
  // future announcements. Without this, toggling mute mid-sentence leaves
  // the current utterance playing to completion.
  useEffect(() => {
    if (muted) cancel();
  }, [muted]);

  // Auto-scroll chat to bottom on new messages.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking, chatOpen]);

  // Clear messages when incident changes so chats don't leak between disasters
  useEffect(() => {
    setMessages([]);
  }, [incident?.id]);

  // Auto-narrate situation changes when not muted.
  // We debounce because a single user action (entering an address inside a
  // hazard zone) triggers two close-together state updates: the level changes
  // first, then the route arrives ~1s later. Without debouncing the assistant
  // speaks twice — once for the level, once after the route resolves.
  useEffect(() => {
    if (muted) return;
    const signature = `${level || 'none'}|${hasLocation ? 'loc' : 'noloc'}|${
      route ? 'route' : 'noroute'
    }`;
    if (signature === prevSignatureRef.current) return;
    // Skip the very first render with no location — the picker's greeting
    // already covered the welcome message.
    if (!hasLocation && !prevSignatureRef.current && signature === 'none|noloc|noroute') {
      prevSignatureRef.current = signature;
      return;
    }

    if (narrateTimerRef.current) clearTimeout(narrateTimerRef.current);
    narrateTimerRef.current = setTimeout(() => {
      prevSignatureRef.current = signature;
      const script = buildScript({ t, level, address, hasLocation, route });
      if (script) speak(script, lang);
    }, 700);

    return () => {
      if (narrateTimerRef.current) clearTimeout(narrateTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, hasLocation, route, muted, lang]);

  // Tear down recognition + audio on unmount.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* noop */
      }
      try {
        cloudRecorderRef.current?.abort?.();
      } catch {
        /* noop */
      }
      cancel();
    };
  }, []);

  function onHelpMe() {
    setError(null);
    const script = buildScript({ t, level, address, hasLocation, route });
    speak(script, lang);
  }

  function onStop() {
    cancel();
  }

  // Stop the current utterance AND mute future announcements in one tap.
  function onStopAndMute() {
    cancel();
    if (!muted) onToggleMute();
  }

  // Send a user message into the conversation. Used by both text input and
  // speech recognition. Passes the full history so Gemini stays conversational.
  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setError(null);
    setChatOpen(true);
    const history = messages;
    const next = [...history, { role: 'user', text: trimmed }];
    setMessages(next);
    setInput('');
    setThinking(true);
    try {
      const out = await chatbotReply({
        history,
        userMessage: trimmed,
        incident,
        shelters,
        lang,
      });
      setMessages([...next, { role: 'bot', text: out }]);
      if (!muted) speak(out, lang);
    } catch (err) {
      console.warn('[assistant] reply failed:', err.message);
      setError(t.chatError);
    } finally {
      setThinking(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
    cancel();
  }

  async function startListening() {
    if (!voiceInputSupported) {
      setError(t.voiceUnavailable);
      return;
    }
    // If already recording/listening, tapping again stops + sends.
    if (listening) {
      if (cloudRecorderRef.current) {
        try {
          const text = await cloudRecorderRef.current.stop();
          cloudRecorderRef.current = null;
          setListening(false);
          if (text) sendMessage(text);
          else setError(t.voiceErrNoSpeech);
        } catch (err) {
          cloudRecorderRef.current = null;
          setListening(false);
          setError(t.voiceErrGeneric);
          console.warn('[stt] failed:', err.message);
        }
        return;
      }
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* noop */
      }
      return;
    }

    cancel(); // don't talk over the user
    setError(null);

    if (CLOUD_STT) {
      const recorder = new CloudRecorder(lang);
      try {
        await recorder.start();
        cloudRecorderRef.current = recorder;
        setListening(true);
      } catch (err) {
        console.warn('[stt] mic error:', err.message);
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setError(t.voiceErrNotAllowed);
        } else if (err.name === 'NotFoundError') {
          setError(t.voiceErrNoMic);
        } else {
          setError(t.voiceErrGeneric);
        }
      }
      return;
    }

    // Fallback: webkitSpeechRecognition
    const rec = new SpeechRecognition();
    rec.lang = RECOGNITION_LANG[lang] || 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (text) sendMessage(text);
    };
    rec.onerror = (event) => {
      const code = event.error;
      if (code === 'aborted') return;
      const map = {
        network: t.voiceErrNetwork,
        'not-allowed': t.voiceErrNotAllowed,
        'service-not-allowed': t.voiceErrNotAllowed,
        'audio-capture': t.voiceErrNoMic,
        'no-speech': t.voiceErrNoSpeech,
      };
      setError(map[code] || t.voiceErrGeneric);
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch (err) {
      setError(err.message);
      setListening(false);
    }
  }

  const muteLabel = muted ? t.voiceUnmute : t.voiceMute;
  const statusLabel = speaking
    ? t.voiceSpeaking
    : listening
      ? CLOUD_STT
        ? t.voiceRecording
        : t.voiceListening
      : thinking
        ? t.voiceTranscribing
        : t.voiceAssistant;

  return (
    <div
      className={`fixed bottom-4 right-4 left-4 sm:left-auto z-40 bg-slate-900/95 backdrop-blur border-2 border-slate-700 rounded-2xl shadow-2xl p-3 transition-all ${
        chatOpen ? 'sm:w-[420px]' : 'sm:w-[360px]'
      }`}
      role="region"
      aria-label={t.voiceAssistant}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
              speaking || thinking
                ? 'bg-sky-400 animate-pulse'
                : listening
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-500'
            }`}
            aria-hidden="true"
          />
          <span className="text-sm font-mono text-slate-200 truncate">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {chatOpen && messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              aria-label={t.voiceClearChat}
              className="p-2 rounded-md hover:bg-slate-800 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4 text-slate-400" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={muted}
            aria-label={muteLabel}
            className="p-2 rounded-md hover:bg-slate-800 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            {muted ? (
              <VolumeX className="w-5 h-5 text-slate-400" aria-hidden="true" />
            ) : (
              <Volume2 className="w-5 h-5 text-sky-400" aria-hidden="true" />
            )}
          </button>
          {chatOpen && (
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label={t.voiceCloseChat}
              className="p-2 rounded-md hover:bg-slate-800 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            >
              <X className="w-5 h-5 text-slate-400" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {speaking && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-sky-950/40 border border-sky-800 px-2 py-1.5">
          <Volume2 className="w-4 h-4 text-sky-300 shrink-0 animate-pulse" aria-hidden="true" />
          <span className="text-xs text-sky-200 flex-1">{t.voiceSpeaking}</span>
          <button
            type="button"
            onClick={onStop}
            className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-medium inline-flex items-center gap-1 min-h-[32px]"
          >
            <Square className="w-3.5 h-3.5" aria-hidden="true" />
            {t.voiceStop}
          </button>
          <button
            type="button"
            onClick={onStopAndMute}
            className="px-2 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold inline-flex items-center gap-1 min-h-[32px]"
          >
            <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
            {t.voiceStopAndMute}
          </button>
        </div>
      )}

      {chatOpen ? (
        <ChatPanel
          t={t}
          messages={messages}
          thinking={thinking}
          error={error}
          input={input}
          setInput={setInput}
          onSend={() => sendMessage(input)}
          onMic={startListening}
          listening={listening}
          voiceInputSupported={voiceInputSupported}
          speaking={speaking}
          onStop={onStop}
          chatEndRef={chatEndRef}
        />
      ) : (
        <CompactPanel
          t={t}
          speaking={speaking}
          listening={listening}
          voiceInputSupported={voiceInputSupported}
          onHelpMe={onHelpMe}
          onStop={onStop}
          onMic={startListening}
          onOpenChat={() => setChatOpen(true)}
          error={error}
          hasMessages={messages.length > 0}
        />
      )}
    </div>
  );
}

function CompactPanel({
  t,
  speaking,
  listening,
  voiceInputSupported,
  onHelpMe,
  onStop,
  onMic,
  onOpenChat,
  error,
  hasMessages,
}) {
  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onHelpMe}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold min-h-[56px] focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          <HelpCircle className="w-5 h-5" aria-hidden="true" />
          {t.voiceHelpMe}
        </button>
        {speaking ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t.voiceStop}
            className="px-4 rounded-xl bg-slate-700 hover:bg-slate-600 min-h-[56px] min-w-[56px] inline-flex items-center justify-center"
          >
            <Square className="w-5 h-5 text-slate-100" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onMic}
            disabled={!voiceInputSupported}
            aria-pressed={listening}
            aria-label={t.voiceAskQuestion}
            title={voiceInputSupported ? t.voiceAskQuestion : t.voiceUnavailable}
            className={`px-4 rounded-xl min-h-[56px] min-w-[56px] inline-flex items-center justify-center ${
              listening
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : voiceInputSupported
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {voiceInputSupported ? (
              <Mic className="w-5 h-5" aria-hidden="true" />
            ) : (
              <MicOff className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenChat}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-medium min-h-[48px]"
      >
        <MessageCircle className="w-4 h-4" aria-hidden="true" />
        {t.voiceChat}
        {hasMessages && (
          <span className="ml-1 inline-block w-2 h-2 rounded-full bg-sky-400" aria-hidden="true" />
        )}
      </button>

      {error && (
        <div className="mt-2 text-red-300 text-xs bg-red-950/40 border border-red-900 rounded-md px-2 py-1">
          {error}
        </div>
      )}
    </>
  );
}

function ChatPanel({
  t,
  messages,
  thinking,
  error,
  input,
  setInput,
  onSend,
  onMic,
  listening,
  voiceInputSupported,
  speaking,
  onStop,
  chatEndRef,
}) {
  function onSubmit(e) {
    e.preventDefault();
    onSend();
  }

  return (
    <div className="flex flex-col">
      <div
        className="overflow-y-auto space-y-2 pr-1 mb-2"
        style={{ maxHeight: '40vh', minHeight: '180px' }}
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 && !thinking && (
          <p className="text-slate-400 text-sm italic">{t.voiceChatEmpty}</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-100 border border-slate-700'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          </div>
        ))}
        {thinking && (
          <div className="text-slate-400 italic text-sm inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            {t.thinking}
          </div>
        )}
        {error && (
          <div className="text-red-300 text-xs bg-red-950/40 border border-red-900 rounded-md px-2 py-1">
            {error}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.voiceTypeMessage}
          aria-label={t.voiceTypeMessage}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-sky-400 min-h-[44px]"
        />
        {speaking ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t.voiceStop}
            className="px-3 rounded-md bg-slate-700 hover:bg-slate-600 inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <Square className="w-4 h-4 text-slate-100" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onMic}
            disabled={!voiceInputSupported}
            aria-pressed={listening}
            aria-label={t.voiceAskQuestion}
            title={voiceInputSupported ? t.voiceAskQuestion : t.voiceUnavailable}
            className={`px-3 rounded-md inline-flex items-center justify-center min-h-[44px] min-w-[44px] ${
              listening
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : voiceInputSupported
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {voiceInputSupported ? (
              <Mic className="w-4 h-4" aria-hidden="true" />
            ) : (
              <MicOff className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        )}
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          aria-label={t.send}
          className="px-4 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white inline-flex items-center justify-center min-h-[44px] min-w-[44px]"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
