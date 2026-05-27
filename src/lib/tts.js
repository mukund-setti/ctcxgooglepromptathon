// Google Cloud Text-to-Speech (REST).
// Falls back to window.speechSynthesis if the Cloud TTS call fails (no key, quota, network).
// Docs: https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize

const KEY = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;

// Map our UI language codes → Cloud TTS BCP-47 + a high-quality voice name.
const VOICE_MAP = {
  en: { languageCode: 'en-US', name: 'en-US-Neural2-F' },
  es: { languageCode: 'es-US', name: 'es-US-Neural2-A' },
  vi: { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A' },
  ko: { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A' },
  fil: { languageCode: 'fil-PH', name: 'fil-PH-Standard-A' },
};

let currentAudio = null;

export async function speak(text, lang = 'en') {
  cancel();
  if (!text) return;

  if (KEY) {
    try {
      await speakCloud(text, lang);
      return;
    } catch (err) {
      console.warn('[tts] Cloud TTS failed, falling back to Web Speech:', err.message);
    }
  }
  speakBrowser(text, lang);
}

async function speakCloud(text, lang) {
  const voice = VOICE_MAP[lang] || VOICE_MAP.en;
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice,
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
    }),
  });
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
  const data = await res.json();
  if (!data.audioContent) throw new Error('TTS returned no audio');

  const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
  currentAudio = audio;
  await audio.play();
}

function speakBrowser(text, lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = (VOICE_MAP[lang] || VOICE_MAP.en).languageCode;
  utter.rate = 1.0;
  window.speechSynthesis.speak(utter);
}

export function cancel() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
