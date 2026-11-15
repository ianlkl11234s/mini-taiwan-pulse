/**
 * W6-8：綜合聲景「這格為什麼是這個結果」的白話一句。滑過提示與點選面板共用這一支（同輸入同字）。
 * 輸入只有七族分級（依 COMPOSITE_FAMILIES 順序；null＝無法判斷）與三版的碼：滑過時來自 Worker 當前幀的打包，
 * 面板來自 compositeCell(該格七碼).terms——兩者是同一套分級，不另算、不呼叫 queryReceiver。
 * 無法判斷的族照實寫「N 種無法判斷」，不當成沒有；不出現 dB。
 */
import type { MessageKey } from "../../i18n/keys";
import { COMPOSITE_FAMILIES, COMPOSITE_FAMILY_COUNT, compositeIndexOfCode, decodeCompositeC, type CompositeFamily } from "../../sound/grid/compositeGrid";
import type { CompositeVariant } from "../../sound/grid/compositePreview";
import { GRID_UNKNOWN } from "../../sound/grid/gridSpec";
import { COMPOSITE } from "../../sound/model/soundProfiles";
import { FAMILY_KEYS, rainClassKey, roadLevelKey } from "./soundAtlasText";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

const LEVEL_KEYS = ["soundAtlas.level.0", "soundAtlas.level.1", "soundAtlas.level.2", "soundAtlas.level.3", "soundAtlas.level.4"] as const;
const A_LEVEL_KEYS = ["soundAtlas.composite.level.0", "soundAtlas.composite.level.1", "soundAtlas.composite.level.2"] as const;
const MAX_LISTED = 3;

/** 白話句用的短族名（道路、河川去掉「（推估）」「（研究）」，避免「道路車流（推估）（中）」雙括號） */
export function reasonFamilyName(t: T, f: CompositeFamily): string {
  if (f === "road_traffic") return t("soundAtlas.reason.family.roadTraffic");
  if (f === "river_water") return t("soundAtlas.reason.family.river");
  return t(FAMILY_KEYS[f]);
}

/** 一族一級的文字（雨用雨勢分級、道路用道路五級、其他用五級潛勢） */
export function familyLevelText(t: T, f: CompositeFamily, level: number): string {
  if (f === "rain") return t(rainClassKey(level));
  if (f === "road_traffic") return t(roadLevelKey(level));
  return t(LEVEL_KEYS[level as 0 | 1 | 2 | 3 | 4] ?? "soundAtlas.level.unknown");
}

/** 「偏活躍」（甲的門檻，各族「中」以上）的族，分級高者在前、同級依族序；面板的依據段也用這個順序 */
export function activeFamilies(levels: readonly (number | null)[]): { family: CompositeFamily; level: number }[] {
  const out: { family: CompositeFamily; level: number }[] = [];
  levels.forEach((l, i) => {
    const f = COMPOSITE_FAMILIES[i]!;
    if (l != null && l >= COMPOSITE.activeMinLevel.value[f]!) out.push({ family: f, level: l });
  });
  return out.sort((a, b) => b.level - a.level);
}

export interface CompositeReason {
  /** 開頭（例：熱鬧、平靜、主因：鐵道（很高）、無法判斷） */
  head: string;
  /** 白話原因（例：鐵道（很高）、飛機（中）） */
  detail: string;
}

export function compositeReason(
  t: T,
  levels: readonly (number | null)[],
  variant: CompositeVariant,
  codes: { a: number; b: number; c: number },
  /** 句尾帶「（N 種無法判斷）」：滑過提示要（沒有別處寫）；點選面板另有「無法判斷：…」一行，傳 false 避免重複 */
  withUnknownSuffix = true,
): CompositeReason {
  const known = levels.filter((l) => l != null).length;
  const unknown = COMPOSITE_FAMILY_COUNT - known;
  const whole = variant === "b" ? codes.b === GRID_UNKNOWN : variant === "c" ? codes.c === GRID_UNKNOWN : codes.a === GRID_UNKNOWN;
  if (whole) return { head: t("soundAtlas.reason.unknownHead"), detail: t("soundAtlas.reason.onlyKnown", { known, total: COMPOSITE_FAMILY_COUNT }) };
  const suffix = withUnknownSuffix && unknown > 0 ? t("soundAtlas.reason.unknownSuffix", { n: unknown }) : "";
  const list = (items: { family: CompositeFamily; level: number }[]) => {
    const shown = items.slice(0, MAX_LISTED).map((x) => t("soundAtlas.reason.item", { family: reasonFamilyName(t, x.family), level: familyLevelText(t, x.family, x.level) }));
    const more = items.length > MAX_LISTED ? t("soundAtlas.reason.more", { n: items.length - MAX_LISTED }) : "";
    return shown.join(t("soundAtlas.reason.sep")) + more;
  };
  if (variant === "c") {
    const top = decodeCompositeC(codes.c);
    if (!top) return { head: t("soundAtlas.composite.level.0"), detail: t("soundAtlas.reason.noneLow", { known }) + suffix };
    const fi = COMPOSITE_FAMILIES.indexOf(top.family);
    const level = levels[fi] ?? top.level;
    const others = levels
      .map((l, i) => ({ family: COMPOSITE_FAMILIES[i]!, level: l ?? -1 }))
      .filter((x, i) => i !== fi && x.level >= 1)
      .sort((a, b) => b.level - a.level);
    return {
      head: t("soundAtlas.reason.topHead", { family: reasonFamilyName(t, top.family), level: familyLevelText(t, top.family, level) }),
      detail: (others.length > 0 ? t("soundAtlas.reason.also", { list: list(others) }) : t("soundAtlas.reason.onlyOne")) + suffix,
    };
  }
  const active = activeFamilies(levels);
  const head = variant === "b"
    ? t("soundAtlas.reason.indexHead", { index: (compositeIndexOfCode(codes.b) ?? 0).toFixed(2) })
    : t(A_LEVEL_KEYS[codes.a as 0 | 1 | 2] ?? "soundAtlas.composite.level.0");
  if (active.length === 0) return { head, detail: t(known === COMPOSITE_FAMILY_COUNT ? "soundAtlas.reason.allQuiet" : "soundAtlas.reason.knownQuiet", { known }) + suffix };
  return { head, detail: list(active) + suffix };
}
