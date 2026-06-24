import { create } from "zustand";

export type ModelPhase = "idle" | "loading" | "ready" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** True while streaming is still in progress for this message. */
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface DownloadProgress {
  text: string;
  loaded: number;
  total: number;
}

// ── LocalStorage persistence helpers ─────────────────────────────────────────

const STORAGE_KEY_CONVERSATIONS = "chat-conversations";
const STORAGE_KEY_ACTIVE = "chat-active-conversation";
const STORAGE_KEY_SYSTEM_PROMPT = "chat-system-prompt";
const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful, concise assistant running entirely in the user's browser. " +
  "No data is sent to any server. Keep answers clear and to the point.";

/** Return true only for objects that look like a valid Conversation. */
function isValidConversation(v: unknown): v is Conversation {
  if (v === null || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    c.id.length > 0 &&
    typeof c.title === "string" &&
    Array.isArray(c.messages) &&
    typeof c.createdAt === "number" &&
    typeof c.updatedAt === "number"
  );
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVERSATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Filter out null/malformed elements so poisoned storage never throws
    return parsed.filter(isValidConversation);
  } catch {
    return [];
  }
}

function saveConversations(convos: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(convos));
  } catch {
    // ignore quota errors
  }
}

function loadActiveId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE);
  } catch {
    return null;
  }
}

function saveActiveId(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY_ACTIVE, id);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE);
  } catch {
    // ignore
  }
}

export function loadSystemPrompt(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_SYSTEM_PROMPT) ?? DEFAULT_SYSTEM_PROMPT;
  } catch {
    return DEFAULT_SYSTEM_PROMPT;
  }
}

export function saveSystemPrompt(prompt: string): void {
  try {
    if (prompt.trim() === DEFAULT_SYSTEM_PROMPT) {
      localStorage.removeItem(STORAGE_KEY_SYSTEM_PROMPT);
    } else {
      localStorage.setItem(STORAGE_KEY_SYSTEM_PROMPT, prompt);
    }
  } catch {
    // ignore
  }
}

export { DEFAULT_SYSTEM_PROMPT };

/** Derive a short title from the first user message. */
function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const text = first.content.trim();
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

function makeConversation(messages: ChatMessage[] = []): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    messages,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface ChatState {
  modelPhase: ModelPhase;
  modelError: string | null;
  downloadProgress: DownloadProgress;
  messages: ChatMessage[];
  generating: boolean;
  systemPrompt: string;

  // Multi-conversation sidebar
  conversations: Conversation[];
  activeConversationId: string | null;
  sidebarOpen: boolean;

  // actions
  setModelPhase: (phase: ModelPhase) => void;
  setModelError: (msg: string) => void;
  setDownloadProgress: (progress: DownloadProgress) => void;
  addUserMessage: (content: string) => string;
  startAssistantMessage: () => string;
  appendToMessage: (id: string, chunk: string) => void;
  finalizeMessage: (id: string) => void;
  setGenerating: (v: boolean) => void;
  clearMessages: () => void;
  setSystemPrompt: (prompt: string) => void;

  // Conversation management
  newConversation: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  setSidebarOpen: (open: boolean) => void;

  // Regenerate: remove last assistant message so the caller can re-send
  removeLastAssistantMessage: () => ChatMessage[];
}

const _savedConvos = loadConversations();
const _activeId = loadActiveId();
const _active = _savedConvos.find((c) => c.id === _activeId) ?? null;

export const useChatStore = create<ChatState>((set, get) => ({
  modelPhase: "idle",
  modelError: null,
  downloadProgress: { text: "", loaded: 0, total: 0 },
  messages: _active?.messages ?? [],
  generating: false,
  systemPrompt: loadSystemPrompt(),

  conversations: _savedConvos,
  activeConversationId: _active?.id ?? null,
  sidebarOpen: false,

  setModelPhase: (phase) => set({ modelPhase: phase }),
  setModelError: (msg) => set({ modelError: msg, modelPhase: "error" }),
  setDownloadProgress: (progress) => set({ downloadProgress: progress }),

  addUserMessage: (content) => {
    const id = crypto.randomUUID();
    set((s) => {
      const messages = [...s.messages, { id, role: "user" as const, content }];
      return { messages };
    });
    return id;
  },

  startAssistantMessage: () => {
    const id = crypto.randomUUID();
    set((s) => ({
      messages: [...s.messages, { id, role: "assistant" as const, content: "", streaming: true }],
    }));
    return id;
  },

  appendToMessage: (id, chunk) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, content: m.content + chunk } : m)),
    })),

  finalizeMessage: (id) => {
    set((s) => {
      const messages = s.messages.map((m) => (m.id === id ? { ...m, streaming: false } : m));
      // Persist the updated conversation
      const { conversations, activeConversationId } = s;
      const now = Date.now();
      let updatedConvos: Conversation[];
      let finalActiveId = activeConversationId;

      if (activeConversationId) {
        updatedConvos = conversations.map((c) =>
          c.id === activeConversationId
            ? { ...c, messages, title: deriveTitle(messages), updatedAt: now }
            : c
        );
      } else {
        // First message in a new session; create a conversation
        const convo = makeConversation(messages);
        convo.title = deriveTitle(messages);
        updatedConvos = [convo, ...conversations];
        finalActiveId = convo.id;
        saveActiveId(convo.id);
      }
      saveConversations(updatedConvos);
      return { messages, conversations: updatedConvos, activeConversationId: finalActiveId };
    });
  },

  setGenerating: (v) => set({ generating: v }),

  clearMessages: () => {
    // Start a fresh conversation (don't delete existing ones)
    get().newConversation();
  },

  setSystemPrompt: (prompt) => {
    saveSystemPrompt(prompt);
    set({ systemPrompt: prompt });
  },

  newConversation: () => {
    saveActiveId(null);
    set({ messages: [], activeConversationId: null });
  },

  loadConversation: (id) => {
    const convo = get().conversations.find((c) => c.id === id);
    if (!convo) return;
    saveActiveId(id);
    set({ messages: convo.messages, activeConversationId: id, sidebarOpen: false });
  },

  deleteConversation: (id) => {
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id);
      saveConversations(conversations);
      // If deleting the active one, clear messages
      if (s.activeConversationId === id) {
        saveActiveId(null);
        return { conversations, messages: [], activeConversationId: null };
      }
      return { conversations };
    });
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  removeLastAssistantMessage: () => {
    let removed: ChatMessage[] = [];
    set((s) => {
      const last = s.messages[s.messages.length - 1];
      if (last?.role === "assistant") {
        removed = [last];
        return { messages: s.messages.slice(0, -1) };
      }
      return {};
    });
    return removed;
  },
}));
