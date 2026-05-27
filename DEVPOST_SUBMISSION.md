# 📋 HazAlert — Devpost Submission (Ready to Copy-Paste)

> **All required fields filled out. Copy-paste each section into the Devpost form at 7:55 PM.**

---

## Project Name
HazAlert

---

## Team Member Names
- [Your name]
- [Teammate's name]

---

## Short Project Description (one-line tagline)
A real-time hazmat evacuation dashboard that tells any resident, in any language: "Am I safe, and what do I do right now?"

---

## Problem Statement

On May 21, 2026, a chemical tank at the GKN Aerospace facility in Garden Grove, California began leaking methyl methacrylate (MMA) — a flammable industrial chemical at risk of thermal runaway or rupture. Over 50,000 residents across nine square miles were placed under mandatory evacuation orders, with the zone repeatedly expanding over multiple days.

But residents trying to figure out what was actually happening had to navigate a chaotic information landscape: city websites, fire authority social media, news stations like KTLA and ABC7, school district closure alerts, Nextdoor posts, and official press conferences — all updating at different times, in different formats, with different levels of detail.

The people least equipped to navigate that fragmentation were the most at risk:
- **Non-English speakers** — Garden Grove has large Vietnamese, Spanish, Korean, and Tagalog-speaking communities
- **Elderly residents** without smartphones or technical fluency
- **People with disabilities** needing accessible formats
- **Parents in panic** trying to simultaneously check schools, shelters, and pet policies
- **Anyone in shock or stress** unable to process technical jargon like "methyl methacrylate thermal runaway"

This is an **information equity problem during disasters**. Wealthier, more digitally connected residents figured it out. Everyone else was left behind — exactly when life-critical information matters most.

---

## Solution Overview

HazAlert is a single, accessible dashboard that consolidates everything a resident needs into one tool, built on the full Google Cloud stack.

**Core user flow:**
1. User enters their address, ZIP code, or clicks "Use my location"
2. Google Maps Geocoding API converts input to coordinates
3. Google Maps Geometry library checks if the user falls inside any active evacuation polygon
4. A giant 4-state status card immediately tells them what to do (Mandatory Evacuation / Shelter in Place / Watch Zone / Safe)
5. An interactive Google Map visualizes the danger zones, their location, nearest shelters, and the fastest safe evacuation route — calculated by Directions API to avoid the chemical plume's drift direction

**Powered by Gemini:**
- Plain-language chatbot answers questions like "What does MMA smell like?" or "Can I bring my dog to the shelter?"
- Personalized evacuation checklist generated based on household details (pets, kids, elderly members, medications, time available)
- Press release summarizer that translates official jargon into 8th-grade reading level

**Accessibility-first:**
- Full WCAG AA compliance — high contrast, large tap targets, keyboard navigation, screen reader support
- Google Cloud Text-to-Speech reads every screen aloud in the selected language
- Google Cloud Translation API translates the entire UI into Spanish, Vietnamese, Korean, and Tagalog
- Diagonal stripe pattern overlays on map zones so colorblind users can distinguish them

**Why this matters:** The next Garden Grove won't be the last hazmat incident. Closing the information equity gap during disasters means fewer people are left behind during the moments that matter most.

---

## Tech Stack Used

### Google Cloud APIs & Tools (10 products)
1. **Google AI Studio (Build Mode)** — Vibe-coded the entire React app from a single mega-prompt
2. **Gemini API** — Powers the chatbot, generates personalized checklists, and translates press releases into plain language
3. **Google Maps JavaScript API** — Renders interactive map with evacuation zone polygons and shelter markers
4. **Google Maps Geocoding API** — Converts user-entered addresses and ZIP codes into latitude/longitude
5. **Google Maps Geometry library** — Performs point-in-polygon checks to determine which evacuation zone a user is in
6. **Google Maps Directions API** — Calculates the fastest safe evacuation route, filtering out paths through the mandatory zone or plume drift direction
7. **Google Maps Places API** — Provides address autocomplete on the location input
8. **Google Cloud Text-to-Speech** — Reads status, guidance, checklist, and chatbot responses aloud in multiple languages
9. **Google Cloud Translation API** — Translates the entire UI into Spanish, Vietnamese, Korean, and Tagalog dynamically
10. **Google Antigravity** — Used as a backup development environment for complex debugging

### Framework & Libraries
- React 18 + Tailwind CSS
- Lucide React for icons
- Browser Geolocation API (for "Use my location")

### Why we chose this stack
We intentionally maximized our use of the Google ecosystem to demonstrate how comprehensive the platform is for building real-world applications under tight time constraints. Every Google product on the list serves a specific user-facing function — none were added for show.

---

## GitHub Repository
[INSERT GITHUB REPO URL HERE BEFORE SUBMITTING]

---

## Demo / Prototype
[INSERT LIVE DEPLOY URL FROM AI STUDIO]

Alternative: Open the included `index.html` file from the repo in any browser. The demo includes 4 pre-configured test addresses (one for each zone status) so judges can immediately experience all states.

---

## Prompting Workflow

### Narrative
Our team used Gemini at three distinct stages of building HazAlert:

**1. Brainstorming & Scoping (pre-build):**
We started with Gemini as a thought partner to refine the core problem and prioritize features. We explored "no one else will think of this" angles by tying the project to the active Garden Grove chemical leak. Gemini helped us pressure-test the feature scope, identify the user equity angle (non-English speakers, elderly, disabled users), and decide on a tiered MVP approach.

**2. Building (during hackathon):**
We used Google AI Studio's Build Mode with a single mega-prompt requesting all 10 Google APIs at once. When that succeeded, we used follow-up prompts in Gemini chat to debug individual features, refine UI components, and write the multilingual translations. The system prompts for our checklist generator and chatbot were iterated 3–4 times to produce tightly-scoped JSON output and 8th-grade reading level responses.

**3. Polish & Submission (final hour):**
We used Gemini to write our README, format our problem statement, and refine the demo script for the live presentation.

### Key prompts we used

**Mega one-shot prompt (paste into AI Studio Build Mode):**
> Build a production-quality web app called "HazAlert" — a real-time hazmat evacuation dashboard. Context: Garden Grove chemical leak (May 21, 2026), MMA tank at GKN Aerospace, 50,000+ residents evacuated. Tech stack: React + Tailwind, Google Maps JS API, Geocoding, Geometry, Directions, Places, Gemini API, Cloud TTS, Cloud Translation. Features: address/ZIP lookup → 4-state status card (mandatory/shelter-in-place/watch/safe), interactive map with zone polygons + shelters + routing, Gemini-powered chatbot, personalized checklist, voice mode, 5-language translation, WCAG AA compliant. [Full prompt available in repo /docs/prompts.md]

**Checklist generator system prompt:**
> Generate a personalized evacuation checklist for a household with these attributes: [household JSON]. Chemical context: methyl methacrylate (MMA) — flammable, irritates eyes/skin/lungs. Output strict JSON only: [{priority, task, why, estimatedTime}]. Rules: 10_minutes = max 5 life-critical items; 30_minutes = 8-12 items; shelter_in_place = different list entirely. Always include medications first if user has them, pet carrier if pets.

**Chatbot system prompt:**
> You are the HazAlert assistant for the Garden Grove chemical leak. Answer in plain, calm, clear language (8th-grade level). Never use jargon without explaining it. Always end urgent answers with one concrete next step. For exposure symptoms, list simply, then say "If you have these symptoms, call 911 immediately." Respond in the user's selected language. Tone: calm, warm, urgent when needed. 2-4 sentences max.

**Press release translator prompt:**
> Take this official emergency press release and rewrite it for 8th-grade reading level. Lead with what the resident should DO. Output format: **What's happening:** [1-2 sentences] / **What you need to do:** [bullets] / **Why it matters:** [1 sentence].

### Prompt engineering principles we applied
- **Concrete constraints over abstract instructions** ("8th-grade reading level," "2-4 sentences max")
- **Strict output formats** for anything we parsed programmatically (JSON-only, no preamble)
- **Persona + context anchoring** in system prompts so Gemini stayed in character
- **Negative examples** ("never use jargon without explaining it")
- **Tiered prompts** — one big mega-prompt for scaffolding, smaller targeted prompts for iteration

---

## Future Improvements / Roadmap

**Real data integration:**
- Connect to official OCFA and city emergency feeds via webhook so zones update in real time
- Integrate with PurpleAir and EPA air quality sensors for live AQI overlays
- Pull official press releases from OC government RSS feeds and auto-summarize via Gemini

**Expanded scope:**
- Generalize the framework so any municipality can spin up a "[CityName]Alert" instance for their own incidents (wildfires, floods, chemical spills, active shooter, earthquake aftermath)
- Mobile native app via React Native with push notifications when zones expand toward user's location
- SMS fallback for users without smartphones — text your address to a number, get a text back with status + nearest shelter

**Community resilience features:**
- Neighbor-check-in mode — mark elderly neighbors as checked in
- Resource sharing — community members offering transportation, lodging, or pet care during evacuations
- Volunteer dispatch — connect with local mutual aid networks

**Accessibility upgrades:**
- ASL video instructions for Deaf users
- Voice-only mode for visually impaired users (full app navigable by voice command via Gemini)
- Low-bandwidth mode for emergency situations where networks are degraded
