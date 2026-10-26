import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";

/**
 * 日本障害者福祉・児童福祉施設（国土数値情報 P14 令和5年度版）的中分類、色票與篩選 SSOT —— hook／legend／popup／params 共用。
 * 兩個圖層共用同一份 PMTiles，依 `major` 分：disability（大分類 03＋中分類 9911）、child（大分類 05＋中分類 9912）。
 * 中分類多（兒童 16 類），配色依「性質」分組（K-2：本層自訂、明列在圖例），同組中分類同色；篩選仍可單選中分類。
 * 契約見 taipei-gis-analytics/docs/data-catalog/world/jp_welfare_facilities.md。
 */
export type JpWelfareMajor = "disability" | "child";

export interface JpWelfareColorGroup {
  value: string;
  label: string;
  color: string;
}

/** 依性質分的色組（兩層共用語意：入所＝紅、社區據點＝綠、服務事業所＝藍…）。 */
export const JP_WELFARE_COLOR_GROUPS = [
  { value: "residential", label: "入所・養護", color: "#ef4444" },
  { value: "nursery", label: "保育", color: "#f59e0b" },
  { value: "development", label: "發展支援", color: "#8b5cf6" },
  { value: "community", label: "社區據點", color: "#10b981" },
  { value: "family", label: "助產・家庭支援・居住", color: "#ec4899" },
  { value: "service", label: "服務事業所", color: "#0ea5e9" },
  { value: "other", label: "其他", color: "#94a3b8" },
] as const satisfies readonly JpWelfareColorGroup[];

type GroupValue = typeof JP_WELFARE_COLOR_GROUPS[number]["value"];

export interface JpWelfareCategory {
  code: string;
  ja: string;
  label: string;
  major: JpWelfareMajor;
  group: GroupValue;
  count: number;
}

/** 中分類（tile 屬性 `category_code`，字串）；筆數為全國總數（含位置正確度 4–5 代表點）。 */
export const JP_WELFARE_CATEGORIES = [
  { code: "0301", ja: "障害者支援施設", label: "障礙者支援設施", major: "disability", group: "residential", count: 2_192 },
  { code: "0302", ja: "地域活動支援センター", label: "地域活動支援中心", major: "disability", group: "community", count: 1_805 },
  { code: "0303", ja: "福祉ホーム", label: "福祉之家", major: "disability", group: "family", count: 129 },
  { code: "9911", ja: "障害者サービス施設", label: "障礙者服務事業所", major: "disability", group: "service", count: 71_819 },
  { code: "0500", ja: "児童福祉施設等（中分類なし）", label: "兒童福祉設施（未分中類）", major: "child", group: "other", count: 1 },
  { code: "0501", ja: "助産施設", label: "助產設施", major: "child", group: "family", count: 289 },
  { code: "0502", ja: "乳児院", label: "乳兒院", major: "child", group: "residential", count: 122 },
  { code: "0504", ja: "保育所等", label: "保育所等", major: "child", group: "nursery", count: 30_376 },
  { code: "0505", ja: "地域型保育事業所", label: "地域型保育事業所", major: "child", group: "nursery", count: 5_709 },
  { code: "0506", ja: "認可外保育施設", label: "認可外保育設施", major: "child", group: "nursery", count: 3_358 },
  { code: "0507", ja: "児童養護施設", label: "兒童養護設施", major: "child", group: "residential", count: 544 },
  { code: "0508", ja: "障害児入所施設", label: "障礙兒入所設施", major: "child", group: "residential", count: 563 },
  { code: "0509", ja: "児童発達支援センター", label: "兒童發展支援中心", major: "child", group: "development", count: 10_259 },
  { code: "0510", ja: "児童心理治療施設", label: "兒童心理治療設施", major: "child", group: "residential", count: 43 },
  { code: "0511", ja: "児童自立支援施設", label: "兒童自立支援設施", major: "child", group: "residential", count: 185 },
  { code: "0512", ja: "児童家庭支援センター", label: "兒童家庭支援中心", major: "child", group: "family", count: 205 },
  { code: "0513", ja: "児童館", label: "兒童館", major: "child", group: "community", count: 3_893 },
  { code: "0514", ja: "児童遊園", label: "兒童遊園", major: "child", group: "community", count: 870 },
  { code: "0599", ja: "その他", label: "其他兒童福祉設施", major: "child", group: "other", count: 12 },
  { code: "9912", ja: "児童福祉サービス施設", label: "兒童福祉服務事業所", major: "child", group: "service", count: 22_198 },
] as const satisfies readonly JpWelfareCategory[];

