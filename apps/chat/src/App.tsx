import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  exportConversation,
  formatEta,
  formatProgress,
  hasWebGpu,
  trimMessage,
} from "./lib/chatHelpers";
import {
  MODEL_ID,
  MODEL_SIZE_LABEL,
  abortGeneration,
  loadEngine,
  streamChat,
} from "./lib/llmEngine";
import { renderMarkdown } from "./lib/renderMarkdown";
import { DEFAULT_SYSTEM_PROMPT, useChatStore } from "./store/chatStore";
import "./styles/chat.css";
import { MobileWarning } from "./components/MobileWarning";

// ── Brand glyph: two overlapping chat bubbles, teal + amber ──────────────

function ChatBrandGlyph() {
  return (
    <>
      {/* Main bubble (teal) */}
      <path
        d="M4 6C4 4.9 4.9 4 6 4h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H10l-4 4v-4H6c-1.1 0-2-.9-2-2V6z"
        stroke="#2f9d8d"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Amber dot row, "typing" indicators */}
      <circle cx="10" cy="11" r="1.3" fill="#e8b04b" />
      <circle cx="14" cy="11" r="1.3" fill="#e8b04b" />
      <circle cx="18" cy="11" r="1.3" fill="#e8b04b" />
    </>
  );
}

// ── WebGPU unsupported banner (graceful) ──────────────────────────────────

