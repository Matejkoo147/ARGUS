import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCameraSnapshot,
  haCameraStreamUrl,
  probeCameraSnapshot,
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
const STREAM_STALL_MS = 6000;

export function CameraFeed({ entity, haUrl, token, label, slot }: CameraFeedProps) {
  const [mode, setMode] = useState<FeedMode>("stream");
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [snapshotSrc, setSnapshotSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
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
    const objectUrl = await fetchCameraSnapshot(haUrl, entity.entity_id, token);
    if (!objectUrl) {
      setStatus("error");
      return;
    }
    revokeBlob();
    blobRef.current = objectUrl;
    setSnapshotSrc(objectUrl);
    setStatus("ok");
  }, [entity, haUrl, token, revokeBlob]);

  useEffect(() => {
    if (!entity || !haUrl || !token) return;

    setMode("stream");
    setStatus("loading");
    setSnapshotSrc(null);
    revokeBlob();

    let cancelled = false;
    void probeCameraSnapshot(haUrl, entity.entity_id, token).then((ok) => {
      if (cancelled) return;
      if (!ok) setStatus("error");
    });

    return () => {
      cancelled = true;
      revokeBlob();
    };
  }, [entity?.entity_id, haUrl, token, revokeBlob]);

  useEffect(() => {
    if (!entity || mode !== "stream") return;

    if (stallTimer.current) clearTimeout(stallTimer.current);
    stallTimer.current = setTimeout(() => {
      const img = imgRef.current;
      if (!img || img.naturalWidth === 0) switchToSnapshot();
    }, STREAM_STALL_MS);

    return () => {
      if (stallTimer.current) clearTimeout(stallTimer.current);
    };
  }, [entity?.entity_id, mode, switchToSnapshot]);

  useEffect(() => {
    if (!entity || mode !== "snapshot" || !haUrl || !token) return;

    void loadSnapshot();
    const id = setInterval(() => void loadSnapshot(), SNAPSHOT_MS);
    return () => {
      clearInterval(id);
    };
  }, [entity?.entity_id, mode, haUrl, token, loadSnapshot]);

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
              <div className="camera-placeholder-title">Camera unreachable</div>
              <div className="camera-placeholder-hint">
                In HA Generic Camera set <strong>Still image</strong> (<code>/capture</code>) and{" "}
                <strong>Stream</strong> (<code>/stream</code>). Close direct ESP32 browser tabs.
              </div>
            </div>
          </div>
        ) : mode === "stream" || snapshotSrc ? (
          <>
            {status === "loading" && mode === "snapshot" && (
              <div className="camera-feed-loading">Loading…</div>
            )}
            <img
              ref={mode === "stream" ? imgRef : undefined}
              className="camera-feed"
              src={mode === "stream" ? streamSrc : snapshotSrc!}
              alt={getFriendlyName(entity)}
              onLoad={() => {
                if (stallTimer.current) clearTimeout(stallTimer.current);
                setStatus("ok");
              }}
              onError={() => {
                if (mode === "stream") switchToSnapshot();
                else setStatus("error");
              }}
            />
          </>
        ) : (
          <div className="camera-feed-loading">Loading…</div>
        )}
      </div>
    </div>
  );
}
