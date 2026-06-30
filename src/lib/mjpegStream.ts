import { resolveHaFetchUrl } from "./haUrl";

/** iOS Safari — prefer native MJPEG img; fetch fallback uses Bearer like snapshots. */
export function prefersNativeMjpegImg(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function streamFailTimeoutMs(): number {
  return prefersNativeMjpegImg() ? 25_000 : 15_000;
}

function appendBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (!a.length) return b;
  if (!b.length) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

/** Extract complete JPEG images (SOI..EOI) from a byte buffer. */
function extractJpegFrames(buf: Uint8Array): { frames: Uint8Array[]; rest: Uint8Array } {
  const frames: Uint8Array[] = [];
  let i = 0;

  while (i < buf.length - 1) {
    if (buf[i] !== 0xff || buf[i + 1] !== 0xd8) {
      i++;
      continue;
    }
    const start = i;
    i += 2;
    let end = -1;
    while (i < buf.length - 1) {
      if (buf[i] === 0xff && buf[i + 1] === 0xd9) {
        end = i + 2;
        break;
      }
      i++;
    }
    if (end === -1) {
      return { frames, rest: buf.slice(start) };
    }
    frames.push(buf.slice(start, end));
    i = end;
  }

  return { frames, rest: new Uint8Array(0) };
}

/**
 * Read HA camera_proxy_stream with Bearer auth and emit JPEG frames.
 * Works through the ARGUS /api/ha proxy (unlike img src + ?token=).
 */
export function startHaMjpegStream(
  haUrl: string,
  entityId: string,
  token: string,
  onFrame: (objectUrl: string) => void,
  onFail?: (reason: string) => void,
): () => void {
  const ctrl = new AbortController();
  const url = resolveHaFetchUrl(haUrl, `/api/camera_proxy_stream/${encodeURIComponent(entityId)}`);

  let lastUrl: string | null = null;
  let frameCount = 0;
  let failTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleFail = () => {
    if (failTimer) clearTimeout(failTimer);
    failTimer = setTimeout(() => {
      if (frameCount === 0) {
        ctrl.abort();
        onFail?.("no frames received");
      }
    }, streamFailTimeoutMs());
  };

  scheduleFail();

  void (async () => {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: ctrl.signal,
      });

      if (!res.ok) {
        onFail?.(`HTTP ${res.status}`);
        return;
      }
      if (!res.body) {
        onFail?.("empty response");
        return;
      }

      const reader = res.body.getReader();
      let pending = new Uint8Array(0) as Uint8Array;

      while (!ctrl.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value?.length) continue;

        pending = appendBytes(pending, value) as Uint8Array;
        const extracted = extractJpegFrames(pending);
        pending = new Uint8Array(extracted.rest) as Uint8Array;

        for (const frame of extracted.frames) {
          if (ctrl.signal.aborted) break;
          frameCount++;
          if (failTimer) clearTimeout(failTimer);
          failTimer = null;

          const blob = new Blob([new Uint8Array(frame)], { type: "image/jpeg" });
          const objectUrl = URL.createObjectURL(blob);
          if (lastUrl) URL.revokeObjectURL(lastUrl);
          lastUrl = objectUrl;
          onFrame(objectUrl);
        }
      }

      if (frameCount === 0 && !ctrl.signal.aborted) {
        onFail?.("stream closed");
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        onFail?.(e instanceof Error ? e.message : "stream error");
      }
    } finally {
      if (failTimer) clearTimeout(failTimer);
    }
  })();

  return () => {
    ctrl.abort();
    if (failTimer) clearTimeout(failTimer);
    if (lastUrl) URL.revokeObjectURL(lastUrl);
  };
}
