import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Google GenAI on the server
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Port & Host binding configuration
const PORT = 3000;

// API Route 1: Post Gemini Checklist Generation
app.post('/api/gemini/checklist', async (req, res) => {
  try {
    const { attributes } = req.body;
    if (!attributes) {
      return res.status(400).json({ error: 'Attributes are required' });
    }

    const prompt = `Generate a personalized evacuation checklist for a household with these attributes: ${attributes}. Chemical context: methyl methacrylate (MMA) — flammable, irritates eyes/skin/lungs, sweet fruity smell. Output strict JSON only (no preamble): [{"priority": 1, "task": "short action", "why": "one sentence", "estimatedTime": "30 seconds"}]. Rules: 10_minutes = max 5 life-critical items; 30_minutes = 8-12 items; shelter_in_place = completely different list (close windows, seal vents, turn off HVAC, move to interior room). Always include medications first if user has them, pet carrier + leash + food if pets, diapers + formula for infants, hearing aids + glasses for elderly.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              priority: { type: Type.INTEGER },
              task: { type: Type.STRING },
              why: { type: Type.STRING },
              estimatedTime: { type: Type.STRING },
            },
            required: ['priority', 'task', 'why', 'estimatedTime']
          }
        }
      }
    });

    const text = response.text || '[]';
    res.json({ success: true, list: JSON.parse(text) });
  } catch (error: any) {
    console.error('Checklist error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API Route 2: Gemini Chatbot
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { message, history, language, languageCode, userLocation, userLatLng, currentStatus, household } = req.body;
    
    // Convert history format to Gen AI chat standard if needed, or use single prompt.
    // Let's execute using a simple generateContent with built-in context.
    let systemInstruction = `You are the HazAlert assistant for the Garden Grove chemical leak (May 21, 2026). A tank of methyl methacrylate (MMA) at GKN Aerospace is at risk of rupture. Over 50,000 residents are under evacuation orders. Answer in plain, calm, clear language (8th-grade level). Never use jargon without explaining it. Always end urgent answers with one concrete next step. For exposure symptoms, list simply, then say 'If you have these symptoms, call 911 immediately.' Respond in the user's selected language: ${language} (${languageCode}). Chemical facts: MMA is flammable, irritates eyes/skin/lungs, smells sweet/fruity. Zone boundaries: Mandatory = Ball Rd N, Trask Ave S, Valley View St E, Dale St W. Shelter-in-place = Orangewood N, Garden Grove Blvd S, Dale St E, Knott St W. Shelters: Magnolia HS (pet-friendly, ADA), Garden Grove Community Center (ADA, no pets), Stanton Rec Center (pet-friendly, ADA). Tone: calm, warm, urgent when needed. 2-4 sentences max.`;

    if (userLocation || currentStatus || household) {
      systemInstruction += `\n\n[RESIDENT CONTEXT]`;
      if (userLocation) {
        systemInstruction += `\n- Resident Address/Location: ${userLocation}`;
      }
      if (userLatLng) {
        systemInstruction += `\n- Resident Coordinates: Latitude ${userLatLng.lat}, Longitude ${userLatLng.lng}`;
      }
      if (currentStatus) {
        systemInstruction += `\n- Current Threat Level/Warning Zone: ${currentStatus.toUpperCase()}`;
      }
      if (household) {
        systemInstruction += `\n- Household Parameters:`;
        if (household.pets && household.pets !== 'None') {
          systemInstruction += `\n  * Pets in household: ${household.pets}`;
        }
        if (household.children && household.children !== 'None') {
          systemInstruction += `\n  * Children in household: ${household.children}`;
        }
        if (household.elderly) {
          systemInstruction += `\n  * Has elderly members or mobility support needs: Yes`;
        }
        if (household.meds) {
          systemInstruction += `\n  * Essential daily prescription medications required: Yes`;
        }
        if (household.evacTime) {
          systemInstruction += `\n  * Available evacuation/exit timeframe: ${household.evacTime}`;
        }
      }
      systemInstruction += `\n\nUse this context to tailor and personalize your safety advice directly. For example:`;
      systemInstruction += `\n- If current threat level is MANDATORY, emphasize immediate evacuation, suggest heading to a shelter, and advise on their specific evacuation route.`;
      systemInstruction += `\n- If they have pets, highlight pet-friendly shelters (e.g. Magnolia HS or Stanton Rec Center) and remind them to pack pet food/leashes/carriers.`;
      systemInstruction += `\n- If they have infants/children, remind them to pack formula/diapers/baby supplies.`;
      systemInstruction += `\n- If they have elderly members, remind them to assist with mobility and check for ADA-compliant shelters (all active shelters except Garden Grove Community Center are pet-friendly & ADA; Garden Grove Community Center has ADA but no pets).`;
      systemInstruction += `\n- If they require daily medications, prioritize packing essential prescriptions first.`;
      systemInstruction += `\n- Refer to their current address when appropriate to confirm you know where they are.`;
    }

    const contents = [];
    if (history && history.length > 0) {
      for (const msg of history) {
        contents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ success: true, text: response.text });
  } catch (error: any) {
    console.error('Chat AI error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API Route 3: Translate Text
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing text or targetLang' });
    }
    
    // Fallback if targetLang is 'en-US' (no-op)
    if (targetLang.startsWith('en')) {
      return res.json({ success: true, translatedText: text });
    }

    // Google Cloud Translation API via server proxy using Gemini
    // We will use Gemini to translate to targetLang to keep translation extremely flexible and fast,
    // avoiding additional library installation if translation credentials aren't fully configured
    const prompt = `Translate the following text strictly into target locale language "${targetLang}". Do not declare or reply with anything else but the direct translation text. Keep formatting/capitalization similar. Pre-translated text: "${text}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
      }
    });

    res.json({ success: true, translatedText: text, isFallback: true });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.json({ success: true, translatedText: req.body.text || '', isFallback: true });
  }
});

// API Route 4: Text to Speech
app.post('/api/tts', async (req, res) => {
  try {
    const { text, langCode } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }

    // Google Cloud Speech Synthesis API using Gemini TTS model: "gemini-3.1-flash-tts-preview"
    // As instructed by gemini-api skill guidelines
    let voiceName = 'Kore'; // English
    if (langCode?.startsWith('es')) {
      voiceName = 'Kore'; // For standard preview models, we can leverage default voices
    } else if (langCode?.startsWith('vi')) {
      voiceName = 'Kore';
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say clearly in language matching locale code "${langCode || 'en-US'}": ${text}` }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({ success: true, audioData: base64Audio });
    } else {
      throw new Error('TTS content not returned from API');
    }
  } catch (error: any) {
    console.error('TTS error:', error);
    // Return a mock success with simple Web Speech API client callback indicator
    res.json({ success: false, error: error.message, isFallback: true });
  }
});

// Register Vite development middlewares or serve production dist static files
import { createServer as createViteServer } from 'vite';

async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupServer();
