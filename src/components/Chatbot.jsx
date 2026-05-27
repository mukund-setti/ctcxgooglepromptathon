import { useState, useRef, useEffect } from 'react';
import { Send, Volume2 } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';
import { chatbotReply } from '../lib/gemini.js';
import { speak } from '../lib/tts.js';

export default function Chatbot({ voiceOn, incident, shelters }) {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  // Clear messages when incident changes so chats don't leak between disasters
  useEffect(() => {
    setMessages([]);
  }, [incident?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(textOverride) {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const reply = await chatbotReply({
        history: messages,
        userMessage: text,
        incident,
        shelters,
        lang,
      });
      setMessages([...next, { role: 'bot', text: reply }]);
      if (voiceOn) speak(reply, lang);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [t.suggested1, t.suggested2, t.suggested3];

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {messages.length === 0 && (
        <div className="space-y-2 mb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="w-full text-left px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sm border border-slate-700 min-h-[44px]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pr-1" role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                m.role === 'user'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-100 border border-slate-700'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm">{m.text}</div>
              {m.role === 'bot' && (
                <button
                  type="button"
                  onClick={() => speak(m.text, lang)}
                  className="mt-2 p-1 rounded text-slate-400 hover:text-sky-400"
                  aria-label="Read response aloud"
                >
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-sm text-slate-400 italic">{t.thinking}</div>
        )}
        {error && (
          <div className="text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-md p-2">
            {t.chatError}
            <div className="text-xs mt-1 opacity-70">{error}</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.chatPlaceholder}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-sky-400 min-h-[44px]"
          aria-label={t.chatPlaceholder}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-2 min-h-[44px]"
          aria-label={t.send}
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
