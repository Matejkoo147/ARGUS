import { useMemo, useState } from "react";
import { CameraFeed } from "../components/CameraFeed";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ConfRing, SensorRow } from "../components/CyberWidgets";
import { useHA } from "../context/HAContext";
import { resolveDashboardCamera } from "../lib/cameras";
import { formatEntityState, isSecurityRelevant, sensorStrength } from "../lib/entities";
import { ARM_ACTIONS, type ArmAction, groupHomeSensors } from "../lib/homeSensors";
import { getDomain, getFriendlyName, isOnState } from "../types";

function logTimestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function DashboardPage() {
  const { summary, entities, config, callService, toggleEntity, preferences } = useHA();
  const [pendingArm, setPendingArm] = useState<ArmAction | null>(null);

  const alarms = entities.filter((e) => getDomain(e.entity_id) === "alarm_control_panel");
  const alarm = alarms[0];
  const cameras = entities.filter((e) => getDomain(e.entity_id) === "camera");

  const cam1 = resolveDashboardCamera(preferences.dashboardCameras[0], cameras, 0);
  const cam2 = resolveDashboardCamera(preferences.dashboardCameras[1], cameras, 1);

  const armed =
    summary.alarmState === "armed_away" ||
    summary.alarmState === "armed_home" ||
    summary.alarmState === "armed_night";

  const securityStatus = summary.alarmState === "triggered"
    ? { text: "BREACH", cls: "glow-red" }
    : armed
      ? { text: "ARMED", cls: "glow-red" }
      : summary.motionActive > 0 || summary.doorOpen > 0
        ? { text: "ALERT", cls: "glow-amber" }
        : { text: "SAFE", cls: "glow-green" };

  const sensorGroups = useMemo(() => groupHomeSensors(entities), [entities]);

  const legacySensorRows = useMemo(() => {
    return entities
      .filter(isSecurityRelevant)
      .filter((e) => getDomain(e.entity_id) === "binary_sensor" || getDomain(e.entity_id) === "sensor")
      .slice(0, 10)
      .map((e) => ({
        id: e.entity_id,
        name: getFriendlyName(e),
        value: formatEntityState(e),
        strength: sensorStrength(e),
        description: (e.attributes.device_class as string) || getDomain(e.entity_id),
      }));
  }, [entities]);

  const activeAlerts = useMemo(() => {
    return entities
      .filter(isSecurityRelevant)
      .filter((e) => isOnState(e.state) || e.state === "triggered" || e.state === "unlocked" || e.state === "moving")
      .map((e) => ({
        name: getFriendlyName(e),
        detail: formatEntityState(e),
      }));
  }, [entities]);

  const quickControls = useMemo(() => {
    return entities.filter((e) => {
      const d = getDomain(e.entity_id);
      if (d === "light" || d === "switch") return true;
      if (d === "lock") return true;
      if (d === "siren" || e.entity_id.includes("siren")) return true;
      return false;
    }).slice(0, 6);
  }, [entities]);

  const runArm = async (mode: ArmAction) => {
    if (!alarm) return;
    await callService("alarm_control_panel", mode, { code: "" }, { entity_id: alarm.entity_id });
    setPendingArm(null);
  };

  const haUrl = config?.url ?? "";
  const token = config?.token ?? "";
  const ts = logTimestamp();

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> HOME</h2>
        <span className="sub">live perimeter · cameras · sensors</span>
      </div>

      <div className="grid-2 camera-row">
        <CameraFeed entity={cam1} haUrl={haUrl} token={token} label="Primary" slot={1} />
        <CameraFeed entity={cam2} haUrl={haUrl} token={token} label="Secondary" slot={2} />
      </div>

      <div className="grid-4">
        <div className="card stat-card">
          <div className="card-body">
            <div className="stat-label"><i className="bi bi-shield-check" /> Security</div>
            <div className={`stat-value ${securityStatus.cls}`}>{securityStatus.text}</div>
            <div className="stat-sub">
              {alarm ? getFriendlyName(alarm) : "Add alarm panel in HA"}
            </div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="card-body">
            <div className="stat-label"><i className="bi bi-heart-pulse" /> Sensor Health</div>
            <ConfRing pct={summary.systemHealth} label={`${summary.systemHealth}%`} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="card-body">
            <div className="stat-label"><i className="bi bi-person-walking" /> Motion</div>
            <div className={`stat-value ${summary.motionActive > 0 ? "glow-red" : "glow-green"}`}>
              {summary.motionActive}
            </div>
            <div className="stat-sub">of {summary.motionCount} sensors</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="card-body">
            <div className="stat-label"><i className="bi bi-door-open" /> Openings</div>
            <div className={`stat-value ${summary.doorOpen > 0 ? "glow-red" : "glow-green"}`}>
              {summary.doorOpen}
            </div>
            <div className="stat-sub">doors / windows · {summary.bleTagCount} BLE tags</div>
          </div>
        </div>
      </div>

      <div className="grid-3-1">
        <div className="card">
          <div className="card-header"><i className="bi bi-broadcast" /> Security Sensors</div>
          <div className="card-body home-sensors-body">
            {sensorGroups.length === 0 && legacySensorRows.length === 0 ? (
              <div className="empty-state">
                <p>No security sensors yet.</p>
                <p style={{ marginTop: 8, fontSize: "0.72rem" }}>
                  Add door contacts, PIR motion, BLE accelerometer tags, or indoor temperature sensors in Home Assistant — they appear here grouped by type.
                </p>
              </div>
            ) : sensorGroups.length > 0 ? (
              <div className="sensor-groups">
                {sensorGroups.map((group) => (
                  <section key={group.id} className="sensor-group">
                    <h3 className="sensor-group-title">{group.label}</h3>
                    <div className="sensor-chip-grid">
                      {group.items.map((item) => (
                        <div
                          key={item.entity.entity_id}
                          className={`sensor-chip${item.alert ? " alert" : ""}`}
                          title={`${item.name}: ${item.value}`}
                        >
                          <i className={`bi ${item.icon}`} />
                          <span className="sensor-chip-name">{item.name}</span>
                          <span className={`sensor-chip-value${item.alert ? " glow-red" : ""}`}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sensor</th>
                    <th>State</th>
                    <th>Signal</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {legacySensorRows.map((r) => (
                    <SensorRow key={r.id} name={r.name} value={r.value} strength={r.strength} description={r.description} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><i className="bi bi-sliders" /> Controls</div>
          <div className="card-body controls-panel">
            <p className="controls-intro">
              Alarm panel commands and quick toggles for lights, sirens, and locks from Home Assistant.
            </p>

            <div className="arm-controls">
              <button
                type="button"
                className="btn-cyber start"
                onClick={() => setPendingArm("arm_away")}
                disabled={!alarm}
                title="Arm Away — full perimeter when nobody is home"
              >
                <i className="bi bi-shield-fill-check" /> ARM AWAY
              </button>
              <button
                type="button"
                className="btn-cyber action"
                onClick={() => setPendingArm("arm_home")}
                disabled={!alarm}
                title="Arm Home — partial mode when you stay inside"
              >
                <i className="bi bi-house-lock" /> ARM HOME
              </button>
              <button
                type="button"
                className="btn-cyber stop"
                onClick={() => setPendingArm("disarm")}
                disabled={!alarm}
                title="Disarm — turn off all alarm zones"
              >
                <i className="bi bi-shield-slash" /> DISARM
              </button>
            </div>

            {!alarm && (
              <p className="hint-box">
                No alarm panel yet. Add an alarm integration in HA, or use automations to trigger a siren on motion.
              </p>
            )}

            <div className="stat-label quick-controls-label">Quick Controls</div>
            <p className="controls-sub">Tap to toggle lights, switches, locks, or sirens.</p>
            <div className="entity-grid compact-grid">
              {quickControls.length === 0 ? (
                <p className="controls-empty">Add lights, switches, or sirens in HA to control them here.</p>
              ) : (
                quickControls.map((e) => (
                  <div
                    key={e.entity_id}
                    className={`card entity-tile ${e.state === "on" || e.state === "unlocked" ? "on" : "off"}`}
                    onClick={() => toggleEntity(e)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(ev) => ev.key === "Enter" && toggleEntity(e)}
                  >
                    <div className="entity-name">{getFriendlyName(e)}</div>
                    <div className="entity-state">{formatEntityState(e)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="card-header"><i className="bi bi-exclamation-triangle" /> Live Alerts</div>
        <div className="card-body log-terminal">
          {activeAlerts.length === 0 ? (
            <div className="log-info">[{ts}] // perimeter clear — no active motion, doors, or breaches</div>
          ) : (
            activeAlerts.map((a, i) => (
              <div key={i} className="log-warn">
                [{ts}] ALERT :: {a.name} — {a.detail}
              </div>
            ))
          )}
        </div>
      </div>

      {pendingArm && (
        <ConfirmDialog
          open
          title={ARM_ACTIONS[pendingArm].title}
          message={ARM_ACTIONS[pendingArm].body}
          confirmLabel={ARM_ACTIONS[pendingArm].confirm}
          variant={ARM_ACTIONS[pendingArm].variant}
          onConfirm={() => runArm(pendingArm)}
          onCancel={() => setPendingArm(null)}
        />
      )}
    </>
  );
}

