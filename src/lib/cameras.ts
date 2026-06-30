import { resolveHaFetchUrl } from "./haUrl";
import type { HAEntity } from "../types";

/** Stored in preferences to disable a dashboard camera slot. */
export const CAMERA_SLOT_NONE = "none";

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
  return `${base}?token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
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

/** Check whether HA exposes an MJPEG stream for this camera (via ARGUS proxy). */
export async function probeCameraStream(
  haUrl: string,
  entityId: string,
  token: string,
): Promise<boolean> {
  const url = resolveHaFetchUrl(haUrl, cameraPath("stream", entityId));
  const ctrl = new AbortController();
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: ctrl.signal,
    });
    const ct = res.headers.get("content-type") ?? "";
    ctrl.abort();
    return res.ok && ct.includes("multipart");
  } catch {
    ctrl.abort();
    return false;
  }
}

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
