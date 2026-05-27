// Gemini API (REST).
// Docs: https://ai.google.dev/api/generate-content

const KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';

const LANG_NAME = {
  en: 'English',
  es: 'Spanish',
  vi: 'Vietnamese',
  ko: 'Korean',
  fil: 'Tagalog (Filipino)',
};

async function callGemini({ systemInstruction, contents, responseMimeType }) {
  if (!KEY) throw new Error('Missing VITE_GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const body = {
    contents,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    generationConfig: {
      temperature: 0.4,
      ...(responseMimeType ? { responseMimeType } : {}),
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return text;
}

// ---------- Chatbot ----------

const CHATBOT_SYSTEM_PROMPT = (lang) => `
You are the HazAlert assistant for the Garden Grove chemical leak (May 21, 2026).
A tank of methyl methacrylate (MMA) at GKN Aerospace is at risk of rupture.
Over 50,000 residents are under evacuation orders.

Rules:
- Plain, calm, clear language at 8th-grade reading level.
- Never use jargon without explaining it.
- 2-4 sentences max.
- End urgent answers with one concrete next step.
- For exposure symptoms, list simply, then say "If you have these symptoms, call 911 immediately."
- Respond in: ${LANG_NAME[lang] || 'English'}.

Chemical facts: MMA is flammable, irritates eyes/skin/lungs, smells sweet/fruity.
Shelters: Magnolia HS (pet-friendly, ADA), Garden Grove Community Center (ADA, no pets), Stanton Rec Center (pet-friendly, ADA).
Tone: calm, warm, urgent when needed.
`.trim();

export async function chatbotReply({ history, userMessage, lang = 'en' }) {
  const contents = [
    ...history.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];
  return callGemini({
    systemInstruction: CHATBOT_SYSTEM_PROMPT(lang),
    contents,
  });
}

// ---------- Checklist generator ----------

const CHECKLIST_SYSTEM_PROMPT = `
Generate a personalized evacuation checklist as STRICT JSON ONLY (no preamble, no markdown fence).
Schema: { "items": [{ "priority": number, "task": string, "why": string, "estimatedTime": string }] }

Chemical context: methyl methacrylate (MMA) — flammable, irritates eyes/skin/lungs, sweet fruity smell.

Rules:
- 10_minutes  = max 5 life-critical items.
- 30_minutes  = 8-12 items.
- shelter_in_place = a DIFFERENT list entirely (close windows, seal vents with damp towels, turn off HVAC, move to interior room, keep pets indoors, monitor official updates).
- If household has medications, list them FIRST.
- If household has pets, include pet carrier + leash + food/water.
- If household has infants, include diapers + formula + bottled water.
- If household has elderly members, include hearing aids + glasses + mobility aids.
- Sort by ascending priority (1 = most urgent).
`.trim();

export async function generateChecklist(household) {
  const userMsg = `Household attributes: ${JSON.stringify(household)}`;
  const raw = await callGemini({
    systemInstruction: CHECKLIST_SYSTEM_PROMPT,
    contents: [{ role: 'user', parts: [{ text: userMsg }] }],
    responseMimeType: 'application/json',
  });
  try {
    const parsed = JSON.parse(raw);
    return parsed.items || [];
  } catch (err) {
    console.warn('[gemini] checklist JSON parse failed:', err.message, raw.slice(0, 200));
    return [];
  }
}
