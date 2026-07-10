import { formatEntityState, isSecurityRelevant, isSystemEntity } from "./entities";
import type { HAEntity } from "../types";
import { getDomain, getFriendlyName, isOnState } from "../types";

export type HomeSensorGroup = "perimeter" | "motion" | "ble" | "environment" | "locks";

export interface HomeSensorItem {
  entity: HAEntity;
  icon: string;
  name: string;
  value: string;
  alert: boolean;
}

const GROUP_LABELS: Record<HomeSensorGroup, string> = {
  perimeter: "Doors & windows",
  motion: "Motion & occupancy",
  ble: "BLE tags & trackers",
  environment: "Climate & environment",
  locks: "Locks",
};

const GROUP_ORDER: HomeSensorGroup[] = ["perimeter", "motion", "ble", "environment", "locks"];

const MOTION_DEVICE_CLASSES = new Set(["motion", "occupancy", "vibration", "tamper", "sound", "smoke", "gas"]);
const PERIMETER_DEVICE_CLASSES = new Set(["door", "window", "garage_door", "opening"]);
const ENV_DEVICE_CLASSES = new Set(["temperature", "humidity", "illuminance", "pressure", "carbon_dioxide"]);

/** Shared motion detection — keep in sync with dashboard stats. */
export function isMotionEntity(entity: HAEntity): boolean {
  const domain = getDomain(entity.entity_id);
  if (domain !== "binary_sensor") return false;
  const dc = (entity.attributes.device_class as string) || "";
  const id = entity.entity_id.toLowerCase();
  if (MOTION_DEVICE_CLASSES.has(dc)) return true;
  return /motion|pir|occupancy|person|animal|reolink/.test(id);
}

export function isPerimeterEntity(entity: HAEntity): boolean {
  const domain = getDomain(entity.entity_id);
  const dc = (entity.attributes.device_class as string) || "";
  const id = entity.entity_id.toLowerCase();
  if (domain === "cover") return true;
  if (domain !== "binary_sensor") return false;
  if (PERIMETER_DEVICE_CLASSES.has(dc)) return true;
  return /door|window|garage|gate/.test(id);
}

export function isBleTagEntity(entity: HAEntity): boolean {
  const id = entity.entity_id.toLowerCase();
  const dc = (entity.attributes.device_class as string) || "";
  const domain = getDomain(entity.entity_id);
  if (id.includes("ble") || id.includes("tag") || dc === "accelerometer") return true;
  if (domain === "device_tracker" && (id.includes("ble") || id.includes("tag"))) return true;
  return false;
}

export function isEnvironmentEntity(entity: HAEntity): boolean {
  if (getDomain(entity.entity_id) !== "sensor") return false;
  const dc = (entity.attributes.device_class as string) || "";
  return ENV_DEVICE_CLASSES.has(dc);
}

function isBleEntity(entity: HAEntity): boolean {
  return isBleTagEntity(entity);
}

function classifyHomeSensor(entity: HAEntity): HomeSensorGroup | null {
  const domain = getDomain(entity.entity_id);

  if (domain === "lock") return "locks";
  if (isBleTagEntity(entity)) return "ble";
  if (isPerimeterEntity(entity)) return "perimeter";
  if (isMotionEntity(entity)) return "motion";
  if (isEnvironmentEntity(entity)) return "environment";

  if (isSystemEntity(entity)) return null;

  if (domain === "binary_sensor" && isSecurityRelevant(entity)) return "motion";

  if (domain === "sensor" && isBleEntity(entity)) return "ble";

  return null;
}

function iconFor(entity: HAEntity, group: HomeSensorGroup): string {
  const dc = (entity.attributes.device_class as string) || "";
  if (group === "perimeter") {
    if (dc === "window") return "bi-window";
    if (dc === "garage_door") return "bi-garage";
    return "bi-door-open";
  }
  if (group === "motion") return "bi-person-walking";
  if (group === "ble") {
    if (isOnState(entity.state) || entity.state === "moving") return "bi-broadcast-pin";
    return "bi-bluetooth";
  }
  if (group === "environment") {
    if (dc === "humidity") return "bi-droplet";
    if (dc === "temperature") return "bi-thermometer-half";
    return "bi-cloud-sun";
  }
  if (group === "locks") return entity.state === "unlocked" ? "bi-unlock" : "bi-lock-fill";
  return "bi-broadcast";
}

function isAlertState(entity: HAEntity, group: HomeSensorGroup): boolean {
  const s = entity.state.toLowerCase();
  if (group === "locks") return s === "unlocked" || s === "open";
  if (group === "ble") return s === "moving" || s === "on";
  if (group === "perimeter") return isOnState(entity.state) || s === "open";
  if (group === "motion") return isOnState(entity.state) || s === "triggered";
  return false;
}

