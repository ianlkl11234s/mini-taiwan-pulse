/**
 * 分享／嵌入面板（EM-19，UI 統一第二輪 Phase P）
 *
 * 因為網址已由 App 的雙向同步保持最新（相機／圖層／底圖／歷史日期都在裡面），
 * 這裡不重新計算狀態 —— 直接取用 `window.location`，把它翻成兩種可貼的形式：
 * 主站連結，以及指向 `/embed` 的 iframe 代碼。
 */
import { useEffect, useRef, useState } from "react";
import { Copy, X } from "lucide-react";
import { BORDER, COLORS, CONTROL, FONT_CJK, FONT_DATA, FONT_SIZE, LIGHT, RADIUS, SURFACE } from "../styles/designTokens";

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

/** 兩個欄位共用：標籤＋值欄＋複製鈕，寬度與按鈕寬度對齊（grid 1fr auto，鈕固定寬） */
function CopyBox({
  label, value, hint, isDark,
}: { label: string; value: string; hint: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const valueRef = useRef<HTMLTextAreaElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      valueRef.current?.select();   // 權限被拒（非 https / 使用者拒絕）→ 直接選取，提示使用者手動複製
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const textStrong = isDark ? COLORS.textStrong : LIGHT.textStrong;
  const textDim = isDark ? COLORS.textDim : LIGHT.textDim;
  const controlBg = isDark ? CONTROL.bg : LIGHT.controlBg;
  const controlBorder = isDark ? CONTROL.border : LIGHT.controlBorder;
  const accent = isDark ? COLORS.accent : LIGHT.accent;
  const accentFaint = isDark ? COLORS.accentFaint : LIGHT.accentFaint;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: textStrong, marginBottom: 4 }}>
        {label}
        <span style={{ fontWeight: 400, color: textDim, fontSize: 10, marginLeft: 6 }}>{hint}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "stretch" }}>
        <textarea
          ref={valueRef}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          rows={value.length > 120 ? 3 : 2}
          style={{
            resize: "none", minWidth: 0,
            background: controlBg,
            border: `1px solid ${controlBorder}`,
            borderRadius: RADIUS.md, padding: "6px 8px",
            color: isDark ? COLORS.textDefault : LIGHT.textDefault,
            fontFamily: FONT_DATA,
            fontSize: 10.5, lineHeight: 1.5,
          }}
        />
        <button
          onClick={copy}
          style={{
            width: 74, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            background: copied ? accentFaint : controlBg,
            border: `1px solid ${copied ? accent : controlBorder}`,
            borderRadius: RADIUS.md,
            color: copied ? accent : textStrong,
            fontWeight: copied ? 600 : 500,
            fontSize: FONT_SIZE.base, fontFamily: "inherit", cursor: "pointer",
          }}
        >
          <Copy size={12} />
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

  const border = isDarkTheme ? BORDER.panel : LIGHT.border;
  const textDim = isDarkTheme ? COLORS.textDim : LIGHT.textDim;
  const statusWarn = isDarkTheme ? COLORS.statusWarn : LIGHT.statusWarn;
  const warnBorder = isDarkTheme ? "rgba(255,152,0,0.4)" : "rgba(194,65,12,0.4)";

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
          width: "min(520px, 100%)", maxHeight: "86vh", overflowY: "auto",
          background: isDarkTheme ? SURFACE.strong : "#fff",
          border: `1px solid ${border}`,
          borderRadius: RADIUS.xl,
          fontFamily: FONT_CJK,
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 14px", borderBottom: `1px solid ${border}`,
        }}>
          <div>
            <div style={{ fontSize: 9, color: textDim, letterSpacing: 1.4 }}>分享</div>
            <h2 style={{ margin: "1px 0 0", fontSize: FONT_SIZE.lg, fontWeight: 700, color: isDarkTheme ? COLORS.textStrong : LIGHT.textStrong }}>
              分享目前畫面
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="關閉分享目前畫面"
            style={{
              width: 24, height: 24, borderRadius: RADIUS.md,
              background: "transparent", border: "none", color: textDim,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "12px 14px" }}>
          <p style={{ margin: "0 0 14px", fontSize: FONT_SIZE.sm, color: textDim }}>
            包含：{included.length ? included.join("、") : "（尚未設定任何參數）"}
          </p>

          <CopyBox
            label="連結"
            hint="開啟即為此畫面（位置、縮放、底圖）"
            value={links.site}
            isDark={isDarkTheme}
          />
          <CopyBox
            label="嵌入文章"
            hint="貼進文章 HTML；嵌入版走免費底圖，不計 Mapbox 費用"
            value={iframeCode}
            isDark={isDarkTheme}
          />

          <div style={{
            fontSize: 10.5, color: statusWarn, lineHeight: 1.5,
            border: `1px solid ${warnBorder}`, borderRadius: RADIUS.md, padding: "5px 8px",
          }}>
            嵌入版只支援靜態圖層與已建快照的圖層；即時類圖層不會顯示。
            歷史畫面需先產生當日快照（<code style={{ fontFamily: FONT_DATA, fontSize: 10 }}>scripts/export/export-embed-snapshot.sh</code>）。
          </div>
        </div>
      </div>
    </div>
  );
}
