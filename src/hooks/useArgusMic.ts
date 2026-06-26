import { useCallback, useEffect, useRef, useState } from "react";

const SILENCE_MS = 5000;
const WAIT_FOR_SPEECH_MS = 25000;
const AUDIO_LEVEL_THRESHOLD = 10;
const WAKE_RE = /\b(argus|arkus|argos|arguss)\b/i;
const NETWORK_RETRY_MS = 2500;
const MAX_NETWORK_RETRIES = 3;
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
  const [audioLevel, setAudioLevel] = useState(0);
  const [heardMic, setHeardMic] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wantListenRef = useRef(false);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);
  const restartRef = useRef(false);
  const sessionTextRef = useRef("");
  const wakeFoundRef = useRef(false);
  const networkRetriesRef = useRef(0);
  const lastErrorAtRef = useRef(0);
  const gotTranscriptRef = useRef(false);
  const heardAudioRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef(0);

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

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const releaseMicHardware = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setAudioLevel(0);
    setHeardMic(false);
  }, []);

  const finalize = useCallback(() => {
    wantListenRef.current = false;
    stoppingRef.current = true;
    networkRetriesRef.current = 0;
    clearStopTimer();
    releaseMicHardware();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListenPhase("idle");
  }, [clearStopTimer, releaseMicHardware]);

  const scheduleStop = useCallback(
    (mode: "wait" | "silence") => {
      clearStopTimer();
      const ms = mode === "wait" ? WAIT_FOR_SPEECH_MS : SILENCE_MS;
      stopTimerRef.current = setTimeout(() => {
        if (!gotTranscriptRef.current) {
          if (!heardAudioRef.current) {
            reportError(
              "Mic hears nothing — check Windows Sound → Input device, or allow mic for Brave on argus.local.",
            );
          } else {
            reportError(
              "Mic works but no words recognized. Brave: Shields → off for argus.local. Speech needs internet (Google). Or type below.",
            );
          }
        }
        finalize();
      }, ms);
    },
    [clearStopTimer, finalize, reportError],
  );

  const bumpActivity = useCallback(
    (hasTranscript: boolean) => {
      if (hasTranscript) gotTranscriptRef.current = true;
      scheduleStop(gotTranscriptRef.current ? "silence" : "wait");
    },
    [scheduleStop],
  );

  const stopMic = useCallback(() => {
    setMicError(null);
    finalize();
  }, [finalize]);

  useEffect(
    () => () => {
      wantListenRef.current = false;
      clearStopTimer();
      releaseMicHardware();
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    },
    [clearStopTimer, releaseMicHardware],
  );

  const startMic = useCallback(async () => {
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
      reportError("Microphone requires HTTPS. Open https://argus.local:9443 or type below.");
      return;
    }

    wantListenRef.current = true;
    stoppingRef.current = false;
    restartRef.current = false;
    networkRetriesRef.current = 0;
    gotTranscriptRef.current = false;
    heardAudioRef.current = false;
    sessionTextRef.current = "";
    wakeFoundRef.current = false;
    setMicError(null);
    setDraft("");
    setLiveTranscript("");
    setListenPhase("wake");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const pollLevel = () => {
        if (!wantListenRef.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i]!;
        const level = sum / data.length;
        setAudioLevel(level);
        if (level > AUDIO_LEVEL_THRESHOLD) {
          if (!heardAudioRef.current) {
            heardAudioRef.current = true;
            setHeardMic(true);
          }
          bumpActivity(false);
        }
        rafRef.current = requestAnimationFrame(pollLevel);
      };
      pollLevel();
    } catch {
      wantListenRef.current = false;
      setListenPhase("idle");
      reportError("Microphone access denied. Allow mic for argus.local in Brave settings.");
      return;
    }

    const rec = new SR();
    rec.lang = SPEECH_LANG;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      networkRetriesRef.current = 0;
      if (!restartRef.current) scheduleStop("wait");
      restartRef.current = false;
    };

    rec.onresult = (ev) => {
      if (!wantListenRef.current) return;
      setMicError(null);

      const full = buildTranscript(ev);
      if (!full) return;

      bumpActivity(true);
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

    const onAudioActivity = () => {
      if (!wantListenRef.current) return;
      heardAudioRef.current = true;
      setHeardMic(true);
      bumpActivity(gotTranscriptRef.current);
    };
    rec.onsoundstart = onAudioActivity;
    rec.onspeechstart = onAudioActivity;

    rec.onerror = (ev) => {
      const err = (ev as SpeechRecognitionErrorEvent).error;
      if (err === "no-speech" || err === "aborted") return;
      if (err === "not-allowed") {
        wantListenRef.current = false;
        setListenPhase("idle");
        reportError("Microphone blocked. Allow mic access for argus.local in browser settings.");
        return;
      }
      if (err === "network") {
        networkRetriesRef.current += 1;
        if (networkRetriesRef.current >= MAX_NETWORK_RETRIES) {
          wantListenRef.current = false;
          setListenPhase("idle");
          reportError(
            "Speech network error — Brave Shields may block Google speech. Turn Shields off for argus.local, or try Chrome.",
          );
        }
        return;
      }
      if (err === "service-not-allowed") {
        wantListenRef.current = false;
        setListenPhase("idle");
        reportError("Speech service not available in this browser.");
        return;
      }
      reportError(`Speech error: ${err}`);
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
      const delay = networkRetriesRef.current > 0 ? NETWORK_RETRY_MS : 150;
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
      setListenPhase("idle");
      releaseMicHardware();
      reportError("Could not start speech recognition. Try again.");
    }
  }, [listenPhase, stopMic, scheduleStop, bumpActivity, finalize, reportError, releaseMicHardware]);

  const listening = listenPhase !== "idle";

  const hint =
    micError
      ? micError
      : listenPhase === "wake"
        ? heardMic
          ? "Mic hears you — waiting for words… say “ARGUS, status”"
          : "Listening… say “ARGUS, status” (green bar = mic level)"
        : listenPhase === "capture"
          ? "Capturing… stops 5s after you stop talking · tap mic to finish"
          : "Tap mic · say “ARGUS, status” · review · Send";

  const micInputValue = listenPhase === "capture" && draft ? draft : liveTranscript;

  return {
    listening,
    listenPhase,
    draft,
    liveTranscript,
    micInputValue,
    audioLevel,
    heardMic,
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
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
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
