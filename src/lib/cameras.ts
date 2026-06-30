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
  return `/api/${route}/${entityId}`;
}

/** Live MJPEG via HA — one stream to the camera (no snapshot polling). */
export function haCameraStreamUrl(haUrl: string, entityId: string, token: string): string {
  return `${resolveHaFetchUrl(haUrl, cameraPath("stream", entityId))}?token=${encodeURIComponent(token)}`;
}

/** Single still frame — use sparingly (each call hits the camera still-image URL). */
export function haCameraSnapshotUrl(
  haUrl: string,
  entityId: string,
  token: string,
  cacheBust?: number,
): string {
  const t = cacheBust ?? Date.now();
  return `${resolveHaFetchUrl(haUrl, cameraPath("snapshot", entityId))}?token=${encodeURIComponent(token)}&t=${t}`;
}

/** Fetch one JPEG snapshot with Bearer auth (works even when img+token query fails). */
export async function fetchCameraSnapshot(
  haUrl: string,
  entityId: string,
  token: string,
): Promise<string | null> {
  const url = resolveHaFetchUrl(haUrl, cameraPath("snapshot", entityId));
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("image")) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** Quick check whether HA can reach the camera still-image endpoint. */
export async function probeCameraSnapshot(
  haUrl: string,
  entityId: string,
  token: string,
): Promise<boolean> {
  const url = resolveHaFetchUrl(haUrl, cameraPath("snapshot", entityId));
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
