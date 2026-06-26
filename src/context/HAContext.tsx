import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { resolveHaUsername } from "../lib/auth";
import { HomeAssistantClient } from "../lib/homeassistant";
import type { ArgusPreferences, ConnectionStatus, HAConfig, HAEntity, SecuritySummary } from "../types";
import {
  PREFS_KEY,
  STORAGE_KEY,
  STORAGE_KEY_LEGACY,
  classifyEntity,
  getDomain,
  isOnState,
} from "../types";
import { normalizeHaConfigInStorage } from "../lib/settingsMigrate";

interface HAContextValue {
  status: ConnectionStatus;
  error: string | null;
  entities: HAEntity[];
  config: HAConfig | null;
  client: HomeAssistantClient | null;
  summary: SecuritySummary;
  preferences: ArgusPreferences;
  connect: (config: HAConfig) => Promise<void>;
  disconnect: () => void;
  callService: (
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: { entity_id?: string | string[] }
  ) => Promise<void>;
  toggleEntity: (entity: HAEntity) => Promise<void>;
  refreshStates: () => Promise<void>;
  setDashboardCameras: (cam1: string, cam2: string) => void;
}

const HAContext = createContext<HAContextValue | null>(null);

function loadConfig(): HAConfig | null {
  try {
    normalizeHaConfigInStorage();
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(STORAGE_KEY_LEGACY) ??
      sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as HAConfig;
    if (!localStorage.getItem(STORAGE_KEY) && !sessionStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, raw);
    }
    return cfg;
  } catch {
    return null;
  }
}

function saveConfig(cfg: HAConfig) {
  const normalized =
    typeof window !== "undefined" && cfg.url.includes("/api/ha")
      ? { ...cfg, url: `${window.location.origin}/api/ha` }
      : cfg;
  const payload = JSON.stringify(normalized);
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (cfg.rememberSession !== false) {
    localStorage.setItem(STORAGE_KEY, payload);
  } else {
    sessionStorage.setItem(STORAGE_KEY, payload);
  }
}

function clearStoredConfig() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY_LEGACY);
  sessionStorage.removeItem(STORAGE_KEY);
}

function loadPreferences(): ArgusPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as ArgusPreferences;
  } catch {
    /* ignore */
  }
  return { dashboardCameras: ["", ""] };
}

function computeSummary(entities: HAEntity[]): SecuritySummary {
  const alarms = entities.filter((e) => getDomain(e.entity_id) === "alarm_control_panel");
  const alarmState = alarms[0]?.state ?? "disarmed";

  const motion = entities.filter(
    (e) =>
      getDomain(e.entity_id) === "binary_sensor" &&
      ["motion", "occupancy", "vibration"].includes((e.attributes.device_class as string) || "")
  );

  const doors = entities.filter(
    (e) =>
      getDomain(e.entity_id) === "binary_sensor" &&
      ["door", "window", "garage_door"].includes((e.attributes.device_class as string) || "")
  );

  const cameras = entities.filter((e) => getDomain(e.entity_id) === "camera");
  const bleTags = entities.filter(
    (e) =>
      e.entity_id.includes("ble") ||
      e.entity_id.includes("tag") ||
      (e.attributes.device_class as string) === "accelerometer"
  );

  const securityEntities = entities.filter((e) => classifyEntity(e) === "security");
  const healthy = securityEntities.filter((e) => e.state !== "unavailable" && e.state !== "unknown").length;
  const healthPct = securityEntities.length
    ? Math.round((healthy / securityEntities.length) * 100)
    : 100;

  return {
    alarmState,
    motionCount: motion.length,
    motionActive: motion.filter((e) => isOnState(e.state)).length,
    doorOpen: doors.filter((e) => isOnState(e.state)).length,
    cameraCount: cameras.length,
    bleTagCount: bleTags.length,
    systemHealth: healthPct,
  };
}

