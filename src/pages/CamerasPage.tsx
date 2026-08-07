import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CameraFeed } from "../components/CameraFeed";
import { DetailSheet } from "../components/DetailSheet";
import { useHA } from "../context/HAContext";
import { getCameraDisplayLabel } from "../lib/cameras";
import { getDomain, type HAEntity } from "../types";

export function CamerasPage() {
  const { entities, config, entityLocations } = useHA();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const [focusCamera, setFocusCamera] = useState<HAEntity | null>(null);

  const cameras = entities.filter((e) => getDomain(e.entity_id) === "camera");
  const haUrl = config?.url ?? "";
  const token = config?.token ?? "";

  useEffect(() => {
    if (!focusId) return;
    const cam = cameras.find((c) => c.entity_id === focusId);
    if (cam) {
      setFocusCamera(cam);
      setSearchParams({}, { replace: true });
      return;
    }
    const el = document.getElementById(`camera-feed-${focusId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("camera-feed-focus");
    const t = setTimeout(() => {
      el.classList.remove("camera-feed-focus");
      setSearchParams({}, { replace: true });
    }, 4000);
    return () => clearTimeout(t);
  }, [focusId, cameras, setSearchParams]);

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> CAMERAS</h2>
        <span className="sub">AI vision feeds · {cameras.length} online · tap for fullscreen</span>
      </div>

      {cameras.length === 0 ? (
        <div className="card">
          <div className="card-body empty-state">
            <i className="bi bi-camera-video-off" style={{ fontSize: "2.5rem", opacity: 0.35, display: "block", marginBottom: "1rem" }} />
            No cameras found. Add ESP32-CAM, USB webcam, or Frigate in Home Assistant.
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {cameras.map((cam, i) => (
            <div
              key={cam.entity_id}
              id={`camera-feed-${cam.entity_id}`}
              className={cam.entity_id === focusId ? "camera-feed-focus" : undefined}
            >
              <CameraFeed
                entity={cam}
                haUrl={haUrl}
                token={token}
                label={getCameraDisplayLabel(cam, entityLocations.areas, entityLocations.registryNames)}
                slot={i % 2 === 0 ? 1 : 2}
                onExpand={() => setFocusCamera(cam)}
              />
            </div>
          ))}
        </div>
      )}

      <DetailSheet
        open={Boolean(focusCamera)}
        title={
          focusCamera
            ? getCameraDisplayLabel(focusCamera, entityLocations.areas, entityLocations.registryNames)
            : "Camera"
        }
        subtitle="Live feed · tap Back to return"
        icon="bi-camera-video-fill"
        onBack={() => setFocusCamera(null)}
        className="detail-sheet-body--camera"
      >
        {focusCamera && (
          <CameraFeed
            entity={focusCamera}
            haUrl={haUrl}
            token={token}
            label="Fullscreen"
            slot={1}
            variant="fullscreen"
          />
        )}
      </DetailSheet>
    </>
  );
}
