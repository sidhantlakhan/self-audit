import { useCallback, useEffect, useRef, useState } from 'react';

interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void;
  onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null;
}

const getCtor = (): (new () => Recognition) | null =>
  typeof window === 'undefined' ? null : ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null);

/** Optional dictation. `supported` is false where the browser has no speech recognition; callers then hide the control. */
export function useVoice(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => { setSupported(!!getCtor()); return () => rec.current?.stop(); }, []);

  const toggle = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (listening) { rec.current?.stop(); return; }
    setError(null);
    const r = new Ctor();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.continuous = true;
    r.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text.trim()) cb.current(text.trim());
    };
    r.onerror = (e: any) => { setError(e.error === 'not-allowed' ? 'Microphone access was not allowed. You can type instead.' : 'Voice input stopped. You can type instead.'); setListening(false); };
    r.onend = () => setListening(false);
    rec.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, [listening]);

  return { supported, listening, error, toggle };
}
