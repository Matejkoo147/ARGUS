import { getCameraDisplayLabel, extractCameraIp } from "./cameras";
import { isBleTagEntity, isMotionEntity, isPerimeterEntity, pickWeatherSnapshot, type ArmAction } from "./homeSensors";
import type { EntityLocationMaps, HAEntity, SecuritySummary } from "../types";
import { getDomain, getFriendlyName, isOnState } from "../types";

export interface VoiceCommandContext {
  entities: HAEntity[];
  summary: SecuritySummary;
  entityLocations: EntityLocationMaps;
  alarmCode?: string;
  callService: (
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: { entity_id?: string | string[] }
  ) => Promise<void>;
}

function alarmPhrase(state: string): string {
  switch (state) {
    case "disarmed":
      return "disarmed — the perimeter is open";
    case "armed_away":
      return "armed away — full perimeter active";
    case "armed_home":
      return "armed home — partial zones active";
    case "armed_night":
      return "armed night mode";
    case "triggered":
      return "TRIGGERED — possible breach";
    case "pending":
      return "pending — entry delay running";
    default:
      return state.replace(/_/g, " ");
  }
}

function findEntityByNameHint(entities: HAEntity[], hint: string, domains?: string[]): HAEntity | null {
  const q = hint.toLowerCase().trim();
  if (!q) return null;
  const pool = domains ? entities.filter((e) => domains.includes(getDomain(e.entity_id))) : entities;
  return (
    pool.find((e) => getFriendlyName(e).toLowerCase().includes(q)) ??
    pool.find((e) => e.entity_id.toLowerCase().includes(q.replace(/\s+/g, "_"))) ??
    null
  );
}

function describeMotion(ctx: VoiceCommandContext): string {
  const active = ctx.entities.filter((e) => isMotionEntity(e) && isOnState(e.state));
  if (!active.length) return "All clear — no motion or occupancy detected.";
  const names = active.slice(0, 5).map((e) => getFriendlyName(e)).join(", ");
  const extra = active.length > 5 ? ` and ${active.length - 5} more` : "";
  return `Motion detected: ${names}${extra}.`;
}

function describeDoors(ctx: VoiceCommandContext): string {
  const open = ctx.entities.filter((e) => isPerimeterEntity(e) && (isOnState(e.state) || e.state === "open"));
  if (!open.length) return "All doors and windows look closed.";
  const names = open.map((e) => getFriendlyName(e)).join(", ");
  return `${open.length} opening${open.length > 1 ? "s" : ""} open: ${names}.`;
}

function describeCameras(ctx: VoiceCommandContext): string {
  const cams = ctx.entities.filter((e) => getDomain(e.entity_id) === "camera");
  if (!cams.length) {
    return "I don't see any cameras in Home Assistant yet. Add a Generic Camera or ReoLink integration first.";
  }

  return cams
    .map((cam) => {
      const label = getCameraDisplayLabel(cam, ctx.entityLocations.areas, ctx.entityLocations.registryNames);
      const area = ctx.entityLocations.areas[cam.entity_id];
      const ip = extractCameraIp(cam);
      if (area && ip) return `The ${area} camera is at ${ip} (${label})`;
      if (area) return `The camera in ${area} (${label})`;
      return label;
    })
    .join(". ");
}

function describeCameraLocation(ctx: VoiceCommandContext): string {
  const cams = ctx.entities.filter((e) => getDomain(e.entity_id) === "camera");
  if (!cams.length) return "There aren't any cameras set up in Home Assistant yet.";
  if (cams.length === 1) {
    const cam = cams[0];
    const area = ctx.entityLocations.areas[cam.entity_id];
    const ip = extractCameraIp(cam);
    if (area && ip) {
      return `Your camera is in ${area}, streaming from ${ip}. Open the Home page in ARGUS to watch the live feed.`;
    }
    if (area) return `Your camera is assigned to ${area}. You can view it on the dashboard.`;
    const label = getCameraDisplayLabel(cam, ctx.entityLocations.areas, ctx.entityLocations.registryNames);
    return `You have one camera (${label}). Set its area in Home Assistant for a friendlier name.`;
  }
  return `${describeCameras(ctx)}. Open the Cameras page to pick a feed.`;
}

function describeWeather(ctx: VoiceCommandContext): string {
  const snap = pickWeatherSnapshot(ctx.entities);
  if (!snap) return "No weather or temperature sensor found in Home Assistant.";
  const parts = [`${snap.location}: ${snap.label}`];
  if (snap.temp) parts.push(snap.temp);
  if (snap.humidity) parts.push(`humidity ${snap.humidity}`);
  return parts.join(", ") + ".";
}

