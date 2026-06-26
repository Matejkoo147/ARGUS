import { useCallback, useEffect, useRef, useState } from "react";

const SILENCE_MS = 5000;
/** Wake word + common mis-hearings (Chrome speech varies by locale). */
const WAKE_RE = /\b(argus|arkus|argos|arguss)\b/i;
const NETWORK_RETRY_MS = 2500;
const MAX_NETWORK_RETRIES = 2;
/** English works best for the "ARGUS" wake word; Slovak UI can still speak commands in English. */
const SPEECH_LANG = "en-US";

export type ListenPhase = "idle" | "wake" | "capture";

function extractAfterWake(full: string): string | null {
  const m = full.match(WAKE_RE);
  if (!m || m.index === undefined) return null;
  return full.slice(m.index + m[0].length).replace(/^[\s,:-]+/, "").trim();
}

function buildTranscript(ev: SpeechRecognitionEvent): string {
  let full = "";
  for (let i = 0; i < ev.results.length; i++) {
    full += ev.results[i]![0]!.transcript;
  }
  return full.replace(/\s+/g, " ").trim();
}

export function useArgusMic(onError?: (msg: string) => void) {
  const [listenPhase, setListenPhase] = useState<ListenPhase>("idle");
  const [draft, setDraft] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wantListenRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);
  const restartRef = useRef(false);
  const silenceArmedRef = useRef(false);
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
    silenceArmedRef.current = false;
    networkRetriesRef.current = 0;
    clearSilenceTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListenPhase("idle");
  }, [clearSilenceTimer]);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      finalize();
    }, SILENCE_MS);
  }, [clearSilenceTimer, finalize]);

  const bumpSilenceTimer = useCallback(() => {
    if (!silenceArmedRef.current) return;
    armSilenceTimer();
  }, [armSilenceTimer]);

  const stopMic = useCallback(() => {
    setMicError(null);
    finalize();
  }, [finalize]);

  useEffect(
    () => () => {
      wantListenRef.current = false;
      silenceArmedRef.current = false;
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
      reportError(
        "Microphone requires HTTPS or localhost. Open ARGUS via https://10.8.0.1:9443, or type your command below.",
      );
      return;
    }

    wantListenRef.current = true;
    stoppingRef.current = false;
    restartRef.current = false;
    silenceArmedRef.current = false;
    networkRetriesRef.current = 0;
    sessionTextRef.current = "";
    wakeFoundRef.current = false;
    setMicError(null);
    setDraft("");
    setLiveTranscript("");
    setListenPhase("wake");

    const rec = new SR();
    rec.lang = SPEECH_LANG;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      networkRetriesRef.current = 0;
      if (!restartRef.current) {
        silenceArmedRef.current = true;
        armSilenceTimer();
      }
      restartRef.current = false;
    };

    rec.onresult = (ev) => {
      if (!wantListenRef.current) return;
      bumpSilenceTimer();
      setMicError(null);

      const full = buildTranscript(ev);
      if (!full) return;

      sessionTextRef.current = full;
      setLiveTranscript(full);

      const afterWake = extractAfterWake(full);
      if (afterWake !== null) {
        wakeFoundRef.current = true;
        setListenPhase("capture");
        setDraft(afterWake);
      } else if (WAKE_RE.test(full)) {
        wakeFoundRef.current = true;
        setListenPhase("capture");
        setDraft("");
      }
    };

    rec.onerror = (ev) => {
      const err = (ev as SpeechRecognitionErrorEvent).error;
      if (err === "no-speech") {
        bumpSilenceTimer();
        return;
      }
      if (err === "aborted") return;
      if (err === "not-allowed") {
        wantListenRef.current = false;
        silenceArmedRef.current = false;
        setListenPhase("idle");
        reportError("Microphone blocked. Allow mic access for this site in browser settings.");
        return;
      }
      if (err === "network") {
        networkRetriesRef.current += 1;
        if (networkRetriesRef.current > MAX_NETWORK_RETRIES) {
          wantListenRef.current = false;
          silenceArmedRef.current = false;
          setListenPhase("idle");
          reportError(
            "Voice recognition needs internet (Chrome uses Google speech servers). Check connection, VPN, or ad-block — or type below.",
          );
        }
        return;
      }
      if (err === "service-not-allowed") {
        wantListenRef.current = false;
        silenceArmedRef.current = false;
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
      restartRef.current = true;
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
      silenceArmedRef.current = false;
      setListenPhase("idle");
      reportError("Could not start microphone. Try again.");
    }
  }, [listenPhase, stopMic, armSilenceTimer, bumpSilenceTimer, finalize, reportError]);

  const listening = listenPhase !== "idle";

  const hint =
    micError
      ? micError
      : listenPhase === "wake"
        ? "Listening… say “ARGUS, status” (words appear below as you speak)"
        : listenPhase === "capture"
          ? "Capturing… stops after 5s silence · tap mic to finish early"
          : "Tap mic · say “ARGUS, status” · review · Send";

  /** Text to show in the input while the mic is active. */
  const micInputValue = listenPhase === "capture" && draft ? draft : liveTranscript;

  return {
    listening,
    listenPhase,
    draft,
    liveTranscript,
    micInputValue,
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
