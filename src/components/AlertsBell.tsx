import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHA } from "../context/HAContext";
import {
  alertIcon,
  buildLiveAlerts,
  buildLogbookAlerts,
  mergeAlerts,
  type ArgusAlert,
} from "../lib/alerts";
import { haCameraSnapshotUrl } from "../lib/cameras";

function formatAlertTime(d: Date): string {
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AlertsBell() {
  const { status, summary, entities, config, client } = useHA();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [logAlerts, setLogAlerts] = useState<ArgusAlert[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const armed =
    summary.alarmState === "armed_away" ||
    summary.alarmState === "armed_home" ||
    summary.alarmState === "armed_night" ||
    summary.alarmState === "triggered";

  const liveAlerts = useMemo(() => buildLiveAlerts(entities, armed), [entities, armed]);

  const loadRecentEvents = useCallback(async () => {
    if (!client || status !== "connected") return;
    setLoadingLog(true);
    try {
      const start = new Date(Date.now() - 2 * 3600_000);
      const entries = await client.getLogbook(start);
      setLogAlerts(buildLogbookAlerts(entries, entities));
    } catch {
      setLogAlerts([]);
    } finally {
      setLoadingLog(false);
    }
  }, [client, status, entities]);

  useEffect(() => {
    if (open) loadRecentEvents();
  }, [open, loadRecentEvents]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const alerts = useMemo(() => mergeAlerts(liveAlerts, logAlerts), [liveAlerts, logAlerts]);
  const count = alerts.length;
  const hasCritical = alerts.some((a) => a.severity === "critical");

  const haUrl = config?.url ?? "";
  const token = config?.token ?? "";

  const openAlert = (alert: ArgusAlert) => {
    setOpen(false);
    if (alert.cameraEntityId && haUrl && token) {
      navigate("/cameras");
      return;
    }
    navigate(alert.route);
  };

  return (
    <div className={`alerts-bell-wrap${open ? " open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className={`btn-alerts-bell${count > 0 ? " has-alerts" : ""}${hasCritical ? " critical" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={count ? `${count} alert${count === 1 ? "" : "s"} to review` : "No active alerts"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <i className={`bi ${count > 0 ? "bi-bell-fill" : "bi-bell"}`} />
        {count > 0 && <span className="alerts-badge">{count > 99 ? "99+" : count}</span>}
      </button>

      {open && (
        <div className="alerts-panel" role="dialog" aria-label="Security alerts">
          <div className="alerts-panel-head">
            <span>
              <i className="bi bi-bell-fill" /> Alerts
              {count > 0 && <em className="alerts-panel-count">{count}</em>}
            </span>
            <button type="button" className="alerts-refresh" onClick={loadRecentEvents} disabled={loadingLog} title="Refresh">
              <i className={`bi bi-arrow-clockwise${loadingLog ? " spin" : ""}`} />
            </button>
          </div>

          <div className="alerts-panel-body">
            {status !== "connected" && (
              <p className="alerts-empty">Connect to Home Assistant to receive perimeter alerts.</p>
            )}

            {status === "connected" && count === 0 && !loadingLog && (
              <p className="alerts-empty">
                <i className="bi bi-shield-check" />
                Perimeter clear — no motion, doors, or unusual events in the last 2 hours.
              </p>
            )}

            {alerts.map((alert) => {
              const thumb =
                alert.cameraEntityId && haUrl && token
                  ? haCameraSnapshotUrl(haUrl, alert.cameraEntityId, token, alert.timestamp.getTime())
                  : null;

              return (
                <button
                  key={alert.id}
                  type="button"
                  className={`alert-item severity-${alert.severity}`}
                  onClick={() => openAlert(alert)}
                >
                  {thumb ? (
                    <span className="alert-thumb-wrap">
                      <img className="alert-thumb" src={thumb} alt="" loading="lazy" />
                    </span>
                  ) : (
                    <span className={`alert-icon severity-${alert.severity}`}>
                      <i className={`bi ${alertIcon(alert.kind)}`} />
                    </span>
                  )}
                  <span className="alert-body">
                    <span className="alert-title">{alert.title}</span>
                    <span className="alert-detail">{alert.detail}</span>
                    <span className="alert-meta">
                      {formatAlertTime(alert.timestamp)}
                      {alert.source === "live" ? " · live" : " · event log"}
                    </span>
                  </span>
                  <span className="alert-action">{alert.actionLabel}</span>
                </button>
              );
            })}

            {loadingLog && count === 0 && (
              <p className="alerts-loading">Scanning recent events…</p>
            )}
          </div>

          <div className="alerts-panel-foot">
            <button type="button" className="alerts-foot-link" onClick={() => { setOpen(false); navigate("/history"); }}>
              Full history
            </button>
            <span className="alerts-foot-hint">Live + last 2h logbook</span>
          </div>
        </div>
      )}
    </div>
  );
}
