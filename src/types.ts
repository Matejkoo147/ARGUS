export interface HAEntityAttributes {
  friendly_name?: string;
  device_class?: string;
  unit_of_measurement?: string;
  icon?: string;
  entity_picture?: string;
  brightness?: number;
  [key: string]: unknown;
}

export interface HAEntity {
  entity_id: string;
  state: string;
  attributes: HAEntityAttributes;
  last_changed: string;
  last_updated: string;
}

export interface HAConfig {
  url: string;
  token: string;
  username?: string;
  rememberSession?: boolean;
}

export interface ArgusPreferences {
  dashboardCameras: [string, string];
  /** HA alarm panel code (empty if panel does not require one). */
  alarmCode?: string;
  /** Pinned entity IDs for home quick controls (up to 6). Empty slot = unused. */
  quickControls: [string, string, string, string, string, string];
}

export interface HALogbookEntry {
  when: string;
  name: string;
  message: string;
  entity_id?: string;
  domain?: string;
}

/** Home Assistant entity registry entry (area assignment). */
export interface HAEntityRegistryEntry {
  entity_id: string;
  area_id: string | null;
  device_id: string | null;
  name?: string | null;
}

/** Home Assistant device registry entry. */
export interface HADeviceRegistryEntry {
  id: string;
  area_id: string | null;
  name?: string | null;
  name_by_user?: string | null;
}

/** Home Assistant area registry entry (room name). */
export interface HAAreaRegistryEntry {
  area_id: string;
  name: string;
}

export interface EntityLocationMaps {
  areas: Record<string, string>;
  registryNames: Record<string, string>;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface SecuritySummary {
  alarmState: string;
  motionCount: number;
  motionActive: number;
  doorOpen: number;
  cameraCount: number;
  bleTagCount: number;
  systemHealth: number;
}

export const STORAGE_KEY = "argus_ha_config";
export const STORAGE_KEY_LEGACY = "aegis_ha_config";
export const PREFS_KEY = "argus_prefs";

export const DOMAIN_ICONS: Record<string, string> = {
  alarm_control_panel: "🛡️",
  binary_sensor: "📡",
  sensor: "📊",
  camera: "📷",
  light: "💡",
  switch: "🔌",
  lock: "🔒",
  cover: "🪟",
  climate: "🌡️",
  media_player: "🔊",
  device_tracker: "📍",
  automation: "⚙️",
  script: "📜",
  person: "👤",
};

export function getDomain(entityId: string): string {
  return entityId.split(".")[0] ?? "";
}

export function getFriendlyName(entity: HAEntity): string {
  return (entity.attributes.friendly_name as string) || entity.entity_id;
}

export function isOnState(state: string): boolean {
  const s = state.toLowerCase();
  return s === "on" || s === "open" || s === "unlocked" || s === "home";
}

export function isAlertState(entity: HAEntity): boolean {
  const s = entity.state.toLowerCase();
  if (s === "unavailable") return true;
  if (s === "unknown") return false;
  const dc = (entity.attributes.device_class as string) || "";
  if (dc === "motion" || dc === "occupancy" || dc === "vibration") {
    return s === "on";
  }
  if (dc === "door" || dc === "window" || dc === "garage_door") {
    return s === "on" || s === "open";
  }
  if (entity.entity_id.startsWith("alarm_control_panel.")) {
    return s === "triggered" || s === "pending";
  }
  return false;
}

export function classifyEntity(entity: HAEntity): "security" | "climate" | "media" | "other" {
  const domain = getDomain(entity.entity_id);
  const dc = (entity.attributes.device_class as string) || "";
  if (
    domain === "alarm_control_panel" ||
    domain === "camera" ||
    domain === "lock" ||
    (domain === "binary_sensor" &&
      ["motion", "occupancy", "door", "window", "vibration", "tamper", "sound"].includes(dc)) ||
    (domain === "sensor" && ["battery", "signal_strength"].includes(dc))
  ) {
    return "security";
  }
  if (domain === "climate" || domain === "fan" || domain === "humidifier") return "climate";
  if (domain === "media_player" || domain === "tts") return "media";
  return "other";
}
