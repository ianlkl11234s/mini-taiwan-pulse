// 長期時間條與圖層標記的顯示文字（STANDARD.md §2 第 2、7、11 條）：
// 一律由 manifest `longTerm` 產生；台灣圖層顯示民國年並附西元，其他國家只用西元。
import { LAYER_MANIFEST } from "../../data/layerManifest";
import type { LongTermGranularity, LongTermSpec } from "../../data/layerLongTerm";
import { coverageEnd, rocYear, type LongTermPeriod } from "../../lib/longTermTime";
import { localizeLayerName } from "../../i18n/layerText";
import type { LocaleSnapshot } from "../../state/localeStore";

type T = LocaleSnapshot["t"];
type Entry = { country?: string; name?: { zh: string; alt?: string; qualifier?: string } };
const entryOf = (key: string) => (LAYER_MANIFEST as unknown as Record<string, Entry>)[key];

/** 台灣圖層（顯示民國年） */
export function usesRocYear(key: string): boolean {
  return entryOf(key)?.country === "TW";
}

const GRANULARITY_KEY = {
  day: "longTerm.granularity.day",
  month: "longTerm.granularity.month",
  quarter: "longTerm.granularity.quarter",
  year: "longTerm.granularity.year",
} as const;

const UNIT_KEY = {
  day: "longTerm.bar.unit.day",
  month: "longTerm.bar.unit.month",
  quarter: "longTerm.bar.unit.quarter",
  year: "longTerm.bar.unit.year",
} as const;

export function granularityText(g: LongTermGranularity, t: T): string {
  return t(GRANULARITY_KEY[g]);
}

/** 每根長條的單位（「每根＝1 個月」） */
export function granularityUnitText(g: LongTermGranularity, t: T): string {
  return t(UNIT_KEY[g]);
}

/** 涵蓋文字，例「111–113 年（2022–2024）」。 */
export function coverageText(key: string, spec: LongTermSpec, t: T): string {
  const from = Number(spec.coverage.start.slice(0, 4));
  const to = Number(coverageEnd(spec.coverage).slice(0, 4));
  const ongoing = spec.coverage.end === "ongoing";
  if (usesRocYear(key)) {
    if (ongoing) return t("longTerm.coverage.rocOngoing", { from: rocYear(from), adFrom: from });
    if (from === to) return t("longTerm.coverage.rocSingle", { from: rocYear(from), adFrom: from });
    return t("longTerm.coverage.rocRange", { from: rocYear(from), to: rocYear(to), adFrom: from, adTo: to });
  }
  if (ongoing) return t("longTerm.coverage.adOngoing", { from });
  if (from === to) return t("longTerm.coverage.adSingle", { from });
  return t("longTerm.coverage.adRange", { from, to });
}

/** 圖層標記 tooltip，例「111–113 年（2022–2024）・每月」。 */
export function badgeTipText(key: string, spec: LongTermSpec, t: T): string {
  return t("longTerm.badge.tip", { coverage: coverageText(key, spec, t), granularity: granularityText(spec.granularity, t) });
}

const p2 = (n: number | undefined) => String(n ?? 1).padStart(2, "0");

/** 期別短標，例台灣月「112/04」、其他國家「2023-04」。 */
export function periodLabel(key: string, p: LongTermPeriod | undefined, g: LongTermGranularity, t: T): string {
  if (!p) return "";
  const roc = usesRocYear(key);
  const y = roc ? rocYear(p.year) : p.year;
  const sep = roc ? "/" : "-";
  if (g === "year") return roc ? t("longTerm.period.rocYear", { roc: y, ad: p.year }) : String(p.year);
  if (g === "quarter") return `${y} Q${p.quarter ?? 1}`;
  if (g === "month") return `${y}${sep}${p2(p.month)}`;
  return `${y}${sep}${p2(p.month)}${sep}${p2(p.day)}`;
}

/** 年份軸標，例「112 年（2023）」。 */
export function yearAxisLabel(key: string, adYear: number, t: T): string {
  return usesRocYear(key) ? t("longTerm.period.rocYear", { roc: rocYear(adYear), ad: adYear }) : String(adYear);
}

export function rangeLabel(key: string, periods: readonly LongTermPeriod[], a: number, b: number, g: LongTermGranularity, t: T): string {
  const left = periodLabel(key, periods[a], g, t);
  return a === b ? left : `${left} – ${periodLabel(key, periods[b], g, t)}`;
}

/** 圖層顯示名（依語系）。 */
export function layerDisplayName(key: string, i18n: LocaleSnapshot): string {
  const name = entryOf(key)?.name;
  if (!name) return key;
  return localizeLayerName(key, name, i18n).primary;
}
