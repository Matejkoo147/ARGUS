import { useMemo } from "react";
import { SensorRow } from "../components/CyberWidgets";
import { useHA } from "../context/HAContext";
import { formatEntityState, isSecurityRelevant, sensorStrength } from "../lib/entities";
import { getFriendlyName } from "../types";

export function SensorsPage() {
  const { entities } = useHA();

  const sections = useMemo(() => {
    const security = entities.filter(isSecurityRelevant);
    const motion = security.filter(
      (e) => (e.attributes.device_class as string) === "motion" || (e.attributes.device_class as string) === "occupancy"
    );
    const doors = security.filter(
      (e) => ["door", "window", "garage_door"].includes((e.attributes.device_class as string) || "")
    );
    const ble = security.filter(
      (e) =>
        e.entity_id.includes("ble") ||
        e.entity_id.includes("tag") ||
        (e.attributes.device_class as string) === "accelerometer" ||
        (e.attributes.device_class as string) === "vibration"
    );
    const other = security.filter((e) => !motion.includes(e) && !doors.includes(e) && !ble.includes(e));
    return [
      { title: "Motion & Occupancy", items: motion },
      { title: "Doors & Windows", items: doors },
      { title: "BLE Tags & Accelerometer", items: ble },
      { title: "Other Security", items: other },
    ].filter((s) => s.items.length > 0);
  }, [entities]);

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> SENSORS</h2>
        <span className="sub">PIR · doors · BLE accelerometer tags</span>
      </div>

      {sections.length === 0 ? (
        <div className="card">
          <div className="card-body empty-state">
            No security sensors yet. Pair ESP32, BLE tags, and PIR sensors through Home Assistant.
          </div>
        </div>
      ) : (
        sections.map((section) => (
          <div key={section.title} className="card" style={{ marginBottom: "1rem" }}>
            <div className="card-header"><i className="bi bi-broadcast" /> {section.title}</div>
            <div className="card-body" style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sensor</th>
                    <th>State</th>
                    <th>Signal</th>
                    <th>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((e) => (
                    <SensorRow
                      key={e.entity_id}
                      name={getFriendlyName(e)}
                      value={formatEntityState(e)}
                      strength={sensorStrength(e)}
                      description={e.entity_id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </>
  );
}
