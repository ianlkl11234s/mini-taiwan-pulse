/**
 * KeySettings — BYOK 金鑰設定頁（內嵌在 ChatPanel 內的一頁）
 *
 * provider / model 選擇 + key 輸入（含儲存位置）+ 測試連線 + 刪除金鑰。
 * key 讀寫一律透過 keyVault（src/lib/keyVault.ts），本檔不直接碰 storage。
 */
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import type { ChatModelOption, ChatProviderId } from "../../chat/types";
import { chatStore, useChatStore, type PersistChoice } from "../../state/chatStore";
import { keyVault } from "../../lib/keyVault";
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

const PERSIST_OPTIONS: { id: PersistChoice; label: string; hint: string }[] = [
  { id: "memory", label: "僅本次", hint: "重新整理頁面就會消失" },
  { id: "session", label: "本分頁記住", hint: "分頁關閉前有效" },
  { id: "local", label: "此瀏覽器記住", hint: "永久保存，需手動刪除" },
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
        message: err instanceof Error ? err.message : "測試連線失敗",
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
          金鑰設定
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onDone} style={{ ...pillStyle(false), display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={13} /> 返回對話
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
              {m.label}
            </option>
          ))}
        </select>
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
          統計、比較、顧問式問題建議用進階檔；輕量檔快但可能偷懶。
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
          placeholder="貼上你的 API key"
          autoComplete="off"
          style={{
            padding: "8px 10px", borderRadius: RADIUS.lg,
            background: WHITE_ALPHA[4], border: `1px solid ${BORDER.mid}`,
            color: COLORS.textDefault, fontFamily: FONT_DATA, fontSize: FONT_SIZE.md,
          }}
        />
        {draftKey && (
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
            已設定・末 4 碼 ****{last4}
          </span>
        )}
      </div>

      {/* 儲存位置 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px", color: COLORS.textFaint }}>
          儲存位置
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERSIST_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handlePersistChange(opt.id)}
              title={opt.hint}
              style={pillStyle(persistChoice === opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
          {PERSIST_OPTIONS.find((o) => o.id === persistChoice)?.hint}
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
          {testing ? "測試中…" : "測試連線"}
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
          刪除金鑰
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
          金鑰只存在你的瀏覽器（依上方選擇存在記憶體 / sessionStorage / localStorage），對話時直接連到對應服務商的
          API，本站伺服器不會經手也不會記錄金鑰內容。建議另外申請一把使用額度較低的專用 key（例如 OpenAI 專案 key
          設定月花費上限、Anthropic workspace key、或 Gemini 免費額度），降低外洩時的風險。
        </span>
      </div>
    </div>
  );
}
