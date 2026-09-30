"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The Web Speech API is not in the TypeScript DOM lib; this is the part we use.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Voice notes for the open questions, transcribed in the browser (Indian
 * English). Nothing is recorded or uploaded; only the transcript is kept.
 */
export function useDictation() {
  const [active, setActive] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(recognitionCtor() !== null);
    return () => rec.current?.stop();
  }, []);

  const start = useCallback((key: string, onFinal: (t: string) => void): "started" | "unsupported" | "denied" => {
    const Ctor = recognitionCtor();
    if (!Ctor) return "unsupported";
    rec.current?.stop();
    const r = new Ctor();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text.trim()) onFinal(text.trim());
    };
    r.onend = () => setActive((k) => (k === key ? null : k));
    r.onerror = () => setActive(null);
    try {
      r.start();
    } catch {
      return "denied";
    }
    rec.current = r;
    setActive(key);
    return "started";
  }, []);

  const stop = useCallback(() => {
    rec.current?.stop();
    setActive(null);
  }, []);

  return { active, supported, start, stop };
}
