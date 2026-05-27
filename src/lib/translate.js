// Google Cloud Translation API (REST v2 — basic edition, simplest auth via API key).
// Docs: https://cloud.google.com/translate/docs/reference/rest/v2/translate

const KEY = import.meta.env.VITE_GOOGLE_CLOUD_API_KEY;

// Cache: `${target}::${text}` → translated string
const cache = new Map();

const TARGET_MAP = { en: 'en', es: 'es', vi: 'vi', ko: 'ko', fil: 'tl' };

export async function translateText(text, targetLang) {
  if (!text) return text;
  if (targetLang === 'en') return text;
  const target = TARGET_MAP[targetLang] || targetLang;
  const cacheKey = `${target}::${text}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  if (!KEY) return text; // graceful: leave English if no key

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target, source: 'en', format: 'text' }),
    });
    if (!res.ok) throw new Error(`Translate HTTP ${res.status}`);
    const data = await res.json();
    const out = data?.data?.translations?.[0]?.translatedText || text;
    cache.set(cacheKey, out);
    return out;
  } catch (err) {
    console.warn('[translate] failed:', err.message);
    return text;
  }
}

// Translate a whole dictionary of UI strings at once. Returns a new object.
export async function translateBundle(strings, targetLang) {
  if (targetLang === 'en') return strings;
  const entries = Object.entries(strings);
  const translated = await Promise.all(
    entries.map(async ([k, v]) => [k, await translateText(v, targetLang)]),
  );
  return Object.fromEntries(translated);
}
