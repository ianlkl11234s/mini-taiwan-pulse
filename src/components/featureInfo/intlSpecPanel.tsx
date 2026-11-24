// 規格驅動 popup 引擎（B1 P2，2026-11-24）：菲律賓第 0–1 波寫的 `makePhPanel`，中國、泰國、越南重用，
// 從 phPanels 搬到中性檔，國家 panel 不再互相 import。本檔不得 import 任何國家模組。
import type { FC } from "react";
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { caText, phCatOf, phText, pickL3, type PhField, type PhLayerSpec } from "../../data/intlLayerShared";

type P = { props: Record<string, unknown> };

export function fmtNum(v: unknown, digits = 0): string {
  const s = caText(v);
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "";
}

/** 上游的空值字樣（GFI 的 'nan'、'None'、NAMRIA 的 '..'）一律當空值，不顯示。 */
const EMPTY_TOKENS = new Set(["nan", "NaN", "None", "null", "..", "…"]);

/** 資料端把含個人稱謂／聯絡方式的欄位清空並標 `<欄>_redacted`（owner_th 標 owner_redacted）：顯示遮蔽字樣，不留空白。 */
const REDACTED_TEXT = { zh: "（個人名義，已遮蔽）", en: "(personal name, redacted)", ja: "（個人名義、秘匿）" } as const;
function isRedactedField(f: PhField, props: Record<string, unknown>): boolean {
  const flag = f.prop === "owner_th" ? props.owner_redacted : props[`${f.prop}_redacted`];
  return (flag === true || flag === "true") && !caText(props[f.prop]);
}

function formatField(f: PhField, props: Record<string, unknown>, locale: string): string {
  if (isRedactedField(f, props)) return locale === "en" ? REDACTED_TEXT.en : locale === "ja" ? REDACTED_TEXT.ja : REDACTED_TEXT.zh;
  const raw = EMPTY_TOKENS.has(caText(props[f.prop])) ? "" : props[f.prop];
  if (f.unlessSameAs && caText(raw) === caText(props[f.unlessSameAs])) return "";
  if (f.kind === "year") {
    // GFI 數值欄是字串（'2004.0'）：轉數字後取整，不加千分位
    const n = Number(caText(raw));
    return caText(raw) !== "" && Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "";
  }
  if (f.kind === "num") {
    const s = fmtNum(raw, f.digits ?? 0);
    return s ? `${s}${f.unit ? ` ${phText(f.unit, locale)}` : ""}` : "";
  }
  const s = caText(raw);
  if (!s) return "";
  if (f.map?.[s]) return pickL3(f.map[s]!, locale);
  return s;
}

export function makePhPanel(spec: PhLayerSpec<string>): FC<P> {
  return function PhDataPanel({ props }) {
    const { locale } = useLocale();
    const cat = phCatOf(spec, props);
    let title = spec.title.props.map((p) => caText(props[p])).find(Boolean);
    if (!title && spec.title.fallbackBy) {
      const t = spec.title.fallbackBy.map[caText(props[spec.title.fallbackBy.prop])];
      if (t) title = pickL3(t, locale);
    }
    return <>
      <Title color={cat?.color ?? spec.otherColor ?? spec.color}>{title || pickL3(spec.title.fallback, locale)}</Title>
      {spec.fields.map((f) => <Row key={f.prop} label={pickL3(f.label, locale)} value={formatField(f, props, locale)} mono={f.kind === "code"} />)}
      {/* 每筆都一樣的備註在圖層「說明・來源」（layerSourceInfo）；popup 只留對這筆成立的條件備註 */}
      {spec.popupNotes.filter((n) => n.when?.(props)).map((n, i) => <Row key={i} label={locale === "en" ? "Note" : locale === "ja" ? "備考" : "備註"} value={pickL3(n.text, locale)} />)}
      <SourceFooter props={{ source_org: phText(spec.sourceOrg, locale), source_url: spec.sourceUrl, license: phText(spec.license, locale), fetched_at: spec.fetchedAt }} />
    </>;
  };
}
