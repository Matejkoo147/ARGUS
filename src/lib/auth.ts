import type { HAEntity } from "../types";
import { getFriendlyName } from "../types";
import { resolveHaFetchUrl } from "./haUrl";
import type { HaCurrentUser } from "./homeassistant";

export function parseHaUserId(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as {
      sub?: string;
    };
    const sub = payload.sub;
    if (sub && /^[0-9a-f-]{36}$/i.test(sub)) return sub;
    return null;
  } catch {
    return null;
  }
}

export function parseHaUsername(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as {
      username?: string;
      sub?: string;
      name?: string;
    };
    const candidate = payload.username || payload.name || null;
    if (candidate && !/^[0-9a-f-]{36}$/i.test(candidate)) return candidate;
    return null;
  } catch {
    return null;
  }
}

async function fetchHaTemplate(url: string, token: string, template: string): Promise<string | null> {
  try {
    const res = await fetch(resolveHaFetchUrl(url, "/api/template"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ template }),
    });
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    const name = raw.replace(/^"|"$/g, "").trim();
    if (!name || name === "None" || name === "unknown" || name === "null") return null;
    return name;
  } catch {
    return null;
  }
}

function usernameFromPersonEntities(states: HAEntity[], token: string, userId?: string | null): string | null {
  const resolvedUserId = userId ?? parseHaUserId(token);
  const persons = states.filter((e) => e.entity_id.startsWith("person."));

  if (resolvedUserId) {
    const linked = persons.find((p) => p.attributes.user_id === resolvedUserId);
    if (linked) {
      const slug = linked.entity_id.replace("person.", "");
      const name = getFriendlyName(linked);
      if (slug && !slug.includes(" ")) return slug;
      if (name && name !== linked.entity_id) return name;
      return slug;
    }
  }

  if (persons.length === 1) {
    const p = persons[0];
    const slug = p.entity_id.replace("person.", "");
    const name = getFriendlyName(p);
    return name !== p.entity_id ? name : slug;
  }

  return null;
}

async function fetchUsernameFromAuthProviders(url: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(resolveHaFetchUrl(url, "/auth/providers"), { credentials: "omit" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      providers?: Array<{ type: string; users?: Record<string, string> }>;
    };
    for (const provider of data.providers ?? []) {
      if (provider.type === "homeassistant" && provider.users?.[userId]) {
        return provider.users[userId];
      }
    }
    return null;
  } catch {
    return null;
  }
}

function usernameFromCurrentUser(currentUser: HaCurrentUser, states: HAEntity[]): string | null {
  const fromPerson = usernameFromPersonEntities(states, "", currentUser.id);
  if (fromPerson) return fromPerson;

  const name = currentUser.name?.trim();
  if (name && name !== "Unknown" && !/^[0-9a-f-]{36}$/i.test(name)) return name;
  return null;
}

/** Resolve HA account display name (e.g. matejkoo) for the active token. */
export async function resolveHaUsername(
  url: string,
  token: string,
  states: HAEntity[] = [],
  currentUser?: HaCurrentUser | null,
): Promise<string | null> {
  const fromJwt = parseHaUsername(token);
  if (fromJwt) return fromJwt;

  if (currentUser?.id) {
    const fromProviders = await fetchUsernameFromAuthProviders(url, currentUser.id);
    if (fromProviders) return fromProviders;

    const fromUser = usernameFromCurrentUser(currentUser, states);
    if (fromUser) return fromUser;
  }

  const fromPerson = usernameFromPersonEntities(states, token);
  if (fromPerson) return fromPerson;

  // Template API requires admin — try anyway
  const fromUserName = await fetchHaTemplate(url, token, "{{ user_name }}");
  if (fromUserName) return fromUserName;

  const fromUser = await fetchHaTemplate(url, token, "{{ user }}");
  if (fromUser) return fromUser;

  return null;
}

export async function fetchHaUsername(url: string, token: string): Promise<string | null> {
  return resolveHaUsername(url, token);
}

export function maskToken(token: string): string {
  if (token.length <= 12) return "••••••••";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
