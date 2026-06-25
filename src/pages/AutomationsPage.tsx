import { useHA } from "../context/HAContext";
import { getDomain, getFriendlyName } from "../types";

export function AutomationsPage() {
  const { entities, callService } = useHA();
  const automations = entities.filter((e) => getDomain(e.entity_id) === "automation");
  const scripts = entities.filter((e) => getDomain(e.entity_id) === "script");

  const trigger = async (entityId: string) => {
    const domain = getDomain(entityId);
    await callService(domain, domain === "script" ? "turn_on" : "trigger", {}, { entity_id: entityId });
  };

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> AUTOMATIONS</h2>
        <span className="sub">HA automations & scripts</span>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">Automations ({automations.length})</div>
          <div className="card-body">
            {automations.length === 0 ? (
              <div className="empty-state">No automations — create them in Home Assistant</div>
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
                  {automations.map((a) => (
                    <tr key={a.entity_id}>
                      <td>{getFriendlyName(a)}</td>
                      <td className={a.state === "on" ? "glow-green" : ""}>{a.state}</td>
                      <td>
                        <button type="button" className="btn-cyber action" style={{ padding: "4px 10px" }} onClick={() => trigger(a.entity_id)}>
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
          <div className="card-header">Scripts ({scripts.length})</div>
          <div className="card-body">
            {scripts.length === 0 ? (
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
                  {scripts.map((s) => (
                    <tr key={s.entity_id}>
                      <td>{getFriendlyName(s)}</td>
                      <td>{s.state}</td>
                      <td>
                        <button type="button" className="btn-cyber start" style={{ padding: "4px 10px" }} onClick={() => trigger(s.entity_id)}>
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
