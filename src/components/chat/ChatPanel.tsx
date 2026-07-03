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
import type { ChatMessage, ChatProviderId, MapBridge, RunChatTurn } from "../../chat/types";
import { chatStore, useChatStore } from "../../state/chatStore";
import { keyVault } from "../../lib/keyVault";
import { KeySettings, MODEL_OPTIONS } from "./KeySettings";
import { useIsMobile } from "../../hooks/useIsMobile";
import {
  SURFACE, COLORS, BORDER, RADIUS, FONT_SIZE, FONT_CJK, FONT_DATA, ELEVATION, WHITE_ALPHA,
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
}

const PROVIDER_LABELS: Record<ChatProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
};

function actionButtonStyle(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "5px 10px", borderRadius: RADIUS.lg, cursor: "pointer",
    background: WHITE_ALPHA[4], border: `1px solid ${BORDER.mid}`,
    color: COLORS.textDefault, fontFamily: FONT_CJK, fontSize: FONT_SIZE.base,
    whiteSpace: "nowrap",
  };
}

function ToolChip({ summary }: { summary: string }) {
  return (
    <span
      style={{
        padding: "2px 8px", borderRadius: RADIUS.pill,
        background: WHITE_ALPHA[4], border: `1px solid ${BORDER.mid}`,
        fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textMuted,
      }}
    >
      {summary}
    </span>
  );
}

function MessageBubble({
  msg,
  streamingPlaceholder,
}: {
  msg: ChatMessage;
  streamingPlaceholder: boolean;
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
            background: isUser ? COLORS.accentFaint : WHITE_ALPHA[4],
            border: `1px solid ${isUser ? COLORS.accentSoft : BORDER.soft}`,
            color: COLORS.textDefault, fontFamily: FONT_CJK, fontSize: FONT_SIZE.md,
            lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}
        >
          {msg.content || (streamingPlaceholder ? "…" : "")}
        </div>
        {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {msg.toolCalls.map((call, idx) => (
              <ToolChip key={`${msg.id}-tool-${idx}`} summary={call.summary} />
            ))}
          </div>
        )}
        {!isUser && msg.usage && (
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>
            輸入 {msg.usage.inputTokens} ・ 輸出 {msg.usage.outputTokens} tokens
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

export function ChatPanel({ open, onClose, bridge, runChatTurn, onTestKey, compact = false }: ChatPanelProps) {
  const { messages, status, provider, model, settingsOpen } = useChatStore();
  const { isMobile } = useIsMobile();
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
        const message = err instanceof Error ? err.message : "對話發生錯誤，請稍後再試";
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
        background: SURFACE.strong,
        borderTop: `1px solid ${BORDER.panel}`,
        borderRadius: "16px 16px 0 0",
        zIndex: 60,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: ELEVATION.dock,
        animation: "chatPanelRiseMobile .28s cubic-bezier(0.22,1,0.36,1)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        color: COLORS.textDefault,
      }
    : {
        position: "fixed", top: 88, right: 14, width: 380,
        height: compact ? "min(45vh, 520px)" : "min(55vh, 640px)",
        opacity: compact ? 0.96 : 1,
        transition: "height 200ms ease, opacity 200ms ease",
        background: SURFACE.panel,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${BORDER.panel}`,
        borderRadius: RADIUS.xl,
        zIndex: 60,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: ELEVATION.lg,
        animation: "chatPanelRise .22s ease-out",
        color: COLORS.textDefault,
      };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderBottom: `1px solid ${BORDER.panel}`,
        }}
      >
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: 700, color: COLORS.textStrong }}>
          AI 助手
        </span>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "2px", color: COLORS.textDim }}>
          BYOK CHAT
        </span>
        <div style={{ flex: 1 }} />
        {!settingsOpen && messages.length > 0 && (
          <button onClick={() => chatStore.reset()} style={actionButtonStyle()} title="清空對話">
            <RotateCcw size={13} /> 清空
          </button>
        )}
        <button onClick={() => chatStore.setSettingsOpen(!settingsOpen)} style={actionButtonStyle()}>
          <Settings size={13} /> {settingsOpen ? "對話" : "設定"}
        </button>
        <button onClick={onClose} style={actionButtonStyle()}>
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
                background: SURFACE.subtle, border: `1px solid ${BORDER.soft}`,
                display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
              }}
            >
              <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textMuted, flex: 1 }}>
                尚未設定 {PROVIDER_LABELS[provider]} 的 API key，請先到設定頁貼上金鑰。
              </span>
              <button onClick={() => chatStore.setSettingsOpen(true)} style={actionButtonStyle()}>
                前往設定
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
                <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, color: COLORS.textMuted }}>
                  問我地圖上的資料，我可以幫你開圖層、飛到定點、查數字
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
                />
              ))
            )}
          </div>

          {/* Input */}
          <div
            style={{
              flexShrink: 0, borderTop: `1px solid ${BORDER.panel}`,
              padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasKey ? "輸入訊息…" : "請先到設定頁貼上 API key"}
                rows={2}
                style={{
                  flex: 1, resize: "none", padding: "8px 10px", borderRadius: RADIUS.lg,
                  background: WHITE_ALPHA[4], border: `1px solid ${BORDER.mid}`,
                  color: COLORS.textDefault, fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, lineHeight: 1.5,
                }}
              />
              {status === "streaming" ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  style={{ ...actionButtonStyle(), color: COLORS.statusErr }}
                  title="中斷"
                >
                  <Square size={13} /> 中斷
                </button>
              ) : (
                <button
                  onClick={() => void handleSend()}
                  disabled={!draft.trim()}
                  style={{
                    ...actionButtonStyle(),
                    opacity: draft.trim() ? 1 : 0.5,
                    cursor: draft.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  <Send size={13} /> 送出
                </button>
              )}
            </div>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textFaint,
              }}
            >
              <CornerDownLeft size={10} /> 送出・Shift+Enter 換行
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
