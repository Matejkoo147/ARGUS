import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHA } from "../context/HAContext";
import { fetchCameraSnapshot, getCameraDisplayLabel, haCameraStreamUrl } from "../lib/cameras";
import { prefersNativeMjpegImg, startHaMjpegStream } from "../lib/mjpegStream";
import type { HAEntity } from "../types";

interface CameraFeedProps {
  entity: HAEntity | null;
  haUrl: string;
  token: string;
  label: string;
  slot: 1 | 2;
}

type FeedMode = "stream" | "snapshot";
type FeedStatus = "loading" | "ok" | "error";

const SNAPSHOT_MS = 3000;
const STREAM_FAIL_MS = 15000;

export function CameraFeed({ entity, haUrl, token, label, slot }: CameraFeedProps) {
  const { entityLocations } = useHA();
  const useNativeStream = useMemo(() => prefersNativeMjpegImg(), []);
  const [mode, setMode] = useState<FeedMode>("stream");
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [errorDetail, setErrorDetail] = useState("");
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);
  const nativeFailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nativeStreamUrl =
    entity && haUrl && token ? haCameraStreamUrl(haUrl, entity.entity_id, token) : null;

  const clearNativeFailTimer = useCallback(() => {
    if (nativeFailTimer.current) {
      clearTimeout(nativeFailTimer.current);
      nativeFailTimer.current = null;
    }
  }, []);

  const revokeBlob = useCallback(() => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
  }, []);

  const switchToSnapshot = useCallback((reason?: string) => {
    if (reason) console.warn("[ARGUS] camera stream fallback:", entity?.entity_id, reason);
    clearNativeFailTimer();
    setMode("snapshot");
    setStatus("loading");
  }, [entity?.entity_id, clearNativeFailTimer]);

  const loadSnapshot = useCallback(async () => {
    if (!entity || !haUrl || !token) return;
    const result = await fetchCameraSnapshot(haUrl, entity.entity_id, token, entity);
    if (!result.ok) {
      setStatus("error");
      setErrorDetail(result.error);
      return;
    }
    revokeBlob();
    blobRef.current = result.url;
    setFrameSrc(result.url);
    setStatus("ok");
  }, [entity, haUrl, token, revokeBlob]);

  useEffect(() => {
    if (!entity || !haUrl || !token) return;

    setMode("stream");
    setStatus("loading");
    setErrorDetail("");
    setFrameSrc(null);
    revokeBlob();
  }, [entity?.entity_id, haUrl, token, revokeBlob]);

  // iOS: native MJPEG via img src (Safari handles multipart/x-mixed-replace).
  useEffect(() => {
    if (!useNativeStream || mode !== "stream" || !entity || !nativeStreamUrl) return;

    clearNativeFailTimer();
    nativeFailTimer.current = setTimeout(
      () => switchToSnapshot("no frames received"),
      STREAM_FAIL_MS,
    );

    return clearNativeFailTimer;
  }, [useNativeStream, mode, entity?.entity_id, nativeStreamUrl, switchToSnapshot, clearNativeFailTimer]);

  // Desktop: live stream via fetch + Bearer auth.
  useEffect(() => {
    if (useNativeStream || mode !== "stream" || !entity || !haUrl || !token) return;

    const stop = startHaMjpegStream(
      haUrl,
      entity.entity_id,
      token,
      (url) => {
        revokeBlob();
        blobRef.current = url;
        setFrameSrc(url);
        setStatus("ok");
      },
      (reason) => switchToSnapshot(reason),
    );

    return () => stop();
  }, [useNativeStream, mode, entity?.entity_id, haUrl, token, revokeBlob, switchToSnapshot]);

  // Snapshot polling only when stream fails.
  useEffect(() => {
    if (mode !== "snapshot" || !entity || !haUrl || !token) return;

    void loadSnapshot();
    const id = setInterval(() => void loadSnapshot(), SNAPSHOT_MS);
    return () => clearInterval(id);
  }, [mode, entity?.entity_id, haUrl, token, loadSnapshot]);

  // Retry stream periodically while on snapshot fallback.
  useEffect(() => {
    if (mode !== "snapshot" || !entity || !haUrl || !token) return;

    const id = setInterval(() => {
      setMode("stream");
      setStatus("loading");
    }, 45000);

    return () => clearInterval(id);
  }, [mode, entity?.entity_id, haUrl, token]);

  useEffect(() => () => {
    revokeBlob();
    clearNativeFailTimer();
  }, [revokeBlob, clearNativeFailTimer]);

  if (!entity) {
    return (
      <div className="card camera-slot">
        <div className="card-header">
          <i className="bi bi-camera-video" /> CAM {slot} — {label}
        </div>
        <div className="card-body camera-slot-body">
          <div className="camera-placeholder">
            <i className="bi bi-camera-video-off camera-placeholder-icon" aria-hidden />
            <div className="camera-placeholder-title">No camera assigned</div>
            <div className="camera-placeholder-hint">Settings → Home cameras → set slot or None</div>
          </div>
        </div>
      </div>
    );
  }

  const displayName = getCameraDisplayLabel(
    entity,
    entityLocations.areas,
    entityLocations.registryNames,
  );

  if (!haUrl || !token) {
    return (
      <div className="card camera-slot">
        <div className="card-header">
          <i className="bi bi-camera-video-fill" /> {displayName}
        </div>
        <div className="card-body camera-slot-body">
          <div className="camera-placeholder">
            <div className="camera-placeholder-title">Not signed in</div>
            <div className="camera-placeholder-hint">Settings → Save &amp; Connect with HA token</div>
          </div>
        </div>
      </div>
    );
  }

  const live = entity.state === "idle" || entity.state === "streaming";
  const modeLabel = mode === "stream" ? "STREAM" : "SNAP";
  const showNativeStream = mode === "stream" && useNativeStream && nativeStreamUrl;
  const imgSrc = showNativeStream ? nativeStreamUrl : frameSrc;

  const onNativeStreamLoad = () => {
    clearNativeFailTimer();
    setStatus("ok");
  };

  const onNativeStreamError = () => {
    switchToSnapshot("img stream failed");
  };

  return (
    <div className="card camera-slot">
      <div className="card-header">
        <i className="bi bi-camera-video-fill" /> {displayName}
        <span className="camera-feed-badges">
          <span className="cam-mode">{modeLabel}</span>
          <span className={`cam-live ${live ? "on" : ""}`}>LIVE</span>
        </span>
      </div>
      <div className="card-body camera-feed-body">
        {status === "error" ? (
          <div className="camera-slot-body">
            <div className="camera-placeholder">
              <i className="bi bi-exclamation-triangle camera-placeholder-icon" aria-hidden />
              <div className="camera-placeholder-title">Camera unreachable ({errorDetail})</div>
              <div className="camera-placeholder-hint">
                In HA → Generic Camera: still <code>/capture</code>, stream <code>/stream</code>.
              </div>
            </div>
          </div>
        ) : imgSrc ? (
          <>
            {status === "loading" && mode === "stream" && (
              <div className="camera-feed-loading">Connecting live stream…</div>
            )}
            <img
              key={showNativeStream ? `${entity.entity_id}-stream` : frameSrc}
              className="camera-feed"
              src={imgSrc}
              alt={displayName}
              onLoad={showNativeStream ? onNativeStreamLoad : undefined}
              onError={showNativeStream ? onNativeStreamError : undefined}
            />
          </>
        ) : (
          <div className="camera-feed-loading">
            {mode === "stream" ? "Connecting live stream…" : "Loading snapshot…"}
          </div>
        )}
      </div>
    </div>
  );
}