function describeCo2(ctx: VoiceCommandContext): string {
  const sensors = ctx.entities.filter(
    (e) => getDomain(e.entity_id) === "sensor" && (e.attributes.device_class as string) === "carbon_dioxide",
  );
  if (!sensors.length) return "No CO₂ sensors configured. Add an air quality monitor in Home Assistant.";
  return sensors
    .map((e) => `${getFriendlyName(e)}: ${e.state}${(e.attributes.unit_of_measurement as string) || " ppm"}`)
    .join(". ");
}

function describeBleTags(ctx: VoiceCommandContext): string {
  const tags = ctx.entities.filter(isBleTagEntity);
  if (!tags.length) return "No BLE tags or trackers found.";
  const moving = tags.filter((e) => e.state === "moving" || e.state === "not_home");
  if (!moving.length) return `You have ${tags.length} BLE tag${tags.length > 1 ? "s" : ""}. All appear stationary.`;
  const names = moving.slice(0, 4).map((e) => `${getFriendlyName(e)} (${e.state})`).join(", ");
  return `BLE tags: ${names}.`;
}

function describeStatus(ctx: VoiceCommandContext): string {
  const { summary } = ctx;
  const parts: string[] = [];

  parts.push(`Alarm is ${alarmPhrase(summary.alarmState)}.`);
  parts.push(describeMotion(ctx).replace(/\.$/, ""));
  parts.push(describeDoors(ctx).replace(/\.$/, ""));
  if (summary.cameraCount > 0) {
    parts.push(`${summary.cameraCount} camera${summary.cameraCount > 1 ? "s" : ""} online.`);
  }
  const weather = pickWeatherSnapshot(ctx.entities);
  if (weather?.temp) parts.push(`Temperature ${weather.temp}.`);
  parts.push(`Sensor health is ${summary.systemHealth}%.`);
  return parts.join(" ");
}

/** Rich system prompt for Ollama — includes rooms, cameras, and live sensor state. */
export function buildArgusSystemPrompt(
  modelName: string,
  ctx: Pick<VoiceCommandContext, "entities" | "summary" | "entityLocations">,
): string {
  const { entities, summary, entityLocations } = ctx;
  const cameras = entities.filter((e) => getDomain(e.entity_id) === "camera");
  const cameraBlock =
    cameras.length === 0
      ? "  (none configured)"
      : cameras
          .map((c) => {
            const label = getCameraDisplayLabel(c, entityLocations.areas, entityLocations.registryNames);
            const area = entityLocations.areas[c.entity_id] || "no area assigned";
            return `  - ${label} | HA area: ${area} | state: ${c.state}`;
          })
          .join("\n");

  const envSensors = entities
    .filter((e) => {
      const dc = (e.attributes.device_class as string) || "";
      return getDomain(e.entity_id) === "sensor" && ["temperature", "humidity", "carbon_dioxide", "pressure"].includes(dc);
    })
    .slice(0, 12)
    .map((e) => `  - ${getFriendlyName(e)}: ${e.state}${(e.attributes.unit_of_measurement as string) || ""}`)
    .join("\n");

  const triggered = entities
    .filter((e) => getDomain(e.entity_id) === "binary_sensor" && isOnState(e.state))
    .slice(0, 10)
    .map((e) => `  - ${getFriendlyName(e)}: ${e.state}`)
    .join("\n");

  const weather = pickWeatherSnapshot(entities);

  return `You are ARGUS, a friendly and concise home security assistant. You run locally as Ollama model "${modelName}".

STYLE:
- Speak naturally, like a calm security operator — not a database dump.
- Use 2–4 short sentences unless the user asks for detail.
- Use room names from Home Assistant (e.g. Kuchyňa = kitchen) when talking about cameras.
- Never invent devices or rooms not listed below.
- You cannot arm/disarm unless the user explicitly says "arm away", "arm home", or "disarm".

LIVE HOME STATE:
- Alarm: ${summary.alarmState}
- Motion sensors active: ${summary.motionActive} of ${summary.motionCount}
- Doors/windows open: ${summary.doorOpen}
- Sensor health: ${summary.systemHealth}%
- Weather: ${weather ? `${weather.location} ${weather.temp ?? ""} ${weather.humidity ?? ""}` : "n/a"}
- Cameras (${summary.cameraCount}):
${cameraBlock}
${envSensors ? `- Environment:\n${envSensors}` : ""}
${triggered ? `- Triggered sensors:\n${triggered}` : "- No sensors currently triggered."}

Answer using the facts above. For camera location questions, use the HA area and IP from the camera list.`;
}

