/**
 * 30 天地圖挑戰 Day 21「OSM」（模擬入口，2026-11-21）：雙北＋基隆道路是哪一年畫進 OpenStreetMap。
 * 網址、年份、色、道路等級單一資料源，overlayRegistry／圖例／說明框／參數規格都從這裡 import。
 * 零 import（layerManifest 會引用本檔的代表色）。
 *
 * 資料（taipei-gis-analytics pipelines/analysis/mapchallenge_2026_day21_osm_road_growth，研究文件同名 topic-research）：
 * - day21_osm_road_years.pmtiles（source layer day21_osm_road_years，z8–14）：ohsome 完整歷史（到 2026-07-27），
 *   現況道路切 ≤100 m 小段依「位置」判定第一次出現的年份，再把同 way／同年／同等級的相連小段合併。
 *   屬性 year（2007–2026；2007＝2007 年以前，含）、highway、name（可缺）、len_m（合併後這一段的長度）、osm_id（way/123）。
 * 用語：一律「畫進 OSM 的年份」，不寫「開通」「興建」。
 */

export const MAPCHALLENGE_DAY21_ROADS_URL = "./mapchallenge/day21_osm_road_years.pmtiles";
export const MAPCHALLENGE_DAY21_ROADS_SOURCE_LAYER = "day21_osm_road_years";
export const MAPCHALLENGE_DAY21_ATTRIBUTION = "© OpenStreetMap contributors（ODbL）；歷史資料：ohsome API（HeiGIT），到 2026-07-27";

/** 代表色（sidebar）：色帶中段的洋紅 */
export const MAPCHALLENGE_DAY21_COLOR = "#9a265d";

export const MAPCHALLENGE_DAY21_YEAR_MIN = 2007;
export const MAPCHALLENGE_DAY21_YEAR_MAX = 2026;

/**
 * 各年色（map-atelier osm-growth-v1 定案動畫的 C2 色帶，analytics 04_build_pmtiles.py 輸出的 year_colors.json 照抄）：
 * 深藍 #2c55c4 → 藍紫 → 紫 → 洋紅 → 紅 → 朱 → 橘 → 黃 #ffd166，sRGB 線性內插；
 * 各年位置＝75%×累積新增長度占比（取該年中點）＋25%×年份等距，新增多的年份占色帶較寬。
 */
export const MAPCHALLENGE_DAY21_YEAR_COLORS: Readonly<Record<number, string>> = {
  2007: "#2c55c4", 2008: "#324dc0", 2009: "#3846bc", 2010: "#403eb6", 2011: "#5235a7",
  2012: "#662d96", 2013: "#7e277d", 2014: "#9a265d", 2015: "#b32a41", 2016: "#cc3c37",
  2017: "#e14b30", 2018: "#eb5b30", 2019: "#f06c33", 2020: "#f67f37", 2021: "#fc913a",
  2022: "#ffa041", 2023: "#ffae4b", 2024: "#ffbb55", 2025: "#ffc65e", 2026: "#ffd166",
};
/** 三縣市現況道路總長（km，178,996 小段合計；圖例說明用） */
export const MAPCHALLENGE_DAY21_TOTAL_KM = 13670;

export const MAPCHALLENGE_DAY21_YEARS: readonly number[] = Array.from(
  { length: MAPCHALLENGE_DAY21_YEAR_MAX - MAPCHALLENGE_DAY21_YEAR_MIN + 1 }, (_, i) => MAPCHALLENGE_DAY21_YEAR_MIN + i,
);

/** 年份色；範圍外（不應出現）回中性灰 */
export function mapchallengeDay21YearColor(year: number): string {
  return MAPCHALLENGE_DAY21_YEAR_COLORS[year] ?? "#94a3b8";
}

/** 年份拉桿值 → 有效年份（2007–2026 整數） */
export function mapchallengeDay21YearAt(v: number | undefined): number {
  const y = Math.round(v ?? MAPCHALLENGE_DAY21_YEAR_MAX);
  return Math.min(MAPCHALLENGE_DAY21_YEAR_MAX, Math.max(MAPCHALLENGE_DAY21_YEAR_MIN, Number.isFinite(y) ? y : MAPCHALLENGE_DAY21_YEAR_MAX));
}

/**
 * 道路等級三級（線寬由粗到細）。OSM highway 原值 → 級：
 * 主幹＝motorway／trunk／primary（含 _link）；次要＝secondary／tertiary（含 _link）；其餘（含未標等級）＝一般道路。
 * 低縮放：主幹與次要 z8 起，residential／unclassified／living_street z10 起，service 與其他 z12 起（圖磚已分好）。
 */
export const MAPCHALLENGE_DAY21_MAJOR = ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link"] as const;
export const MAPCHALLENGE_DAY21_MID = ["secondary", "secondary_link", "tertiary", "tertiary_link"] as const;
export type MapchallengeDay21Class = "major" | "mid" | "local";
export function mapchallengeDay21ClassOf(highway: unknown): MapchallengeDay21Class {
  const hw = typeof highway === "string" ? highway : "";
  if ((MAPCHALLENGE_DAY21_MAJOR as readonly string[]).includes(hw)) return "major";
  if ((MAPCHALLENGE_DAY21_MID as readonly string[]).includes(hw)) return "mid";
  return "local";
}
