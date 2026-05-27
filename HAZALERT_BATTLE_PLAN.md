# 🚨 HazAlert — Battle Plan v4 (Maximalist One-Shot Strategy)

> **Strategy: Swing for the fences with all 10 Google products. If the one-shot works, polish. If not, fall back gracefully.**

---

## 🎯 ELEVATOR PITCH (memorize)

> HazAlert is a real-time hazmat evacuation dashboard that answers one question for any resident, in any language: **"Am I safe, and what do I do right now?"** When the Garden Grove chemical leak triggered evacuations for 50,000+ people across nine square miles, residents had to piece together life-critical info from a dozen scattered sources. HazAlert consolidates evacuation zones, fastest escape routes, personalized checklists, and plain-language voice assistance into one accessible, multilingual dashboard — closing the information equity gap during disasters.

---

## 🏆 THE THREE NON-NEGOTIABLE FEATURES

1. 🗺️ **Map of affected areas** with location-aware guidance
2. 🔊 **Voice feature** in multiple languages
3. 🤖 **Gemini AI** powering checklist + chatbot

Everything else is supporting these.

---

## 🛠️ MAXIMUM GOOGLE STACK — 10 Products

| # | Product | Used for | Fallback if it fails |
|---|---------|----------|----------------------|
| 1 | **Google AI Studio (Build Mode)** | App scaffolding | Antigravity |
| 2 | **Gemini API** | Chatbot + checklist + plain-language summarizer | Hardcoded responses |
| 3 | **Google Maps JavaScript API** | Zone polygons + markers + user pin | Leaflet + OpenStreetMap |
| 4 | **Google Maps Geocoding API** | Address/ZIP → lat/lng | Hardcoded test addresses |
| 5 | **Google Maps Geometry library** | Point-in-polygon zone checks | Ray-casting algorithm in JS |
| 6 | **Google Maps Directions API** | Fastest evacuation route | Skip routing, keep zones only |
| 7 | **Google Maps Places API** | Address autocomplete | Plain text input |
| 8 | **Google Cloud Text-to-Speech** | Premium multilingual voice | Browser Web Speech API |
| 9 | **Google Cloud Translation API** | Full UI translation | Hardcoded translations dict |
| 10 | **Google Antigravity** | Backup dev env | AI Studio (already primary) |

---

## ⏱️ TIMELINE (2.5 hour build window — 5:45 PM – 8:15 PM)

### 🟢 PRE-HACKATHON (do BEFORE 5:45 PM)

**The Night Before:**
- [ ] Set up Google Cloud project + enable billing
- [ ] Enable APIs: Maps JS, Geocoding, Directions, Places, Cloud TTS, Cloud Translation, Gemini
- [ ] Smoke-test each API with a curl call
- [ ] Create empty GitHub repo (HazAlert), have URL ready
- [ ] Create Devpost account, accept hackathon invite
- [ ] Sleep 8 hours

**Morning of (check-in is 5:00 PM):**
- [ ] Pin browser tabs: AI Studio, Gemini chat, this plan, mock JSON, README template, Devpost form
- [ ] Test all API keys one more time
- [ ] Charging cable, water, snacks

### ⏰ 5:45 PM – 6:15 PM (0:00 – 0:30) — THE ONE-SHOT

**5:45 — Paste the Mega One-Shot Prompt into AI Studio Build Mode**
- Hit generate
- Let it cook (this takes 5-10 min in Build Mode)
- Use the time to skim what it generates, identify issues

**6:00 — First validation pass**
- Does the map render? Does the address input work? Does anything voice-related exist?

**6:15 — DECISION POINT** ⚠️
- ✅ **Map + status card + voice work** → polish remaining features (Plan A continues)
- ⚠️ **Partial success** → identify what's broken, plan targeted fixes
- ❌ **Total failure** → switch to Plan B simpler scaffold immediately (no shame)

### ⏰ 6:15 PM – 7:15 PM (0:30 – 1:30) — ITERATE OR FALLBACK

**Plan A (one-shot worked):**
- 6:15 – 6:30 · Polish zone visualization + voice
- 6:30 – 6:45 · Test all 4 status states with test addresses
- 6:45 – 7:00 · Verify Gemini chatbot + checklist
- 7:00 – 7:15 · Verify translation + voice in non-English language

**Plan B (one-shot failed):**
- 6:15 – 6:30 · Paste **Plan B Simpler Scaffold Prompt**
- 6:30 – 6:50 · Verify map + status card + voice (the 3 non-negotiables)
- 6:50 – 7:10 · Add checklist + chatbot via follow-up prompts
- 7:10 – 7:15 · Test everything

