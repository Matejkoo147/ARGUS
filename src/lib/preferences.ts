import { PREFS_KEY, type ArgusPreferences, type HAEntity } from "../types";
import { getDomain } from "../types";

export const DEFAULT_PREFERENCES: ArgusPreferences = {
  dashboardCameras: ["", ""],
  alarmCode: "",
  quickControls: ["", "", "", "", "", ""],
};

export const QUICK_CONTROL_SLOTS = 6;

export function loadPreferences(): ArgusPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<ArgusPreferences>;
    const quickControls = [...(parsed.quickControls ?? [])];
    while (quickControls.length < QUICK_CONTROL_SLOTS) quickControls.push("");
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      dashboardCameras: parsed.dashboardCameras ?? DEFAULT_PREFERENCES.dashboardCameras,
      quickControls: quickControls.slice(0, QUICK_CONTROL_SLOTS) as ArgusPreferences["quickControls"],
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: ArgusPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/** Resolve pinned quick-control entities; falls back to first controllable entities. */
export function resolveQuickControls(entities: HAEntity[], pinned: string[]): HAEntity[] {
  const byId = new Map(entities.map((e) => [e.entity_id, e]));
  const pinnedEntities = pinned
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => byId.get(id))
    .filter((e): e is HAEntity => Boolean(e));

  if (pinnedEntities.length > 0) return pinnedEntities.slice(0, QUICK_CONTROL_SLOTS);

  return controllableEntities(entities).slice(0, QUICK_CONTROL_SLOTS);
}

export function controllableEntities(entities: HAEntity[]): HAEntity[] {
  return entities.filter((e) => {
    const d = getDomain(e.entity_id);
    return d === "light" || d === "switch" || d === "lock" || d === "siren";
  });
}
