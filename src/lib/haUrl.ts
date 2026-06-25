const LOCAL_HA_URLS = new Set(["http://localhost:8123", "http://127.0.0.1:8123"]);
const HA_PROXY_PATH = "/api/ha";

function isHaProxyUrl(base: string): boolean {
  if (base === HA_PROXY_PATH) return true;
  try {
    const parsed = new URL(base, window.location.origin);
    return parsed.pathname === HA_PROXY_PATH || parsed.pathname.startsWith(`${HA_PROXY_PATH}/`);
  } catch {
    return false;
  }
}

/** In dev, route local HA through Vite proxy. In prod, same path via nginx when configured. */
export function resolveHaBase(url: string): string {
  const base = url.replace(/\/$/, "");
  if (import.meta.env.DEV && LOCAL_HA_URLS.has(base)) {
    return HA_PROXY_PATH;
  }
  if (isHaProxyUrl(base)) {
    return HA_PROXY_PATH;
  }
  return base;
}

export function resolveHaWebSocketUrl(url: string): string {
  const base = resolveHaBase(url);
  if (base.startsWith("/")) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${base}/api/websocket`;
  }
  return base.replace(/^http/, "ws") + "/api/websocket";
}

export function resolveHaFetchUrl(url: string, path: string): string {
  const base = resolveHaBase(url);
  const p = path.startsWith("/") ? path : `/${path}`;
  return base.startsWith("/") ? `${base}${p}` : `${base}${p}`;
}
