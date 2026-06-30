import { getCameraDisplayLabel, extractCameraIp } from "./cameras";
import type { EntityLocationMaps, HAEntity, SecuritySummary } from "../types";
import { getDomain, getFriendlyName, isOnState } from "../types";

export interface VoiceCommandContext {
  entities: HAEntity[];
  summary: SecuritySummary;
  entityLocations: EntityLocationMaps;
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

function describeCameras(ctx: VoiceCommandContext): string {
  const cams = ctx.entities.filter((e) => getDomain(e.entity_id) === "camera");
  if (!cams.length) {
    return "I don't see any cameras in Home Assistant yet. Add your ESP32-CAM as a Generic Camera first.";
  }

  return cams
    .map((cam) => {
      const label = getCameraDisplayLabel(cam, ctx.entityLocations.areas, ctx.entityLocations.registryNames);
      const area = ctx.entityLocations.areas[cam.entity_id];
      const ip = extractCameraIp(cam);
      if (area && ip) {
        return `The ${area} camera is at ${ip} (${label})`;
      }
      if (area) {
        return `The camera in ${area} (${label})`;
      }
      return label;
    })
    .join(". ");
}

function describeCameraLocation(ctx: VoiceCommandContext): string {
  const cams = ctx.entities.filter((e) => getDomain(e.entity_id) === "camera");
  if (!cams.length) {
    return "There aren't any cameras set up in Home Assistant yet.";
  }
  if (cams.length === 1) {
    const cam = cams[0];
    const area = ctx.entityLocations.areas[cam.entity_id];
    const ip = extractCameraIp(cam);
    if (area && ip) {
      return `Your camera is in ${area}, streaming from ${ip}. Open the Home page in ARGUS to watch the live feed.`;
    }
    if (area) {
      return `Your camera is assigned to ${area}. You can view it on the dashboard.`;
    }
    const label = getCameraDisplayLabel(cam, ctx.entityLocations.areas, ctx.entityLocations.registryNames);
    return `You have one camera (${label}). I couldn't find a room assigned in Home Assistant — set its area under Settings → Devices.`;
  }
  return `${describeCameras(ctx)}. Open the Cameras page to pick a feed.`;
}

function describeStatus(ctx: VoiceCommandContext): string {
  const { summary } = ctx;
  const parts: string[] = [];

  parts.push(`Alarm is ${alarmPhrase(summary.alarmState)}.`);

  if (summary.motionActive > 0) {
    parts.push(`${summary.motionActive} motion sensor${summary.motionActive > 1 ? "s" : ""} active right now.`);
  } else {
    parts.push("No motion detected.");
  }

  if (summary.doorOpen > 0) {
    parts.push(`${summary.doorOpen} door or window open.`);
  } else {
    parts.push("All doors and windows look closed.");
  }

  if (summary.cameraCount > 0) {
    const cam = ctx.entities.find((e) => getDomain(e.entity_id) === "camera");
    const area = cam ? ctx.entityLocations.areas[cam.entity_id] : null;
    parts.push(
      area
        ? `${summary.cameraCount} camera online — ${area} feed is live.`
        : `${summary.cameraCount} camera${summary.cameraCount > 1 ? "s" : ""} online.`,
    );
  }

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

  const triggered = entities
    .filter((e) => getDomain(e.entity_id) === "binary_sensor" && isOnState(e.state))
    .slice(0, 10)
    .map((e) => `  - ${getFriendlyName(e)}: ${e.state}`)
    .join("\n");

  const openDoors = entities
    .filter((e) => {
      const dc = (e.attributes.device_class as string) || "";
      return getDomain(e.entity_id) === "binary_sensor" && ["door", "window", "garage_door"].includes(dc) && isOnState(e.state);
    })
    .map((e) => getFriendlyName(e))
    .join(", ");

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
- Doors/windows open: ${summary.doorOpen}${openDoors ? ` (${openDoors})` : ""}
- Sensor health: ${summary.systemHealth}%
- Cameras (${summary.cameraCount}):
${cameraBlock}
${triggered ? `- Triggered sensors:\n${triggered}` : "- No sensors currently triggered."}

Answer using the facts above. For camera location questions, use the HA area and IP from the camera list.`;
}

/**
 * Instant HA-backed replies for clear commands. Returns null → use Ollama.
 */
export async function runArgusLocalCommand(
  text: string,
  ctx: VoiceCommandContext,
): Promise<string | null> {
  const lower = text.toLowerCase().replace(/^(hey\s+)?(argus|argo)\s*,?\s*/i, "").trim();

  if (/\b(status|how'?s the perimeter|system status|what'?s happening)\b/.test(lower)) {
    return describeStatus(ctx);
  }

  if (lower.includes("arm away")) {
    const alarm = ctx.entities.find((e) => e.entity_id.startsWith("alarm_control_panel."));
    if (alarm) {
      await ctx.callService("alarm_control_panel", "arm_away", { code: "" }, { entity_id: alarm.entity_id });
      return "Arming away now. Perimeter secured — I'll watch the sensors.";
    }
    return "I can't arm away because there's no alarm panel in Home Assistant yet.";
  }

  if (lower.includes("arm home")) {
    const alarm = ctx.entities.find((e) => e.entity_id.startsWith("alarm_control_panel."));
    if (alarm) {
      await ctx.callService("alarm_control_panel", "arm_home", { code: "" }, { entity_id: alarm.entity_id });
      return "Arming home mode. Interior motion may stay relaxed while you're inside.";
    }
    return "No alarm panel found to arm.";
  }

  if (lower.includes("disarm")) {
    const alarm = ctx.entities.find((e) => e.entity_id.startsWith("alarm_control_panel."));
    if (alarm) {
      await ctx.callService("alarm_control_panel", "disarm", { code: "" }, { entity_id: alarm.entity_id });
      return "Disarmed. Welcome home — perimeter is open.";
    }
    return "No alarm panel found to disarm.";
  }

  if (/\b(where|location|located|which room|what room|area)\b/.test(lower) && /\b(cam|camera|feed)\b/.test(lower)) {
    return describeCameraLocation(ctx);
  }

  if (/\b(how many|list|show|name)\b.*\bcameras?\b/.test(lower) || /\bcameras?\s+(list|names?)\b/.test(lower)) {
    const cams = ctx.entities.filter((e) => getDomain(e.entity_id) === "camera");
    if (!cams.length) return "No cameras are configured yet.";
    return `You have ${cams.length} camera${cams.length > 1 ? "s" : ""}. ${describeCameras(ctx)}.`;
  }

  if (/\b(motion|movement|anyone there|someone there)\b/.test(lower) && !lower.includes("model")) {
    const active = ctx.entities.filter(
      (e) => getDomain(e.entity_id) === "binary_sensor" && isOnState(e.state),
    );
    if (!active.length) {
      return "All clear — no motion or door sensors are triggered right now.";
    }
    const names = active.slice(0, 5).map((e) => getFriendlyName(e)).join(", ");
    const extra = active.length > 5 ? ` and ${active.length - 5} more` : "";
    return `Something's active: ${names}${extra}. Check the dashboard for details.`;
  }

  return null;
}
