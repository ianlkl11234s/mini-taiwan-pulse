/**
 * KeySettings — BYOK 金鑰設定頁（內嵌在 ChatPanel 內的一頁）
 *
 * provider / model 選擇 + key 輸入（含儲存位置）+ 測試連線 + 刪除金鑰。
 * key 讀寫一律透過 keyVault（src/lib/keyVault.ts），本檔不直接碰 storage。
 */
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import type { ChatModelOption, ChatProviderId } from "../../chat/types";
import type { MessageKey } from "../../i18n/keys";
import { chatStore, useChatStore, type PersistChoice } from "../../state/chatStore";
import { keyVault } from "../../lib/keyVault";
import { useLocale } from "../../state/localeStore";
import {
  SURFACE, COLORS, BORDER, RADIUS, FONT_SIZE, FONT_CJK, FONT_DATA, SPACING, WHITE_ALPHA,
} from "../../styles/designTokens";

/** 各家 2 檔：預設輕量 + 進階。id 為合理現役型號，之後可調整。 */
export const MODEL_OPTIONS: Record<ChatProviderId, ChatModelOption[]> = {
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5（快速・預設）", tier: "default" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5（進階）", tier: "advanced" },
  ],
  openai: [
    { id: "gpt-5-mini", label: "GPT-5 mini（快速・預設）", tier: "default" },
    { id: "gpt-5", label: "GPT-5（進階）", tier: "advanced" },
  ],
  google: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash（快速・預設）", tier: "default" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro（進階）", tier: "advanced" },
  ],
};

const PROVIDER_OPTIONS: { id: ChatProviderId; label: string }[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google Gemini" },
];

/** 模型顯示名（不翻）；檔位文字（快速・預設／進階）依語系組合，MODEL_OPTIONS.label 維持中文給其他呼叫端。 */
const MODEL_NAMES: Record<string, string> = {
  "claude-haiku-4-5": "Claude Haiku 4.5",
  "claude-sonnet-5": "Claude Sonnet 5",
  "gpt-5-mini": "GPT-5 mini",
  "gpt-5": "GPT-5",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
};

const PERSIST_OPTIONS: { id: PersistChoice; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { id: "memory", labelKey: "chat.key.persist.memory", hintKey: "chat.key.persist.memoryHint" },
  { id: "session", labelKey: "chat.key.persist.session", hintKey: "chat.key.persist.sessionHint" },
  { id: "local", labelKey: "chat.key.persist.local", hintKey: "chat.key.persist.localHint" },
];

