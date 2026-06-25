import { useEffect, useState } from "react";
import { useHA } from "../context/HAContext";
import type { HALogbookEntry } from "../types";

export function HistoryPage() {
  const { client, status } = useHA();
  const [entries, setEntries] = useState<HALogbookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (hours: number) => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const start = new Date(Date.now() - hours * 3600_000);
      const data = await client.getLogbook(start);
      setEntries(data.reverse().slice(0, 200));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logbook");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "connected") load(24);
  }, [status, client]);

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> HISTORY</h2>
        <span className="sub">HA logbook · security events</span>
      </div>

      <div className="btn-row" style={{ marginBottom: "1rem" }}>
        <button type="button" className="btn-cyber action" onClick={() => load(1)} disabled={loading}>1H</button>
        <button type="button" className="btn-cyber action" onClick={() => load(24)} disabled={loading}>24H</button>
        <button type="button" className="btn-cyber action" onClick={() => load(168)} disabled={loading}>7D</button>
      </div>

      <div className="card">
        <div className="card-header">Event Log</div>
        <div className="card-body log-terminal" style={{ height: 480 }}>
          {loading && <div className="log-debug">// loading logbook...</div>}
          {error && <div className="log-error">{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div className="log-debug">// no events in selected period</div>
          )}
          {entries.map((e, i) => (
            <div key={i} className="log-info">
              [{new Date(e.when).toLocaleString()}] {e.name}: {e.message}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
