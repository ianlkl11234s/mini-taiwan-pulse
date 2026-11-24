import { createContext, useContext, type ReactNode } from "react";
import type { PopupSourceMode } from "../../data/layerSourceInfo";
import { RADIUS, FONT_SIZE, FONT_WEIGHT, FONT_DATA } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { LOCALES } from "../../i18n/locales";
import type { StaticMessageKey } from "../../i18n/keys";
import { localeStore, useLocale } from "../../state/localeStore";

/** 共用欄位名（`popup.field.<名>`，見 locales/<語系>/popup.json）。新增常用欄位時加進 popup.json。 */
export type PopupField = StaticMessageKey extends infer K ? (K extends `popup.field.${infer F}` ? F : never) : never;

/** 含組合附加符號（U+0300–036F）的字串：上游常是 NFD（o + ̣），顯示前合成 NFC。只動顯示，不動 ID／篩選值。 */
const COMBINING_MARK = /[\u0300-\u036f]/;
/** 越南文專用字母（ơ ư đ 與 U+1EA0–1EF9 帶聲調字母）。PingFang TC 沒有 U+1Exx 預組字形，會拆成 o + ̣ 自己畫、點對錯位置。 */
const VIETNAMESE_CHAR = /[\u01a0\u01a1\u01af\u01b0\u0110\u0111\u1ea0-\u1ef9]/;

/**
 * Popup 顯示用文字：NFD 轉 NFC，含越南文字母時回 `lang="vi"`，
 * 讓 tokens.css 的 `[lang="vi"]` 改用拉丁字型在前的字族（spec §4.1）。
 */
export function popupText(value: string): { text: string; lang?: "vi" } {
  const text = COMBINING_MARK.test(value) ? value.normalize("NFC") : value;
  return VIETNAMESE_CHAR.test(text) ? { text, lang: "vi" } : { text };
}

/**
 * Popup 內容共用標題 — 前置分類色點 + 粗體標題 + 下方分隔線（B 版規格，
 * 見 docs/features/ui-consistency-audit-20260927/proposal.md §6.1）。
 * 原本 13 個 domain 檔（culturePanels/religionPanels/educationPanels/…）
 * 各自複製同一段極簡本地版，此處收斂為單一 export，各檔改 import 此版本。
 */
export function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  const shown = popupText(children);
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
      {shown.lang ? <span lang={shown.lang}>{shown.text}</span> : shown.text}
    </div>
  );
}

