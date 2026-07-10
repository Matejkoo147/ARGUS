import { formatEntityState } from "./entities";
import { isBleTagEntity, isMotionEntity, isPerimeterEntity } from "./homeSensors";
import type { HALogbookEntry, HAEntity } from "../types";
import { getDomain, getFriendlyName, isOnState } from "../types";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertKind = "breach" | "motion" | "door" | "camera" | "tamper" | "lock" | "sensor" | "event";

export interface ArgusAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  entityId?: string;
  cameraEntityId?: string;
  timestamp: Date;
  route: string;
  actionLabel: string;
  source: "live" | "logbook";
}

const LOG_SECURITY_RE =
  /motion|door|window|alarm|breach|trigger|camera|lock|tamper|intrusion|person|occupancy|garage|opened|detected/i;

function alertKindForEntity(entity: HAEntity): AlertKind {
  const domain = getDomain(entity.entity_id);
  const dc = (entity.attributes.device_class as string) || "";
  if (domain === "alarm_control_panel") return "breach";
  if (domain === "camera") return "camera";
  if (domain === "lock") return "lock";
  if (isPerimeterEntity(entity)) return "door";
  if (isMotionEntity(entity)) return "motion";
  if (isBleTagEntity(entity)) return "sensor";
  if (["door", "window", "garage_door"].includes(dc)) return "door";
  if (["motion", "occupancy", "vibration"].includes(dc)) return "motion";
  if (dc === "tamper" || dc === "smoke" || dc === "gas") return "tamper";
  return "sensor";
}

function severityForEntity(entity: HAEntity, armed: boolean): AlertSeverity {
  const domain = getDomain(entity.entity_id);
  const dc = (entity.attributes.device_class as string) || "";
  if (entity.state === "triggered" || entity.state === "pending") return "critical";
  if (dc === "tamper" || dc === "smoke" || dc === "gas") return "critical";
  if (domain === "lock" && entity.state === "unlocked") return armed ? "critical" : "warning";
  if (isPerimeterEntity(entity)) return armed ? "critical" : "warning";
  if (isMotionEntity(entity) || isBleTagEntity(entity)) return armed ? "warning" : "info";
  if (["door", "window", "garage_door"].includes(dc)) return armed ? "critical" : "warning";
  if (["motion", "occupancy", "vibration"].includes(dc)) return armed ? "warning" : "info";
  return "warning";
}

function routeForKind(kind: AlertKind): string {
  switch (kind) {
    case "camera":
      return "/cameras";
    case "motion":
    case "sensor":
    case "tamper":
      return "/sensors";
    case "door":
    case "breach":
    case "lock":
      return "/";
    default:
      return "/history";
  }
}

