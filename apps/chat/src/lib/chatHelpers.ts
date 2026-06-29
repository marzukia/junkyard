/**
 * Pure helper functions for the chat UI.
 * No side-effects, easily unit-tested.
 *
 * Note: system prompt management lives in store/chatStore.ts (DEFAULT_SYSTEM_PROMPT,
 * loadSystemPrompt, saveSystemPrompt) so it can be persisted alongside conversation
 * state. buildSystemPrompt() here is kept for backward compat and delegates to the
 * default constant.
 */

export { formatBytes } from "@junkyardsh/ui";

/**
 * Estimate remaining download time as a human-readable string.
 * Returns null if there is insufficient data to estimate.
 */
export function formatEta(loaded: number, total: number, elapsedMs: number): string | null {
  if (total <= 0 || loaded <= 0 || elapsedMs <= 0) return null;
  const rate = loaded / elapsedMs; // units per ms
  const remaining = total - loaded;
  const etaMs = remaining / rate;
  if (!Number.isFinite(etaMs) || etaMs < 0) return null;
  const secs = Math.round(etaMs / 1000);
  if (secs < 5) return null; // too close to show
  if (secs < 60) return `~${secs}s left`;
  return `~${Math.ceil(secs / 60)}m left`;
}

export interface ExportMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Serialise a conversation to plain-text markdown.
 * Each message is labelled You / AI with a blank line between.
 */
export function exportConversation(messages: ExportMessage[]): string {
  if (messages.length === 0) return "";
  const lines: string[] = ["# Chat export", ""];
  for (const msg of messages) {
    const label = msg.role === "user" ? "**You**" : "**AI**";
    lines.push(`${label}`);
    lines.push("");
    lines.push(msg.content.trim());
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** Format a progress fraction as a percentage string. */
export function formatProgress(loaded: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.min(100, Math.round((loaded / total) * 100))}%`;
}

/**
 * True if WebGPU is available AND a GPU adapter can be obtained.
 * navigator.gpu existing is necessary but not sufficient: Linux Chrome on a
 * blocklisted GPU passes the property check but requestAdapter() returns null,
 * causing CreateMLCEngine to throw a raw error instead of showing the banner.
 */
export async function hasWebGpu(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Build a minimal system prompt for the chat.
 * Kept here so it can be tested and tweaked in isolation.
 */
export function buildSystemPrompt(): string {
  return (
    "You are a helpful, concise assistant running entirely in the user's browser. " +
    "No data is sent to any server. Keep answers clear and to the point."
  );
}

/**
 * Trim a message string: collapse inner whitespace runs but preserve paragraph
 * breaks (double newlines). Used to clean user input before sending.
 */
export function trimMessage(raw: string): string {
  return raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .join("\n\n")
    .trim();
}
