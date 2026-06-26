import { useCallback, useEffect, useRef, useState } from "react";
import { stripWakePrefix, transcribeWebm } from "../lib/stt";

const SILENCE_MS = 5000;
const WAIT_FOR_SPEECH_MS = 30000;
const AUDIO_LEVEL_THRESHOLD = 10;
const WAKE_RE = /\b(argus|arkus|argos|arguss)\b/i;
const NETWORK_RETRY_MS = 2500;
const SPEECH_LANG = "en-US";

export type ListenPhase = "idle" | "wake" | "capture" | "transcribing";

function buildTranscript(ev: SpeechRecognitionEvent): string {
  let final = "";
  let interim = "";
  for (let i = 0; i < ev.results.length; i++) {
    const result = ev.results[i]!;
    const text = result[0]?.transcript ?? "";
    if (result.isFinal) {
      final += text;
    } else {
      interim += text;
    }
  }
  return (final + interim).replace(/\s+/g, " ").trim();
}

function applyTranscript(
  full: string,
  setDraft: (v: string) => void,
  setLiveTranscript: (v: string) => void,
  setListenPhase: (p: ListenPhase) => void,
) {
  if (!full) return;
  setLiveTranscript(full);
  if (WAKE_RE.test(full)) {
    setListenPhase("capture");
    const after = stripWakePrefix(full);
    setDraft(after || full);
  } else {
    setDraft(full);
  }
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
  const networkRetriesRef = useRef(0);
  const lastErrorAtRef = useRef(0);
  const gotTranscriptRef = useRef(false);
  const heardAudioRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const sttAttemptedRef = useRef(false);

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
    if (recorderRef.current?.state !== "inactive") {
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setAudioLevel(0);
    setHeardMic(false);
  }, []);

  const flushRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(recordChunksRef.current.length > 0 ? new Blob(recordChunksRef.current, { type: "audio/webm" }) : null);
        return;
      }
      rec.onstop = () => {
        resolve(recordChunksRef.current.length > 0 ? new Blob(recordChunksRef.current, { type: "audio/webm" }) : null);
      };
      try {
        rec.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  const runServerStt = useCallback(
    async (blob: Blob | null): Promise<boolean> => {
      if (sttAttemptedRef.current || gotTranscriptRef.current || !blob?.size) return gotTranscriptRef.current;
      sttAttemptedRef.current = true;
      setListenPhase("transcribing");
      setMicError(null);

      try {
        const text = await transcribeWebm(blob);
        if (text) {
          gotTranscriptRef.current = true;
          sessionTextRef.current = text;
          applyTranscript(text, setDraft, setLiveTranscript, setListenPhase);
          return true;
        }
      } catch (e) {
        reportError(
          e instanceof Error
            ? `Local STT failed: ${e.message}. On server: docker compose --profile stt up -d`
            : "Local STT failed — enable Whisper on server (see DEPLOY.md).",
        );
      }
      return false;
    },
    [reportError],
  );

  const finishSession = useCallback(async () => {
    wantListenRef.current = false;
    stoppingRef.current = true;
    networkRetriesRef.current = 0;
    clearStopTimer();

    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }

    const blob = await flushRecording();

    if (!gotTranscriptRef.current && heardAudioRef.current) {
      await runServerStt(blob);
    }

    releaseMicHardware();
    setListenPhase("idle");
    stoppingRef.current = false;
  }, [clearStopTimer, flushRecording, releaseMicHardware, runServerStt]);

  const scheduleStop = useCallback(
    (mode: "wait" | "silence") => {
      clearStopTimer();
      const ms = mode === "wait" ? WAIT_FOR_SPEECH_MS : SILENCE_MS;
      stopTimerRef.current = setTimeout(() => {
        void finishSession();
      }, ms);
    },
    [clearStopTimer, finishSession],
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
    void finishSession();
  }, [finishSession]);

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

    if (listenPhase !== "idle" && listenPhase !== "transcribing") {
      stopMic();
      return;
    }
    if (listenPhase === "transcribing") return;

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
    sttAttemptedRef.current = false;
    sessionTextRef.current = "";
    recordChunksRef.current = [];
    setMicError(null);
    setDraft("");
    setLiveTranscript("");
    setListenPhase("wake");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      micStreamRef.current = stream;

      const recorder = new MediaRecorder(
        stream,
        MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : undefined,
      );
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.start(500);

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
          bumpActivity(gotTranscriptRef.current);
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
    rec.continuous = false;
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
      applyTranscript(full, setDraft, setLiveTranscript, setListenPhase);
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
        reportError("Microphone blocked. Allow mic for argus.local.");
        return;
      }
      if (err === "network") {
        networkRetriesRef.current += 1;
        return;
      }
    };

    rec.onend = () => {
      if (stoppingRef.current || !wantListenRef.current) return;

      if (gotTranscriptRef.current) {
        void finishSession();
        return;
      }

      const delay = networkRetriesRef.current > 0 ? NETWORK_RETRY_MS : 200;
      restartRef.current = true;
      window.setTimeout(() => {
        if (!wantListenRef.current || stoppingRef.current) return;
        try {
          rec.start();
        } catch {
          void finishSession();
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
  }, [listenPhase, stopMic, scheduleStop, bumpActivity, finishSession, reportError, releaseMicHardware]);

  const listening = listenPhase !== "idle";

  const hint =
    micError
      ? micError
      : listenPhase === "transcribing"
        ? "Transcribing on server (Whisper)…"
        : listenPhase === "wake"
          ? heardMic
            ? "Mic hears you — say “ARGUS, status” (server Whisper if text stays empty)"
            : "Listening… say “ARGUS, status”"
          : listenPhase === "capture"
            ? "Capturing… stops 5s after silence · tap mic to finish"
            : "Tap mic · say “ARGUS, status” · review · Send";

  const micInputValue = listenPhase === "capture" && draft ? draft : liveTranscript || draft;

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

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
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
