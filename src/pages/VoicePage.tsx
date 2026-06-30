import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHA } from "../context/HAContext";
import { useArgusMic } from "../hooks/useArgusMic";
import { buildArgusSystemPrompt, runArgusLocalCommand } from "../lib/argusVoice";
import { askOllama, loadOllamaConfig, type OllamaConfig } from "../lib/ollama";

const VOICE_MUTE_KEY = "argus_voice_muted";

type ReplySource = "ollama" | "local" | "fallback" | "error";

interface ChatMessage {
  role: "user" | "argus";
  text: string;
  meta?: string;
  source?: ReplySource;
}

function formatMeta(source: ReplySource, model?: string, latencyMs?: number, tokens?: number, loadMs?: number): string {
  if (source === "local") return "LOCAL · Home Assistant command (instant)";
  if (source === "fallback") return "FALLBACK · no Ollama configured";
  if (source === "error") return "ERROR · Ollama request failed";
  const parts = ["OLLAMA", model, latencyMs != null ? `${(latencyMs / 1000).toFixed(1)}s` : null];
  if (tokens != null) parts.push(`${tokens} tok`);
  if (loadMs != null && loadMs > 100) parts.push(`load ${(loadMs / 1000).toFixed(1)}s`);
  return parts.filter(Boolean).join(" · ");
}

