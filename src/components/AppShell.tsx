import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArgusLogo } from "./ArgusLogo";
import { AlertsBell } from "./AlertsBell";
import { useHA } from "../context/HAContext";
import { pickWeatherSnapshot } from "../lib/homeSensors";

const NAV = [
  { to: "/", icon: "bi-house-fill", label: "Home" },
  { to: "/devices", icon: "bi-hdd-network", label: "Devices" },
  { to: "/cameras", icon: "bi-camera-video", label: "Cameras" },
  { to: "/sensors", icon: "bi-broadcast", label: "Sensors" },
  { to: "/voice", icon: "bi-mic", label: "Voice" },
  { to: "/automations", icon: "bi-diagram-3", label: "Automations" },
  { to: "/history", icon: "bi-clock-history", label: "History" },
  { to: "/settings", icon: "bi-gear", label: "Settings" },
];

function formatNavClock(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function NavMetricBtn({
  title,
  icon,
  value,
  alert,
  onClick,
  className = "",
}: {
  title: string;
  icon: string;
  value: ReactNode;
  alert?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={`nav-metric nav-metric-btn${alert ? " alert" : ""} ${className}`.trim()} title={title} onClick={onClick}>
      <i className={`bi ${icon}`} />
      <strong className={alert ? "glow-red" : ""}>{value}</strong>
    </button>
  );
}

export function AppShell() {
  const { status, summary, config, entities, disconnect } = useHA();
  const navigate = useNavigate();
  const [clock, setClock] = useState(formatNavClock);

  const weather = useMemo(() => pickWeatherSnapshot(entities), [entities]);

  const armed =
    summary.alarmState === "armed_away" ||
    summary.alarmState === "armed_home" ||
    summary.alarmState === "armed_night";

  const breach = summary.alarmState === "triggered";
  const alertActive = breach || summary.motionActive > 0 || summary.doorOpen > 0;

  const sensorTotal = summary.motionCount + summary.bleTagCount;

  const perimeterBrief = useMemo(() => {
    if (breach) return { text: "BREACH", cls: "glow-red", route: "/" as const };
    if (summary.motionActive > 0) {
      return { text: `${summary.motionActive} MOTION`, cls: "glow-amber", route: "/sensors" as const };
    }
    if (summary.doorOpen > 0) {
      return { text: `${summary.doorOpen} OPEN`, cls: "glow-amber", route: "/" as const };
    }
    if (sensorTotal > 0) {
      const health = summary.systemHealth < 100 ? ` · ${summary.systemHealth}%` : "";
      return { text: `CLEAR · ${sensorTotal} sensors${health}`, cls: "glow-green", route: "/" as const };
    }
    return null;
  }, [breach, summary, sensorTotal]);

  useEffect(() => {
    const tick = setInterval(() => setClock(formatNavClock()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("system-armed", armed);
    document.body.classList.toggle("system-breach", breach);
    document.body.classList.toggle("system-alert", alertActive);
    return () => {
      document.body.classList.remove("system-armed", "system-breach", "system-alert");
    };
  }, [armed, breach, alertActive]);

  const dotClass =
    status === "connected"
      ? breach || summary.motionActive > 0 || summary.doorOpen > 0
        ? "dot-alert"
        : "dot-online"
      : "dot-offline";

  const statusLabel =
    status === "connected"
      ? breach
        ? "INTRUSION"
        : armed
          ? "ARMED"
          : "Online"
      : status === "connecting"
        ? "Connecting"
        : "Offline";

  const handleLogout = () => {
    disconnect();
    navigate("/");
    window.location.reload();
  };

  const openSettings = () => navigate("/settings");
  const displayUser = config?.username ?? "User";

  return (
    <div className="app-root">
      <header className={`navbar${armed ? " navbar--armed" : ""}${breach ? " navbar--breach" : ""}`}>
        <div className="nav-left">
          <div className="nav-logo-frame" aria-hidden>
            <span className="nav-logo-ring" />
            <ArgusLogo size={46} className="nav-brand-logo" />
          </div>
          <div className="nav-identity">
            <div className="nav-title">ARGUS</div>
            <div className="nav-tagline">All-Seeing Guardian</div>
          </div>
        </div>

        <div className="nav-hud">
          <span className="nav-metric nav-metric--clock" title="Local time">
            <i className="bi bi-clock" />
            <strong>{clock}</strong>
          </span>

          <span className="nav-hud-sep" aria-hidden />

          <div className="nav-hud-status">
            <span className={`status-dot ${dotClass}`} />
            <span className={breach ? "glow-red" : armed ? "glow-red" : status === "connected" ? "glow-green" : ""}>
              {statusLabel}
            </span>
          </div>

          <span className="nav-hud-sep" aria-hidden />

          {breach ? (
            <span className="badge-mode badge-breach">BREACH</span>
          ) : armed ? (
            <span className="badge-mode badge-armed">SECURE</span>
          ) : status === "connected" ? (
            <span className="badge-mode badge-safe">DISARMED</span>
          ) : null}

          {perimeterBrief && (
            <>
              <span className="nav-hud-sep nav-hud-sep--brief" aria-hidden />
              <button
                type="button"
                className={`nav-hud-brief${perimeterBrief.cls ? ` ${perimeterBrief.cls}` : ""}`}
                title="Perimeter status — tap to open"
                onClick={() => navigate(perimeterBrief.route)}
              >
                {perimeterBrief.text}
              </button>
            </>
          )}

          <span className="nav-hud-sep nav-hud-sep--metrics" aria-hidden />

          <div className="nav-metrics nav-metrics--desktop">
            <NavMetricBtn
              title="Cameras — open feeds"
              icon="bi-camera-video"
              value={summary.cameraCount}
              onClick={() => navigate("/cameras")}
            />
            <NavMetricBtn
              title={`Motion — ${summary.motionActive} active of ${summary.motionCount}`}
              icon="bi-person-walking"
              value={`${summary.motionActive}/${summary.motionCount}`}
              alert={summary.motionActive > 0}
              onClick={() => navigate("/sensors")}
            />
            <NavMetricBtn
              title="Open doors and windows"
              icon="bi-door-open"
              value={summary.doorOpen}
              alert={summary.doorOpen > 0}
              onClick={() => navigate("/")}
            />
            {summary.bleTagCount > 0 && (
              <NavMetricBtn
                title="BLE tags and trackers"
                icon="bi-bluetooth"
                value={summary.bleTagCount}
                onClick={() => navigate("/sensors")}
              />
            )}
            <NavMetricBtn
              title="Sensor health — online vs unavailable"
              icon="bi-heart-pulse"
              value={`${summary.systemHealth}%`}
              alert={summary.systemHealth < 90}
              onClick={() => navigate("/sensors")}
            />
          </div>

          <div className="nav-metrics nav-metrics--mobile">
            <NavMetricBtn
              title="Motion sensors"
              icon="bi-person-walking"
              value={summary.motionActive}
              alert={summary.motionActive > 0}
              onClick={() => navigate("/sensors")}
            />
            <NavMetricBtn
              title="Openings"
              icon="bi-door-open"
              value={summary.doorOpen}
              alert={summary.doorOpen > 0}
              onClick={() => navigate("/")}
            />
            <NavMetricBtn
              title="Cameras"
              icon="bi-camera-video"
              value={summary.cameraCount}
              onClick={() => navigate("/cameras")}
            />
            {summary.bleTagCount > 0 && (
              <NavMetricBtn
                title="BLE tags"
                icon="bi-bluetooth"
                value={summary.bleTagCount}
                onClick={() => navigate("/sensors")}
              />
            )}
          </div>

          <span className="nav-hud-spacer" aria-hidden />

          {weather && (
            <button
              type="button"
              className="nav-metric nav-metric-btn nav-metric--weather nav-hud-weather"
              title={`${weather.label} — ${weather.temp ?? ""} ${weather.humidity ?? ""}`.trim()}
              onClick={() => navigate("/sensors")}
            >
              <i className={`bi ${weather.icon}`} />
              <span className="weather-loc">{weather.location}</span>
              {weather.temp && <strong>{weather.temp}</strong>}
              {weather.humidity && <span className="weather-humidity">{weather.humidity}</span>}
            </button>
          )}
        </div>

        <div className="nav-actions">
          <AlertsBell />
          <button
            type="button"
            className="btn-user-settings"
            onClick={openSettings}
            title="Open settings"
          >
            <i className="bi bi-person-fill" />
            <span>{displayUser}</span>
          </button>
        </div>
      </header>

      <div className="app-shell">
        <aside className="sidebar">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
              title={item.label}
            >
              <span className="icon"><i className={`bi ${item.icon}`} /></span>
              <span className="lbl">{item.label}</span>
            </NavLink>
          ))}
          <div className="sidebar-spacer" />
          <button type="button" className="sidebar-link sb-logout" onClick={handleLogout} title="Sign out of ARGUS">
            <span className="icon"><i className="bi bi-box-arrow-left" /></span>
            <span className="lbl">Logout</span>
          </button>
        </aside>
        <main className="main-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
