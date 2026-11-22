/**
 * 30 天地圖挑戰 Day 23「味覺 Taste」（模擬入口，2026-11-22）：店名裡的味道。
 * 網址、詞、色、家數、半徑公式的單一資料源，overlayRegistry／圖例／說明框／參數規格都從這裡 import。
 * 零 import（layerManifest 會引用本檔的代表色）。
 *
 * 資料（taipei-gis-analytics pipelines/analysis/mapchallenge_2026_day23_taste，研究文件同名 topic-research）：
 * 財政部稅籍登記 2026-08-16 快照，營業中且主要行業為餐飲業（行業代號 56 開頭，181,255 家，其中 179,672 家有座標），
 * 用「店名含該詞」分類後彙總到 H3 六角格，點畫在格心。
 * - day23_taste_terms.geojson：每個（詞 × 格）一點。屬性 term（詞 id）、n（家數）、res（6｜7）、h3。
 * - day23_taste_variants.geojson：每個（組 × 寫法 × 格）一點。屬性 group、w（寫法序號）、n、c0／c1／c2（同格同組各寫法家數）、res、h3。
 * 隱私：稅籍表含獨資行號地址，公開檔只有六角格彙總家數，沒有店名、地址、統編、單店座標。
 * 用語：只描述「店名含該詞的登記餐飲店家數」；不寫口味偏好、不寫哪裡最愛吃。
 */

export const MAPCHALLENGE_DAY23_TERMS_URL = "./mapchallenge/day23_taste_terms.geojson";
export const MAPCHALLENGE_DAY23_VARIANTS_URL = "./mapchallenge/day23_taste_variants.geojson";
export const MAPCHALLENGE_DAY23_ATTRIBUTION = "財政部財政資訊中心 全國營業（稅籍）登記資料 · 政府資料開放授權條款第 1 版";
export const MAPCHALLENGE_DAY23_DATA_DATE = "2026-08-16";
/** 母體：營業中、主要行業為餐飲業的稅籍登記家數（圖例說明用） */
export const MAPCHALLENGE_DAY23_BASE_STORES = 181255;

/** 代表色（sidebar） */
export const MAPCHALLENGE_DAY23_TERMS_COLOR = "#ff6b5e"; // 牛肉湯
export const MAPCHALLENGE_DAY23_VARIANTS_COLOR = "#7fd6c2"; // 滷肉飯

/** 格網兩級：低縮放 res 6（約 36 km²），z ≥ SWITCH_ZOOM 換 res 7（約 5.2 km²） */
export const MAPCHALLENGE_DAY23_SWITCH_ZOOM = 9;
export const MAPCHALLENGE_DAY23_RES = [6, 7] as const;
export const MAPCHALLENGE_DAY23_CELL_KM2: Readonly<Record<number, number>> = { 6: 36, 7: 5.2 };

/**
 * 圖層 1 的 12 個詞（順序＝選單順序）。dark＝原型預覽圖的顏色（暗底）；light＝同色相壓低 OKLCH 亮度到淡底陸地對比 ≥ 3。
 * stores＝店名含該詞的登記家數；mapped＝其中有座標、畫在地圖上的家數（analytics day23_layer_stats.json）。
 * 「意麵」排除店名含「鍋燒」者；「粄條／板條」兩種寫法合計。
 */
export const MAPCHALLENGE_DAY23_TERMS = [
  { value: "beefSoup", label: "牛肉湯", dark: "#ff6b5e", light: "#db4a40", stores: 169, mapped: 167 },
  { value: "kongRou", label: "爌肉", dark: "#d9905a", light: "#ae6932", stores: 168, mapped: 166 },
  { value: "turkeyRice", label: "火雞肉飯", dark: "#ffd166", light: "#987300", stores: 337, mapped: 336 },
  { value: "fanTang", label: "飯湯", dark: "#7fd6c2", light: "#2b8775", stores: 34, mapped: 33 },
  { value: "yiMian", label: "意麵", dark: "#f4a259", light: "#b46712", stores: 202, mapped: 197 },
  { value: "eel", label: "鱔魚", dark: "#c9a0ff", light: "#8e66bf", stores: 112, mapped: 111 },
  { value: "rouZaoFan", label: "肉燥飯", dark: "#ff8fab", light: "#c15775", stores: 119, mapped: 117 },
  { value: "banTiao", label: "粄條／板條", dark: "#8ecae6", light: "#3281a1", stores: 94, mapped: 93 },
  { value: "rouYuan", label: "肉圓", dark: "#b8e986", light: "#59841e", stores: 498, mapped: 492 },
  { value: "wanGuo", label: "碗粿", dark: "#f1e3c0", light: "#8e7533", stores: 150, mapped: 150 },
  { value: "urn", label: "甕（甕缸雞類）", dark: "#e07a5f", light: "#c05d43", stores: 105, mapped: 104 },
  { value: "liveFish", label: "活魚", dark: "#64aaff", light: "#357bcc", stores: 24, mapped: 23 },
] as const;
export type MapchallengeDay23Term = (typeof MAPCHALLENGE_DAY23_TERMS)[number];
export type MapchallengeDay23TermId = MapchallengeDay23Term["value"];