export function VoicePage() {
  const { entities, summary, callService, entityLocations } = useHA();
  const navigate = useNavigate();
  const [ollama, setOllama] = useState<OllamaConfig | null>(() => loadOllamaConfig());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [muted, setMuted] = useState(() => localStorage.getItem(VOICE_MUTE_KEY) === "1");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const o = loadOllamaConfig();
    return [
      {
        role: "argus",
        text: o
          ? `ARGUS online — Ollama model ${o.model}. Tap the mic, say “ARGUS, status”, review the text, then Send.`
          : "ARGUS online. Tap mic and say “ARGUS, status” — or configure Ollama in Settings for AI replies.",
        meta: o ? `Ready · ${o.url}` : undefined,
      },
    ];
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { listening, listenPhase, draft, micInputValue, audioLevel, heardMic, setDraft, hint, micError, startMic, stopMic } =
    useArgusMic();

  useEffect(() => {
    const syncOllama = () => setOllama(loadOllamaConfig());
    syncOllama();
    window.addEventListener("focus", syncOllama);
    window.addEventListener("storage", syncOllama);
    return () => {
      window.removeEventListener("focus", syncOllama);
      window.removeEventListener("storage", syncOllama);
    };
  }, []);

  useEffect(() => {
    if (!listening && draft) {
      setInput(draft);
      inputRef.current?.focus();
    }
  }, [listening, draft]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(VOICE_MUTE_KEY, muted ? "1" : "0");
  }, [muted]);

  const speak = useCallback(
    (text: string) => {
      if (muted || !("speechSynthesis" in window)) return;
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 0.9;
      speechSynthesis.speak(utter);
    },
    [muted]
  );

  const runLocalCommand = useCallback(
    async (text: string): Promise<string | null> => {
      return runArgusLocalCommand(text, {
        entities,
        summary,
        entityLocations,
        callService,
      });
    },
    [entities, summary, entityLocations, callService],
  );

  const respond = useCallback(
    async (text: string) => {
      setBusy(true);
      setBusyLabel("Processing…");
      let reply = "";
      let meta = "";
      let source: ReplySource = "fallback";

      const local = await runLocalCommand(text);
      if (local) {
        reply = local;
        source = "local";
        meta = formatMeta("local");
      } else if (ollama) {
        setBusyLabel(`Running ${ollama.model}…`);
        try {
          const context = buildArgusSystemPrompt(ollama.model, {
            entities,
            summary,
            entityLocations,
          });

          const result = await askOllama(ollama, text, context);
          reply = result.text || "(empty response from model)";
          source = "ollama";
          meta = formatMeta("ollama", result.model, result.latencyMs, result.tokens, result.loadMs);
        } catch (e) {
          reply = `Ollama error: ${e instanceof Error ? e.message : "failed"}. Check Settings → Ollama URL.`;
          source = "error";
          meta = formatMeta("error");
        }
        setBusyLabel("");
      } else {
        reply = `Configure Ollama in Settings for open questions. Commands: "status", "arm away", "disarm", "any motion?"`;
        meta = formatMeta("fallback");
      }

      setMessages((prev) => [...prev, { role: "argus", text: reply, meta, source }]);
      speak(reply);
      setBusyLabel("");
      setBusy(false);
    },
    [ollama, runLocalCommand, entities, summary, entityLocations, speak],
  );

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (listening) stopMic();
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    await respond(trimmed);
  };

  const runModelTest = () => {
    if (!ollama) {
      navigate("/settings");
      return;
    }
    const n = Math.floor(Math.random() * 10000);
    sendMessage(
      `Reply with exactly: MODEL_CHECK — state your model name and the number ${n}.`,
    );
  };

  const toggleMute = () => {
    setMuted((m) => {
      if (!m) speechSynthesis.cancel();
      return !m;
    });
  };

  const toggleListen = () => {
    if (listening) {
      stopMic();
      return;
    }
    setInput("");
    startMic();
  };

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> VOICE</h2>
        <span className="sub">
          {ollama ? `Ollama · ${ollama.model}` : "configure Ollama in Settings"}
        </span>
      </div>

      <div className="grid-2 voice-grid">
        <div className="card voice-card">
          <div className="card-header card-header-row">
            <span><i className="bi bi-mic-fill" /> ARGUS Voice</span>
            <span className={`voice-badge${muted ? " muted" : ""}`}>
              <i className={`bi ${muted ? "bi-volume-mute-fill" : "bi-volume-up-fill"}`} />
              {muted ? "VOICE: OFF" : "VOICE: ON"}
            </span>
          </div>
          <div className="card-body voice-panel">
            <div className="voice-toolbar">
              <button
                type="button"
                className={`voice-mic${listening ? " listening" : ""}${listenPhase === "capture" ? " capturing" : ""}`}
                onClick={toggleListen}
                disabled={busy}
                title="Tap to listen for “ARGUS, …” — tap again to stop early"
                aria-label="Microphone — wake word ARGUS"
              >
                <i className={`bi ${listening ? "bi-mic-fill" : "bi-mic"}`} />
              </button>
              <button
                type="button"
                className={`voice-aux-btn${muted ? " active" : ""}`}
                onClick={toggleMute}
                title={muted ? "Unmute spoken replies" : "Mute spoken replies"}
                aria-label={muted ? "Unmute voice reply" : "Mute voice reply"}
              >
                <i className={`bi ${muted ? "bi-volume-mute-fill" : "bi-volume-up-fill"}`} />
              </button>
            </div>

            <p className={`voice-hint${listening ? " active" : ""}${listenPhase === "capture" ? " capture" : ""}${micError ? " error" : ""}`}>
              {busy ? busyLabel || "Processing…" : hint}
            </p>

            {listening && (
              <div className="voice-level" aria-hidden>
                <div
                  className={`voice-level-bar${heardMic ? " hot" : ""}`}
                  style={{ width: `${Math.min(100, (audioLevel / 50) * 100)}%` }}
                />
              </div>
            )}

            <div className="voice-input-wrap">
              <input
                ref={inputRef}
                className="cyber-input voice-input"
                value={listening ? micInputValue : input}
                onChange={(e) => {
                  const v = e.target.value;
                  if (listening) setDraft(v);
                  else setInput(v);
                }}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(listening ? (draft || micInputValue) : input)}
                placeholder="Ask ARGUS… or say “ARGUS, status”"
                disabled={busy}
              />
              <button
                type="button"
                className="btn-cyber action voice-send"
                onClick={() => sendMessage(listening ? (draft || micInputValue) : input)}
                disabled={busy || !(listening ? (draft || micInputValue) : input).trim()}
              >
                {busy ? (
                  <>
                    <span className="argus-spinner argus-spinner--btn" aria-hidden />
                    WAIT
                  </>
                ) : (
                  "SEND"
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="card voice-card">
          <div className="card-header card-header-row">
            <span><i className="bi bi-chat-dots" /> Conversation</span>
            <div className="voice-chat-actions">
              <button
                type="button"
                className="btn-cyber-mini"
                onClick={runModelTest}
                disabled={busy}
                title={
                  ollama
                    ? "Model check — Ollama replies with MODEL_CHECK and a random number"
                    : "Configure Ollama in Settings first"
                }
              >
                <i className="bi bi-cpu" /> TEST
              </button>
            </div>
          </div>
          <div className="card-body log-terminal voice-chat" style={{ height: 360 }}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}${m.source === "ollama" ? " ollama-reply" : ""}`}>
                <div className="who">{m.role === "user" ? "YOU" : "ARGUS"}</div>
                <div className="chat-text">{m.text}</div>
                {m.meta && (
                  <div className={`chat-meta${m.source === "ollama" ? " glow-cyan" : ""}`}>{m.meta}</div>
                )}
              </div>
            ))}
            {busy && (
              <div className="chat-bubble argus thinking" aria-live="polite" aria-busy="true">
                <div className="who">ARGUS</div>
                <div className="chat-thinking">
                  <span className="argus-spinner" aria-hidden />
                  <span>{busyLabel || "Thinking…"}</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header"><i className="bi bi-info-circle" /> Web mic &amp; HTTPS</div>
        <div className="card-body hint-box" style={{ lineHeight: 1.7 }}>
          <p>
            Browsers only allow the microphone on <strong>HTTPS</strong>. Use <code>https://argus.local:9443</code>.
          </p>
          <p style={{ marginTop: 6 }}>
            <strong>Speech not typing in Brave?</strong> Enable server Whisper once:{" "}
            <code>docker compose --profile stt up -d</code> on mato-server, then mic uses local STT automatically.
          </p>
          <p style={{ marginTop: 6 }}>Use the <strong>speaker button</strong> next to the mic to mute/unmute spoken replies.</p>
        </div>
      </div>
    </>
  );
}
