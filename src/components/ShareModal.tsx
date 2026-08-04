/**
 * 分享／嵌入面板（EM-19）
 *
 * 因為網址已由 App 的雙向同步保持最新（相機／圖層／底圖／歷史日期都在裡面），
 * 這裡不重新計算狀態 —— 直接取用 `window.location`，把它翻成兩種可貼的形式：
 * 主站連結，以及指向 `/embed` 的 iframe 代碼。
 */
import { useEffect, useState } from "react";
import { COLORS, FONT_DATA, FONT_SIZE, RADIUS, SURFACE } from "../styles/designTokens";

/** 正式站網域：本機開發時分享 localhost 沒有意義，一律輸出線上網址 */
const PROD_ORIGIN = "https://mini-taiwan-pulse.itsmigu.com";

interface Props {
  open: boolean;
  onClose: () => void;
  isDarkTheme?: boolean;
}

function buildLinks() {
  const search = window.location.search || "?v=1";
  return {
    site: `${PROD_ORIGIN}/${search}`,
    embed: `${PROD_ORIGIN}/embed${search}`,
  };
}

function CopyBox({
  label, value, hint, isDark,
}: { label: string; value: string; hint: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;   // 權限被拒（非 https / 使用者拒絕）→ 使用者仍可手動選取
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: FONT_SIZE.md, fontWeight: 600, color: isDark ? COLORS.textDefault : "#222" }}>
          {label}
        </span>
        <span style={{ fontSize: FONT_SIZE.sm, color: isDark ? COLORS.textDim : "#777" }}>{hint}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <textarea
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          rows={value.length > 120 ? 3 : 2}
          style={{
            flex: 1, resize: "none",
            background: isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.04)",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)"}`,
            borderRadius: RADIUS.md, padding: "8px 10px",
            color: isDark ? "#dfe6ee" : "#222",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11.5, lineHeight: 1.55,
          }}
        />
        <button
          onClick={copy}
          style={{
            flexShrink: 0, minWidth: 62,
            background: copied ? "rgba(64,200,120,0.22)" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
            border: `1px solid ${copied ? "rgba(64,200,120,0.5)" : isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
            borderRadius: RADIUS.md, color: isDark ? "#fff" : "#333",
            fontSize: FONT_SIZE.sm, fontFamily: FONT_DATA, cursor: "pointer",
          }}
        >
          {copied ? "已複製" : "複製"}
        </button>
      </div>
    </div>
  );
}

export function ShareModal({ open, onClose, isDarkTheme = true }: Props) {
  const [links, setLinks] = useState(buildLinks);

  // 每次開啟都重讀網址（面板關著時使用者可能又移動了地圖）
  useEffect(() => {
    if (open) setLinks(buildLinks());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const iframeCode =
    `<iframe\n` +
    `  src="${links.embed}"\n` +
    `  width="100%" height="480" style="border:0;border-radius:10px"\n` +
    `  loading="lazy" title="Mini Taiwan Pulse"></iframe>`;

  const params = new URLSearchParams(window.location.search);
  const included = [
    params.has("lng") && "位置",
    params.has("z") && "縮放",
    params.has("pitch") && "傾角",
    params.has("layers") && `圖層 ${params.get("layers")!.split(",").length} 個`,
    params.has("style") && "底圖",
    params.has("date") && `日期 ${params.get("date")}${params.has("h") ? ` ${params.get("h")}時` : ""}`,
  ].filter(Boolean) as string[];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)", maxHeight: "86vh", overflowY: "auto",
          background: isDarkTheme ? SURFACE.strong : "#fff",
          border: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)"}`,
          borderRadius: RADIUS.lg, padding: "20px 22px",
          fontFamily: FONT_DATA,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17, color: isDarkTheme ? "#fff" : "#111" }}>分享目前畫面</h2>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1,
              color: isDarkTheme ? COLORS.textDim : "#888", padding: 4,
            }}
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        <p style={{ margin: "0 0 16px", fontSize: FONT_SIZE.sm, color: isDarkTheme ? COLORS.textDim : "#666" }}>
          包含：{included.length ? included.join("、") : "（尚未設定任何參數）"}
        </p>

        <CopyBox
          label="連結"
          hint="分享給別人，開啟即為此畫面"
          value={links.site}
          isDark={isDarkTheme}
        />
        <CopyBox
          label="嵌入文章"
          hint="貼進文章 HTML；嵌入版走免費底圖，不計 Mapbox 費用"
          value={iframeCode}
          isDark={isDarkTheme}
        />

        <p style={{ margin: 0, fontSize: FONT_SIZE.sm, color: isDarkTheme ? COLORS.textDim : "#777", lineHeight: 1.7 }}>
          ⚠️ 嵌入版只支援靜態圖層與已建快照的圖層；即時類圖層不會顯示。
          歷史畫面需先產生當日快照（<code style={{ fontSize: 11 }}>scripts/export/export-embed-snapshot.sh</code>）。
        </p>
      </div>
    </div>
  );
}