### ⏰ 7:15 PM – 7:45 PM (1:30 – 2:00) — POLISH

- 7:15 – 7:30 · WCAG polish: contrast, aria-labels, keyboard nav
- 7:30 – 7:40 · Take screenshots: RED card, Vietnamese mode, Checklist, Chatbot
- 7:40 – 7:45 · Record 60-second screen capture demo as backup

### ⏰ 7:45 PM – 7:55 PM (2:00 – 2:10) — GITHUB

- 7:45 · Create README.md (template provided below)
- 7:48 · git init, add all files, commit
- 7:50 · git push to the pre-created repo
- 7:55 · Confirm repo is public

### ⏰ 7:55 PM – 8:13 PM (2:10 – 2:28) — DEVPOST SUBMISSION

- 7:55 · Open Devpost form
- 7:56 · Paste pre-written Project Description
- 7:58 · Paste Problem Statement
- 8:00 · Paste Solution Overview
- 8:02 · Paste Tech Stack
- 8:04 · Paste Prompting Workflow
- 8:06 · Add GitHub repo URL
- 8:08 · Upload 4 screenshots
- 8:10 · Upload demo video (optional)
- 8:12 · Add team member (your partner)
- 8:13 · **SUBMIT**

### ⏰ 8:13 PM – 8:20 PM — Final demo prep

- Practice the 90-second pitch one last time
- Have backup screen recording cued up
- Take a breath

### ⏰ 8:20 PM — JUDGING + PROJECT EXPO 🎤

---

## 📋 MOCK DATA (paste into your app)

```json
{
  "incident": {
    "name": "Garden Grove Chemical Leak",
    "chemical": "Methyl Methacrylate (MMA)",
    "facility": "GKN Aerospace",
    "started": "2026-05-21T10:00:00-07:00",
    "status": "active",
    "windDirection": "SW",
    "plumeRiskDirection": "NE"
  },
  "zones": [
    {
      "level": "mandatory",
      "color": "#DC2626",
      "label": "Mandatory Evacuation",
      "guidance": "Leave immediately. Head northeast, away from the plume. Take pets, medications, and ID.",
      "polygon": [
        {"lat": 33.7900, "lng": -117.9650},
        {"lat": 33.7900, "lng": -117.9450},
        {"lat": 33.7700, "lng": -117.9450},
        {"lat": 33.7700, "lng": -117.9650}
      ]
    },
    {
      "level": "shelter_in_place",
      "color": "#F59E0B",
      "label": "Shelter-in-Place",
      "guidance": "Stay indoors. Close all windows and doors. Seal vents with damp towels. Turn off HVAC. Move to an interior room.",
      "polygon": [
        {"lat": 33.8050, "lng": -117.9750},
        {"lat": 33.8050, "lng": -117.9350},
        {"lat": 33.7600, "lng": -117.9350},
        {"lat": 33.7600, "lng": -117.9750}
      ]
    },
    {
      "level": "watch",
      "color": "#FB923C",
      "label": "Watch Zone — Be Ready",
      "guidance": "Pack a go-bag with medications, IDs, and pet supplies. Stay near home and monitor official updates.",
      "polygon": [
        {"lat": 33.8200, "lng": -117.9900},
        {"lat": 33.8200, "lng": -117.9200},
        {"lat": 33.7450, "lng": -117.9200},
        {"lat": 33.7450, "lng": -117.9900}
      ]
    }
  ],
  "shelters": [
    {"name": "Magnolia High School", "address": "2450 W Ball Rd, Anaheim, CA", "petFriendly": true, "adaAccessible": true, "lat": 33.8250, "lng": -117.9670},
    {"name": "Garden Grove Community Center", "address": "11300 Stanford Ave, Garden Grove, CA", "petFriendly": false, "adaAccessible": true, "lat": 33.7740, "lng": -117.9410},
    {"name": "Stanton Recreation Center", "address": "7800 Katella Ave, Stanton, CA", "petFriendly": true, "adaAccessible": true, "lat": 33.8020, "lng": -118.0030}
  ],
  "testAddresses": {
    "mandatory_zone": "12345 Brookhurst St, Garden Grove, CA",
    "shelter_in_place": "9100 Garden Grove Blvd, Garden Grove, CA",
    "watch_zone": "8200 Katella Ave, Stanton, CA",
    "outside_zone": "1 Disneyland Way, Anaheim, CA"
  }
}
```

---

## 🤖 THE MEGA ONE-SHOT PROMPT (paste into AI Studio Build Mode)

