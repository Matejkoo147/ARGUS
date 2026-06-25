import type { HAConfig, HAEntity, HALogbookEntry } from "../types";
import { resolveHaFetchUrl, resolveHaWebSocketUrl } from "./haUrl";

export interface HaCurrentUser {
  id: string;
  name: string;
  is_owner: boolean;
  is_admin: boolean;
}

let msgId = 1;

export class HomeAssistantClient {
  private ws: WebSocket | null = null;
  private config: HAConfig;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  onStateChanged?: (entity: HAEntity) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (err: string) => void;

  constructor(config: HAConfig) {
    this.config = config;
  }

  get connected() {
    return this._connected;
  }

  updateConfig(config: HAConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect(false);

      const wsUrl = resolveHaWebSocketUrl(this.config.url);

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        reject(e);
        return;
      }

      const fail = (msg: string) => {
        this.onError?.(msg);
        reject(new Error(msg));
      };

      this.ws.onmessage = async (ev) => {
        const msg = JSON.parse(ev.data as string) as Record<string, unknown>;

        if (msg.type === "auth_required") {
          this.sendRaw({ type: "auth", access_token: this.config.token });
          return;
        }

        if (msg.type === "auth_ok") {
          this._connected = true;
          this.onConnected?.();
          await this.subscribeEvents();
          resolve();
          return;
        }

        if (msg.type === "auth_invalid") {
          fail("Invalid access token");
          this.ws?.close();
          return;
        }

        if (msg.type === "event") {
          const event = msg.event as Record<string, unknown>;
          if (event.event_type === "state_changed") {
            const data = event.data as { new_state: HAEntity | null };
            if (data.new_state) this.onStateChanged?.(data.new_state);
          }
          return;
        }

        if (typeof msg.id === "number") {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if (msg.success) p.resolve(msg.result);
            else p.reject(new Error((msg.error as { message?: string })?.message || "HA request failed"));
          }
        }
      };

      this.ws.onerror = () => fail("WebSocket connection failed");
      this.ws.onclose = () => {
        this._connected = false;
        this.onDisconnected?.();
        this.scheduleReconnect();
      };
    });
  }

  disconnect(clearReconnect = true) {
    if (clearReconnect && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (clearReconnect) {
      this.onDisconnected = undefined;
    }
    this.ws?.close();
    this.ws = null;
    this._connected = false;
    this.pending.forEach((p) => p.reject(new Error("Disconnected")));
    this.pending.clear();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => undefined);
    }, 5000);
  }

  private sendRaw(data: Record<string, unknown>) {
    this.ws?.send(JSON.stringify(data));
  }

  private call<T = unknown>(type: string, extra: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.sendRaw({ id, type, ...extra });
    });
  }

  private async subscribeEvents() {
    await this.call("subscribe_events", { event_type: "state_changed" });
  }

  async getStates(): Promise<HAEntity[]> {
    return this.call<HAEntity[]>("get_states");
  }

  async getConfig(): Promise<Record<string, unknown>> {
    return this.call("get_config");
  }

  async getCurrentUser(): Promise<HaCurrentUser> {
    return this.call<HaCurrentUser>("auth/current_user");
  }

  async callService(
    domain: string,
    service: string,
    serviceData: Record<string, unknown> = {},
    target?: { entity_id?: string | string[] }
  ): Promise<unknown> {
    return this.call("call_service", {
      domain,
      service,
      service_data: serviceData,
      target: target ?? {},
    });
  }

  async getLogbook(start: Date): Promise<HALogbookEntry[]> {
    const iso = start.toISOString();
    const res = await fetch(resolveHaFetchUrl(this.config.url, `/api/logbook/${iso}`), {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error("Failed to fetch logbook");
    return res.json() as Promise<HALogbookEntry[]>;
  }

  getCameraSnapshotUrl(entityId: string): string {
    return `${resolveHaFetchUrl(this.config.url, `/api/camera_proxy/${entityId}`)}?token=${this.config.token}`;
  }

  toggleEntity(entity: HAEntity): Promise<unknown> {
    const domain = entity.entity_id.split(".")[0];
    if (domain === "light" || domain === "switch" || domain === "input_boolean") {
      const svc = entity.state === "on" ? "turn_off" : "turn_on";
      return this.callService(domain, svc, {}, { entity_id: entity.entity_id });
    }
    if (domain === "lock") {
      const svc = entity.state === "locked" ? "unlock" : "lock";
      return this.callService(domain, svc, {}, { entity_id: entity.entity_id });
    }
    if (domain === "cover") {
      const svc = entity.state === "open" ? "close_cover" : "open_cover";
      return this.callService(domain, svc, {}, { entity_id: entity.entity_id });
    }
    return Promise.resolve();
  }

  setAlarm(entityId: string, code: string, action: "arm_away" | "arm_home" | "arm_night" | "disarm") {
    return this.callService("alarm_control_panel", action, { code }, { entity_id: entityId });
  }
}

export async function testConnection(config: HAConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(resolveHaFetchUrl(config.url, "/api/"), {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, message: "HTTP 401: invalid or expired token — create a new one in HA Profile → Security" };
      }
      if (res.status === 400) {
        return {
          ok: false,
          message:
            "HTTP 400: bad request via proxy — redeploy ARGUS (git pull + argus-update), then create a fresh HA token and paste with no spaces",
        };
      }
      return { ok: false, message: `HTTP ${res.status}: check URL and token` };
    }
    const data = (await res.json()) as { message: string };
    return { ok: true, message: data.message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}
