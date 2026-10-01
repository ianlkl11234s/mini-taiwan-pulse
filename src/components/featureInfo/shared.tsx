import type { ReactNode } from "react";
import { RADIUS, FONT_SIZE, FONT_WEIGHT, FONT_DATA } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";

/**
 * Popup 內容共用標題 — 前置分類色點 + 粗體標題 + 下方分隔線（B 版規格，
 * 見 docs/features/ui-consistency-audit-20260927/proposal.md §6.1）。
 * 原本 13 個 domain 檔（culturePanels/religionPanels/educationPanels/…）
 * 各自複製同一段極簡本地版，此處收斂為單一 export，各檔改 import 此版本。
 */
export function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.bold,
        color: t.textStrong,
        borderBottom: `1px solid ${t.border}`,
        paddingBottom: 5,
        marginBottom: 4,
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      {children}
    </div>
  );
}

export function formatTaiwanTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function Row({ label, value, color, mono, title }: { label: string; value: string; color?: string; mono?: boolean; title?: string }) {
  const t = useFeatureTheme();
  if (!value || value === "null" || value === "undefined") return null;
  return (
    <div className="fi-row" style={{ display: "flex", gap: 8, padding: "3px 0", fontSize: FONT_SIZE.base, lineHeight: 1.3 }}>
      <span style={{ color: t.textMuted, flexShrink: 0, minWidth: 56, fontSize: FONT_SIZE.sm }}>{label}</span>
      <span
        title={title}
        style={{
          color: color ?? t.textStrong,
          wordBreak: "break-word",
          ...(mono ? { fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" as const } : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Popup 內容區高度上限；超過在 `PopupScroll` 內捲動，不撐高整個 popup。 */
export const POPUP_SCROLL_MAX_HEIGHT = 320;

export function PopupScroll({ children }: { children: ReactNode }) {
  return <div className="fi-scroll" style={{ maxHeight: POPUP_SCROLL_MAX_HEIGHT, overflowY: "auto", overscrollBehavior: "contain" }}>{children}</div>;
}

/** 收合區塊（預設收起），樣式與橋梁韌性 popup 的「說明與限制」一致。 */
export function PopupDetails({ summary, children }: { summary: string; children: ReactNode }) {
  const t = useFeatureTheme();
  return <details className="fi-details" style={{ marginTop: 6 }}>
    <summary style={{ cursor: "pointer", fontSize: FONT_SIZE.sm, color: t.textMuted, padding: "4px 0" }}>{summary}</summary>
    {children}
  </details>;
}

/**
 * AI 助手 highlight_point tool 的通用標記 panel。
 * properties 期望帶：label（選填標籤）、lng / lat（座標）。
 */
export function ChatHighlightPanel({ props }: { props: Record<string, unknown> }) {
  const label = typeof props.label === "string" ? props.label : "";
  const lng = Number(props.lng);
  const lat = Number(props.lat);
  const hasCoords = Number.isFinite(lng) && Number.isFinite(lat);
  return (
    <div>
      {label && <Row label="標記" value={label} />}
      {hasCoords && <Row label="座標" value={`${lng.toFixed(4)}, ${lat.toFixed(4)}`} mono />}
      {!label && !hasCoords && <Row label="標記" value="地圖標記點" />}
    </div>
  );
}

export function Badge({ label, on, color }: { label: string; on: boolean; color: string }) {
  const t = useFeatureTheme();
  return (
    <span style={{
      fontSize: FONT_SIZE.sm,
      padding: "1px 5px",
      borderRadius: RADIUS.sm,
      background: on ? color : t.bgStrong,
      color: on ? "#fff" : t.textDim,
      fontWeight: on ? 700 : 400,
    }}>
      {label}
    </span>
  );
}

export function numOrNull(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function formatNum(v: number | null, unit: string, digits = 1): string {
  if (v == null) return "";
  return `${v.toFixed(digits)} ${unit}`;
}

/**
 * 溯源清單正規化：跑 map.queryRenderedFeatures() 拿到的 properties 是 vector tile
 * 編碼後的結果——mapbox-gl-js 的 vt-pbf writeProperties() 對非 string/boolean/number
 * 的值一律 `JSON.stringify()`，所以巢狀 array（如 `_provenance`）到面板手上時常是
 * JSON 字串而非真陣列（Supabase RPC 直出的 loader 如 fossilFuelLoader 才會是真陣列）。
 * 兩種來源都要接得住。
 */
function toProvenanceArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    } catch {
      // 非合法 JSON，視為沒有溯源清單
    }
  }
  return [];
}

/**
 * 標準溯源 footer（F2 規格，見 proposal.md §6.1 / handoff.md §4a 第三輪拍板）——
 * 2026-09-27 起由 FeatureInfoPanel 統一在 content 後掛一次，各 panel 不再各自呼叫
 * （少數欄位需要 panel 端 enrich 常數值，或另有自訂溯源 UI 的例外見 FeatureInfoPanel.tsx）。
 * props 期望帶：source / source_org / source_url / license / fetched_at / source_tier
 * （無 source_org／source_url 時退用 attribution／attribution_href）。
 * canonical SSOT layer 多帶 provenance jsonb（會展成 details 列出）；
 * 部分 pipeline（如宗教）欄位名是 `_provenance`（底線開頭），兩者都接。
 *
 * F2：第一行「機關 · Tier N · 原始下載頁 ↗」（缺項省略）；第二行 license ＋ 抓取時間
 * （FONT_DATA 等寬）；完全沒有 org/url 時整段改顯示「來源資訊待補」（warn 色）。
 */
export function SourceFooter({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  // 部分 loader（如 gfwFishingEffortLoader）以 attribution / attribution_href 帶來源，一併視為來源。
  const org = String(props.source_org ?? props.source ?? props.attribution ?? "");
  const url = String(props.source_url ?? props.attribution_href ?? "");
  const license = String(props.license ?? "");
  const tier = props.source_tier;
  const fetched = String(props.fetched_at ?? "");
  const provenance = toProvenanceArray(props._provenance ?? props.provenance);
  const hasSource = Boolean(org || url);

  if (!hasSource) {
    return (
      <div
        className="fi-footer"
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid ${t.borderSoft}`,
          fontSize: FONT_SIZE.xs,
          color: t.warn,
        }}
      >
        資料來源 · 來源資訊待補
      </div>
    );
  }

  const firstLine = [org, tier == null ? "" : `Tier ${String(tier)}`].filter(Boolean);

  return (
    <div
      className="fi-footer"
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: `1px solid ${t.borderSoft}`,
        fontSize: FONT_SIZE.xs,
        color: t.textDim,
      }}
    >
      <div>
        {firstLine.join(" · ")}
        {url && (
          <>
            {firstLine.length > 0 ? " · " : ""}
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{ color: t.link, textDecoration: "none" }}
            >
              原始下載頁 ↗
            </a>
          </>
        )}
      </div>
      {(license || fetched) && (
        <div style={{ marginTop: 2, fontFamily: FONT_DATA }}>
          {license}
          {license && fetched ? " · " : ""}
          {fetched && `抓取於 ${fetched}`}
        </div>
      )}
      {provenance.length > 1 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: "pointer" }}>
            溯源 {provenance.length} 筆
          </summary>
          <ul style={{ margin: "4px 0 0 12px", padding: 0 }}>
            {provenance.map((p, i) => {
              const pTier = String(p.tier ?? "?");
              const pOrg = String(p.source_org ?? p.source ?? "");
              const pName = String(p.name_raw ?? "");
              const pUrl = String(p.source_url ?? "");
              return (
                <li key={i} style={{ marginTop: 2 }}>
                  Tier {pTier} · {pOrg}
                  {pName && pName !== String(props.name ?? "") ? ` ("${pName}")` : ""}
                  {pUrl && (
                    <>
                      {" · "}
                      <a
                        href={pUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: t.link }}
                      >
                        原始頁
                      </a>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