```
Build a production-quality web app called "HazAlert" — a real-time hazmat evacuation dashboard for residents during chemical emergencies. This is for a hackathon focused on social good, using the maximum Google Cloud stack.

CONTEXT:
The Garden Grove chemical leak (May 21, 2026) at GKN Aerospace involved a 34,000-gallon tank of methyl methacrylate (MMA) at risk of thermal runaway or rupture. Over 50,000 residents across nine square miles were evacuated. Residents struggled to find consolidated information.

GOAL: Build a single dashboard where any resident can:
1. Enter their address, ZIP, or use geolocation to instantly see if they're in the evacuation zone
2. View an interactive Google Map with zones, their location, shelters, and routing
3. Get a personalized evacuation checklist generated by Gemini based on household details
4. Get the fastest safe evacuation route via Google Maps Directions API
5. Ask a Gemini-powered chatbot any question in plain language
6. Toggle between English, Spanish, Vietnamese, Korean, and Tagalog via Google Cloud Translation
7. Hear any content read aloud via Google Cloud Text-to-Speech

TECH STACK (use ALL of these):
- React + Tailwind CSS + Lucide React icons
- Google Maps JavaScript API (with libraries=geometry,places)
- Google Maps Geocoding API (for address/ZIP → lat/lng)
- Google Maps Directions API (for fastest evacuation route)
- Google Maps Places API (for address autocomplete)
- Google Maps Geometry library — use google.maps.geometry.poly.containsLocation() for point-in-polygon checks
- Gemini API (for chatbot + checklist generation)
- Google Cloud Text-to-Speech API (for voice mode)
- Google Cloud Translation API (for multilingual UI)

LAYOUT (desktop):
- Header (64px): "HazAlert" logo with pulsing alert mark on left, live incident banner in middle, language dropdown + voice mode toggle on right
- Hero band (200px): Big address input with Places autocomplete + "Use my location" button on left, large 4-state status card on right
- Main grid: 60% Google Map (left) + 40% side panel with tabs (right)
- Side panel tabs: [Guidance] [Checklist] [Shelters] [Assistant]

LAYOUT (mobile): Stack everything vertically, map becomes 400px tall, side panel becomes a bottom drawer.

CORE LOGIC FLOW:
1. User enters address/ZIP OR clicks "Use my location"
2. App calls Google Maps Geocoding API → returns lat/lng
3. App uses google.maps.geometry.poly.containsLocation() to check user point against zone polygons
4. App determines status: mandatory / shelter_in_place / watch / safe
5. Status card displays with color, icon, text, pattern overlay, action button
6. Map auto-centers on user, drops pulsing pin if in danger zone
7. Side panel shows location-specific guidance text
8. If RED or YELLOW: Directions API calculates fastest route to nearest appropriate shelter (avoiding mandatory zone), highlights it on map

STATUS CARD STATES:
- RED 🚨 "MANDATORY EVACUATION" — bg-red-600 gradient, pulsing border, white text, "Leave the area now" — action button: "Get fastest safe route"
- YELLOW ⚠️ "SHELTER IN PLACE" — bg-amber-500 gradient, dark text — action button: "Show shelter-in-place steps"
- ORANGE 👀 "WATCH ZONE — BE READY" — bg-orange-400 gradient, dark text — action button: "Show preparedness checklist"
- GREEN ✅ "YOU ARE OUTSIDE THE DANGER ZONE" — bg-green-600 gradient, white text — action button: "Turn on watch mode"

Each status card has an aria-live="assertive" attribute so screen readers announce changes.

MAP REQUIREMENTS:
- Render all 3 zone polygons (mandatory red, shelter-in-place yellow, watch zone orange) with semi-transparent fill
- Apply diagonal stripe SVG pattern overlay on each polygon so colorblind users can distinguish zones
- User location pin: large blue dot, pulsing animation when user is inside any zone
- Plot all 3 shelter markers with icon coding (🐾 pet-friendly, ♿ ADA accessible)
- Click any shelter → side panel opens shelter details + "Route me here" button
- Click any zone → popup explaining what that zone level means
- Wind direction arrow in top-right corner of map (mock: SW → NE)
- Mock 2 road closure markers (red X icons)
- Recenter button + zoom controls
- Legend overlay in corner

CHECKLIST FEATURE:
- "Checklist" tab opens household questionnaire:
  • Pets? [Dogs / Cats / Other / None]
  • Children? [None / Infant / Toddler / School-age / Teen]
  • Elderly or mobility needs? [Yes / No]
  • Daily medications? [Yes / No]
  • Time available? [10 min / 30 min / Shelter in place]
- On submit, call Gemini API with this checklist generation prompt:

"Generate a personalized evacuation checklist for a household with these attributes: [INSERT]. Chemical context: methyl methacrylate (MMA) — flammable, irritates eyes/skin/lungs, sweet fruity smell. Output strict JSON only (no preamble): [{priority: 1, task: 'short action', why: 'one sentence', estimatedTime: '30 seconds'}]. Rules: 10_minutes = max 5 life-critical items; 30_minutes = 8-12 items; shelter_in_place = completely different list (close windows, seal vents, turn off HVAC, move to interior room). Always include medications first if user has them, pet carrier + leash + food if pets, diapers + formula for infants, hearing aids + glasses for elderly."

- Render JSON as interactive checklist: checkbox + bold task + smaller "why" + time estimate + per-item voice button
- Progress bar at top showing % complete

CHATBOT FEATURE:
- "Assistant" tab has floating chat interface
- 3 suggested starter questions: "Is my street in the zone?" / "What does MMA smell like?" / "Where can I take my dog?"
- Send user messages to Gemini API with this system prompt:

"You are the HazAlert assistant for the Garden Grove chemical leak (May 21, 2026). A tank of methyl methacrylate (MMA) at GKN Aerospace is at risk of rupture. Over 50,000 residents are under evacuation orders. Answer in plain, calm, clear language (8th-grade level). Never use jargon without explaining it. Always end urgent answers with one concrete next step. For exposure symptoms, list simply, then say 'If you have these symptoms, call 911 immediately.' Respond in the user's selected language: [LANGUAGE_CODE]. Chemical facts: MMA is flammable, irritates eyes/skin/lungs, smells sweet/fruity. Zone boundaries: Mandatory = Ball Rd N, Trask Ave S, Valley View St E, Dale St W. Shelter-in-place = Orangewood N, Garden Grove Blvd S, Dale St E, Knott St W. Shelters: Magnolia HS (pet-friendly, ADA), Garden Grove Community Center (ADA, no pets), Stanton Rec Center (pet-friendly, ADA). Tone: calm, warm, urgent when needed. 2-4 sentences max."

- Each bot response has a 🔊 voice button
- If global voice toggle is ON, auto-speak responses

VOICE FEATURE:
- Global 🔊 toggle in header
- Use Google Cloud Text-to-Speech API for premium voice quality
- When global voice ON: auto-read status card text + guidance every time status changes
- Per-element 🔊 buttons on status card, guidance, each checklist item, each chatbot response
- Voice changes based on selected language (use TTS voice matching language code)

TRANSLATION FEATURE:
- Language dropdown in header: English (en-US) / Español (es-ES) / Tiếng Việt (vi-VN) / 한국어 (ko-KR) / Tagalog (fil-PH)
- Use Google Cloud Translation API to translate all UI labels dynamically on language change
- Translated text gets passed to TTS in matching language
- Update Gemini chatbot system prompt to include current language code so it responds in that language

ACCESSIBILITY (WCAG AA minimum):
- All colors paired with icons + text labels (NEVER color alone)
- Contrast ratio ≥ 4.5:1 throughout
- All interactive elements ≥ 44×44px tap targets
- Full keyboard navigation (logical Tab order, Enter to activate, Escape to close modals)
- aria-labels on all interactive elements, especially map markers
- Status card uses aria-live="assertive"
- Focus visible outlines

DESIGN:
- Background: slate-900 (#0b1220)
- Panels: slate-800 with subtle borders
- Typography: JetBrains Mono or system monospace for headers (gives serious/technical feel), Inter for body
- Calm but urgent palette — alert colors used only where they matter
- Generous whitespace
- Clear hierarchy — status card is the loudest element

MOCK DATA — use this JSON for zones, shelters, road closures, and test addresses:
[INSERT MOCK JSON FROM ABOVE]

TEST ADDRESSES (for demo purposes, these should resolve via Geocoding API):
- "12345 Brookhurst St, Garden Grove, CA" → mandatory zone (RED)
- "9100 Garden Grove Blvd, Garden Grove, CA" → shelter-in-place (YELLOW)
- "8200 Katella Ave, Stanton, CA" → watch zone (ORANGE)
- "1 Disneyland Way, Anaheim, CA" → outside all zones (GREEN)

IMPORTANT: This is for a hackathon with a 2.5-hour build window. Build it as a complete, working, polished single-page React app. Include all features above in the first generation. Production-quality on first pass.
```