function UnsupportedBanner() {
  return (
    <div className="card">
      <div className="chat-unsupported">
        <svg
          className="chat-unsupported-icon"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e8b04b"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="chat-unsupported-title">WebGPU not available in this browser</p>
        <p className="chat-unsupported-body">
          This tool runs an AI model directly in your browser using WebGPU. Your current browser or
          device does not support WebGPU yet.
          <br />
          <br />
          <strong>To use this tool:</strong> open it in{" "}
          <a href="https://www.google.com/chrome/" target="_blank" rel="noreferrer">
            Chrome 113+
          </a>{" "}
          or{" "}
          <a href="https://www.microsoft.com/en-us/edge" target="_blank" rel="noreferrer">
            Edge 113+
          </a>{" "}
          on a desktop or laptop. WebGPU is not yet supported in most mobile browsers or Firefox.
          <br />
          <br />
          <strong>Alternatively:</strong> use a server-side AI chat such as{" "}
          <a href="https://chat.openai.com" target="_blank" rel="noreferrer">
            ChatGPT
          </a>{" "}
          or{" "}
          <a href="https://claude.ai" target="_blank" rel="noreferrer">
            Claude.ai
          </a>{" "}
          while WebGPU support matures on your device.
        </p>
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────

interface ProgressBarProps {
  text: string;
  loaded: number;
  total: number;
  startedAt: number;
}

function ProgressBar({ text, loaded, total, startedAt }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const elapsed = startedAt > 0 ? Date.now() - startedAt : 0;
  const eta = formatEta(loaded, total, elapsed);
  const label = [text || "Downloading model", formatProgress(loaded, total), eta]
    .filter(Boolean)
    .join(" | ");
  return (
    <div className="chat-progress-wrap">
      <div
        className="chat-progress-bar-wrap"
        role="progressbar"
        tabIndex={0}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Model download progress"
      >
        <div className="chat-progress-track">
          <div className="chat-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="chat-progress-label">{label}</span>
      </div>
      <p className="chat-progress-sub">Saved in your browser cache after the first load.</p>
    </div>
  );
}

// ── Conversation sidebar ──────────────────────────────────────────────────

function Sidebar() {
  const {
    conversations,
    activeConversationId,
    generating,
    sidebarOpen,
    newConversation,
    loadConversation,
    deleteConversation,
    setSidebarOpen,
  } = useChatStore();

  return (
    <>
      {sidebarOpen && (
        <div
          className="chat-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
          role="presentation"
        />
      )}
      <aside className={`chat-sidebar${sidebarOpen ? " chat-sidebar--open" : ""}`}>
        <div className="chat-sidebar-header">
          <span className="chat-sidebar-title">History</span>
          <button
            type="button"
            className="chat-sidebar-new-btn"
            onClick={newConversation}
            disabled={generating}
            title="New chat"
          >
            + New
          </button>
        </div>
        {conversations.length === 0 ? (
          <p className="chat-sidebar-empty">No saved chats yet.</p>
        ) : (
          <ul className="chat-sidebar-list">
            {conversations
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((convo) => (
                <li key={convo.id} className="chat-sidebar-item">
                  <button
                    type="button"
                    className={`chat-sidebar-item-btn${convo.id === activeConversationId ? " chat-sidebar-item-btn--active" : ""}`}
                    onClick={() => loadConversation(convo.id)}
                    disabled={generating}
                    title={convo.title}
                  >
                    {convo.title}
                  </button>
                  <button
                    type="button"
                    className="chat-sidebar-del-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(convo.id);
                    }}
                    disabled={generating}
                    aria-label="Delete conversation"
                    title="Delete"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </aside>
    </>
  );
}

// ── System prompt settings panel ──────────────────────────────────────────

interface SettingsPanelProps {
  onClose: () => void;
}

function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { systemPrompt, setSystemPrompt } = useChatStore();
  const [draft, setDraft] = useState(systemPrompt);
  const isDirty = draft.trim() !== systemPrompt.trim();

  const handleSave = () => {
    setSystemPrompt(draft.trim() || DEFAULT_SYSTEM_PROMPT);
    onClose();
  };

  const handleReset = () => {
    setDraft(DEFAULT_SYSTEM_PROMPT);
  };

  return (
    <div className="chat-settings-panel">
      <label htmlFor="system-prompt-input" className="chat-settings-label">
        System prompt
      </label>
      <textarea
        id="system-prompt-input"
        className="chat-settings-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        aria-label="System prompt"
      />
      <div className="chat-settings-row">
        <span className="chat-settings-hint">Controls AI behaviour for this session.</span>
        <button type="button" className="btn-secondary" onClick={handleReset}>
          Reset
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={!isDirty && draft.trim() === systemPrompt.trim()}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ── Chat message bubble ───────────────────────────────────────────────────

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

function Message({ role, content, streaming }: MessageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const renderedHtml = role === "assistant" && !streaming ? renderMarkdown(content) : null;

  return (
    <div className={`chat-msg chat-msg--${role}`}>
      <div className={`chat-msg-avatar chat-msg-avatar--${role}`}>
        {role === "user" ? "YOU" : "AI"}
      </div>
      <div className="chat-msg-body">
        <div className="chat-msg-role">
          {role === "user" ? "You" : "Local AI"}
          {!streaming && content && (
            <button
              type="button"
              className="chat-copy-btn"
              onClick={handleCopy}
              aria-label="Copy message"
              title="Copy"
            >
              {copied ? (
                <span className="chat-copy-flash">Copied!</span>
              ) : (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>
        {renderedHtml != null ? (
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by renderMarkdown (HTML-escaped before processing)
          <div className="chat-msg-markdown" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        ) : (
          <p className="chat-msg-text">
            {content}
            {streaming && <span className="chat-cursor" aria-hidden="true" />}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────

// Starter prompt chips shown in the empty-state to seed the conversation.
const STARTER_PROMPTS = [
  "Explain how WebGPU works in simple terms",
  "Write a short poem about privacy",
  "What are 3 tips for better focus?",
  "Summarise the key ideas behind neural networks",
];

export function App() {
  const {
    modelPhase,
    modelError,
    downloadProgress,
    messages,
    generating,
    systemPrompt,
    sidebarOpen,
    setModelPhase,
    setModelError,
    setDownloadProgress,
    addUserMessage,
    startAssistantMessage,
    appendToMessage,
    finalizeMessage,
    setGenerating,
    clearMessages,
    setSidebarOpen,
    removeLastAssistantMessage,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [loadStartedAt, setLoadStartedAt] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  // null = probe in-flight; true/false = resolved
  const [webGpuSupported, setWebGpuSupported] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Probe WebGPU support on mount (requestAdapter catches blocklisted GPUs that
  // expose navigator.gpu but fail at engine creation).
  useEffect(() => {
    hasWebGpu().then(setWebGpuSupported);
  }, []);

  // Auto-scroll to bottom when message count changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length is the trigger
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleLoadModel = useCallback(async () => {
    setModelPhase("loading");
    setLoadStartedAt(Date.now());
    try {
      await loadEngine((text, loaded, total) => {
        setDownloadProgress({ text, loaded, total });
      });
      setModelPhase("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load model.";
      setModelError(msg);
    }
  }, [setModelPhase, setDownloadProgress, setModelError]);

  const handleExport = useCallback(() => {
    const text = exportConversation(messages);
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chat-export.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  const handleStop = useCallback(() => {
    abortGeneration();
    // finalizeMessage is called in handleSend's finally block; setGenerating is also there.
    // We just signal the abort; the finally cleanup handles the rest.
  }, []);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = trimMessage(overrideText ?? input);
      if (!text || generating || modelPhase !== "ready") return;

      if (!overrideText) setInput("");
      setGenerating(true);

      addUserMessage(text);
      const assistantId = startAssistantMessage();

      try {
        const history = useChatStore.getState().messages.slice(0, -1);
        const turns = [
          { role: "system" as const, content: systemPrompt },
          ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user" as const, content: text },
        ];

        await streamChat(turns, (delta) => {
          appendToMessage(assistantId, delta);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Generation failed.";
        appendToMessage(assistantId, `\n\n[Error: ${msg}]`);
      } finally {
        finalizeMessage(assistantId);
        setGenerating(false);
      }
    },
    [
      input,
      generating,
      modelPhase,
      systemPrompt,
      setGenerating,
      addUserMessage,
      startAssistantMessage,
      appendToMessage,
      finalizeMessage,
    ]
  );

  const handleRegenerate = useCallback(async () => {
    if (generating) return;
    // Find last user message before removing the assistant response
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    removeLastAssistantMessage();
    setGenerating(true);

    const assistantId = startAssistantMessage();

    try {
      const history = useChatStore.getState().messages.slice(0, -1);
      const turns = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: lastUser.content },
      ];

      await streamChat(turns, (delta) => {
        appendToMessage(assistantId, delta);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed.";
      appendToMessage(assistantId, `\n\n[Error: ${msg}]`);
    } finally {
      finalizeMessage(assistantId);
      setGenerating(false);
    }
  }, [
    generating,
    messages,
    systemPrompt,
    removeLastAssistantMessage,
    setGenerating,
    startAssistantMessage,
    appendToMessage,
    finalizeMessage,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter (no shift) or Cmd/Ctrl+Enter both send
      const isSendKey =
        (e.key === "Enter" && !e.shiftKey) || (e.key === "Enter" && (e.metaKey || e.ctrlKey));
      if (isSendKey) {
        e.preventDefault();
        void handleSend(undefined);
      }
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);

  const busy = modelPhase === "loading" || generating;
  const canSend = !busy && modelPhase === "ready" && input.trim().length > 0;
  // Show regenerate only when last message is from the assistant and not generating
  const canRegenerate =
    !generating && modelPhase === "ready" && messages[messages.length - 1]?.role === "assistant";

  return (
    <div className="app-root">
      <Header
        title="Local AI Chat"
        subtitle="chat with an AI, 100% in your browser, no API key, fully private"
        brandMark={
          <BrandMark label="Local AI Chat">
            <ChatBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <MobileWarning />
        <p className="chat-notice">
          <strong>Fully private.</strong> The AI runs entirely in your browser using WebGPU. First
          run downloads the model ({MODEL_SIZE_LABEL}), then it is instant and offline. Nothing is
          sent to any server.
        </p>

        {/* WebGPU check — null means probe in-flight, render nothing until resolved */}
        {webGpuSupported === false && <UnsupportedBanner />}

        {/* Load model prompt */}
        {webGpuSupported === true && modelPhase === "idle" && (
          <div className="card">
            <div className="chat-load-wrap">
              <p className="chat-load-title">Ready to load the AI model</p>
              <p className="chat-load-sub">
                Click below to download <strong>{MODEL_ID}</strong> ({MODEL_SIZE_LABEL}) into your
                browser cache. Subsequent visits are instant and work offline.
              </p>
              <button type="button" className="btn-primary" onClick={() => void handleLoadModel()}>
                Load AI model
              </button>
            </div>
          </div>
        )}

        {/* Model loading / download */}
        {webGpuSupported === true && modelPhase === "loading" && (
          <div className="card">
            <ProgressBar
              text={downloadProgress.text}
              loaded={downloadProgress.loaded}
              total={downloadProgress.total}
              startedAt={loadStartedAt}
            />
          </div>
        )}

        {/* Model load error */}
        {webGpuSupported === true && modelPhase === "error" && (
          <div className="card">
            <div className="chat-unsupported">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d9594c"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="chat-unsupported-title">Model failed to load</p>
              <p className="chat-unsupported-body">{modelError}</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setModelPhase("idle");
                }}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Chat UI */}
        {webGpuSupported === true && modelPhase === "ready" && (
          <div className="chat-layout">
            {/* Sidebar: persistent on desktop, drawer on mobile */}
            <Sidebar />

            <div className="card" style={{ flex: 1, minWidth: 0 }}>
              {/* Actions bar */}
              <div className="chat-actions">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {/* Mobile sidebar toggle */}
                  <button
                    type="button"
                    className="chat-sidebar-toggle"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Open conversation history"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                    History
                  </button>
                  <span className="chat-model-badge mono-label">{MODEL_ID}</span>
                </div>
                <div className="chat-actions-right">
                  {generating && (
                    <button
                      type="button"
                      className="chat-stop-btn"
                      onClick={handleStop}
                      aria-label="Stop generation"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                      Stop
                    </button>
                  )}
                  {canRegenerate && (
                    <button
                      type="button"
                      className="chat-regen-btn"
                      onClick={() => void handleRegenerate()}
                      disabled={generating}
                      aria-label="Regenerate last response"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
                      </svg>
                      Regenerate
                    </button>
                  )}
                  <button
                    type="button"
                    className={`chat-settings-toggle-btn${showSettings ? " chat-settings-toggle-btn--active" : ""}`}
                    onClick={() => setShowSettings((v) => !v)}
                    aria-label="System prompt settings"
                    title="System prompt"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleExport}
                    disabled={messages.length === 0}
                    aria-label="Export conversation"
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={clearMessages}
                    disabled={generating || messages.length === 0}
                    aria-label="New chat"
                  >
                    New chat
                  </button>
                </div>
              </div>

              {/* Settings panel (collapsible) */}
              {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

              {/* Messages */}
              <div className="chat-messages" aria-live="polite" aria-label="Chat conversation">
                {messages.length === 0 && (
                  <div className="chat-empty">
                    <svg
                      className="chat-empty-icon"
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="chat-empty-label">Send a message to start chatting</span>
                    <div className="chat-chips" aria-label="Starter prompts">
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          className="chat-chip"
                          onClick={() => void handleSend(prompt)}
                          disabled={generating}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg) => (
                  <Message
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    streaming={msg.streaming}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input row */}
              <div className="chat-input-row">
                <textarea
                  ref={textareaRef}
                  className="chat-textarea"
                  rows={1}
                  placeholder={
                    generating
                      ? "Generating..."
                      : "Type a message... (Enter to send, Shift+Enter for newline)"
                  }
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  disabled={busy}
                  aria-label="Chat message input"
                />
                <button
                  type="button"
                  className="chat-send-btn"
                  onClick={() => void handleSend(undefined)}
                  disabled={!canSend}
                  aria-label="Send message"
                >
                  {generating ? (
                    <span className="chat-spinner" aria-hidden="true" />
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. Your conversations never leave your device." />
    </div>
  );
}