export function groupHomeSensors(entities: HAEntity[]): { id: HomeSensorGroup; label: string; items: HomeSensorItem[] }[] {
  const buckets: Record<HomeSensorGroup, HomeSensorItem[]> = {
    perimeter: [],
    motion: [],
    ble: [],
    environment: [],
    locks: [],
  };

  for (const entity of entities) {
    const group = classifyHomeSensor(entity);
    if (!group) continue;
    buckets[group].push({
      entity,
      icon: iconFor(entity, group),
      name: getFriendlyName(entity),
      value: formatEntityState(entity),
      alert: isAlertState(entity, group),
    });
  }

  for (const key of GROUP_ORDER) {
    buckets[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  return GROUP_ORDER.map((id) => ({
    id,
    label: GROUP_LABELS[id],
    items: buckets[id],
  })).filter((g) => g.items.length > 0);
}

export interface WeatherSnapshot {
  location: string;
  label: string;
  temp: string | null;
  humidity: string | null;
  icon: string;
}

function weatherLocation(entity: HAEntity): string {
  const loc = entity.attributes.location as string | undefined;
  if (loc?.trim()) return loc.trim();
  const fn = getFriendlyName(entity);
  if (fn && !/^weather$/i.test(fn) && !/^forecast$/i.test(fn)) return fn;
  const slug = entity.entity_id.split(".")[1]?.replace(/_/g, " ").trim();
  if (slug) return slug.charAt(0).toUpperCase() + slug.slice(1);
  return "Home";
}

function formatCelsius(value: unknown, unit?: string): string | null {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return null;
  const u = (unit ?? "°C").replace(/\s/g, "").toUpperCase();
  let c = n;
  if (u === "F" || u === "°F" || u === "FAHRENHEIT") {
    c = ((n - 32) * 5) / 9;
  }
  const rounded = Math.round(c * 10) / 10;
  return `${rounded}°C`;
}

function formatSensorTempCelsius(entity: HAEntity): string | null {
  const uom = (entity.attributes.unit_of_measurement as string) || "°C";
  return formatCelsius(entity.state, uom);
}

export function pickWeatherSnapshot(entities: HAEntity[]): WeatherSnapshot | null {
  const weather = entities.find((e) => getDomain(e.entity_id) === "weather");
  if (!weather) {
    const temp = entities.find(
      (e) => getDomain(e.entity_id) === "sensor" && (e.attributes.device_class as string) === "temperature"
    );
    if (!temp) return null;
    return {
      location: weatherLocation(temp),
      label: getFriendlyName(temp),
      temp: formatSensorTempCelsius(temp),
      humidity: null,
      icon: "bi-thermometer-half",
    };
  }

  const t = weather.attributes.temperature;
  const unit = weather.attributes.temperature_unit as string | undefined;
  const h = weather.attributes.humidity;

  return {
    location: weatherLocation(weather),
    label: getFriendlyName(weather),
    temp: formatCelsius(t, unit),
    humidity: h != null && h !== "" ? `${h}%` : null,
    icon: weatherIcon(weather.state),
  };
}

function weatherIcon(state: string): string {
  const s = state.toLowerCase();
  if (s.includes("rain") || s.includes("pour")) return "bi-cloud-rain-heavy";
  if (s.includes("cloud")) return "bi-clouds";
  if (s.includes("snow")) return "bi-snow";
  if (s.includes("wind") || s.includes("windy")) return "bi-wind";
  if (s.includes("fog") || s.includes("mist")) return "bi-cloud-fog2";
  if (s.includes("night") || s.includes("clear-night")) return "bi-moon-stars";
  return "bi-sun";
}

export const ARM_ACTIONS = {
  arm_away: {
    title: "Arm Away?",
    body: "Full-away mode — all perimeter sensors active. Use when nobody is home. Entry delay applies on doors.",
    confirm: "ARM AWAY",
    variant: "start" as const,
  },
  arm_home: {
    title: "Arm Home?",
    body: "Stay-home mode — exterior doors/windows armed; interior motion may be bypassed (depends on your HA alarm panel).",
    confirm: "ARM HOME",
    variant: "action" as const,
  },
  disarm: {
    title: "Disarm system?",
    body: "Turns off all alarm zones. Use when you are home and want free movement without triggers.",
    confirm: "DISARM",
    variant: "stop" as const,
  },
};

export type ArmAction = keyof typeof ARM_ACTIONS;
