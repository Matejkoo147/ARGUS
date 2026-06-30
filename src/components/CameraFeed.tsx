import { useCallback, useEffect, useRef, useState } from "react";
import { useHA } from "../context/HAContext";
import {
  fetchCameraSnapshot,
  getCameraDisplayLabel,
  haCameraStreamUrl,
} from "../lib/cameras";
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
const STREAM_RETRIES = 8;
const STREAM_RETRY_MS = 2000;

export function CameraFeed({ entity, haUrl, token, label, slot }: CameraFeedProps) {
  const { entityAreas } = useHA();
  const [mode, setMode] = useState<FeedMode>("stream");
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [errorDetail, setErrorDetail] = useState("");
  const [snapshotSrc, setSnapshotSrc] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);
  const streamAttempts = useRef(0);
  const blobRef = useRef<string | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const retryStream = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      setStreamKey((k) => k + 1);
      setStatus("loading");
    }, STREAM_RETRY_MS);
  }, []);

  const handleStreamError = useCallback(() => {
    streamAttempts.current += 1;
    if (streamAttempts.current < STREAM_RETRIES) {
      retryStream();
      return;
    }
    switchToSnapshot();
  }, [retryStream, switchToSnapshot]);

  // Always start with live stream — no pre-probe (probe fetch was falsely failing / blocking).
  useEffect(() => {
    if (!entity || !haUrl || !token) return;

    setMode("stream");
    setStatus("loading");
    setErrorDetail("");
    setSnapshotSrc(null);
    streamAttempts.current = 0;
    setStreamKey(0);
    revokeBlob();

    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      revokeBlob();
    };
  }, [entity?.entity_id, haUrl, token, revokeBlob]);

  // Snapshot polling only as last-resort fallback.
  useEffect(() => {
    if (!entity || mode !== "snapshot" || !haUrl || !token) return;

    void loadSnapshot();
    const id = setInterval(() => void loadSnapshot(), SNAPSHOT_MS);
    return () => clearInterval(id);
  }, [entity?.entity_id, mode, haUrl, token, loadSnapshot]);

  // Periodically try to upgrade back from snapshots to stream.
  useEffect(() => {
    if (mode !== "snapshot" || !entity || !haUrl || !token) return;

    const id = setInterval(() => {
      streamAttempts.current = 0;
      setMode("stream");
      setStatus("loading");
      setStreamKey((k) => k + 1);
    }, 45000);

    return () => clearInterval(id);
  }, [mode, entity?.entity_id, haUrl, token]);

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

  const displayName = getCameraDisplayLabel(entity, entityAreas);

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

  const streamSrc = `${haCameraStreamUrl(haUrl, entity.entity_id, token)}&_k=${streamKey}`;
  const live = entity.state === "idle" || entity.state === "streaming";
  const modeLabel = mode === "stream" ? "STREAM" : "SNAP";

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
        ) : mode === "stream" ? (
          <>
            {status === "loading" && (
              <div className="camera-feed-loading">Connecting live stream…</div>
            )}
            <img
              key={streamKey}
              className="camera-feed"
              src={streamSrc}
              alt={displayName}
              onLoad={() => setStatus("ok")}
              onError={handleStreamError}
            />
          </>
        ) : snapshotSrc ? (
          <img className="camera-feed" src={snapshotSrc} alt={displayName} />
        ) : (
          <div className="camera-feed-loading">Loading fallback snapshot…</div>
        )}
      </div>
    </div>
  );
}
