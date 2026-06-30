import { CameraFeed } from "../components/CameraFeed";
import { useHA } from "../context/HAContext";
import { getCameraDisplayLabel } from "../lib/cameras";
import { getDomain } from "../types";

export function CamerasPage() {
  const { entities, config, entityLocations } = useHA();
  const cameras = entities.filter((e) => getDomain(e.entity_id) === "camera");
  const haUrl = config?.url ?? "";
  const token = config?.token ?? "";

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> CAMERAS</h2>
        <span className="sub">AI vision feeds · {cameras.length} online</span>
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
            <CameraFeed
              key={cam.entity_id}
              entity={cam}
              haUrl={haUrl}
              token={token}
              label={getCameraDisplayLabel(cam, entityLocations.areas, entityLocations.registryNames)}
              slot={i % 2 === 0 ? 1 : 2}
            />
          ))}
        </div>
      )}
    </>
  );
}
