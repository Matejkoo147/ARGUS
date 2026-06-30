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

/** Live MJPEG via HA — one stream to the camera (no snapshot polling). */
export function haCameraStreamUrl(haUrl: string, entityId: string, token: string): string {
  return `${resolveHaFetchUrl(haUrl, `/api/camera_proxy_stream/${entityId}`)}?token=${encodeURIComponent(token)}`;
}

/** Single still frame — use sparingly (each call hits the camera still-image URL). */
export function haCameraSnapshotUrl(
  haUrl: string,
  entityId: string,
  token: string,
  cacheBust?: number,
): string {
  const t = cacheBust ?? Date.now();
  return `${resolveHaFetchUrl(haUrl, `/api/camera_proxy/${entityId}`)}?token=${encodeURIComponent(token)}&t=${t}`;
}
