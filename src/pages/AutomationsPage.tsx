import { useMemo, useState } from "react";
import { useHA } from "../context/HAContext";
import { getDomain, getFriendlyName } from "../types";

function formatLastTriggered(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString();
}

export function AutomationsPage() {
  const { entities, callService } = useHA();
  const [filter, setFilter] = useState("");

  const automations = entities.filter((e) => getDomain(e.entity_id) === "automation");
  const scripts = entities.filter((e) => getDomain(e.entity_id) === "script");

  const q = filter.toLowerCase();
  const match = (e: (typeof automations)[0]) =>
    !q ||
    getFriendlyName(e).toLowerCase().includes(q) ||
    e.entity_id.toLowerCase().includes(q);

  const filteredAuto = useMemo(() => automations.filter(match), [automations, q]);
  const filteredScripts = useMemo(() => scripts.filter(match), [scripts, q]);

  const trigger = async (entityId: string) => {
    const domain = getDomain(entityId);
    await callService(domain, domain === "script" ? "turn_on" : "trigger", {}, { entity_id: entityId });
  };

  const toggleAutomation = async (entityId: string, on: boolean) => {
    await callService("automation", on ? "turn_on" : "turn_off", {}, { entity_id: entityId });
  };

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> AUTOMATIONS</h2>
        <span className="sub">
          {automations.length} automations · {scripts.length} scripts · works with any HA trigger (motion, ReoLink, weather, CO₂)
        </span>
      </div>

      <div className="hint-box" style={{ marginBottom: "1rem", fontSize: "0.75rem" }}>
        ARGUS lists automations and scripts from Home Assistant. Triggers like ReoLink person detection, PIR motion, door sensors, or CO₂ thresholds run in HA — use <strong>TRIGGER</strong> to test, or toggle automations on/off.
      </div>

      <input
        className="cyber-input"
        style={{ marginBottom: "1rem", maxWidth: 400 }}
        placeholder="search automations & scripts…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="grid-2">
        <div className="card">
          <div className="card-header">Automations ({filteredAuto.length})</div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            {filteredAuto.length === 0 ? (
              <div className="empty-state">No automations — create them in Home Assistant</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>On</th>
                    <th>Last run</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuto.map((a) => (
                    <tr key={a.entity_id}>
                      <td title={a.entity_id}>{getFriendlyName(a)}</td>
                      <td>
                        <button
                          type="button"
                          className={`btn-cyber-mini${a.state === "on" ? " active" : ""}`}
                          onClick={() => toggleAutomation(a.entity_id, a.state !== "on")}
                          title={a.state === "on" ? "Disable" : "Enable"}
                        >
                          {a.state === "on" ? "ON" : "OFF"}
                        </button>
                      </td>
                      <td className="log-muted" style={{ fontSize: "0.72rem" }}>
                        {formatLastTriggered(a.attributes.last_triggered)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-cyber action"
                          style={{ padding: "4px 10px" }}
                          onClick={() => trigger(a.entity_id)}
                        >
                          TRIGGER
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Scripts ({filteredScripts.length})</div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            {filteredScripts.length === 0 ? (
              <div className="empty-state">No scripts configured</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>State</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScripts.map((s) => (
                    <tr key={s.entity_id}>
                      <td title={s.entity_id}>{getFriendlyName(s)}</td>
                      <td>{s.state}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-cyber start"
                          style={{ padding: "4px 10px" }}
                          onClick={() => trigger(s.entity_id)}
                        >
                          RUN
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
