import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCameraSnapshot,
  haCameraStreamUrl,
  probeCameraStream,
} from "../lib/cameras";
import type { HAEntity } from "../types";
import { getFriendlyName } from "../types";

interface CameraFeedProps {
  entity: HAEntity | null;
  haUrl: string;
  token: string;
  label: string;
  slot: 1 | 2;
}

type FeedMode = "stream" | "snapshot";
type FeedStatus = "loading" | "ok" | "error";

const SNAPSHOT_MS = 2500;
const STREAM_STALL_MS = 7000;

export function CameraFeed({ entity, haUrl, token, label, slot }: CameraFeedProps) {
  const [mode, setMode] = useState<FeedMode>("stream");
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [errorDetail, setErrorDetail] = useState("");
  const [snapshotSrc, setSnapshotSrc] = useState<string | null>(null);
  const streamRef = useRef<HTMLImageElement>(null);
  const blobRef = useRef<string | null>(null);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revokeBlob = useCallback(() => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
  }, []);

  const switchToSnapshot = useCallback(() => {
    setMode("snapshot");
    setStatus("loading");
  }, []);

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
    setSnapshotSrc(result.url);
    setStatus("ok");
  }, [entity, haUrl, token, revokeBlob]);

  // Prefer live stream; fall back to snapshots only when stream is unavailable.
  useEffect(() => {
    if (!entity || !haUrl || !token) return;

    setStatus("loading");
    setErrorDetail("");
    setSnapshotSrc(null);
    revokeBlob();

    let cancelled = false;

    void (async () => {
      const streamOk = await probeCameraStream(haUrl, entity.entity_id, token);
      if (cancelled) return;

      if (streamOk) {
        setMode("stream");
        return;
      }

      setMode("snapshot");
      await loadSnapshot();
    })();

    return () => {
      cancelled = true;
      revokeBlob();
    };
  }, [entity?.entity_id, haUrl, token, loadSnapshot, revokeBlob]);

  // Snapshot polling only while in snapshot mode (never competes with ESP32 stream).
  useEffect(() => {
    if (!entity || mode !== "snapshot" || !haUrl || !token) return;

    const id = setInterval(() => void loadSnapshot(), SNAPSHOT_MS);
    return () => clearInterval(id);
  }, [entity?.entity_id, mode, haUrl, token, loadSnapshot]);

  // If stream img never decodes a frame, fall back to snapshots.
  useEffect(() => {
    if (!entity || mode !== "stream") return;

    if (stallTimer.current) clearTimeout(stallTimer.current);
    stallTimer.current = setTimeout(() => {
      const img = streamRef.current;
      if (!img || img.naturalWidth === 0) switchToSnapshot();
    }, STREAM_STALL_MS);

    return () => {
      if (stallTimer.current) clearTimeout(stallTimer.current);
    };
  }, [entity?.entity_id, mode, switchToSnapshot]);

  useEffect(() => () => revokeBlob(), [revokeBlob]);

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

  if (!haUrl || !token) {
    return (
      <div className="card camera-slot">
        <div className="card-header">
          <i className="bi bi-camera-video-fill" /> {getFriendlyName(entity)}
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

  const streamSrc = haCameraStreamUrl(haUrl, entity.entity_id, token);
  const live = entity.state === "idle" || entity.state === "streaming";
  const modeLabel = mode === "stream" ? "STREAM" : "SNAP";

  return (
    <div className="card camera-slot">
      <div className="card-header">
        <i className="bi bi-camera-video-fill" /> {getFriendlyName(entity)}
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
        ) : mode === "stream" ? (
          <>
            {status === "loading" && (
              <div className="camera-feed-loading">Starting live stream…</div>
            )}
            <img
              ref={streamRef}
              className="camera-feed"
              src={streamSrc}
              alt={getFriendlyName(entity)}
              onLoad={() => {
                if (stallTimer.current) clearTimeout(stallTimer.current);
                setStatus("ok");
              }}
              onError={() => switchToSnapshot()}
            />
          </>
        ) : snapshotSrc ? (
          <img className="camera-feed" src={snapshotSrc} alt={getFriendlyName(entity)} />
        ) : (
          <div className="camera-feed-loading">Loading from Home Assistant…</div>
        )}
      </div>
    </div>
  );
}
