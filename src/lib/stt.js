// Google Cloud Speech-to-Text (REST).
// Records mic audio with MediaRecorder, then sends a single short clip to the
// recognize endpoint. Reliable across browsers (Brave, Arc, Edge, etc.) where
// webkitSpeechRecognition is unavailable or blocked.
// Docs: https://cloud.google.com/speech-to-text/docs/reference/rest/v1/speech/recognize

const KEY = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;

const LANG_MAP = {
  en: 'en-US',
  es: 'es-US',
  vi: 'vi-VN',
  ko: 'ko-KR',
  fil: 'fil-PH',
};

export function isCloudSttAvailable() {
  if (!KEY) return false;
  if (typeof window === 'undefined') return false;
  if (typeof MediaRecorder === 'undefined') return false;
  if (!navigator?.mediaDevices?.getUserMedia) return false;
  return true;
}

function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export class CloudRecorder {
  constructor(lang = 'en') {
    this.lang = lang;
    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.mimeType = '';
  }

  async start() {
    if (!KEY) throw new Error('Missing VITE_GOOGLE_CLOUD_API_KEY');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mimeType = pickMimeType();
    this.mediaRecorder = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined,
    );
    this.chunks = [];
    this.mediaRecorder.addEventListener('dataavailable', (e) => {
      if (e.data?.size > 0) this.chunks.push(e.data);
    });
    this.mediaRecorder.start();
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        resolve('');
        return;
      }
      this.mediaRecorder.addEventListener('stop', async () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        try {
          const blob = new Blob(this.chunks, {
            type: this.mimeType || 'audio/webm',
          });
          if (blob.size === 0) {
            resolve('');
            return;
          }
          const base64 = await blobToBase64(blob);
          const transcript = await transcribe(base64, this.mimeType, this.lang);
          resolve(transcript);
        } catch (err) {
          reject(err);
        }
      });
      try {
        this.mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  abort() {
    try {
      this.mediaRecorder?.stop();
    } catch {
      /* noop */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      const idx = typeof result === 'string' ? result.indexOf(',') : -1;
      resolve(idx >= 0 ? result.slice(idx + 1) : '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function transcribe(base64Audio, mimeType, lang) {
  const encoding = mimeType.includes('webm') ? 'WEBM_OPUS' : 'OGG_OPUS';
  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${KEY}`;
  const body = {
    config: {
      encoding,
      sampleRateHertz: 48000,
      languageCode: LANG_MAP[lang] || 'en-US',
      enableAutomaticPunctuation: true,
      model: 'latest_short',
    },
    audio: { content: base64Audio },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`STT HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.results?.[0]?.alternatives?.[0]?.transcript?.trim() || '';
}
