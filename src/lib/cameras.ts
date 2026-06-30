import { resolveHaFetchUrl } from "./haUrl";
import type { HAEntity } from "../types";
import { getFriendlyName } from "../types";

/** Stored in preferences to disable a dashboard camera slot. */
export const CAMERA_SLOT_NONE = "none";

const IP_LIKE = /^\d{1,3}(?:[._]\d{1,3}){3}$/;

function isIpLike(value: string): boolean {
  return IP_LIKE.test(value) || IP_LIKE.test(value.replace(/\./g, "_"));
}

/** Pull IPv4 from entity_id (camera.192_168_0_111) or friendly name. */
export function extractCameraIp(entity: HAEntity): string | null {
  const slug = entity.entity_id.split(".")[1] ?? "";
  if (IP_LIKE.test(slug)) return slug.replace(/_/g, ".");

  const fn = entity.attributes.friendly_name;
  if (typeof fn === "string" && IP_LIKE.test(fn)) return fn.replace(/_/g, ".");

  for (const key of ["still_image_url", "stream_source"] as const) {
    const url = entity.attributes[key];
    if (typeof url !== "string") continue;
    const m = url.match(/https?:\/\/(\d{1,3}(?:\.\d{1,3}){3})/);
    if (m) return m[1];
  }

  return null;
}

/** Display label: HA area/room name + camera IP, e.g. "Kuchyňa - 192.168.0.111". */
export function getCameraDisplayLabel(
  entity: HAEntity,
  entityAreas: Record<string, string>,
  registryNames: Record<string, string> = {},
): string {
  const ip = extractCameraIp(entity);
  const friendly = getFriendlyName(entity);
  const area =
    entityAreas[entity.entity_id] ||
    (typeof entity.attributes.area === "string" ? entity.attributes.area : null);
  const regName = registryNames[entity.entity_id];

  const location =
    area ||
    (regName && !isIpLike(regName) ? regName : null) ||
    (friendly && !isIpLike(friendly) ? friendly : null);

  if (location && ip) return `${location} - ${ip}`;
  if (location) return location;
  if (ip) return ip;
  return friendly;
}

export function resolveDashboardCamera(
  pref: string,
  cameras: HAEntity[],
  autoIndex: number,
): HAEntity | null {
  if (pref === CAMERA_SLOT_NONE) return null;
  if (pref) {
    const match = cameras.find((c) => c.entity_id === pref);
    return match ?? null;
  }
  return cameras[autoIndex] ?? null;
}

function cameraPath(kind: "stream" | "snapshot", entityId: string): string {
  const route = kind === "stream" ? "camera_proxy_stream" : "camera_proxy";
  return `/api/${route}/${encodeURIComponent(entityId)}`;
}

/** Live MJPEG via HA (browser img — needs nginx proxy_buffering off). */
export function haCameraStreamUrl(haUrl: string, entityId: string, token: string): string {
  const base = resolveHaFetchUrl(haUrl, cameraPath("stream", entityId));
  const qs = `token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
  const relative = `${base}?${qs}`;
  if (typeof window === "undefined") return relative;
  return relative.startsWith("http") ? relative : `${window.location.origin}${relative}`;
}

/** Single still frame URL (img src — less reliable than fetch with Bearer). */
export function haCameraSnapshotUrl(
  haUrl: string,
  entityId: string,
  token: string,
  cacheBust?: number,
): string {
  const t = cacheBust ?? Date.now();
  const base = resolveHaFetchUrl(haUrl, cameraPath("snapshot", entityId));
  return `${base}?token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}&t=${t}`;
}

/** HA entity_picture path from websocket (signed URL when available). */
export function haEntityPictureUrl(haUrl: string, entity: HAEntity): string | null {
  const pic = entity.attributes.entity_picture;
  if (typeof pic !== "string" || !pic) return null;
  const q = pic.indexOf("?");
  const path = q >= 0 ? pic.slice(0, q) : pic;
  const query = q >= 0 ? pic.slice(q + 1) : "";
  const base = resolveHaFetchUrl(haUrl, path.startsWith("/") ? path : `/${path}`);
  return query ? `${base}?${query}` : base;
}

export type CameraFetchResult = { ok: true; url: string } | { ok: false; error: string };

/** Fetch one JPEG with Bearer auth — same method HA frontend uses. */
export async function fetchCameraSnapshot(
  haUrl: string,
  entityId: string,
  token: string,
  entity?: HAEntity | null,
): Promise<CameraFetchResult> {
  const pictureUrl = entity ? haEntityPictureUrl(haUrl, entity) : null;
  const candidates = [
    pictureUrl,
    resolveHaFetchUrl(haUrl, cameraPath("snapshot", entityId)),
  ].filter(Boolean) as string[];

  let lastError = "No response";

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const blob = await res.blob();
      if (blob.size < 256) {
        lastError = "Empty image";
        continue;
      }
      return { ok: true, url: URL.createObjectURL(blob) };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Network error";
    }
  }

  return { ok: false, error: lastError };
}
