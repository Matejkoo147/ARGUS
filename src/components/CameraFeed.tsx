import { useEffect, useState } from "react";
import { resolveHaFetchUrl } from "../lib/haUrl";
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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!entity) return;
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [entity]);

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
            <div className="camera-placeholder-hint">Add a camera in Home Assistant → Settings</div>
          </div>
        </div>
      </div>
    );
  }

  const base = resolveHaFetchUrl(haUrl, `/api/camera_proxy/${entity.entity_id}`);
  const src = `${base}?token=${token}&t=${tick}`;

  return (
    <div className="card camera-slot">
      <div className="card-header">
        <i className="bi bi-camera-video-fill" /> {getFriendlyName(entity)}
        <span className={`cam-live ${entity.state === "idle" || entity.state === "streaming" ? "on" : ""}`}>LIVE</span>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <img
          className="camera-feed"
          src={src}
          alt={getFriendlyName(entity)}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            img.style.display = "none";
          }}
        />
      </div>
    </div>
  );
}