/** 選單 encode 序號 → 詞（越界回第一個） */
export function mapchallengeDay23TermAt(idx: number | undefined): MapchallengeDay23Term {
  return MAPCHALLENGE_DAY23_TERMS[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY23_TERMS[0];
}
export function mapchallengeDay23TermById(id: unknown): MapchallengeDay23Term | undefined {
  return MAPCHALLENGE_DAY23_TERMS.find((t) => t.value === id);
}
export const mapchallengeDay23TermColor = (t: { dark: string; light: string }, isDark: boolean): string => (isDark ? t.dark : t.light);

/**
 * 圖層 2 的同物異字三組（順序＝選單順序）。同組內各寫法各自比對、不互斥（店名同時含兩種寫法會各算一次）；
 * 「粿條」全台只有 1 家，不列。色＝原型預覽圖（暗底）；light 規則同上。
 */
export const MAPCHALLENGE_DAY23_VARIANT_GROUPS = [
  {
    value: "rice", label: "魯肉飯／滷肉飯／肉燥飯",
    words: [
      { label: "魯肉飯", dark: "#64aaff", light: "#357bcc", stores: 249, mapped: 247 },
      { label: "滷肉飯", dark: "#7fd6c2", light: "#2b8775", stores: 88, mapped: 87 },
      { label: "肉燥飯", dark: "#ff8fab", light: "#c15775", stores: 119, mapped: 117 },
    ],
  },
  {
    value: "banTiao", label: "粄條／板條",
    words: [
      { label: "粄條", dark: "#ffd166", light: "#987300", stores: 74, mapped: 74 },
      { label: "板條", dark: "#64aaff", light: "#357bcc", stores: 20, mapped: 19 },
    ],
  },
  {
    value: "kongRou", label: "爌肉／焢肉／控肉",
    words: [
      { label: "爌肉", dark: "#ffd166", light: "#987300", stores: 168, mapped: 166 },
      { label: "焢肉", dark: "#64aaff", light: "#357bcc", stores: 49, mapped: 48 },
      { label: "控肉", dark: "#ff8fab", light: "#c15775", stores: 20, mapped: 20 },
    ],
  },
] as const;
export type MapchallengeDay23VariantGroup = (typeof MAPCHALLENGE_DAY23_VARIANT_GROUPS)[number];

export function mapchallengeDay23GroupAt(idx: number | undefined): MapchallengeDay23VariantGroup {
  return MAPCHALLENGE_DAY23_VARIANT_GROUPS[Math.trunc(idx ?? 0)] ?? MAPCHALLENGE_DAY23_VARIANT_GROUPS[0];
}
export function mapchallengeDay23GroupById(id: unknown): MapchallengeDay23VariantGroup | undefined {
  return MAPCHALLENGE_DAY23_VARIANT_GROUPS.find((g) => g.value === id);
}

/**
 * 圓半徑：面積正比於家數 → r = k × √n（不加底、不設上限；兩級格網同一條公式，圖例大小列兩級都成立）。
 * 單格家數 res 6 最多 34、res 7 最多 17；n＝1 時半徑 3 px。
 */
export const MAPCHALLENGE_DAY23_RADIUS_K = 3;
export function mapchallengeDay23Radius(n: number, scale = 1): number {
  return MAPCHALLENGE_DAY23_RADIUS_K * Math.sqrt(Math.max(1, n)) * scale;
}
/** 光暈（原型三層發光圓的外兩層合成一層模糊圓）：半徑 ×、透明度 × 圖層透明度（淡底再減半） */
export const MAPCHALLENGE_DAY23_GLOW = { radiusFactor: 2.1, opacity: 0.32, blur: 0.7 } as const;