export function HAProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    const saved = loadConfig();
    return saved?.url && saved?.token ? "connecting" : "disconnected";
  });
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<HAEntity[]>([]);
  const [config, setConfig] = useState<HAConfig | null>(loadConfig);
  const [preferences, setPreferences] = useState<ArgusPreferences>(loadPreferences);
  const clientRef = useRef<HomeAssistantClient | null>(null);
  const connectGenRef = useRef(0);

  const upsertEntity = useCallback((entity: HAEntity) => {
    setEntities((prev) => {
      const idx = prev.findIndex((e) => e.entity_id === entity.entity_id);
      if (idx === -1) return [...prev, entity];
      const next = [...prev];
      next[idx] = entity;
      return next;
    });
  }, []);

  const connect = useCallback(async (cfg: HAConfig) => {
    const gen = ++connectGenRef.current;
    setStatus("connecting");
    setError(null);

    const prev = clientRef.current;
    if (prev) {
      prev.onDisconnected = undefined;
      prev.onConnected = undefined;
      prev.onError = undefined;
      prev.disconnect();
      clientRef.current = null;
    }

    const fullCfg: HAConfig = { ...cfg, username: cfg.username?.trim() || undefined };

    const client = new HomeAssistantClient(fullCfg);
    client.onConnected = () => {
      if (connectGenRef.current === gen) setStatus("connected");
    };
    client.onDisconnected = () => {
      if (connectGenRef.current === gen) setStatus("disconnected");
    };
    client.onError = (msg) => {
      if (connectGenRef.current !== gen) return;
      setError(msg);
      setStatus("error");
    };
    client.onStateChanged = upsertEntity;

    try {
      await client.connect();
      if (connectGenRef.current !== gen) {
        client.onDisconnected = undefined;
        client.disconnect();
        return;
      }
      const states = await client.getStates();
      if (connectGenRef.current !== gen) {
        client.onDisconnected = undefined;
        client.disconnect();
        return;
      }

      let currentUser = null;
      try {
        currentUser = await client.getCurrentUser();
      } catch {
        /* non-fatal */
      }

      let username = cfg.username?.trim() || undefined;
      if (!username) {
        username = (await resolveHaUsername(fullCfg.url, fullCfg.token, states, currentUser)) ?? undefined;
      }

      const savedCfg: HAConfig = { ...fullCfg, username };

      setEntities(states);
      setConfig(savedCfg);
      saveConfig(savedCfg);
      clientRef.current = client;
      setStatus("connected");
    } catch (e) {
      if (connectGenRef.current !== gen) return;
      client.onDisconnected = undefined;
      client.disconnect();
      setStatus("error");
      setError(e instanceof Error ? e.message : "Connection failed");
      throw e;
    }
  }, [upsertEntity]);

  const disconnect = useCallback(() => {
    connectGenRef.current += 1;
    const client = clientRef.current;
    if (client) {
      client.onDisconnected = undefined;
      client.onConnected = undefined;
      client.onError = undefined;
      client.disconnect();
    }
    clientRef.current = null;
    setEntities([]);
    setConfig(null);
    clearStoredConfig();
    setStatus("disconnected");
  }, []);

  const refreshStates = useCallback(async () => {
    if (!clientRef.current) return;
    const states = await clientRef.current.getStates();
    setEntities(states);
  }, []);

  const callService = useCallback(
    async (
      domain: string,
      service: string,
      data: Record<string, unknown> = {},
      target?: { entity_id?: string | string[] }
    ) => {
      if (!clientRef.current) return;
      await clientRef.current.callService(domain, service, data, target);
    },
    []
  );

  const toggleEntity = useCallback(async (entity: HAEntity) => {
    if (!clientRef.current) return;
    await clientRef.current.toggleEntity(entity);
  }, []);

  const setDashboardCameras = useCallback((cam1: string, cam2: string) => {
    const prefs: ArgusPreferences = { dashboardCameras: [cam1, cam2] };
    setPreferences(prefs);
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, []);

  useEffect(() => {
    if (status !== "connected" || !config?.url || !config?.token) return;
    if (config.username && config.username.toLowerCase() !== "user") return;

    let cancelled = false;
    (async () => {
      const client = clientRef.current;
      if (!client) return;
      let currentUser = null;
      try {
        currentUser = await client.getCurrentUser();
      } catch {
        /* ignore */
      }
      const name = await resolveHaUsername(config.url, config.token, entities, currentUser);
      if (cancelled || !name) return;
      const updated = { ...config, username: name };
      setConfig(updated);
      saveConfig(updated);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, config, entities]);

  useEffect(() => {
    const saved = loadConfig();
    if (saved?.url && saved?.token) {
      connect(saved).catch(() => undefined);
    }
    return () => {
      connectGenRef.current += 1;
      const client = clientRef.current;
      if (client) {
        client.onDisconnected = undefined;
        client.disconnect();
      }
      clientRef.current = null;
    };
    // Auto-connect once on mount when a saved session exists
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => computeSummary(entities), [entities]);

  const value = useMemo<HAContextValue>(
    () => ({
      status,
      error,
      entities,
      config,
      client: clientRef.current,
      summary,
      preferences,
      connect,
      disconnect,
      callService,
      toggleEntity,
      refreshStates,
      setDashboardCameras,
    }),
    [status, error, entities, config, summary, preferences, connect, disconnect, callService, toggleEntity, refreshStates, setDashboardCameras]
  );

  return <HAContext.Provider value={value}>{children}</HAContext.Provider>;
}

export function useHA() {
  const ctx = useContext(HAContext);
  if (!ctx) throw new Error("useHA must be used within HAProvider");
  return ctx;
}

export function useSecurityEntities() {
  const { entities } = useHA();
  return useMemo(
    () => entities.filter((e) => classifyEntity(e) === "security"),
    [entities]
  );
}

export { isOnState } from "../types";
export { isAlertState } from "../types";
