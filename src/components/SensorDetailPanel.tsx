import { useHA } from "../context/HAContext";
import { formatEntityState } from "../lib/entities";
import type { HomeSensorItem } from "../lib/homeSensors";
import { getDomain, getFriendlyName, isOnState } from "../types";

const SKIP_ATTRS = new Set([
  "friendly_name",
  "icon",
  "entity_picture",
  "supported_features",
  "attribution",
  "device_class",
  "state_class",
  "unit_of_measurement",
]);

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

interface SensorDetailPanelProps {
  item: HomeSensorItem;
}

export function SensorDetailPanel({ item }: SensorDetailPanelProps) {
  const { entityLocations } = useHA();
  const { entity, icon, name, value, alert } = item;
  const domain = getDomain(entity.entity_id);
  const dc = (entity.attributes.device_class as string) || "";
  const unit = (entity.attributes.unit_of_measurement as string) || "";
  const areaName = entityLocations.areas[entity.entity_id];

  const extraAttrs = Object.entries(entity.attributes)
    .filter(([k, v]) => !SKIP_ATTRS.has(k) && v != null && v !== "" && typeof v !== "object")
    .slice(0, 12);

  const statusHint = alert
    ? domain === "binary_sensor" && (dc === "door" || dc === "window" || /door|window/.test(entity.entity_id))
      ? "Opening detected — check perimeter"
      : isOnState(entity.state)
        ? "Active / triggered"
        : "Needs attention"
    : "Nominal";

  return (
    <div className="sensor-detail">
      <div className={`sensor-detail-hero${alert ? " alert" : ""}`}>
        <i className={`bi ${icon}`} aria-hidden />
        <div className="sensor-detail-hero-text">
          <div className="sensor-detail-name">{name}</div>
          <div className={`sensor-detail-value${alert ? " glow-red" : " glow-cyan"}`}>
            {value}
            {unit && !String(value).includes(unit) ? ` ${unit}` : ""}
          </div>
          <div className={`sensor-detail-status${alert ? " glow-amber" : " glow-green"}`}>{statusHint}</div>
        </div>
      </div>

      <dl className="sensor-detail-meta">
        <div>
          <dt>Entity</dt>
          <dd><code>{entity.entity_id}</code></dd>
        </div>
        <div>
          <dt>Domain</dt>
          <dd>{domain}</dd>
        </div>
        {dc && (
          <div>
            <dt>Device class</dt>
            <dd>{dc}</dd>
          </div>
        )}
        {areaName && (
          <div>
            <dt>Area</dt>
            <dd>{areaName}</dd>
          </div>
        )}
        <div>
          <dt>Raw state</dt>
          <dd>{formatEntityState(entity)} <span className="muted">({entity.state})</span></dd>
        </div>
        <div>
          <dt>Last changed</dt>
          <dd>{formatWhen(entity.last_changed)}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatWhen(entity.last_updated)}</dd>
        </div>
        {extraAttrs.map(([k, v]) => (
          <div key={k}>
            <dt>{k.replace(/_/g, " ")}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
      </dl>

      <p className="sensor-detail-hint">
        Managed in Home Assistant. ARGUS shows live state for the security hub — use HA for device config.
      </p>
      <p className="sensor-detail-hint muted" style={{ marginTop: 4 }}>
        Registry name: {getFriendlyName(entity)}
      </p>
    </div>
  );
}
