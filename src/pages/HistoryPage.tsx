import { useEffect, useMemo, useState } from "react";
import { useHA } from "../context/HAContext";
import type { HALogbookEntry } from "../types";

const LOG_SECURITY_RE =
  /motion|door|window|alarm|breach|trigger|camera|lock|tamper|intrusion|person|occupancy|garage|opened|detected|armed|disarm|siren|ble|tag/i;

function classifyLogEntry(entry: HALogbookEntry): "security" | "automation" | "system" | "other" {
  const text = `${entry.name} ${entry.message} ${entry.entity_id ?? ""}`.toLowerCase();
  if (LOG_SECURITY_RE.test(text)) return "security";
  if (/automation|script|scene/.test(text)) return "automation";
  if (/sun|backup|weather|forecast|update|home assistant/.test(text)) return "system";
  return "other";
}

function logClass(kind: ReturnType<typeof classifyLogEntry>, message: string): string {
  if (kind === "security") {
    if (/trigger|breach|alarm|intrusion|tamper/i.test(message)) return "log-warn";
    if (/motion|door|open|detected|person/i.test(message)) return "log-info";
    return "log-info";
  }
  if (kind === "automation") return "log-debug";
  if (kind === "system") return "log-muted";
  return "log-debug";
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function HistoryPage() {
  const { client, status } = useHA();
  const [entries, setEntries] = useState<HALogbookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [securityOnly, setSecurityOnly] = useState(true);
  const [search, setSearch] = useState("");

  const load = async (h: number) => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const start = new Date(Date.now() - h * 3600_000);
      const data = await client.getLogbook(start);
      setEntries(data.reverse().slice(0, 300));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logbook");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "connected") load(hours);
  }, [status, client, hours]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (securityOnly && classifyLogEntry(e) !== "security") return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.message.toLowerCase().includes(q) ||
        (e.entity_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, securityOnly, search]);

  const securityCount = useMemo(
    () => entries.filter((e) => classifyLogEntry(e) === "security").length,
    [entries],
  );

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> HISTORY</h2>
        <span className="sub">
          HA logbook · {securityCount} security events in period
        </span>
      </div>

      <div className="filter-bar" style={{ marginBottom: "1rem" }}>
        <input
          className="cyber-input filter-bar-search"
          placeholder="search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-bar-controls">
          <label className="filter-bar-toggle">
            <input
              type="checkbox"
              checked={securityOnly}
              onChange={(e) => setSecurityOnly(e.target.checked)}
            />
            <span>security only</span>
          </label>
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: "1rem" }}>
        {([1, 24, 168] as const).map((h) => (
          <button
            key={h}
            type="button"
            className={`btn-cyber action${hours === h ? " active" : ""}`}
            onClick={() => setHours(h)}
            disabled={loading}
          >
            {h === 1 ? "1H" : h === 24 ? "24H" : "7D"}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          Event Log
          <span className="cam-mode" style={{ marginLeft: "auto" }}>
            {displayed.length} shown
          </span>
        </div>
        <div className="card-body log-terminal" style={{ height: 480 }}>
          {loading && <div className="log-debug">// loading logbook…</div>}
          {error && <div className="log-error">{error}</div>}
          {!loading && !error && displayed.length === 0 && (
            <div className="log-debug">
              // {securityOnly ? "no security events" : "no events"} in selected period
              {securityOnly && " — uncheck “security only” to see all HA activity"}
            </div>
          )}
          {displayed.map((e, i) => {
            const kind = classifyLogEntry(e);
            const cls = logClass(kind, `${e.name} ${e.message}`);
            return (
              <div key={i} className={cls}>
                <span className="log-ts">[{formatLogTime(e.when)}]</span>
                <span className="log-kind">{kind.toUpperCase()}</span>
                <strong>{e.name}</strong>
                {e.message ? `: ${e.message}` : ""}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