export function formatTaiwanTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(LOCALES[localeStore.getSnapshot().active].intl, {
      timeZone: "Asia/Taipei",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatTaiwanParts(iso: string | null, options: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(LOCALES[localeStore.getSnapshot().active].intl, { timeZone: "Asia/Taipei", hour12: false, ...options });
}

/** 日期＋時分（取代 `formatTaiwanTime(x).slice(0, 16)`，各語系格式正確） */
export function formatTaiwanMinute(iso: string | null): string {
  return formatTaiwanParts(iso, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** 月日＋時分（取代 `formatTaiwanTime(x).slice(5, 16)`） */
export function formatTaiwanShort(iso: string | null): string {
  return formatTaiwanParts(iso, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * 欄位列。欄位名二擇一：
 * - `field="address"`：共用欄位（popup.field.*），Row 自己依語系翻譯，面板不必呼叫 useLocale
 * - `label`：面板自己給的字串（已翻譯或尚未搬遷的中文）
 */
export function Row({ label, field, value, color, mono, title }: { label?: string; field?: PopupField; value: string; color?: string; mono?: boolean; title?: string }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const shownLabel = field ? tr(`popup.field.${field}`) : label;
  if (!value || value === "null" || value === "undefined") return null;
  const shown = popupText(value);
  return (
    <div className="fi-row" style={{ display: "flex", gap: 8, padding: "3px 0", fontSize: FONT_SIZE.base, lineHeight: 1.3 }}>
      <span style={{ color: t.textMuted, flexShrink: 0, minWidth: 56, fontSize: FONT_SIZE.sm }}>{shownLabel}</span>
      <span
        title={title}
        lang={mono ? undefined : shown.lang}
        style={{
          color: color ?? t.textStrong,
          wordBreak: "break-word",
          ...(mono ? { fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" as const } : {}),
        }}
      >
        {shown.text}
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
  const { t } = useLocale();
  const label = typeof props.label === "string" ? props.label : "";
  const lng = Number(props.lng);
  const lat = Number(props.lat);
  const hasCoords = Number.isFinite(lng) && Number.isFinite(lat);
  return (
    <div>
      {label && <Row label={t("popup.common.marker")} value={label} />}
      {hasCoords && <Row label={t("popup.common.coordinates")} value={`${lng.toFixed(4)}, ${lat.toFixed(4)}`} mono />}
      {!label && !hasCoords && <Row label={t("popup.common.marker")} value={t("popup.common.mapMarker")} />}
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
 * popup 來源列的顯示方式（站主 2026-11-23：來源與資料說明放圖層的「說明・來源」，popup 只放使用者需要的資料）。
 * FeatureInfoPanel 依 `popupSourceMode(layerType)` 提供；popup 以外（衛星主控台、設計系統頁）沒有 provider，維持 `legacy` 原樣。
 */
export type SourceFooterMode = PopupSourceMode | "legacy";
const SourceFooterModeContext = createContext<SourceFooterMode>("legacy");
export const SourceFooterModeProvider = SourceFooterModeContext.Provider;

/**
 * 溯源 footer。props 期望帶：source / source_org / source_url / license / fetched_at / source_tier
 * （無 source_org／source_url 時退用 attribution／attribution_href）；provenance／_provenance 會展成 details。
 *
 * popup 內（spec §5.2）：
 * - `none`：圖層側已有機關＋授權，不顯示。
 * - `compact`：逐筆來源不同，只留一行「機關 · 來源 ↗」，不放 Tier、授權、抓取時間。
 * - `full`：圖層側還補不到，一行「機關 · 授權 · 來源 ↗」；完全沒有機關／連結時顯示「來源資訊待補」。
 * `legacy`（popup 以外）：第一行「機關 · Tier N · 原始下載頁 ↗」，第二行授權＋抓取時間。
 */
export function SourceFooter({ props }: { props: Record<string, unknown> }) {
  const mode = useContext(SourceFooterModeContext);
  if (mode === "none") return null;
  return mode === "legacy" ? <LegacySourceFooter props={props} /> : <PopupSourceLine props={props} withLicense={mode === "full"} />;
}

function PopupSourceLine({ props, withLicense }: { props: Record<string, unknown>; withLicense: boolean }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const org = String(props.source_org ?? props.source ?? props.attribution ?? "");
  const url = String(props.source_url ?? "") || String(props.attribution_href ?? "");
  const license = withLicense ? String(props.license ?? "") : "";
  const provenance = toProvenanceArray(props._provenance ?? props.provenance);
  const style = { marginTop: 10, paddingTop: 8, borderTop: `1px solid ${t.borderSoft}`, fontSize: FONT_SIZE.xs, color: t.textDim } as const;
  if (!org && !url) {
    if (!withLicense) return null;
    return <div className="fi-footer" style={{ ...style, color: t.warn }}>{tr("popup.common.sourceLabel")} · {tr("popup.common.sourceMissing")}</div>;
  }
  const text = [org, license].filter(Boolean).join(" · ");
  return (
    <div className="fi-footer" style={style}>
      {text}
      {url && (
        <>
          {text ? " · " : ""}
          <a href={url} target="_blank" rel="noreferrer" style={{ color: t.link, textDecoration: "none" }}>{tr("popup.common.sourceLink")}</a>
        </>
      )}
      {provenance.length > 1 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: "pointer" }}>{tr("popup.common.provenanceCount", { count: provenance.length })}</summary>
          <ul style={{ margin: "4px 0 0 12px", padding: 0 }}>
            {provenance.map((p, i) => {
              const pOrg = String(p.source_org ?? p.source ?? "");
              const pUrl = String(p.source_url ?? "");
              return (
                <li key={i} style={{ marginTop: 2 }}>
                  {pOrg}
                  {pUrl && <>{pOrg ? " · " : ""}<a href={pUrl} target="_blank" rel="noreferrer" style={{ color: t.link }}>{tr("popup.common.originalPage")}</a></>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

function LegacySourceFooter({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  // 部分 loader（如 gfwFishingEffortLoader）以 attribution / attribution_href 帶來源，一併視為來源。
  const org = String(props.source_org ?? props.source ?? props.attribution ?? "");
  // 下載頁與出處頁分開：attribution_href 是出處／供應商頁，不是「原始下載頁」
  const url = String(props.source_url ?? "");
  const attributionUrl = String(props.attribution_href ?? "");
  const license = String(props.license ?? "");
  const tier = props.source_tier;
  const fetched = String(props.fetched_at ?? "");
  const provenance = toProvenanceArray(props._provenance ?? props.provenance);
  const hasSource = Boolean(org || url || attributionUrl);

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
        {tr("popup.common.sourceLabel")} · {tr("popup.common.sourceMissing")}
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
              {tr("popup.common.originalDownload")}
            </a>
          </>
        )}
        {attributionUrl && attributionUrl !== url && (
          <>
            {firstLine.length > 0 || url ? " · " : ""}
            <a
              href={attributionUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: t.link, textDecoration: "none" }}
            >
              {tr("popup.common.sourceLink")}
            </a>
          </>
        )}
      </div>
      {(license || fetched) && (
        <div style={{ marginTop: 2, fontFamily: FONT_DATA }}>
          {license}
          {license && fetched ? " · " : ""}
          {fetched && tr("popup.common.fetchedAt", { time: fetched })}
        </div>
      )}
      {provenance.length > 1 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: "pointer" }}>
            {tr("popup.common.provenanceCount", { count: provenance.length })}
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
                        {tr("popup.common.originalPage")}
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
