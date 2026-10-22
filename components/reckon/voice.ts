'use client';
import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';

interface RecognitionLike extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: {resultIndex: number; results: ArrayLike<ArrayLike<{transcript: string}> & {isFinal: boolean}>}) => void) | null;
  onend: (() => void) | null; onerror: ((e: {error: string}) => void) | null;
}
type Ctor = new () => RecognitionLike;

const noop = () => () => {};

function getCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor};
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Browser speech-to-text where available (Safari/Chrome). Nothing leaves the device except via the browser's own engine. */
export function useSpeech(onText: (text: string) => void) {
  const supported = useSyncExternalStore(noop, () => !!getCtor(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<RecognitionLike | null>(null);
  const cb = useRef(onText);
  useEffect(() => { cb.current = onText; }, [onText]);
  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    const C = getCtor(); if (!C) return;
    const r = new C(); rec.current = r;
    r.lang = 'en-AU'; r.continuous = true; r.interimResults = true;
    let finalText = '';
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript + ' '; else interim += res[0].transcript;
      }
      cb.current((finalText + interim).trim());
    };
    r.onerror = e => { setError(e.error === 'not-allowed' ? 'Microphone access was declined.' : 'Voice input stopped.'); setListening(false); };
    r.onend = () => setListening(false);
    setError(null); setListening(true); r.start();
  }, []);
  const stop = useCallback(() => { rec.current?.stop(); setListening(false); }, []);
  return {supported, listening, error, start, stop};
}