function actionLabelForKind(kind: AlertKind, hasCamera: boolean): string {
  if (hasCamera) return "View capture";
  switch (kind) {
    case "camera":
      return "Open cameras";
    case "motion":
      return "Check sensors";
    case "door":
    case "breach":
    case "lock":
      return "Open home";
    default:
      return "Investigate";
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

/** Pick a camera that likely covers this sensor (name/area overlap). */
export function findRelatedCamera(entity: HAEntity, entities: HAEntity[]): HAEntity | null {
  const cameras = entities.filter((e) => getDomain(e.entity_id) === "camera");
  if (!cameras.length) return null;

  const hay = `${entity.entity_id} ${getFriendlyName(entity)} ${(entity.attributes.area as string) || ""}`.toLowerCase();
  const words = tokenize(hay);

  let best: HAEntity | null = null;
  let bestScore = 0;
  for (const cam of cameras) {
    const camHay = `${cam.entity_id} ${getFriendlyName(cam)} ${(cam.attributes.area as string) || ""}`.toLowerCase();
    const score = words.reduce((n, w) => (camHay.includes(w) ? n + 1 : n), 0);
    if (score > bestScore) {
      bestScore = score;
      best = cam;
    }
  }

  return bestScore > 0 ? best : null;
}

/** Entities that should surface as live perimeter alerts (not lights/switches). */
export function isLiveAlertCandidate(entity: HAEntity): boolean {
  const domain = getDomain(entity.entity_id);
  if (domain === "alarm_control_panel" || domain === "camera" || domain === "lock" || domain === "siren") {
    return true;
  }
  if (isMotionEntity(entity) || isPerimeterEntity(entity) || isBleTagEntity(entity)) return true;
  const dc = (entity.attributes.device_class as string) || "";
  if (domain === "binary_sensor") {
    return ["tamper", "smoke", "gas", "sound", "moisture"].includes(dc);
  }
  return false;
}

function isActiveAlertState(entity: HAEntity): boolean {
  const domain = getDomain(entity.entity_id);
  const s = entity.state.toLowerCase();
  if (s === "unknown" || s === "unavailable") return false;
  if (domain === "alarm_control_panel") {
    return s === "triggered" || s === "pending";
  }
  if (domain === "device_tracker") {
    return s === "moving" || s === "not_home";
  }
  if (isBleTagEntity(entity)) {
    return s === "moving" || s === "on";
  }
  return isOnState(entity.state) || s === "triggered" || s === "unlocked";
}

export function buildLiveAlerts(entities: HAEntity[], armed: boolean): ArgusAlert[] {
  return entities
    .filter(isLiveAlertCandidate)
    .filter(isActiveAlertState)
    .map((entity) => {
      const kind = alertKindForEntity(entity);
      const related = kind === "motion" || kind === "door" ? findRelatedCamera(entity, entities) : null;
      const cameraEntityId = kind === "camera" ? entity.entity_id : related?.entity_id;
      return {
        id: `live:${entity.entity_id}`,
        kind,
        severity: severityForEntity(entity, armed),
        title: getFriendlyName(entity),
        detail: formatEntityState(entity),
        entityId: entity.entity_id,
        cameraEntityId,
        timestamp: new Date(entity.last_changed),
        route: routeForKind(kind),
        actionLabel: actionLabelForKind(kind, Boolean(cameraEntityId)),
        source: "live" as const,
      };
    })
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.timestamp.getTime() - a.timestamp.getTime());
}

function severityRank(s: AlertSeverity): number {
  if (s === "critical") return 3;
  if (s === "warning") return 2;
  return 1;
}

function logbookKind(entry: HALogbookEntry): AlertKind {
  const msg = `${entry.message} ${entry.name} ${entry.entity_id || ""}`.toLowerCase();
  if (/camera|snapshot|image|record/.test(msg)) return "camera";
  if (/motion|occupancy|person|detected/.test(msg)) return "motion";
  if (/door|window|garage|opened|closed/.test(msg)) return "door";
  if (/alarm|breach|trigger/.test(msg)) return "breach";
  if (/lock|unlock/.test(msg)) return "lock";
  if (/tamper|smoke|gas/.test(msg)) return "tamper";
  return "event";
}

export function buildLogbookAlerts(entries: HALogbookEntry[], entities: HAEntity[]): ArgusAlert[] {
  const seen = new Set<string>();
  const out: ArgusAlert[] = [];

  for (const entry of entries) {
    if (!LOG_SECURITY_RE.test(`${entry.message} ${entry.name} ${entry.entity_id || ""}`)) continue;

    const entity = entry.entity_id ? entities.find((x) => x.entity_id === entry.entity_id) : undefined;
    const kind = entity ? alertKindForEntity(entity) : logbookKind(entry);
    const related = entity ? findRelatedCamera(entity, entities) : null;
    const cameraEntityId =
      kind === "camera" && entry.entity_id?.startsWith("camera.")
        ? entry.entity_id
        : related?.entity_id;

    const id = `log:${entry.when}:${entry.entity_id || entry.message}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      kind,
      severity: "info",
      title: entry.name || entry.entity_id || "Security event",
      detail: entry.message,
      entityId: entry.entity_id,
      cameraEntityId,
      timestamp: new Date(entry.when),
      route: routeForKind(kind),
      actionLabel: cameraEntityId ? "View capture" : "View history",
      source: "logbook",
    });
  }

  return out.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function mergeAlerts(live: ArgusAlert[], logbook: ArgusAlert[], maxLogbook = 12): ArgusAlert[] {
  const liveEntityIds = new Set(live.map((a) => a.entityId).filter(Boolean));
  const recentLog = logbook.filter((a) => !a.entityId || !liveEntityIds.has(a.entityId)).slice(0, maxLogbook);
  return [...live, ...recentLog];
}

export function countBySeverity(alerts: ArgusAlert[]): { critical: number; warning: number; info: number } {
  return alerts.reduce(
    (acc, a) => {
      acc[a.severity] += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 },
  );
}

export function alertIcon(kind: AlertKind): string {
  switch (kind) {
    case "breach":
      return "bi-shield-exclamation";
    case "motion":
      return "bi-person-walking";
    case "door":
      return "bi-door-open";
    case "camera":
      return "bi-camera-video-fill";
    case "lock":
      return "bi-unlock-fill";
    case "tamper":
      return "bi-exclamation-octagon-fill";
    default:
      return "bi-broadcast";
  }
}
