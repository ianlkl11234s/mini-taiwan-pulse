/**
 * 領土格的介面字：正本在 `src/i18n/locales/<語系>/territory.json`（中文是正本），這裡只把 t() 包成好用的物件。
 * 屬性名稱、tag、單位、來源來自 attributes.json（資料內容），維持中文，不在這裡翻。
 */
import { useMemo } from "react";
import { useLocale, type LocaleSnapshot } from "../state/localeStore";

export function territoryText(t: LocaleSnapshot["t"]) {
  return {
    rail: t("territory.rail"),
    panelEyebrow: t("territory.panelEyebrow"),
    panelTitle: t("territory.panelTitle"),
    intro: t("territory.intro"),
    tagSection: t("territory.tagSection"),
    tagHint: t("territory.tagHint"),
    attrSection: t("territory.attrSection"),
    attrHint: t("territory.attrHint"),
    clearColor: t("territory.clearColor"),
    opacity: t("territory.opacity"),
    uncovered: t("territory.uncovered"),
    legendGrayBase: t("territory.legendGrayBase"),
    legendOther: t("territory.legendOther"),
    legendLowHigh: t("territory.legendLowHigh"),
    legendLowHighDistance: t("territory.legendLowHighDistance"),
    legendScore: t("territory.legendScore"),
    legendNoBreaks: t("territory.legendNoBreaks"),
    legendNoStatsAtRes: t("territory.legendNoStatsAtRes"),
    legendZeroSplit: t("territory.legendZeroSplit"),
    legendMeters: t("territory.legendMeters"),
    loading: t("territory.loading"),
    loadFailed: t("territory.loadFailed"),
    resNote: (label: string) => t("territory.resNote", { label }),
    coverageOnly: (areas: string) => t("territory.coverageOnly", { areas }),
    allExcept: (list: string) => t("territory.allExcept", { list }),
    zoomOut: t("territory.zoomOut"),
    bizGroup: (n: number) => t("territory.bizGroup", { n }),
    bizRow: t("territory.bizRow"),
    bizOther: (n: number) => t("territory.bizOther", { n }),
    bizNone: t("territory.bizNone"),
    villageValue: t("territory.villageValue"),
    villageValueNote: t("territory.villageValueNote"),
    cardEyebrow: t("territory.cardEyebrow"),
    cardClose: t("territory.cardClose"),
    beatAll: (n: number) => t("territory.beatAll", { n }),
    beatArea: (n: number, area: string) => t("territory.beatArea", { n, area }),
    rankNation: t("territory.rankNation"),
    rankCounty: t("territory.rankCounty"),
    rankScopeLabel: t("territory.rankScopeLabel"),
    countySuffix: t("territory.countySuffix"),
    /** res9 房價中位數本格成交不足、取自所屬 res8 格 */
    fromNeighbour: t("territory.fromNeighbour"),
    /** 解析度白話（H3 平均邊長：res7 約 1.2 km、res8 約 460 m、res9 約 170 m，站主拍板 res9 叫「約 200 公尺格」） */
    resLabel: (res: number): string | null =>
      res === 7 ? t("territory.res.7") : res === 8 ? t("territory.res.8") : res === 9 ? t("territory.res.9") : null,
    scoreLabel: (key: ScoreKey) => t(SCORE_TEXT_KEYS[key].label),
    scoreBlurb: (key: ScoreKey, county: boolean) =>
      t(county && key === "score_wealth" ? "territory.score.wealth.blurbCounty" : SCORE_TEXT_KEYS[key].blurb),
  };
}
export type TerritoryText = ReturnType<typeof territoryText>;

/** 元件用：語系切換時跟著換字 */
export function useTerritoryText(): TerritoryText {
  const { t } = useLocale();
  return useMemo(() => territoryText(t), [t]);
}

/** 三個標籤（站主拍板名稱；不叫治安） */
export const SCORE_TAGS = [
  { key: "score_response" },
  { key: "score_wealth" },
  { key: "score_convenience" },
] as const;
export type ScoreKey = (typeof SCORE_TAGS)[number]["key"];

const SCORE_TEXT_KEYS = {
  score_response: { label: "territory.score.response.label", blurb: "territory.score.response.blurb" },
  score_wealth: { label: "territory.score.wealth.label", blurb: "territory.score.wealth.blurb" },
  score_convenience: { label: "territory.score.convenience.label", blurb: "territory.score.convenience.blurb" },
} as const;

/** 屬性區的 tag 顯示順序（契約的 tag 列舉，資料值；「標籤」由上方三顆大按鈕處理，不在屬性區重列） */
export const TAG_ORDER = ["交通", "生活機能", "應變", "房價", "產業", "土地", "人口", "地形"] as const;

/** 領土格屬性載入的 loadingRegistry 標籤（同其他 loader 用中文） */
export const TERRITORY_LOADING_LABEL = "領土格屬性";