---

## 🤖 PLAN B SIMPLER SCAFFOLD PROMPT (use if one-shot fails)

```
Build a web app called "HazAlert" with ONLY these features for now:

1. HEADER: "HazAlert" logo + language dropdown (5 options) + voice toggle button
2. ADDRESS INPUT: Text field + "Use my location" button
3. STATUS CARD: 4 colors (red/yellow/orange/green) showing zone status
4. MAP: Leaflet + OpenStreetMap (NOT Google Maps), with 3 zone polygons
5. GUIDANCE TEXT: Location-specific instructions below status
6. VOICE: Use window.speechSynthesis (browser Web Speech API, no external API)
7. LANGUAGE: Hardcoded translations dictionary (no API call)

Use React + Tailwind. Make it WCAG AA compliant: high contrast, icon + text labels, aria-live on status, keyboard navigation.

For zone checking, use a simple ray-casting point-in-polygon function in JavaScript.

For test addresses, use this hardcoded lookup:
- "12345 Brookhurst" → lat 33.78, lng -117.955 (mandatory)
- "9100 Garden Grove Blvd" → lat 33.77, lng -117.95 (shelter)
- "8200 Katella" → lat 33.805, lng -117.985 (watch)
- "1 Disneyland Way" → lat 33.8121, lng -117.919 (safe)

[INSERT MOCK JSON]
```

