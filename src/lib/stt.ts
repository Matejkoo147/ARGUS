/** Server-side Whisper STT via ARGUS nginx proxy (/api/stt/). */

export async function transcribeWebm(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio_file", blob, "voice.webm");

  const res = await fetch("/api/stt/asr?encode=true&task=transcribe&language=en&output=txt", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(err.slice(0, 120) || `STT HTTP ${res.status}`);
  }

  return (await res.text()).trim();
}

export function stripWakePrefix(text: string): string {
  const m = text.match(/\b(argus|arkus|argos|arguss)\b[,:.\s-]*/i);
  if (!m || m.index === undefined) return text.trim();
  return text.slice(m.index + m[0].length).trim() || text.trim();
}
