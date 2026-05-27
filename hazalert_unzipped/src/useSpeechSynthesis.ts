import { useState, useEffect } from 'react';

export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSupported(true);
    }
  }, []);

  const speak = async (text: string, langCode: string = 'en-US') => {
    if (!text) return;
    
    // First try the custom high-quality Google Cloud TTS proxy route on the server
    try {
      setSpeaking(true);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, langCode })
      });
      const data = await response.json();
      
      if (data.success && data.audioData) {
        // Decode base64 and play using browser audio element
        const audioSrc = `data:audio/mp3;base64,${data.audioData}`;
        const audio = new Audio(audioSrc);
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => {
          // fallback to client-side SpeechSynthesis if audio tag fails
          speakClientFallback(text, langCode);
        };
        await audio.play();
        return;
      }
    } catch (err) {
      console.warn('Server TTS failed. Using client-side fallback SpeechSynthesis...', err);
    }

    // Client-side fallback speech synthesis
    speakClientFallback(text, langCode);
  };

  const speakClientFallback = (text: string, langCode: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(true);
    
    const utterance = new SpeechSynthesisUtterance(text);
    // Bind correct locale language
    utterance.lang = langCode;
    
    // Attempt map locale code into native browser synthesis voices
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang.startsWith(langCode.substring(0, 2)));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    if (supported) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  return { speak, stop, speaking, supported };
}
