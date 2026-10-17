/**
 * ChatPanel — BYOK 對話浮層主面板
 *
 * 仿 MonitorPanel/IntelPanel 浮層 pattern：fixed 定位 + zIndex + 深色底。
 * 桌機右側浮層寬 ~380px；手機底部上拉全寬。
 * 訊息 / provider / model / settingsOpen 狀態走 chatStore（useSyncExternalStore）。
 * key 讀取一律透過 keyVault，本檔不直接碰 storage。
 */
import { useEffect, useRef, useState } from "react";
import { X, Send, Settings, Square, RotateCcw, CornerDownLeft } from "lucide-react";
import type { ChatMessage, ChatProviderId, ChatToolCallSummary, MapBridge, RunChatTurn } from "../../chat/types";
import { chatStore, useChatStore } from "../../state/chatStore";
import { keyVault } from "../../lib/keyVault";
import { KeySettings, MODEL_OPTIONS } from "./KeySettings";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useLocale, type LocaleSnapshot } from "../../state/localeStore";
import {
  SURFACE, COLORS, BORDER, RADIUS, FONT_SIZE, FONT_CJK, FONT_DATA, ELEVATION, WHITE_ALPHA, Z_INDEX,
} from "../../styles/designTokens";

export interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  bridge: MapBridge;
  /** 依賴注入，Task B（src/chat/agent.ts）的實作由整合層綁進來 */
  runChatTurn: RunChatTurn;
  /** 呼叫由整合層綁定的測試連線函式（本元件不實作） */
  onTestKey: (
    provider: ChatProviderId,
    model: string,
    key: string,
  ) => Promise<{ ok: boolean; message: string }>;
  /** 右下 stack（FeatureInfoPanel popup / LegendPanel）有東西時傳 true，面板縮高度讓位 */
  compact?: boolean;
  /** 淺色地圖底時傳 false，面板改用淺色中性 chrome；預設深色（維持既有行為） */
  isDarkTheme?: boolean;
}

const PROVIDER_LABELS: Record<ChatProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
};

// ─── 主題中性色票（chrome only）─────────────────────────────
// 深色分支沿用本檔既有 hardcode token；淺色分支為白底地圖用的中性 chrome。
// accent 藍 / 狀態色（statusErr 等）不進此表，兩主題共用。
function buildPalette(isDark: boolean) {
  return isDark
    ? {
        panelMobile: SURFACE.strong,        // rgba(10,10,20,0.88)
        panelDesktop: SURFACE.panel,        // rgba(0,0,0,0.52)
        cardBg: SURFACE.subtle,             // rgba(0,0,0,0.40)
        borderPanel: BORDER.panel,          // rgba(255,255,255,0.10)
        borderMid: BORDER.mid,              // rgba(255,255,255,0.14)
        borderSoft: BORDER.soft,            // rgba(255,255,255,0.06)
        chipBg: WHITE_ALPHA[4],             // rgba(255,255,255,0.04)
        aiBubbleBg: WHITE_ALPHA[4],         // rgba(255,255,255,0.04)
        inputBg: WHITE_ALPHA[4],            // rgba(255,255,255,0.04)
        userBubbleBg: COLORS.accentFaint,   // rgba(100,170,255,0.16)
        userBubbleBorder: COLORS.accentSoft, // rgba(100,170,255,0.55)
        textStrong: COLORS.textStrong,      // #f3f4f6
        textBody: COLORS.textDefault,       // #d8dce3
        bubbleText: COLORS.textDefault,     // #d8dce3
        inputText: COLORS.textDefault,      // #d8dce3
        textSecondary: COLORS.textMuted,    // #9ca3af
        textDim: COLORS.textDim,            // #6b7280
        textFaint: COLORS.textFaint,        // #4b5560
      }
    : {
        panelMobile: "rgba(255,255,255,0.96)",
        panelDesktop: "rgba(255,255,255,0.96)",
        cardBg: "#F9FAFB",
        borderPanel: "rgba(0,0,0,0.10)",
        borderMid: "rgba(0,0,0,0.12)",
        borderSoft: "rgba(0,0,0,0.08)",
        chipBg: "rgba(0,0,0,0.04)",
        aiBubbleBg: "#F9FAFB",
        inputBg: "#F3F4F6",
        userBubbleBg: "#EFF6FF",
        userBubbleBorder: "rgba(37,99,235,0.22)",
        textStrong: "#111827",
        textBody: "#1F2937",
        bubbleText: "#111827",
        inputText: "#111827",
        textSecondary: "#4B5563",
        textDim: "#6B7280",
        textFaint: "#9CA3AF",
      };
}
type Palette = ReturnType<typeof buildPalette>;

function actionButtonStyle(c: Palette): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "5px 10px", borderRadius: RADIUS.lg, cursor: "pointer",
    background: c.chipBg, border: `1px solid ${c.borderMid}`,
    color: c.textBody, fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
    whiteSpace: "nowrap",
  };
}