export type JpWelfareLayerKey = "jpWelfareDisability" | "jpWelfareChild";

export const JP_WELFARE_LAYER_MAJOR: Readonly<Record<JpWelfareLayerKey, JpWelfareMajor>> = {
  jpWelfareDisability: "disability",
  jpWelfareChild: "child",
};

/** 各層點數（全國，含代表點）：disability 75,945、child 78,627；合計 154,572。 */
export const JP_WELFARE_POINT_COUNT: Readonly<Record<JpWelfareLayerKey, number>> = {
  jpWelfareDisability: 75_945,
  jpWelfareChild: 78_627,
};

export function jpWelfareCategoriesOf(major: JpWelfareMajor) {
  return JP_WELFARE_CATEGORIES.filter((c) => c.major === major);
}

/** 該層用到的色組（依 JP_WELFARE_COLOR_GROUPS 順序）。 */
export function jpWelfareGroupsOf(major: JpWelfareMajor) {
  const used = new Set<string>(jpWelfareCategoriesOf(major).map((c) => c.group));
  return JP_WELFARE_COLOR_GROUPS.filter((g) => used.has(g.value));
}

export function jpWelfareCategoryColor(code: unknown): string | undefined {
  const cat = JP_WELFARE_CATEGORIES.find((c) => c.code === String(code ?? ""));
  return cat ? JP_WELFARE_COLOR_GROUPS.find((g) => g.value === cat.group)?.color : undefined;
}

export const JP_WELFARE_OTHER_COLOR = "#94a3b8";
export const JP_WELFARE_LAYER_COLOR: Readonly<Record<JpWelfareLayerKey, string>> = {
  jpWelfareDisability: "#0ea5e9",
  jpWelfareChild: "#f59e0b",
};

export const JP_WELFARE_COLOR_EXPRESSION: ExpressionSpecification = [
  "match", ["get", "category_code"],
  ...JP_WELFARE_CATEGORIES.flatMap((c) => [c.code, jpWelfareCategoryColor(c.code)!]),
  JP_WELFARE_OTHER_COLOR,
] as unknown as ExpressionSpecification;

/** 位置正確度 1–5；4＝市區町村代表點、5＝都道府縣代表點（同一點堆疊，預設不畫）。 */
export const JP_WELFARE_ACCURACY_MAX_DEFAULT = 3;
export const JP_WELFARE_ACCURACY_LEVELS: Readonly<Record<number, string>> = {
  1: "位置特定（25 m 級）", 2: "小字・街區代表點", 3: "大字・町丁目代表點", 4: "市區町村代表點", 5: "都道府縣代表點",
};
export const JP_WELFARE_ACCURACY_OPTIONS = [
  { value: "precise", label: "精確到町丁目（1–3）" },
  { value: "all", label: "全部（含市町村／縣代表點）" },
] as const;

/**
 * 該層的 select index → 篩選：0=全部、1..G=色組（只列該層用到的組）、G+1..=中分類單選。
 * accuracyIdx：0=只畫位置正確度 ≤3、1=全部。無效 index fail closed。
 */
export function jpWelfareFilter(major: JpWelfareMajor, categoryIdx: number, accuracyIdx: number): FilterSpecification {
  const parts: unknown[] = [["==", ["get", "major"], major]];
  if (accuracyIdx === 0) parts.push(["<=", ["get", "position_accuracy"], JP_WELFARE_ACCURACY_MAX_DEFAULT]);
  else if (accuracyIdx !== 1) return ["literal", false] as unknown as FilterSpecification;
  if (categoryIdx !== 0) {
    const groups = jpWelfareGroupsOf(major);
    const cats = jpWelfareCategoriesOf(major);
    const g = categoryIdx >= 1 ? groups[categoryIdx - 1] : undefined;
    const c = categoryIdx > groups.length ? cats[categoryIdx - 1 - groups.length] : undefined;
    if (g) parts.push(["in", ["get", "category_code"], ["literal", cats.filter((x) => x.group === g.value).map((x) => x.code)]]);
    else if (c) parts.push(["==", ["get", "category_code"], c.code]);
    else return ["literal", false] as unknown as FilterSpecification;
  }
  return ["all", ...parts] as unknown as FilterSpecification;
}

export const JP_WELFARE_ATTRIBUTION = "出典：国土数値情報（福祉施設データ）（国土交通省）を加工して作成";
export const JP_WELFARE_SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P14-2023.html";
export const JP_WELFARE_LICENSE = "CC BY 4.0 / PDL1.0（一部制限：自治體別條件見 license_note）";
export const JP_WELFARE_DATA_AS_OF = "令和5年度版（2023）";
