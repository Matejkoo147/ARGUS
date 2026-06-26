import { PREFS_KEY, STORAGE_KEY, STORAGE_KEY_LEGACY, type HAConfig } from "../types";

/** Must match ARGUS_HTTPS_PORT in server .env */
export const ARGUS_HTTPS_PORT = 9443;

const MIGRATE_HASH_PREFIX = "argus-migrate=";

/** All ARGUS keys stored in the browser (per-origin). */
export const ARGUS_LOCAL_STORAGE_KEYS = [
  STORAGE_KEY,
  STORAGE_KEY_LEGACY,
  "argus_ollama_config",
  PREFS_KEY,
  "argus_voice_muted",
] as const;

export function exportSettingsSnapshot(): Record<string, string> {
  const snap: Record<string, string> = {};
  for (const key of ARGUS_LOCAL_STORAGE_KEYS) {
    const v = localStorage.getItem(key);
    if (v) snap[key] = v;
  }
  const sessionHa = sessionStorage.getItem(STORAGE_KEY);
  if (sessionHa && !snap[STORAGE_KEY]) snap[STORAGE_KEY] = sessionHa;
  return snap;
}

/** Rewrite stored HA proxy URL to the current origin (HTTP:9080 → HTTPS:9443). */
export function normalizeHaConfigInStorage(): void {
  if (typeof window === "undefined") return;
  const apiHa = `${window.location.origin}/api/ha`;

  for (const key of [STORAGE_KEY, STORAGE_KEY_LEGACY] as const) {
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (!raw) continue;
    try {
      const cfg = JSON.parse(raw) as HAConfig;
      if (!cfg.url?.includes("/api/ha") && !cfg.url?.includes(":8123")) continue;
      if (cfg.url.includes("/api/ha")) {
        cfg.url = apiHa;
        const payload = JSON.stringify(cfg);
        if (localStorage.getItem(key)) localStorage.setItem(key, payload);
        if (sessionStorage.getItem(key)) sessionStorage.setItem(key, payload);
      }
    } catch {
      /* ignore */
    }
  }
}

function importFromHash(): boolean {
  const match = window.location.hash.match(new RegExp(`^#${MIGRATE_HASH_PREFIX}(.+)$`));
  if (!match) return false;

  try {
    const snap = JSON.parse(atob(decodeURIComponent(match[1]!))) as Record<string, string>;
    for (const [key, value] of Object.entries(snap)) {
      if (ARGUS_LOCAL_STORAGE_KEYS.includes(key as (typeof ARGUS_LOCAL_STORAGE_KEYS)[number]) || key === STORAGE_KEY) {
        localStorage.setItem(key, value);
      }
    }
    normalizeHaConfigInStorage();
  } catch {
    /* corrupt payload */
  }

  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

/**
 * HTTPS-only: import settings from a one-time #argus-migrate= hash, or redirect HTTP → HTTPS
 * with settings in the hash (browser cannot read http localStorage from https).
 */
export function runStartupMigration(): void {
  if (typeof window === "undefined") return;

  if (window.location.protocol === "https:") {
    importFromHash();
    normalizeHaConfigInStorage();
    return;
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return;
  }

  const snap = exportSettingsSnapshot();
  const path = `${window.location.pathname}${window.location.search}`;
  const httpsBase = `https://${window.location.hostname}:${ARGUS_HTTPS_PORT}${path}`;

  if (Object.keys(snap).length > 0) {
    const encoded = encodeURIComponent(btoa(JSON.stringify(snap)));
    window.location.replace(`${httpsBase}#${MIGRATE_HASH_PREFIX}${encoded}`);
  } else {
    window.location.replace(httpsBase);
  }
}

export function defaultHaProxyUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/ha`;
  }
  return `https://10.8.0.1:${ARGUS_HTTPS_PORT}/api/ha`;
}

export function defaultOllamaUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "http://127.0.0.1:11434";
    return `http://${host}:11434`;
  }
  return "http://10.8.0.1:11434";
}
