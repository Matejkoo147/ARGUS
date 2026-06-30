import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHA } from "../context/HAContext";
import { fetchCameraSnapshot, getCameraDisplayLabel, haCameraStreamUrl } from "../lib/cameras";
import { prefersNativeMjpegImg, startHaMjpegStream, streamFailTimeoutMs } from "../lib/mjpegStream";
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
type StreamMethod = "img" | "fetch";

const SNAPSHOT_MS = 3000;
const IMG_STREAM_RETRIES = 3;

function initialStreamMethod(): StreamMethod {
  return prefersNativeMjpegImg() ? "img" : "fetch";
}

export function CameraFeed({ entity, haUrl, token, label, slot }: CameraFeedProps) {
  const { entityLocations } = useHA();
  const [mode, setMode] = useState<FeedMode>("stream");
  const [streamMethod, setStreamMethod] = useState<StreamMethod>(initialStreamMethod);
  const [streamAttempt, setStreamAttempt] = useState(0);
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [errorDetail, setErrorDetail] = useState("");
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);
  const nativeFailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nativeStreamUrl = useMemo(() => {
    if (!entity || !haUrl || !token) return null;
    return `${haCameraStreamUrl(haUrl, entity.entity_id, token)}&_r=${streamAttempt}`;
  }, [entity?.entity_id, haUrl, token, streamAttempt]);

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

  const tryFetchStream = useCallback((reason: string) => {
    console.warn("[ARGUS] camera img stream failed, trying fetch:", entity?.entity_id, reason);
    clearNativeFailTimer();
    setStreamMethod("fetch");
    setStreamAttempt(0);
    setStatus("loading");
    setFrameSrc(null);
    revokeBlob();
  }, [entity?.entity_id, clearNativeFailTimer, revokeBlob]);

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
    setStreamMethod(initialStreamMethod());
    setStreamAttempt(0);
    setStatus("loading");
    setErrorDetail("");
    setFrameSrc(null);
    revokeBlob();
  }, [entity?.entity_id, haUrl, token, revokeBlob]);

  // iOS: native MJPEG via img (Safari renders multipart/x-mixed-replace).
  useEffect(() => {
    if (mode !== "stream" || streamMethod !== "img" || !entity || !nativeStreamUrl) return;

    clearNativeFailTimer();
    nativeFailTimer.current = setTimeout(
      () => tryFetchStream("no frames received"),
      streamFailTimeoutMs(),
    );

    return clearNativeFailTimer;
  }, [mode, streamMethod, entity?.entity_id, nativeStreamUrl, tryFetchStream, clearNativeFailTimer]);

  // fetch + Bearer (desktop primary; iOS fallback after img).
  useEffect(() => {
    if (mode !== "stream" || streamMethod !== "fetch" || !entity || !haUrl || !token) return;

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
  }, [mode, streamMethod, entity?.entity_id, haUrl, token, revokeBlob, switchToSnapshot]);

  useEffect(() => {
    if (mode !== "snapshot" || !entity || !haUrl || !token) return;

    void loadSnapshot();
    const id = setInterval(() => void loadSnapshot(), SNAPSHOT_MS);
    return () => clearInterval(id);
  }, [mode, entity?.entity_id, haUrl, token, loadSnapshot]);

  useEffect(() => {
    if (mode !== "snapshot" || !entity || !haUrl || !token) return;

    const id = setInterval(() => {
      setMode("stream");
      setStreamMethod(initialStreamMethod());
      setStreamAttempt(0);
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
  const useImgStream = mode === "stream" && streamMethod === "img" && nativeStreamUrl;
  const imgSrc = useImgStream ? nativeStreamUrl : frameSrc;

  const onNativeStreamLoad = () => {
    clearNativeFailTimer();
    setStatus("ok");
  };

  const onNativeStreamError = () => {
    clearNativeFailTimer();
    if (streamAttempt + 1 < IMG_STREAM_RETRIES) {
      setStreamAttempt((n) => n + 1);
      setStatus("loading");
      return;
    }
    tryFetchStream("img stream failed");
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
              <div className="camera-feed-loading">
                {streamMethod === "img" ? "Connecting live stream…" : "Connecting live stream…"}
              </div>
            )}
            <img
              key={useImgStream ? `${entity.entity_id}-img-${streamAttempt}` : frameSrc}
              className="camera-feed"
              src={imgSrc}
              alt={displayName}
              onLoad={useImgStream ? onNativeStreamLoad : undefined}
              onError={useImgStream ? onNativeStreamError : undefined}
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
