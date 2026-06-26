import { useState } from "react";
import { ArgusLogo } from "./ArgusLogo";
import { testConnection } from "../lib/homeassistant";
import type { HAConfig } from "../types";

interface ConnectScreenProps {
  onConnect: (config: HAConfig) => Promise<void>;
  error?: string | null;
}

import { defaultHaProxyUrl } from "../lib/settingsMigrate";

function defaultHaUrl(): string {
  if (import.meta.env.DEV) return "http://localhost:8123";
  return defaultHaProxyUrl();
}

export function ConnectScreen({ onConnect, error }: ConnectScreenProps) {
  const [url, setUrl] = useState(defaultHaUrl);
  const [token, setToken] = useState("");
  const [rememberSession, setRememberSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    setLoading(true);
    const cfg: HAConfig = {
      url: url.trim(),
      token: token.trim(),
      rememberSession,
    };
    const test = await testConnection(cfg);
    if (!test.ok) {
      setLocalErr(test.message);
      setLoading(false);
      return;
    }
    try {
      await onConnect(cfg);
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const displayErr = localErr || error;

  return (
    <div className="connect-screen">
      <form className="connect-panel" onSubmit={handleSubmit}>
        <ArgusLogo size={72} className="connect-logo" />
        <div className="connect-brand">ARGUS</div>
        <div className="connect-tagline">all-seeing guardian · perimeter watch</div>

        <div className="auth-steps">
          <p><strong>1.</strong> Create your account in <strong>Home Assistant</strong> first</p>
          <p><strong>2.</strong> Generate a <strong>Long-Lived Access Token</strong> for that user only</p>
          <p><strong>3.</strong> Paste the token here — ARGUS uses your HA identity, no separate password</p>
        </div>

        <div className="field">
          <label htmlFor="ha-url"><i className="bi bi-link-45deg" /> home assistant url</label>
          <input
            id="ha-url"
            className="cyber-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://10.8.0.1:9443/api/ha"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="ha-token"><i className="bi bi-key-fill" /> long-lived access token</label>
          <input
            id="ha-token"
            className="cyber-input"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="from HA → Profile → Security"
            autoComplete="off"
            required
          />
        </div>

        <label className="remember-row">
          <input
            type="checkbox"
            checked={rememberSession}
            onChange={(e) => setRememberSession(e.target.checked)}
          />
          keep signed in on this device (stores token locally)
        </label>

        <button type="submit" className="btn-cyber action" style={{ width: "100%" }} disabled={loading}>
          {loading ? "verifying identity..." : "authenticate via HA"}
        </button>

        <div className={`err-box${displayErr ? " show" : ""}`}>{displayErr}</div>

        <p className="connect-footer">
          <span className="glow-green">●</span> token-bound to your HA user · revoke anytime in HA profile
        </p>
      </form>
    </div>
  );
}
