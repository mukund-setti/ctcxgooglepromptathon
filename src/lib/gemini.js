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

const CHATBOT_SYSTEM_PROMPT = (lang) => {
  let prompt = `
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

  try {
    const userStateRaw = typeof window !== 'undefined' ? localStorage.getItem('hazalert_user_state') : null;
    const householdRaw = typeof window !== 'undefined' ? localStorage.getItem('hazalert_household') : null;

    if (userStateRaw || householdRaw) {
      prompt += `\n\n[RESIDENT CONTEXT]`;
      if (userStateRaw) {
        const userState = JSON.parse(userStateRaw);
        if (userState.address) {
          prompt += `\n- Resident Address/Location: ${userState.address}`;
        }
        if (userState.lat && userState.lng) {
          prompt += `\n- Coordinates: Latitude ${userState.lat}, Longitude ${userState.lng}`;
        }
        if (userState.level && userState.level !== 'none') {
          prompt += `\n- Warning Zone Status: ${userState.level.toUpperCase()}`;
        }
        if (userState.routeSummary) {
          prompt += `\n- Evacuation Route: Avoid mandatory zone, proceed via ${userState.routeSummary} (${userState.routeDistance}, ${userState.routeDuration})`;
        }
      }
      if (householdRaw) {
        const household = JSON.parse(householdRaw);
        prompt += `\n- Household Parameters:`;
        if (household.pets && household.pets !== 'none') {
          prompt += `\n  * Pets in household: ${household.pets}`;
        }
        if (household.children && household.children !== 'none') {
          prompt += `\n  * Children in household: ${household.children}`;
        }
        if (household.elderly === 'yes') {
          prompt += `\n  * Has elderly members or mobility support needs: Yes`;
        }
        if (household.medications === 'yes') {
          prompt += `\n  * Essential daily prescription medications required: Yes`;
        }
        if (household.time) {
          prompt += `\n  * Available evacuation/exit timeframe: ${household.time}`;
        }
      }
      prompt += `\n\nUse this context to tailor and personalize your safety advice directly. For example:`;
      prompt += `\n- If current threat level is MANDATORY, emphasize immediate evacuation, suggest heading to a shelter, and advise on their specific evacuation route.`;
      prompt += `\n- If they have pets, highlight pet-friendly shelters (e.g. Magnolia HS or Stanton Rec Center) and remind them to pack pet food/leashes/carriers.`;
      prompt += `\n- If they have infants/children, remind them to pack formula/diapers/baby supplies.`;
      prompt += `\n- If they have elderly members, remind them to assist with mobility and check for ADA-compliant shelters (all active shelters except Garden Grove Community Center are pet-friendly & ADA; Garden Grove Community Center has ADA but no pets).`;
      prompt += `\n- If they require daily medications, prioritize packing essential prescriptions first.`;
      prompt += `\n- Refer to their current address/status when appropriate to confirm you know where they are.`;
    }
  } catch (err) {
    console.warn('[gemini] failed to load dynamic context:', err);
  }

  return prompt;
};

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
