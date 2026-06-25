import { useCallback, useEffect, useRef, useState } from "react";

const SILENCE_MS = 5000;
const WAKE_RE = /\bargus\b/i;
const NETWORK_RETRY_MS = 2500;
const MAX_NETWORK_RETRIES = 2;

export type ListenPhase = "idle" | "wake" | "capture";

function extractAfterWake(full: string): string | null {
  const m = full.match(WAKE_RE);
  if (!m || m.index === undefined) return null;
  return full.slice(m.index + m[0].length).replace(/^[\s,:-]+/, "").trim();
}

export function useArgusMic(onError?: (msg: string) => void) {
  const [listenPhase, setListenPhase] = useState<ListenPhase>("idle");
  const [draft, setDraft] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wantListenRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);
  const sessionTextRef = useRef("");
  const wakeFoundRef = useRef(false);
  const networkRetriesRef = useRef(0);
  const lastErrorAtRef = useRef(0);

  const reportError = useCallback(
    (msg: string) => {
      const now = Date.now();
      if (now - lastErrorAtRef.current < 8000) return;
      lastErrorAtRef.current = now;
      setMicError(msg);
      onError?.(msg);
    },
    [onError],
  );

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const finalize = useCallback(() => {
    wantListenRef.current = false;
    stoppingRef.current = true;
    networkRetriesRef.current = 0;
    clearSilenceTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListenPhase("idle");
  }, [clearSilenceTimer]);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      finalize();
    }, SILENCE_MS);
  }, [clearSilenceTimer, finalize]);

  const stopMic = useCallback(() => {
    setMicError(null);
    finalize();
  }, [finalize]);

  useEffect(
    () => () => {
      wantListenRef.current = false;
      clearSilenceTimer();
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    },
    [clearSilenceTimer],
  );

  const startMic = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      reportError("Speech recognition not supported. Use Chrome or Edge.");
      return;
    }

    if (listenPhase !== "idle") {
      stopMic();
      return;
    }

    if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      reportError("Microphone requires HTTPS or localhost.");
      return;
    }

    wantListenRef.current = true;
    stoppingRef.current = false;
    networkRetriesRef.current = 0;
    sessionTextRef.current = "";
    wakeFoundRef.current = false;
    setMicError(null);
    setDraft("");
    setListenPhase("wake");

    const rec = new SR();
    const lang = navigator.language || "en-US";
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      networkRetriesRef.current = 0;
      setListenPhase("wake");
      resetSilenceTimer();
    };

    rec.onresult = (ev) => {
      if (!wantListenRef.current) return;
      resetSilenceTimer();
      setMicError(null);

      let segment = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        segment += ev.results[i][0].transcript;
      }
      if (!segment.trim()) return;

      sessionTextRef.current = `${sessionTextRef.current} ${segment}`.replace(/\s+/g, " ").trim();
      const afterWake = extractAfterWake(sessionTextRef.current);

      if (afterWake !== null) {
        wakeFoundRef.current = true;
        setListenPhase("capture");
        setDraft(afterWake);
      } else if (!wakeFoundRef.current && WAKE_RE.test(sessionTextRef.current)) {
        wakeFoundRef.current = true;
        setListenPhase("capture");
        setDraft("");
      }
    };

    rec.onerror = (ev) => {
      const err = (ev as SpeechRecognitionErrorEvent).error;
      if (err === "no-speech" || err === "aborted") return;
      if (err === "not-allowed") {
        wantListenRef.current = false;
        setListenPhase("idle");
        reportError("Microphone blocked. Allow mic access for this site in browser settings.");
        return;
      }
      if (err === "network") {
        networkRetriesRef.current += 1;
        if (networkRetriesRef.current > MAX_NETWORK_RETRIES) {
          wantListenRef.current = false;
          setListenPhase("idle");
          reportError(
            "Voice recognition needs internet (Chrome uses Google speech servers). Check your connection, disable VPN/ad-block, or type your command below.",
          );
        }
        return;
      }
      if (err === "service-not-allowed") {
        wantListenRef.current = false;
        setListenPhase("idle");
        reportError("Speech service not available in this browser.");
      }
    };

    rec.onend = () => {
      if (stoppingRef.current) {
        stoppingRef.current = false;
        setListenPhase("idle");
        return;
      }
      if (!wantListenRef.current) {
        setListenPhase("idle");
        return;
      }
      const delay = networkRetriesRef.current > 0 ? NETWORK_RETRY_MS : 120;
      window.setTimeout(() => {
        if (!wantListenRef.current) return;
        try {
          rec.start();
        } catch {
          finalize();
        }
      }, delay);
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      wantListenRef.current = false;
      setListenPhase("idle");
      reportError("Could not start microphone. Try again.");
    }
  }, [listenPhase, stopMic, resetSilenceTimer, finalize, reportError]);

  const listening = listenPhase !== "idle";

  const hint =
    micError
      ? micError
      : listenPhase === "wake"
        ? "Listening… say “ARGUS”, then your command"
        : listenPhase === "capture"
          ? "Capturing… stops after 5s silence · tap mic to finish early"
          : "Tap mic · say “ARGUS, status” · review · Send";

  return {
    listening,
    listenPhase,
    draft,
    setDraft,
    hint,
    micError,
    startMic,
    stopMic,
  };
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