/**
 * 工具摘要 chip。摘要由工具產生（中文，也會併回對話歷史給 AI），外文介面改顯示通用狀態，
 * 原摘要放 title；中文介面照舊顯示摘要。
 */
function ToolChip({ call, c }: { call: ChatToolCallSummary; c: Palette }) {
  const { active, t } = useLocale();
  const text = active === "zh-TW" ? call.summary : t(call.failed ? "chat.toolFailed" : "chat.toolDone");
  return (
    <span
      title={active === "zh-TW" ? undefined : call.summary}
      style={{
        padding: "2px 8px", borderRadius: RADIUS.pill,
        background: c.chipBg, border: `1px solid ${c.borderMid}`,
        fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: c.textSecondary,
      }}
    >
      {text}
    </span>
  );
}

function MessageBubble({
  msg,
  streamingPlaceholder,
  c,
  i18n,
}: {
  msg: ChatMessage;
  streamingPlaceholder: boolean;
  c: Palette;
  i18n: LocaleSnapshot;
}) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "86%", display: "flex", flexDirection: "column", gap: 4,
          alignItems: isUser ? "flex-end" : "flex-start",
        }}
      >
        <div
          style={{
            padding: "8px 12px", borderRadius: RADIUS.lg,
            background: isUser ? c.userBubbleBg : c.aiBubbleBg,
            border: `1px solid ${isUser ? c.userBubbleBorder : c.borderSoft}`,
            color: c.bubbleText, fontFamily: FONT_CJK, fontSize: FONT_SIZE.md,
            lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}
        >
          {msg.content || (streamingPlaceholder ? "…" : "")}
        </div>
        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {msg.toolCalls.map((call, idx) => (
              <ToolChip key={`${msg.id}-tool-${idx}`} call={call} c={c} />
            ))}
          </div>
        )}
        {!isUser && msg.usage && (
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: c.textFaint }}>
            {i18n.t("chat.usage", { input: msg.usage.inputTokens, output: msg.usage.outputTokens })}
          </span>
        )}
        {msg.error && (
          <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.statusErr }}>
            {msg.error}
          </span>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({ open, onClose, bridge, runChatTurn, onTestKey, compact = false, isDarkTheme = true }: ChatPanelProps) {
  const { messages, status, provider, model, settingsOpen } = useChatStore();
  const i18n = useLocale();
  const { t } = i18n;
  const { isMobile } = useIsMobile();
  const c = buildPalette(isDarkTheme);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // provider 切換後 model 永遠對到合法選項（即使使用者從沒開過設定頁）
  useEffect(() => {
    const options = MODEL_OPTIONS[provider];
    if (!options.some((m) => m.id === model)) {
      chatStore.setModel(options[0]!.id);
    }
  }, [provider, model]);

  // 新訊息 / streaming 增量 → 自動捲到底
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 面板關閉時若還在 streaming，中斷掉，避免背景繼續打 API
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [open]);

  if (!open) return null;

  const hasKey = keyVault.presence()[provider];

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || status === "streaming") return;
    const apiKey = keyVault.get(provider);
    if (!apiKey) {
      chatStore.setSettingsOpen(true);
      return;
    }

    const history = chatStore.getState().messages; // 不含本輪 user 訊息
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "user", content: text, createdAt: Date.now(),
    };
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(), role: "assistant", content: "", createdAt: Date.now(),
    };
    chatStore.appendMessage(userMsg);
    chatStore.appendMessage(assistantMsg);
    setDraft("");
    chatStore.setStatus("streaming");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await runChatTurn({
        provider,
        model,
        apiKey,
        history,
        userText: text,
        bridge,
        onDelta: (chunk) => {
          const cur = chatStore.getState().messages;
          const prev = cur[cur.length - 1];
          chatStore.updateLastAssistant({ content: (prev?.content ?? "") + chunk });
        },
        onToolCall: (call) => {
          const cur = chatStore.getState().messages;
          const prev = cur[cur.length - 1];
          chatStore.updateLastAssistant({ toolCalls: [...(prev?.toolCalls ?? []), call] });
        },
        abortSignal: controller.signal,
      });
      // 契約 RunChatTurn 只保證最終回傳「一則 ChatMessage」，未明講 toolCalls/usage
      // 是否已含 streaming 期間累積的內容 → 保守合併：result 有值就用 result，
      // 否則保留 streaming 累積的版本，避免被 undefined 蓋掉。
      const streamed = chatStore.getState().messages;
      const streamedLast = streamed[streamed.length - 1];
      chatStore.updateLastAssistant({
        content: result.content || streamedLast?.content || "",
        toolCalls: result.toolCalls ?? streamedLast?.toolCalls,
        usage: result.usage ?? streamedLast?.usage,
        error: result.error,
      });
      chatStore.setStatus(result.error ? "error" : "idle");
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (aborted) {
        chatStore.setStatus("idle");
      } else {
        const message = err instanceof Error ? err.message : t("chat.error.generic");
        chatStore.updateLastAssistant({ error: message });
        chatStore.setStatus("error");
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // IME（注音/拼音）選字階段的 Enter 是「確認選字」，不是送出；
      // isComposing 涵蓋大多數瀏覽器，keyCode 229 補 Safari/舊版判斷。
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      void handleSend();
    }
  };

  const containerStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed", left: 0, right: 0, bottom: 0, height: "60vh",
        background: c.panelMobile,
        borderTop: `1px solid ${c.borderPanel}`,
        borderRadius: "16px 16px 0 0",
        // 與置中視窗同層（modal）：DOM 在 MemberPanel／InfoModal／ShareModal 之前，靠順序讓它們蓋過對話浮層
        zIndex: Z_INDEX.modal,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: ELEVATION.dock,
        animation: "chatPanelRiseMobile .28s cubic-bezier(0.22,1,0.36,1)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        color: c.textBody,
      }
    : {
        position: "fixed", top: 88, right: 14, width: 380,
        height: compact ? "min(45vh, 520px)" : "min(55vh, 640px)",
        opacity: compact ? 0.96 : 1,
        transition: "height 200ms ease, opacity 200ms ease",
        background: c.panelDesktop,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${c.borderPanel}`,
        borderRadius: RADIUS.xl,
        // 與置中視窗同層（modal）：DOM 在 MemberPanel／InfoModal／ShareModal 之前，靠順序讓它們蓋過對話浮層
        zIndex: Z_INDEX.modal,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: ELEVATION.lg,
        animation: "chatPanelRise .22s ease-out",
        color: c.textBody,
      };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderBottom: `1px solid ${c.borderPanel}`,
        }}
      >
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: 700, color: c.textStrong }}>
          {t("chat.title")}
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "2px", color: c.textDim }}>
          BYOK CHAT
        </span>
        <div style={{ flex: 1 }} />
        {!settingsOpen && messages.length > 0 && (
          <button onClick={() => chatStore.reset()} style={actionButtonStyle(c)} title={t("chat.clearTitle")}>
            <RotateCcw size={13} /> {t("chat.clear")}
          </button>
        )}
        <button onClick={() => chatStore.setSettingsOpen(!settingsOpen)} style={actionButtonStyle(c)}>
          <Settings size={13} /> {settingsOpen ? t("chat.backToChat") : t("chat.settings")}
        </button>
        <button onClick={onClose} style={actionButtonStyle(c)} aria-label={t("chat.close")} title={t("chat.close")}>
          <X size={14} />
        </button>
      </div>

      {settingsOpen ? (
        <KeySettings onTestKey={onTestKey} onDone={() => chatStore.setSettingsOpen(false)} />
      ) : (
        <>
          {!hasKey && (
            <div
              style={{
                margin: "10px 14px 0", padding: "8px 10px", borderRadius: RADIUS.lg,
                background: c.cardBg, border: `1px solid ${c.borderSoft}`,
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
              }}
            >
              <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: c.textSecondary, flex: 1 }}>
                {t("chat.noKeyNotice", { provider: PROVIDER_LABELS[provider] })}
              </span>
              <button onClick={() => chatStore.setSettingsOpen(true)} style={actionButtonStyle(c)}>
                {t("chat.goSettings")}
              </button>
            </div>
          )}

          <div
            ref={listRef}
            className="mtp-scroll"
            style={{
              flex: 1, overflowY: "auto", padding: "12px 14px",
              display: "flex", flexDirection: "column", gap: 12,
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", height: "100%", gap: 8, textAlign: "center", padding: 24,
                }}
              >
                <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, color: c.textSecondary }}>
                  {t("chat.empty")}
                </span>
              </div>
            ) : (
              messages.map((m, idx) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  streamingPlaceholder={
                    status === "streaming" && idx === messages.length - 1 && m.role === "assistant"
                  }
                  c={c}
                  i18n={i18n}
                />
              ))
            )}
          </div>

          {/* Input */}
          <div
            style={{
              flexShrink: 0, borderTop: `1px solid ${c.borderPanel}`,
              padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasKey ? t("chat.placeholder") : t("chat.placeholderNoKey")}
                rows={2}
                style={{
                  flex: 1, resize: "none", padding: "8px 10px", borderRadius: RADIUS.lg,
                  background: c.inputBg, border: `1px solid ${c.borderMid}`,
                  color: c.inputText, fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, lineHeight: 1.5,
                }}
              />
              {status === "streaming" ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  style={{ ...actionButtonStyle(c), color: COLORS.statusErr }}
                  title={t("chat.abort")}
                >
                  <Square size={13} /> {t("chat.abort")}
                </button>
              ) : (
                <button
                  onClick={() => void handleSend()}
                  disabled={!draft.trim()}
                  style={{
                    ...actionButtonStyle(c),
                    opacity: draft.trim() ? 1 : 0.5,
                    cursor: draft.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  <Send size={13} /> {t("chat.send")}
                </button>
              )}
            </div>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: c.textFaint,
              }}
            >
              <CornerDownLeft size={10} /> {t("chat.hint")}
            </span>
          </div>
        </>
      )}

      <style>{`
        @keyframes chatPanelRise {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatPanelRiseMobile {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="chatPanelRise"] { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
