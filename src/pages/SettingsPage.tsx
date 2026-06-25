import { useEffect, useState } from "react";
import { useHA } from "../context/HAContext";
import { maskToken } from "../lib/auth";
import { loadOllamaConfig, saveOllamaConfig, testOllama, type OllamaApiMode, type OllamaConfig, DEFAULT_OLLAMA } from "../lib/ollama";
import { getDomain, getFriendlyName } from "../types";

export function SettingsPage() {
  const { config, connect, disconnect, status, refreshStates, entities, preferences, setDashboardCameras } = useHA();
  const [url, setUrl] = useState(config?.url ?? "http://localhost:8123");
  const [token, setToken] = useState(config?.token ?? "");
  const [displayName, setDisplayName] = useState(config?.username ?? "");
  const [rememberSession, setRememberSession] = useState(config?.rememberSession ?? false);
  const [saved, setSaved] = useState(false);

  const [ollamaUrl, setOllamaUrl] = useState(DEFAULT_OLLAMA.url);
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_OLLAMA.model);
  const [ollamaApiMode, setOllamaApiMode] = useState<OllamaApiMode>("native");
  const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);

  const [cam1, setCam1] = useState(preferences.dashboardCameras[0]);
  const [cam2, setCam2] = useState(preferences.dashboardCameras[1]);

  const cameras = entities.filter((e) => getDomain(e.entity_id) === "camera");

  useEffect(() => {
    const o = loadOllamaConfig();
    if (o) {
      setOllamaUrl(o.url);
      setOllamaModel(o.model);
      if (o.apiMode) setOllamaApiMode(o.apiMode);
      else if (o.url.includes("/v1")) setOllamaApiMode("openai");
    }
  }, []);

  useEffect(() => {
    if (config?.username) setDisplayName(config.username);
  }, [config?.username]);

  const handleSaveHa = async () => {
    const trimmedName = displayName.trim();
    await connect({
      url: url.trim(),
      token: token.trim(),
      rememberSession,
      username: trimmedName || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveOllama = async () => {
    const cfg: OllamaConfig = {
      url: ollamaUrl.trim(),
      model: ollamaModel.trim(),
      apiMode: ollamaApiMode,
    };
    saveOllamaConfig(cfg);
    const test = await testOllama(cfg);
    setOllamaStatus(test.ok ? test.message : `Error: ${test.message}`);
  };

  const handleSaveCameras = () => {
    setDashboardCameras(cam1, cam2);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> SETTINGS</h2>
        <span className="sub">connection · cameras · AI · security</span>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><i className="bi bi-shield-lock" /> Home Assistant (identity)</div>
          <div className="card-body">
            <div className="hint-box" style={{ marginBottom: "1rem" }}>
              ARGUS has <strong>no separate accounts</strong>. Each user logs in with their own HA long-lived token.
              Permissions follow Home Assistant — revoke tokens anytime in HA Profile → Security.
            </div>
            <div className="field">
              <label>Status</label>
              <div className={status === "connected" ? "glow-green" : "glow-amber"}>
                {status.toUpperCase()}
                {config?.username && ` · ${config.username}`}
              </div>
            </div>
            <div className="field">
              <label htmlFor="set-display-name">Display name</label>
              <input
                id="set-display-name"
                className="cyber-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Auto-detected from Home Assistant (e.g. matejkoo)"
              />
              <p className="field-hint" style={{ marginTop: 6, fontSize: "0.72rem", opacity: 0.75 }}>
                Shown in the top bar. Leave blank to detect from your HA account.
              </p>
            </div>
            <div className="field">
              <label htmlFor="set-url">URL</label>
              <input id="set-url" className="cyber-input" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="set-token">Access Token</label>
              <input
                id="set-token"
                className="cyber-input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={config?.token ? maskToken(config.token) : "HA long-lived token"}
              />
            </div>
            <label className="remember-row">
              <input type="checkbox" checked={rememberSession} onChange={(e) => setRememberSession(e.target.checked)} />
              keep signed in on this device
            </label>
            <div className="btn-row">
              <button type="button" className="btn-cyber start" onClick={handleSaveHa}>SAVE & CONNECT</button>
              <button type="button" className="btn-cyber stop" onClick={disconnect}>SIGN OUT</button>
              <button type="button" className="btn-cyber action" onClick={refreshStates}>REFRESH</button>
            </div>
            {saved && <p className="glow-green" style={{ marginTop: 8, fontSize: "0.75rem" }}>Saved</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><i className="bi bi-camera-video" /> Home cameras</div>
          <div className="card-body">
            <div className="field">
              <label>Camera slot 1</label>
              <select className="cyber-select" value={cam1} onChange={(e) => setCam1(e.target.value)}>
                <option value="">Auto (first camera)</option>
                {cameras.map((c) => (
                  <option key={c.entity_id} value={c.entity_id}>{getFriendlyName(c)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Camera slot 2</label>
              <select className="cyber-select" value={cam2} onChange={(e) => setCam2(e.target.value)}>
                <option value="">Auto (second camera)</option>
                {cameras.map((c) => (
                  <option key={c.entity_id} value={c.entity_id}>{getFriendlyName(c)}</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-cyber action" onClick={handleSaveCameras}>SAVE CAMERAS</button>
            {cameras.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: "0.72rem", marginTop: 8 }}>
                No cameras in HA yet. Add ESP32-CAM, USB cam, or Frigate integration.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header"><i className="bi bi-cpu" /> Ollama / Odysseus AI (home server)</div>
        <div className="card-body">
          <div className="hint-box" style={{ marginBottom: "1rem" }}>
            <p><strong>Odysseus AI</strong> and <strong>ARGUS Voice</strong> both talk to the same <strong>Ollama</strong> backend on your home server.</p>
            <p style={{ marginTop: 6 }}>
              Odysseus uses <code>172.17.0.1:11434/v1</code> from inside Docker — that only works inside Docker.
              From your laptop, use your server&apos;s <strong>LAN IP</strong> (e.g. <code>192.168.1.50</code>).
            </p>
          </div>
          <div className="field">
            <label>Ollama URL (LAN IP of home server)</label>
            <input
              className="cyber-input"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://192.168.1.50:11434"
            />
          </div>
          <div className="field">
            <label>Model name (exact, from Odysseus list)</label>
            <input
              className="cyber-input"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="qwen2.5:3b"
            />
          </div>
          <div className="field">
            <label>API mode</label>
            <select
              className="cyber-select"
              value={ollamaApiMode}
              onChange={(e) => setOllamaApiMode(e.target.value as OllamaApiMode)}
            >
              <option value="native">Native Ollama (/api/chat)</option>
              <option value="openai">OpenAI-compatible (/v1 — same as Odysseus)</option>
            </select>
          </div>
          <p style={{ fontSize: "0.68rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
            If Odysseus shows <code>http://172.17.0.1:11434/v1</code>, use{" "}
            <code>http://YOUR-SERVER-IP:11434/v1</code> here with <strong>OpenAI-compatible</strong> mode.
          </p>
          <button type="button" className="btn-cyber action" onClick={handleSaveOllama}>SAVE & TEST</button>
          {ollamaStatus && <p style={{ marginTop: 8, fontSize: "0.75rem", color: "var(--muted)" }}>{ollamaStatus}</p>}
          <div className="hint-box" style={{ marginTop: "1rem" }}>
            <p><strong>Your setup (qwen2.5:3b):</strong></p>
            <p>URL: <code>http://&lt;server-ip&gt;:11434</code> · Model: <code>qwen2.5:3b</code></p>
            <p style={{ marginTop: 6 }}>On Ubuntu ensure Ollama listens on LAN:</p>
            <p><code>OLLAMA_HOST=0.0.0.0:11434 ollama serve</code></p>
          </div>
        </div>
      </div>
    </>
  );
}