/** Detect arm/disarm voice intent — execution requires UI confirmation in VoicePage. */
export function parseVoiceArmAction(text: string): ArmAction | null {
  const lower = text.toLowerCase().replace(/^(hey\s+)?(argus|argo|arkus)\s*,?\s*/i, "").trim();
  if (lower.includes("arm away")) return "arm_away";
  if (lower.includes("arm home")) return "arm_home";
  if (/\bdisarm\b/.test(lower)) return "disarm";
  return null;
}

export const VOICE_ARM_REPLIES: Record<ArmAction, string> = {
  arm_away: "Arming away now. Perimeter secured — I'll watch the sensors.",
  arm_home: "Arming home mode. Interior motion may stay relaxed while you're inside.",
  disarm: "Disarmed. Welcome home — perimeter is open.",
};

/**
 * Instant HA-backed replies for clear commands. Returns null → use Ollama.
 */
export async function runArgusLocalCommand(
  text: string,
  ctx: VoiceCommandContext,
): Promise<string | null> {
  const lower = text.toLowerCase().replace(/^(hey\s+)?(argus|argo|arkus)\s*,?\s*/i, "").trim();

  if (/\b(status|how'?s the perimeter|system status|what'?s happening|report)\b/.test(lower)) {
    return describeStatus(ctx);
  }

  if (parseVoiceArmAction(text)) {
    return null;
  }

  if (/\b(where|location|located|which room|what room|area)\b/.test(lower) && /\b(cam|camera|feed)\b/.test(lower)) {
    return describeCameraLocation(ctx);
  }

  if (/\b(how many|list|show|name)\b.*\bcameras?\b/.test(lower) || /\bcameras?\s+(list|names?)\b/.test(lower)) {
    const cams = ctx.entities.filter((e) => getDomain(e.entity_id) === "camera");
    if (!cams.length) return "No cameras are configured yet.";
    return `You have ${cams.length} camera${cams.length > 1 ? "s" : ""}. ${describeCameras(ctx)}.`;
  }

  if (/\b(motion|movement|anyone there|someone there|occupancy)\b/.test(lower) && !lower.includes("model")) {
    return describeMotion(ctx);
  }

  if (/\b(door|window|opening|openings?)\b/.test(lower) && /\b(open|closed|status)\b/.test(lower)) {
    return describeDoors(ctx);
  }

  if (/\b(weather|temperature|temp|humidity|forecast)\b/.test(lower)) {
    return describeWeather(ctx);
  }

  if (/\b(co2|co₂|carbon|air quality)\b/.test(lower)) {
    return describeCo2(ctx);
  }

  if (/\b(ble|tag|tracker|keys|wallet)\b/.test(lower)) {
    return describeBleTags(ctx);
  }

  const turnOn = lower.match(/\bturn on\s+(.+)/);
  if (turnOn) {
    const target = findEntityByNameHint(ctx.entities, turnOn[1], ["light", "switch", "siren"]);
    if (target) {
      const domain = getDomain(target.entity_id);
      await ctx.callService(domain, "turn_on", {}, { entity_id: target.entity_id });
      return `Turning on ${getFriendlyName(target)}.`;
    }
    return `I couldn't find a light or switch matching "${turnOn[1]}".`;
  }

  const turnOff = lower.match(/\bturn off\s+(.+)/);
  if (turnOff) {
    const target = findEntityByNameHint(ctx.entities, turnOff[1], ["light", "switch", "siren"]);
    if (target) {
      const domain = getDomain(target.entity_id);
      await ctx.callService(domain, "turn_off", {}, { entity_id: target.entity_id });
      return `Turning off ${getFriendlyName(target)}.`;
    }
    return `I couldn't find a light or switch matching "${turnOff[1]}".`;
  }

  if (/\block\b/.test(lower) && !/\bunlock\b/.test(lower)) {
    const hint = lower.replace(/.*\block\b\s*/, "").trim() || lower;
    const target = findEntityByNameHint(ctx.entities, hint, ["lock"]);
    if (target) {
      await ctx.callService("lock", "lock", {}, { entity_id: target.entity_id });
      return `Locking ${getFriendlyName(target)}.`;
    }
  }

  if (/\bunlock\b/.test(lower)) {
    const hint = lower.replace(/.*\bunlock\b\s*/, "").trim() || lower;
    const target = findEntityByNameHint(ctx.entities, hint, ["lock"]);
    if (target) {
      await ctx.callService("lock", "unlock", {}, { entity_id: target.entity_id });
      return `Unlocking ${getFriendlyName(target)}.`;
    }
  }

  return null;
}
