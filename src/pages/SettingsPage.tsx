import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHA } from "../context/HAContext";
import { CAMERA_SLOT_NONE, getCameraDisplayLabel } from "../lib/cameras";
import { maskToken } from "../lib/auth";
import { controllableEntities, QUICK_CONTROL_SLOTS } from "../lib/preferences";
import { loadOllamaConfig, saveOllamaConfig, testOllama, getDefaultOllama, type OllamaApiMode, type OllamaConfig } from "../lib/ollama";
import { defaultHaProxyUrl } from "../lib/settingsMigrate";
import { getDomain, getFriendlyName } from "../types";

export function SettingsPage() {
  const navigate = useNavigate();
  const { config, connect, disconnect, status, refreshStates, entities, preferences, setDashboardCameras, updatePreferences, entityLocations } = useHA();
  const [url, setUrl] = useState(config?.url ?? defaultHaProxyUrl());
  const [token, setToken] = useState(config?.token ?? "");
  const [displayName, setDisplayName] = useState(config?.username ?? "");
  const [rememberSession, setRememberSession] = useState(config?.rememberSession ?? false);
  const [saved, setSaved] = useState(false);

  const defaults = getDefaultOllama();
  const [ollamaUrl, setOllamaUrl] = useState(defaults.url);
  const [ollamaModel, setOllamaModel] = useState(defaults.model);
  const [ollamaApiMode, setOllamaApiMode] = useState<OllamaApiMode>("native");
  const [ollamaStatus, setOllamaStatus] = useState<string | null>(null);

  const [cam1, setCam1] = useState(preferences.dashboardCameras[0]);
  const [cam2, setCam2] = useState(preferences.dashboardCameras[1]);
  const [alarmCode, setAlarmCode] = useState(preferences.alarmCode ?? "");
  const [quickSlots, setQuickSlots] = useState<string[]>([...preferences.quickControls]);

  const cameras = entities.filter((e) => getDomain(e.entity_id) === "camera");
  const controls = controllableEntities(entities);

  useEffect(() => {
    setCam1(preferences.dashboardCameras[0]);
    setCam2(preferences.dashboardCameras[1]);
    setAlarmCode(preferences.alarmCode ?? "");
    setQuickSlots([...preferences.quickControls]);
  }, [preferences.dashboardCameras, preferences.alarmCode, preferences.quickControls]);

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
    const trimmedToken = token.trim() || config?.token || "";
    await connect({
      url: url.trim(),
      token: trimmedToken,
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

  const handleSaveSecurity = () => {
    updatePreferences({
      alarmCode: alarmCode.trim(),
      quickControls: quickSlots.slice(0, QUICK_CONTROL_SLOTS) as typeof preferences.quickControls,
    });
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
            <p className="field-hint" style={{ marginBottom: "1rem", fontSize: "0.72rem", opacity: 0.85 }}>
              Dashboard loads via HA snapshots first, then upgrades to stream when available.
              Set unused slots to <strong>None (disabled)</strong>.
            </p>
            <div className="field">
              <label>Camera slot 1</label>
              <select className="cyber-select" value={cam1} onChange={(e) => setCam1(e.target.value)}>
                <option value="">Auto (first camera)</option>
                <option value={CAMERA_SLOT_NONE}>None (disabled)</option>
                {cameras.map((c) => (
                  <option key={c.entity_id} value={c.entity_id}>{getCameraDisplayLabel(c, entityLocations.areas, entityLocations.registryNames)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Camera slot 2</label>
              <select className="cyber-select" value={cam2} onChange={(e) => setCam2(e.target.value)}>
                <option value="">Auto (second camera)</option>
                <option value={CAMERA_SLOT_NONE}>None (disabled)</option>
                {cameras.map((c) => (
                  <option key={c.entity_id} value={c.entity_id}>{getCameraDisplayLabel(c, entityLocations.areas, entityLocations.registryNames)}</option>
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

      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div className="card">
          <div className="card-header"><i className="bi bi-shield-lock-fill" /> Security</div>
          <div className="card-body">
            <p className="field-hint" style={{ marginBottom: "1rem", fontSize: "0.72rem", opacity: 0.85 }}>
              Alarm code is sent to Home Assistant when you arm or disarm. Leave blank if your panel does not require a code.
            </p>
            <div className="field">
              <label htmlFor="set-alarm-code">Alarm code</label>
              <input
                id="set-alarm-code"
                className="cyber-input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={alarmCode}
                onChange={(e) => setAlarmCode(e.target.value)}
                placeholder="Optional — e.g. 1234"
              />
            </div>
            <button type="button" className="btn-cyber action" onClick={handleSaveSecurity}>
              SAVE SECURITY
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><i className="bi bi-lightning-charge" /> Quick controls (Home)</div>
          <div className="card-body">
            <p className="field-hint" style={{ marginBottom: "1rem", fontSize: "0.72rem", opacity: 0.85 }}>
              Pin up to {QUICK_CONTROL_SLOTS} lights, switches, locks, or sirens on the Home page. Leave a slot empty to skip it. If all empty, ARGUS auto-picks the first controllable devices.
            </p>
            {Array.from({ length: QUICK_CONTROL_SLOTS }, (_, i) => (
              <div className="field" key={i}>
                <label>Slot {i + 1}</label>
                <select
                  className="cyber-select"
                  value={quickSlots[i] ?? ""}
                  onChange={(e) => {
                    const next = [...quickSlots];
                    next[i] = e.target.value;
                    setQuickSlots(next);
                  }}
                >
                  <option value="">None</option>
                  {controls.map((c) => (
                    <option key={c.entity_id} value={c.entity_id}>
                      {getFriendlyName(c)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button type="button" className="btn-cyber action" onClick={handleSaveSecurity}>
              SAVE QUICK CONTROLS
            </button>
            {controls.length === 0 && (
              <p style={{ color: "var(--muted)", fontSize: "0.72rem", marginTop: 8 }}>
                No controllable devices yet. Add lights or switches in Home Assistant.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header"><i className="bi bi-cpu" /> Ollama / Odysseus AI (home server)</div>
        <div className="card-body">
          <div className="hint-box" style={{ marginBottom: "1rem" }}>
            <p><strong>Odysseus AI</strong> and <strong>ARGUS Voice</strong> use the same <strong>Ollama</strong> on mato-server.</p>
            <p style={{ marginTop: 6 }}>
              On <strong>HTTPS</strong> ARGUS use the proxy URL (browser blocks <code>http://</code> from <code>https://</code>):
            </p>
            <p><code>{typeof window !== "undefined" ? `${window.location.origin}/api/ollama` : "https://argus.local:9443/api/ollama"}</code></p>
          </div>
          <div className="field">
            <label>Ollama URL (home server)</label>
            <input
              className="cyber-input"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="https://argus.local:9443/api/ollama"
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
          <details className="hint-box" style={{ marginTop: "1rem", fontSize: "0.72rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Server troubleshooting (advanced)</summary>
            <p style={{ marginTop: 8 }}><code>ARGUS_OLLAMA_UPSTREAM=http://host.docker.internal:11434</code> in <code>.env</code></p>
            <p style={{ marginTop: 6 }}>HTTP 502? <code>curl http://127.0.0.1:11434/api/tags</code> on mato-server.</p>
            <p style={{ marginTop: 6 }}>HTTP 403? Redeploy with <code>argus-update build</code>.</p>
          </details>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header"><i className="bi bi-box-arrow-left" /> Session</div>
        <div className="card-body">
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 1rem" }}>
            Sign out clears your Home Assistant token from this device. On phones, use this instead of the bottom bar.
          </p>
          <button
            type="button"
            className="btn-cyber stop"
            onClick={() => {
              disconnect();
              navigate("/");
              window.location.reload();
            }}
          >
            SIGN OUT
          </button>
        </div>
      </div>
    </>
  );
}
