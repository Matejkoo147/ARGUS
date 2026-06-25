export type OllamaApiMode = "native" | "openai";

export interface OllamaConfig {
  /** Ollama base URL, e.g. http://192.168.1.50:11434 or .../v1 for OpenAI-compatible */
  url: string;
  model: string;
  apiMode?: OllamaApiMode;
}

export const OLLAMA_STORAGE_KEY = "argus_ollama_config";

export const DEFAULT_OLLAMA: OllamaConfig = {
  url: "http://192.168.1.50:11434",
  model: "qwen2.5:3b",
  apiMode: "native",
};

function resolveApi(cfg: OllamaConfig): { base: string; mode: OllamaApiMode } {
  let base = cfg.url.trim().replace(/\/$/, "");
  if (cfg.apiMode) return { base, mode: cfg.apiMode };
  if (base.endsWith("/v1")) return { base, mode: "openai" };
  return { base, mode: "native" };
}

export function loadOllamaConfig(): OllamaConfig | null {
  try {
    const raw = localStorage.getItem(OLLAMA_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OllamaConfig;
  } catch {
    return null;
  }
}

export function saveOllamaConfig(cfg: OllamaConfig) {
  localStorage.setItem(OLLAMA_STORAGE_KEY, JSON.stringify(cfg));
}

export interface OllamaReply {
  text: string;
  model: string;
  latencyMs: number;
  tokens?: number;
  loadMs?: number;
}

export async function askOllama(
  cfg: OllamaConfig,
  prompt: string,
  systemContext: string
): Promise<OllamaReply> {
  const started = performance.now();
  const { base, mode } = resolveApi(cfg);

  if (mode === "openai") {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama OpenAI API ${res.status}: ${err.slice(0, 160)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
      usage?: { completion_tokens?: number; total_tokens?: number };
    };
    const latencyMs = Math.round(performance.now() - started);
    return {
      text: data.choices?.[0]?.message?.content?.trim() || "No response from model.",
      model: data.model || cfg.model,
      latencyMs,
      tokens: data.usage?.completion_tokens ?? data.usage?.total_tokens,
    };
  }

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      stream: false,
      messages: [
        { role: "system", content: systemContext },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama ${res.status}: ${err.slice(0, 160)}`);
  }
  const data = (await res.json()) as {
    message?: { content?: string };
    model?: string;
    eval_count?: number;
    load_duration?: number;
  };
  const latencyMs = Math.round(performance.now() - started);
  return {
    text: data.message?.content?.trim() || "No response from Ollama.",
    model: data.model || cfg.model,
    latencyMs,
    tokens: data.eval_count,
    loadMs: data.load_duration ? Math.round(data.load_duration / 1_000_000) : undefined,
  };
}

export async function testOllama(cfg: OllamaConfig): Promise<{ ok: boolean; message: string }> {
  const { base, mode } = resolveApi(cfg);
  try {
    if (mode === "openai") {
      const res = await fetch(`${base}/models`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status} at ${base}/models` };
      const data = (await res.json()) as { data?: { id: string }[] };
      const names = data.data?.map((m) => m.id).slice(0, 6).join(", ") || "none listed";
      const hasModel = data.data?.some((m) => m.id === cfg.model || m.id.startsWith(cfg.model));
      return {
        ok: true,
        message: hasModel
          ? `Connected (OpenAI /v1). Model "${cfg.model}" found. Also: ${names}`
          : `Connected (OpenAI /v1). Models: ${names}. "${cfg.model}" not in list — check exact name.`,
      };
    }

    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status} at ${base}/api/tags` };
    const data = (await res.json()) as { models?: { name: string }[] };
    const names = data.models?.map((m) => m.name).slice(0, 6).join(", ") || "none";
    const hasModel = data.models?.some((m) => m.name === cfg.model || m.name.startsWith(cfg.model));
    return {
      ok: true,
      message: hasModel
        ? `Connected. Model "${cfg.model}" found.`
        : `Connected. Models: ${names}. "${cfg.model}" not found — use exact name from ollama list.`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
  }
}

export async function listOllamaModels(cfg: OllamaConfig): Promise<string[]> {
  const { base, mode } = resolveApi(cfg);
  if (mode === "openai") {
    const res = await fetch(`${base}/models`);
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id: string }[] };
    return data.data?.map((m) => m.id) ?? [];
  }
  const res = await fetch(`${base}/api/tags`);
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: { name: string }[] };
  return data.models?.map((m) => m.name) ?? [];
}
