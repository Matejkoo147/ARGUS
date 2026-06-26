import { useMemo, useState } from "react";
import { EntityTile } from "../components/CyberWidgets";
import { useHA } from "../context/HAContext";
import { isSystemEntity } from "../lib/entities";
import { classifyEntity, getDomain, getFriendlyName } from "../types";

const CATEGORY_HINTS: Record<string, string> = {
  security: "alarms · cameras · locks · motion",
  climate: "thermostats · fans · HVAC",
  media: "speakers · TVs · cast",
  other: "lights · switches · misc",
};

export function DevicesPage() {
  const { entities, toggleEntity } = useHA();
  const [filter, setFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [showSystem, setShowSystem] = useState(false);

  const visible = useMemo(
    () => (showSystem ? entities : entities.filter((e) => !isSystemEntity(e))),
    [entities, showSystem]
  );

  const domains = useMemo(() => {
    const set = new Set(visible.map((e) => getDomain(e.entity_id)));
    return ["all", ...Array.from(set).sort()];
  }, [visible]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return visible.filter((e) => {
      if (domainFilter !== "all" && getDomain(e.entity_id) !== domainFilter) return false;
      if (!q) return true;
      return (
        e.entity_id.toLowerCase().includes(q) ||
        getFriendlyName(e).toLowerCase().includes(q)
      );
    });
  }, [visible, filter, domainFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const cat = classifyEntity(e);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(e);
    }
    return map;
  }, [filtered]);

  return (
    <>
      <div className="page-head">
        <h2><span className="accent">//</span> DEVICES</h2>
        <span className="sub">{filtered.length} entities · security & home control</span>
      </div>

      <div className="filter-bar">
        <input
          className="cyber-input filter-bar-search"
          placeholder="search devices..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="filter-bar-controls">
          <select
            className="cyber-select filter-bar-domain"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            aria-label="Filter by type"
          >
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <label className="filter-bar-toggle">
            <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
            <span>show HA system</span>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">No devices match — add integrations in Home Assistant</div>
      ) : (
        Array.from(grouped.entries()).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: "1.5rem" }}>
            <div className="devices-section-head">
              <span className="stat-label">{cat}</span>
              {CATEGORY_HINTS[cat] && <span className="devices-section-hint">{CATEGORY_HINTS[cat]}</span>}
            </div>
            <div className="entity-grid">
              {items.map((e) => (
                <EntityTile key={e.entity_id} entity={e} onToggle={toggleEntity} />
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
