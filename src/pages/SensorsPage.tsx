import { useMemo } from "react";
import { useHA } from "../context/HAContext";
import { groupHomeSensors } from "../lib/homeSensors";

export function SensorsPage() {
  const { entities, summary } = useHA();

  const groups = useMemo(() => groupHomeSensors(entities), [entities]);
  const totalSensors = groups.reduce((n, g) => n + g.items.length, 0);
  const alertCount = groups.reduce((n, g) => n + g.items.filter((i) => i.alert).length, 0);

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> SENSORS</h2>
        <span className="sub">
          {totalSensors} sensors · {summary.motionCount} motion · {summary.bleTagCount} BLE · {summary.doorOpen} open
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <div className="card-body empty-state">
            <p>No sensors yet.</p>
            <p style={{ marginTop: 8, fontSize: "0.72rem" }}>
              Add PIR motion, door contacts, BLE tags, ReoLink motion, CO₂ monitors, or temperature sensors in Home Assistant — they appear here grouped by type.
            </p>
          </div>
        </div>
      ) : (
        <>
          {alertCount > 0 && (
            <div className="card sensors-alert-banner" style={{ marginBottom: "1rem" }}>
              <div className="card-body glow-amber" style={{ fontSize: "0.8rem" }}>
                <i className="bi bi-exclamation-triangle-fill" /> {alertCount} sensor{alertCount > 1 ? "s" : ""} need attention
              </div>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.id} className="card" style={{ marginBottom: "1rem" }}>
              <div className="card-header">
                <i className={`bi ${group.items[0]?.icon ?? "bi-broadcast"}`} /> {group.label}
                <span className="cam-mode" style={{ marginLeft: "auto" }}>{group.items.length}</span>
              </div>
              <div className="card-body home-sensors-body">
                <div className="sensor-chip-grid sensors-page-grid">
                  {group.items.map((item) => (
                    <div
                      key={item.entity.entity_id}
                      className={`sensor-chip sensor-chip-lg${item.alert ? " alert" : ""}`}
                      title={`${item.entity.entity_id}\n${item.name}: ${item.value}`}
                    >
                      <i className={`bi ${item.icon}`} />
                      <span className="sensor-chip-name">{item.name}</span>
                      <span className={`sensor-chip-value${item.alert ? " glow-red" : ""}`}>{item.value}</span>
                      <span className="sensor-chip-entity">{item.entity.entity_id}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
