import { useState } from "react";
import { haCameraStreamUrl } from "../lib/cameras";
import type { HAEntity } from "../types";
import { getFriendlyName } from "../types";

interface CameraFeedProps {
  entity: HAEntity | null;
  haUrl: string;
  token: string;
  label: string;
  slot: 1 | 2;
}

export function CameraFeed({ entity, haUrl, token, label, slot }: CameraFeedProps) {
  const [streamError, setStreamError] = useState(false);

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

  const src = haCameraStreamUrl(haUrl, entity.entity_id, token);
  const live = entity.state === "idle" || entity.state === "streaming";

  return (
    <div className="card camera-slot">
      <div className="card-header">
        <i className="bi bi-camera-video-fill" /> {getFriendlyName(entity)}
        <span className={`cam-live ${live ? "on" : ""}`}>LIVE</span>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {streamError ? (
          <div className="camera-slot-body">
            <div className="camera-placeholder">
              <i className="bi bi-exclamation-triangle camera-placeholder-icon" aria-hidden />
              <div className="camera-placeholder-title">Stream unavailable</div>
              <div className="camera-placeholder-hint">
                In HA Generic Camera set a <strong>Stream source URL</strong> (e.g. <code>/stream</code>).
                Close other tabs hitting the ESP32 directly.
              </div>
            </div>
          </div>
        ) : (
          <img
            className="camera-feed"
            src={src}
            alt={getFriendlyName(entity)}
            onError={() => setStreamError(true)}
            onLoad={() => setStreamError(false)}
          />
        )}
      </div>
    </div>
  );
}
