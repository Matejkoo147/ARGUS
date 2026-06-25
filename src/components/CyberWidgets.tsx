import type { HAEntity } from "../types";
import { DOMAIN_ICONS, getFriendlyName, isAlertState } from "../types";
import { formatEntityState } from "../lib/entities";
import { isOnState } from "../types";

interface EntityTileProps {
  entity: HAEntity;
  onToggle?: (entity: HAEntity) => void;
}

export function EntityTile({ entity, onToggle }: EntityTileProps) {
  const domain = entity.entity_id.split(".")[0];
  const alert = isAlertState(entity);
  const on = isOnState(entity.state);
  const cls = alert ? "alert" : on ? "on" : "off";

  return (
    <div
      className={`card entity-tile ${cls}`}
      onClick={() => onToggle?.(entity)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onToggle?.(entity)}
    >
      <div className="entity-name">
        {DOMAIN_ICONS[domain] ?? "◆"} {getFriendlyName(entity)}
      </div>
      <div className="entity-state">{formatEntityState(entity)}</div>
      {entity.attributes.unit_of_measurement && (
        <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: 4 }}>
          {entity.attributes.unit_of_measurement as string}
        </div>
      )}
    </div>
  );
}

interface SensorRowProps {
  name: string;
  value: string;
  strength: number;
  description: string;
}

export function SensorRow({ name, value, strength, description }: SensorRowProps) {
  const pct = Math.min(100, Math.abs(strength));
  const isNeg = strength < 0;

  return (
    <tr>
      <td>{name}</td>
      <td style={{ fontFamily: "Orbitron", color: isNeg ? "var(--red)" : "var(--neon-green)" }}>{value}</td>
      <td style={{ width: 120 }}>
        <div className="score-track">
          <div className="score-center-line" />
          {isNeg ? (
            <div className="score-left" style={{ width: `${pct / 2}%` }} />
          ) : (
            <div className="score-right" style={{ width: `${pct / 2}%` }} />
          )}
        </div>
      </td>
      <td style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{description}</td>
    </tr>
  );
}

interface ConfRingProps {
  pct: number;
  label: string;
  color?: string;
}

export function ConfRing({ pct, label, color }: ConfRingProps) {
  const clr = color ?? (pct > 70 ? "var(--neon-green)" : pct > 40 ? "var(--neon-amber)" : "var(--red)");
  return (
    <div className="conf-ring" style={{ "--pct": `${pct}%`, "--clr": clr } as React.CSSProperties}>
      <span className="conf-label">{label}</span>
    </div>
  );
}