---

## 🎬 90-SECOND DEMO SCRIPT

> "Last Friday in Garden Grove, a chemical tank started failing and 50,000 people had to evacuate. *(Show news headline screenshot)* But to figure out what was happening, residents had to check the city website, watch press conferences, follow KTLA, and refresh the school district page — all at once. The people least equipped to do that — non-English speakers, elderly residents, people with disabilities — were the most at risk.
>
> HazAlert solves that. *(Type address)* You enter your address, ZIP, or use your location, and instantly know if you're in the zone. *(Show RED card)* The map shows the danger area, your location, the nearest shelter, and the fastest safe route — calculated by Google Maps Directions API to avoid the plume drift direction. *(Click voice)* It reads your situation aloud via Google Cloud Text-to-Speech — for elderly users, people driving, or anyone in panic mode. *(Switch to Vietnamese)* In every language Garden Grove residents actually speak, via Google Translation API. *(Click checklist)* You get a personalized checklist based on your household, generated by Gemini. *(Open chatbot)* And you can ask the Gemini-powered assistant any question in plain language.
>
> Ten Google products working together. One dashboard. Address-level clarity. Voice-enabled. WCAG-compliant. Closing the information equity gap during disasters — for Garden Grove today, and the next emergency tomorrow."

---

## 🚨 FALLBACK CHAIN (if anything fails mid-build)

Strip features in this order, 5 minutes per swap:

1. **Cloud Translation fails** → swap to hardcoded translations dictionary
2. **Cloud TTS fails** → swap to `window.speechSynthesis` (Web Speech API)
3. **Directions API fails** → drop fastest route, keep just zones + guidance
4. **Places autocomplete fails** → plain text input only
5. **Geocoding fails** → use hardcoded test address lookup table
6. **Google Maps fails entirely** → swap to Leaflet + OpenStreetMap
7. **Gemini API fails** → use hardcoded checklist + canned chatbot responses

**Hard rule:** if at 7:00 PM (1:15 in) you have map + status + voice working, STOP adding features and start polishing. Three working features beats five broken ones.

---

## ✅ FINAL PRE-HACKATHON CHECKLIST

### Night before
- [ ] Google Cloud project + billing enabled
- [ ] Gemini API key generated + tested with curl
- [ ] Maps API key generated (Maps JS + Geocoding + Directions + Places + Geometry enabled)
- [ ] Cloud TTS API enabled
- [ ] Cloud Translation API enabled
- [ ] Test EACH API works (smoke test with simple HTML page)
- [ ] Empty GitHub repo created (public), URL copied
- [ ] Devpost hackathon RSVP confirmed
- [ ] Pitch practiced out loud twice
- [ ] Devpost submission text reviewed and ready
- [ ] Sleep 8 hours

### Morning of (before 5:45 PM)
- [ ] Laptop charged, charger packed
- [ ] All browser tabs pinned and pre-loaded
- [ ] Mock JSON in Notes app
- [ ] All Gemini prompts in Notes app
- [ ] Mega one-shot prompt copied to clipboard
- [ ] Water + snack
- [ ] Phone fully charged

### At 5:45 PM
- [ ] Deep breath
- [ ] Paste mega prompt → hit generate → GO

---

**Build the demo. Tell the story. Ship it.** 🚀
