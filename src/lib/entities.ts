import type { HAEntity } from "../types";
import { classifyEntity, getDomain } from "../types";

const SYSTEM_ENTITY_PATTERNS = [
  /^sun\./,
  /^sensor\.sun_/,
  /^binary_sensor\.updater/,
  /^update\./,
  /^backup\./,
  /^sensor\.backup/,
  /^event\./,
  /^automation\./,
  /^script\./,
  /^scene\./,
  /^zone\./,
  /^person\./,
  /^device_tracker\./,
  /^weather\./,
  /^tts\./,
  /^stt\./,
  /^conversation\./,
  /^todo\./,
  /^shopping_list/,
  /^calendar\./,
  /^media_player\.google_translate/,
];

const SYSTEM_DOMAINS = new Set([
  "sun",
  "backup",
  "update",
  "event",
  "forecast",
  "weather",
  "todo",
  "shopping_list",
  "conversation",
  "tts",
  "stt",
  "calendar",
  "zone",
]);

export function isSystemEntity(entity: HAEntity): boolean {
  const domain = getDomain(entity.entity_id);
  if (SYSTEM_DOMAINS.has(domain)) return true;
  if (entity.entity_id === "binary_sensor.updater") return true;
  return SYSTEM_ENTITY_PATTERNS.some((re) => re.test(entity.entity_id));
}

export function isSecurityRelevant(entity: HAEntity): boolean {
  if (isSystemEntity(entity)) return false;
  if (classifyEntity(entity) === "security") return true;

  const domain = getDomain(entity.entity_id);
  const dc = (entity.attributes.device_class as string) || "";

  if (domain === "binary_sensor") {
    return ["motion", "occupancy", "door", "window", "garage_door", "vibration", "tamper", "sound", "smoke", "gas", "moisture"].includes(dc);
  }
  if (domain === "sensor") {
    return ["battery", "signal_strength", "temperature", "humidity", "illuminance", "accelerometer"].includes(dc)
      || entity.entity_id.includes("ble")
      || entity.entity_id.includes("tag");
  }
  if (["lock", "cover", "alarm_control_panel", "camera", "switch", "light", "siren"].includes(domain)) {
    return true;
  }
  return false;
}

export function isUnknownState(state: string): boolean {
  return state === "unknown" || state === "unavailable";
}

export function formatEntityState(entity: HAEntity): string {
  const s = entity.state;
  if (s === "unknown") return "—";
  if (s === "unavailable") return "offline";
  const u = entity.attributes.unit_of_measurement as string | undefined;
  return u ? `${s} ${u}` : s;
}

export function sensorStrength(entity: HAEntity): number {
  const val = parseFloat(entity.state);
  if (Number.isFinite(val)) return Math.min(100, Math.max(-100, val));
  if (entity.state === "on" || entity.state === "open" || entity.state === "triggered") return 85;
  if (entity.state === "off" || entity.state === "closed") return -15;
  return 0;
}
