import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useHA } from "../context/HAContext";
import { useArgusMic } from "../hooks/useArgusMic";
import { buildArgusSystemPrompt, parseVoiceArmAction, runArgusLocalCommand, VOICE_ARM_REPLIES } from "../lib/argusVoice";
import { ARM_ACTIONS, type ArmAction } from "../lib/homeSensors";
import { ARGUS_VOICE_COMMANDS, VOICE_COMMAND_CATEGORIES } from "../lib/voiceCommands";
import { askOllama, loadOllamaConfig, resolveOllamaConfig, type OllamaConfig } from "../lib/ollama";
import { getDomain } from "../types";

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

function groupedCommands() {
  return Object.entries(
    ARGUS_VOICE_COMMANDS.reduce<Record<string, typeof ARGUS_VOICE_COMMANDS>>((acc, cmd) => {
      (acc[cmd.category] ??= []).push(cmd);
      return acc;
    }, {}),
  );
}

function VoiceCommandsList({ onPick }: { onPick: (phrase: string) => void }) {
  return (
    <>
      {groupedCommands().map(([cat, cmds]) => (
        <div key={cat} className="voice-cmd-group">
          <div className="voice-cmd-cat">{VOICE_COMMAND_CATEGORIES[cat as keyof typeof VOICE_COMMAND_CATEGORIES]}</div>
          <div className="voice-cmd-list">
            {cmds.map((cmd) => (
              <button
                key={cmd.phrase}
                type="button"
                className="voice-cmd-item"
                onClick={() => onPick(cmd.example ?? `ARGUS, ${cmd.phrase}`)}
              >
                <span className="voice-cmd-phrase">{cmd.phrase}</span>
                <span className="voice-cmd-desc">{cmd.description}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function VoicePage() {
  const { entities, summary, callService, entityLocations, preferences } = useHA();
  const [pendingArm, setPendingArm] = useState<ArmAction | null>(null);
  const commandsRef = useRef<HTMLDetailsElement>(null);
  const [ollama, setOllama] = useState<OllamaConfig | null>(() => loadOllamaConfig());
  const effectiveOllama = ollama ?? resolveOllamaConfig();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [muted, setMuted] = useState(() => localStorage.getItem(VOICE_MUTE_KEY) === "1");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const o = resolveOllamaConfig();
    const saved = loadOllamaConfig();
    return [
      {
        role: "argus",
        text: saved
          ? `ARGUS online — Ollama model ${o.model}. Tap the mic, say “ARGUS, status”, review the text, then Send.`
          : `ARGUS online — using default Ollama (${o.model}). Tap TEST in conversation to verify AI, or save your settings.`,
        meta: saved ? `Ready · ${o.url}` : `Default · ${o.url}`,
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
      utter.rate = 0.92;
      utter.pitch = 0.95;
      const voices = speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /samantha|zira|google.*english|english.*premium/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith("en")) ??
        voices[0];
      if (preferred) utter.voice = preferred;
      speechSynthesis.speak(utter);
    },
    [muted],
  );

  const runLocalCommand = useCallback(
    async (text: string): Promise<string | null> => {
      return runArgusLocalCommand(text, {
        entities,
        summary,
        entityLocations,
        alarmCode: preferences.alarmCode,
        callService,
      });
    },
    [entities, summary, entityLocations, preferences.alarmCode, callService],
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
      } else {
        const cfg = resolveOllamaConfig();
        setBusyLabel(`Running ${cfg.model}…`);
        try {
          const context = buildArgusSystemPrompt(cfg.model, {
            entities,
            summary,
            entityLocations,
          });

          const result = await askOllama(cfg, text, context);
          reply = result.text || "(empty response from model)";
          source = "ollama";
          meta = formatMeta("ollama", result.model, result.latencyMs, result.tokens, result.loadMs);
        } catch (e) {
          reply = `Ollama error: ${e instanceof Error ? e.message : "failed"}. Check Settings → Ollama URL and tap SAVE & TEST.`;
          source = "error";
          meta = formatMeta("error");
        }
        setBusyLabel("");
      }

      setMessages((prev) => [...prev, { role: "argus", text: reply, meta, source }]);
      speak(reply);
      setBusyLabel("");
      setBusy(false);
    },
    [runLocalCommand, entities, summary, entityLocations, speak],
  );

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (listening) stopMic();
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");

    const armAction = parseVoiceArmAction(trimmed);
    if (armAction) {
      const alarm = entities.find((e) => getDomain(e.entity_id) === "alarm_control_panel");
      if (!alarm) {
        const noPanel =
          armAction === "disarm"
            ? "No alarm panel found to disarm."
            : "I can't arm because there's no alarm panel in Home Assistant yet.";
        setMessages((prev) => [
          ...prev,
          { role: "argus", text: noPanel, meta: formatMeta("local"), source: "local" as const },
        ]);
        speak(noPanel);
        return;
      }
      setPendingArm(armAction);
      const prompt = `${ARM_ACTIONS[armAction].title.replace("?", "")} — confirm below or tap Cancel.`;
      setMessages((prev) => [
        ...prev,
        { role: "argus", text: prompt, meta: "CONFIRM · security action", source: "local" as const },
      ]);
      speak(prompt);
      return;
    }

    await respond(trimmed);
  };

  const runArm = async (mode: ArmAction) => {
    const alarm = entities.find((e) => getDomain(e.entity_id) === "alarm_control_panel");
    if (!alarm) {
      setPendingArm(null);
      return;
    }
    setBusy(true);
    setBusyLabel("Arming…");
    try {
      await callService(
        "alarm_control_panel",
        mode,
        { code: preferences.alarmCode ?? "" },
        { entity_id: alarm.entity_id },
      );
      const reply = VOICE_ARM_REPLIES[mode];
      setMessages((prev) => [
        ...prev,
        { role: "argus", text: reply, meta: formatMeta("local"), source: "local" as const },
      ]);
      speak(reply);
    } catch (e) {
      const err = `Alarm command failed: ${e instanceof Error ? e.message : "unknown error"}`;
      setMessages((prev) => [
        ...prev,
        { role: "argus", text: err, meta: formatMeta("error"), source: "error" as const },
      ]);
    } finally {
      setBusyLabel("");
      setBusy(false);
      setPendingArm(null);
    }
  };

  const runModelTest = async () => {
    if (busy) return;
    if (listening) stopMic();

    const n = Math.floor(Math.random() * 10000);
    const cfg = resolveOllamaConfig();
    const userText = `Model test · verification ${n}`;

    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setBusy(true);
    setBusyLabel(`Testing ${cfg.model}…`);

    const aiPrompt =
      `Reply with exactly one line in this format: AI_MODEL: <your exact model name> · NUMBER: ${n}. The number must be ${n}. No other text.`;

    try {
      const context = buildArgusSystemPrompt(cfg.model, {
        entities,
        summary,
        entityLocations,
      });
      const result = await askOllama(cfg, aiPrompt, context);
      const reply = result.text?.trim() || `AI_MODEL: ${result.model} · NUMBER: ${n}`;
      setMessages((prev) => [
        ...prev,
        {
          role: "argus",
          text: reply,
          meta: formatMeta("ollama", result.model, result.latencyMs, result.tokens, result.loadMs),
          source: "ollama",
        },
      ]);
      speak(reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      const hint = ollama
        ? ""
        : " Tip: open Settings → Ollama and tap SAVE & TEST if defaults are wrong.";
      setMessages((prev) => [
        ...prev,
        {
          role: "argus",
          text: `Model test failed: ${msg}.${hint}`,
          meta: formatMeta("error"),
          source: "error",
        },
      ]);
    } finally {
      setBusyLabel("");
      setBusy(false);
    }
  };

  const toggleMute = () => {
    setMuted((m) => {
      if (!m) speechSynthesis.cancel();
      return !m;
    });
  };

  const pickCommand = (raw: string) => {
    setInput(raw.replace(/^ARGUS,\s*/i, ""));
    if (commandsRef.current) commandsRef.current.open = false;
    inputRef.current?.focus();
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
          {ollama ? `Ollama · ${effectiveOllama.model}` : `Ollama · ${effectiveOllama.model} (default)`}
        </span>
      </div>

      <div className="grid-2 voice-grid">
        <div className="card voice-card voice-card--controls">
          <div className="card-header card-header-row">
            <span><i className="bi bi-mic-fill" /> ARGUS Voice</span>
            <span className={`voice-badge${muted ? " muted" : ""}`}>
              <i className={`bi ${muted ? "bi-volume-mute-fill" : "bi-volume-up-fill"}`} />
              {muted ? "VOICE: OFF" : "VOICE: ON"}
            </span>
          </div>
          <div className="card-body voice-panel">
            <div className="voice-controls">
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

            <details ref={commandsRef} className="voice-commands-drawer">
              <summary className="voice-commands-summary">
                <i className="bi bi-list-ul" /> Command phrases
              </summary>
              <div className="voice-commands-panel voice-commands-panel--sidebar">
                <VoiceCommandsList onPick={pickCommand} />
              </div>
            </details>
          </div>
        </div>

        <div className="card voice-card voice-card--chat">
          <div className="card-header card-header-row">
            <span><i className="bi bi-chat-dots" /> Conversation</span>
            <div className="voice-chat-actions">
              <button
                type="button"
                className="btn-cyber-mini"
                onClick={runModelTest}
                disabled={busy}
                title="Model test — Ollama replies with AI_MODEL and a random number in the conversation"
              >
                <i className="bi bi-cpu" /> TEST
              </button>
            </div>
          </div>

          <div className="card-body log-terminal voice-chat voice-chat-log">
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

      <details className="card voice-hints-card" style={{ marginTop: "1rem" }}>
        <summary className="card-header" style={{ cursor: "pointer", listStyle: "none" }}>
          <i className="bi bi-info-circle" /> Mic &amp; HTTPS tips
        </summary>
        <div className="card-body hint-box" style={{ lineHeight: 1.7, fontSize: "0.75rem" }}>
          <p>Microphone needs <strong>HTTPS</strong> — use your ARGUS URL (e.g. <code>https://10.8.0.1:9443</code>).</p>
          <p style={{ marginTop: 6 }}>Brave not typing speech? Run <code>docker compose --profile stt up -d</code> on the server for Whisper fallback.</p>
          <p style={{ marginTop: 6 }}>Use the <strong>speaker button</strong> to mute spoken replies. Open <strong>Command phrases</strong> under the mic panel to fill the input — the chat stays full height.</p>
        </div>
      </details>

      {pendingArm && (
        <ConfirmDialog
          open
          title={ARM_ACTIONS[pendingArm].title}
          message={ARM_ACTIONS[pendingArm].body}
          confirmLabel={ARM_ACTIONS[pendingArm].confirm}
          variant={ARM_ACTIONS[pendingArm].variant}
          onConfirm={() => runArm(pendingArm)}
          onCancel={() => setPendingArm(null)}
        />
      )}
    </>
  );
}
