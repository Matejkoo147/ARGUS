import { resolveHaFetchUrl } from "./haUrl";

export function parseHaUsername(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/"))) as {
      username?: string;
      sub?: string;
      name?: string;
    };
    const sub = payload.username || payload.name || payload.sub || null;
    // HA long-lived tokens often use a UUID in sub — not a display name
    if (sub && /^[0-9a-f-]{36}$/i.test(sub)) return null;
    return sub;
  } catch {
    return null;
  }
}

/** Ask HA who owns this token (works for long-lived tokens). */
export async function fetchHaUsername(url: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(resolveHaFetchUrl(url, "/api/template"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ template: "{{ user }}" }),
    });
    if (!res.ok) return null;
    const raw = (await res.text()).trim();
    const name = raw.replace(/^"|"$/g, "").trim();
    return name && name !== "None" ? name : null;
  } catch {
    return null;
  }
}

export function maskToken(token: string): string {
  if (token.length <= 12) return "••••••••";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