interface KeySettingsProps {
  /** 呼叫由整合層綁定的測試連線函式（本元件不實作） */
  onTestKey: (
    provider: ChatProviderId,
    model: string,
    key: string,
  ) => Promise<{ ok: boolean; message: string }>;
  /** 返回聊天畫面 */
  onDone: () => void;
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: RADIUS.lg,
    background: active ? COLORS.accentFaint : WHITE_ALPHA[4],
    border: `1px solid ${active ? COLORS.accentSoft : BORDER.mid}`,
    color: active ? COLORS.accent : COLORS.textMuted,
    fontFamily: FONT_CJK,
    fontSize: FONT_SIZE.md,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export function KeySettings({ onTestKey, onDone }: KeySettingsProps) {
  const { provider, model, persistChoice } = useChatStore();
  const { t } = useLocale();
  const [draftKey, setDraftKey] = useState(() => keyVault.get(provider) ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // provider 切換 → 重新載入該 provider 已存的 key + 清掉舊測試結果
  useEffect(() => {
    setDraftKey(keyVault.get(provider) ?? "");
    setTestResult(null);
  }, [provider]);

  const models = MODEL_OPTIONS[provider];
  const activeModel = models.some((m) => m.id === model) ? model : models[0]!.id;

  const handleKeyChange = (value: string) => {
    setDraftKey(value);
    setTestResult(null);
    if (value) {
      keyVault.set(provider, value, persistChoice);
    } else {
      keyVault.clear(provider);
    }
  };

  const handlePersistChange = (next: PersistChoice) => {
    chatStore.setPersistChoice(next);
    if (draftKey) keyVault.set(provider, draftKey, next);
  };

  const handleDelete = () => {
    keyVault.clear(provider);
    setDraftKey("");
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!draftKey || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTestKey(provider, activeModel, draftKey);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : t("chat.error.testFailed"),
      });
    } finally {
      setTesting(false);
    }
  };

  const last4 = draftKey.slice(-4);

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: SPACING.lg,
        padding: "14px 16px 18px", overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: 700, color: COLORS.textStrong }}>
          {t("chat.key.title")}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onDone} style={{ ...pillStyle(false), display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={13} /> {t("chat.key.back")}
        </button>
      </div>

      {/* Provider 三選 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px", color: COLORS.textFaint }}>
          PROVIDER
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PROVIDER_OPTIONS.map((p) => (
            <button
              key={p.id}
              onClick={() => chatStore.setProvider(p.id)}
              style={pillStyle(provider === p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 模型下拉 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px", color: COLORS.textFaint }}>
          MODEL
        </span>
        <select
          value={activeModel}
          onChange={(e) => chatStore.setModel(e.target.value)}
          style={{
            padding: "7px 10px", borderRadius: RADIUS.lg,
            background: WHITE_ALPHA[4], border: `1px solid ${BORDER.mid}`,
            color: COLORS.textDefault, fontFamily: FONT_CJK, fontSize: FONT_SIZE.md,
          }}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id} style={{ background: SURFACE.app }}>
              {MODEL_NAMES[m.id] ? t(m.tier === "advanced" ? "chat.key.modelAdvanced" : "chat.key.modelDefault", { name: MODEL_NAMES[m.id]! }) : m.label}
            </option>
          ))}
        </select>
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
          {t("chat.key.modelHint")}
        </span>
      </div>

      {/* Key 輸入 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px", color: COLORS.textFaint }}>
          API KEY
        </span>
        <input
          type="password"
          value={draftKey}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder={t("chat.key.placeholder")}
          autoComplete="off"
          style={{
            padding: "8px 10px", borderRadius: RADIUS.lg,
            background: WHITE_ALPHA[4], border: `1px solid ${BORDER.mid}`,
            color: COLORS.textDefault, fontFamily: FONT_DATA, fontSize: FONT_SIZE.md,
          }}
        />
        {draftKey && (
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
            {t("chat.key.saved", { last4 })}
          </span>
        )}
      </div>

      {/* 儲存位置 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px", color: COLORS.textFaint }}>
          {t("chat.key.storage")}
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERSIST_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handlePersistChange(opt.id)}
              title={t(opt.hintKey)}
              style={pillStyle(persistChoice === opt.id)}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
          {(() => { const o = PERSIST_OPTIONS.find((x) => x.id === persistChoice); return o ? t(o.hintKey) : null; })()}
        </span>
      </div>

      {/* 測試連線 + 刪除 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleTest}
          disabled={!draftKey || testing}
          style={{
            ...pillStyle(false),
            opacity: !draftKey || testing ? 0.5 : 1,
            cursor: !draftKey || testing ? "not-allowed" : "pointer",
          }}
        >
          {testing ? t("chat.key.testing") : t("chat.key.test")}
        </button>
        <button
          onClick={handleDelete}
          disabled={!draftKey}
          style={{
            ...pillStyle(false),
            opacity: !draftKey ? 0.5 : 1,
            cursor: !draftKey ? "not-allowed" : "pointer",
            color: draftKey ? COLORS.statusErr : COLORS.textMuted,
          }}
        >
          {t("chat.key.delete")}
        </button>
        {testResult && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            {testResult.ok ? (
              <CheckCircle2 size={13} color={COLORS.statusLive} />
            ) : (
              <AlertTriangle size={13} color={COLORS.statusErr} />
            )}
            <span
              style={{
                fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm,
                color: testResult.ok ? COLORS.statusLive : COLORS.statusErr,
              }}
            >
              {testResult.message}
            </span>
          </span>
        )}
      </div>

      {/* 風險說明 */}
      <div
        style={{
          padding: "10px 12px", borderRadius: RADIUS.lg,
          background: SURFACE.subtle, border: `1px solid ${BORDER.soft}`,
          display: "flex", gap: 8, alignItems: "flex-start",
        }}
      >
        <Info size={14} color={COLORS.textFaint} style={{ marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, lineHeight: 1.6 }}>
          {t("chat.key.risk")}
        </span>
      </div>
    </div>
  );
}
