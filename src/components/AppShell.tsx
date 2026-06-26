import { useEffect, useMemo } from "react";
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

export function AppShell() {
  const { status, summary, config, entities, disconnect } = useHA();
  const navigate = useNavigate();

  const weather = useMemo(() => pickWeatherSnapshot(entities), [entities]);

  const armed =
    summary.alarmState === "armed_away" ||
    summary.alarmState === "armed_home" ||
    summary.alarmState === "armed_night" ||
    summary.alarmState === "triggered";

  const breach = summary.alarmState === "triggered";
  const alertActive = breach || summary.motionActive > 0 || summary.doorOpen > 0;

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
      ? summary.motionActive > 0 || summary.doorOpen > 0 || summary.alarmState === "triggered"
        ? "dot-alert"
        : "dot-online"
      : "dot-offline";

  const statusLabel =
    status === "connected"
      ? summary.alarmState === "triggered"
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
          <div className="nav-hud-status">
            <span className={`status-dot ${dotClass}`} />
            <span className={armed ? "glow-red" : status === "connected" ? "glow-green" : ""}>
              {statusLabel}
            </span>
          </div>

          <span className="nav-hud-sep" aria-hidden />

          {armed ? (
            <span className="badge-mode badge-armed">SECURE</span>
          ) : status === "connected" ? (
            <span className="badge-mode badge-safe">DISARMED</span>
          ) : null}

          <span className="nav-hud-sep" aria-hidden />

          <div className="nav-metrics">
            <span className="nav-metric" title="Cameras">
              <i className="bi bi-camera-video" />
              <strong>{summary.cameraCount}</strong>
            </span>
            <span className="nav-metric" title="Active motion">
              <i className="bi bi-broadcast" />
              <strong className={summary.motionActive ? "glow-red" : ""}>{summary.motionActive}</strong>
            </span>
            <span className="nav-metric" title="Open doors/windows">
              <i className="bi bi-door-open" />
              <strong className={summary.doorOpen ? "glow-red" : ""}>{summary.doorOpen}</strong>
            </span>
            {weather && (
              <span className="nav-metric nav-metric--weather" title={weather.label}>
                <i className={`bi ${weather.icon}`} />
                <span className="weather-loc">{weather.location}</span>
                {weather.temp && <strong>{weather.temp}</strong>}
                {weather.humidity && <span className="weather-humidity">{weather.humidity}</span>}
              </span>
            )}
          </div>
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
