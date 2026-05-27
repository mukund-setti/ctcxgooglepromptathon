# HazAlert

Real-time hazmat evacuation dashboard built for the **CTC × Google Gemini Prompt-a-Thon 2026**.

Single dashboard that answers: **"Am I safe, and what do I do right now?"**

## Quick start

```bash
cd hazalert
npm install
cp .env.example .env
# fill in your API keys (see below), then:
npm run dev
```

Open http://localhost:5173.

## API keys required

The app calls **real** Google services. Add these to `.env`:

| Variable                       | What it powers                                              |
| ------------------------------ | ----------------------------------------------------------- |
| `VITE_GOOGLE_MAPS_API_KEY`     | Maps JS, Geocoding, Directions, Places autocomplete         |
| `VITE_GEMINI_API_KEY`          | Gemini chatbot + checklist generator                        |
| `VITE_GOOGLE_CLOUD_API_KEY`    | Cloud TTS (voice) + Cloud Translation (multilingual UI)     |
| `VITE_GEMINI_MODEL` *(opt.)*   | Defaults to `gemini-2.5-flash`                              |

**Enable these APIs in Google Cloud Console** on the keys above:

- Maps JavaScript API
- Geocoding API
- Directions API
- Places API
- Cloud Text-to-Speech API
- Cloud Translation API

The Gemini key comes from [Google AI Studio](https://aistudio.google.com/) → "Get API key".

> ⚠️ Vite exposes `VITE_*` vars to the browser. Restrict each key by HTTP referrer in the Cloud Console before deploying anywhere public.

## Test addresses (for demo)

| Address                                       | Expected zone           |
| --------------------------------------------- | ----------------------- |
| `12345 Brookhurst St, Garden Grove, CA`       | RED — Mandatory         |
| `9100 Garden Grove Blvd, Garden Grove, CA`    | YELLOW — Shelter in place |
| `8200 Katella Ave, Stanton, CA`               | ORANGE — Watch          |
| `1 Disneyland Way, Anaheim, CA`               | GREEN — Safe            |

Zone polygons are mocked in [`src/data/mockData.json`](src/data/mockData.json). Real geocoding is used to convert the address → lat/lng, then point-in-polygon checks against the mock zones.

## Graceful degradation

- **Cloud TTS** failure → falls back to `window.speechSynthesis` (browser Web Speech API).
- **Cloud Translation** failure → leaves UI in English.
- **Gemini** failure → chatbot and checklist show an error banner with the underlying message.
- **Directions** failure → map still shows zones + user pin, just no highlighted route.

## Structure

```
hazalert/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── AddressBar.jsx          # Places autocomplete + geolocate
│   │   ├── StatusCard.jsx          # 4-state aria-live status
│   │   ├── MapView.jsx             # Google Maps JS with zones, shelters, route
│   │   ├── GuidancePanel.jsx
│   │   ├── Checklist.jsx           # Gemini-generated household checklist
│   │   ├── Chatbot.jsx             # Gemini chat
│   │   └── SheltersList.jsx
│   ├── lib/
│   │   ├── mapsLoader.js           # Dynamic Maps JS API loader
│   │   ├── geocode.js              # Geocoding REST + reverse geocode
│   │   ├── directions.js           # Directions API w/ polygon-avoid
│   │   ├── zones.js                # Ray-casting point-in-polygon + haversine
│   │   ├── gemini.js               # Gemini REST (chat + checklist)
│   │   ├── tts.js                  # Cloud TTS w/ Web Speech fallback
│   │   ├── translate.js            # Cloud Translation v2
│   │   └── i18n.js                 # React context + translateBundle
│   ├── data/mockData.json
│   └── styles/globals.css
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── .env.example
```

## Accessibility

- All status changes announced via `aria-live="assertive"`.
- All buttons / inputs ≥ 44×44 px tap targets.
- Color paired with icon + text label (never color alone).
- Focus-visible outline at high contrast.
- Diagonal-stripe CSS pattern available for the red zone overlay.

## License

MIT — built for educational and social-good purposes.
