// 運動場館分類定義 — overlay 分色 / legend / popup 共用的單一真實來源。
// 鏡像 livestockTypes.ts 的做法：色與 label 只在這裡定義一次。
//
// 資料來源：運動部 data.gov.tw 22849（全國 15,000 點）。
// - category：990 raw 變體正規化成 27 canonical 類（見 HANDOFF）。
// - layer：5 類互斥隸屬（學校 / 其他公共 / 民營 / 運動公園 / 國民運動中心），
//   前端拆 5 個 sublayer 各自 toggle，共用同一份 GeoJSON + filter。

export interface CatStyle {
  key: string;
  color: string;
  label: string;
}

// ── 27 類 category（key = 資料中文原值；越常見排越前，僅供閱讀，match 不看順序）──
export const SPORTS_CATEGORIES: CatStyle[] = [
  { key: "籃球場", color: "#ff7043", label: "籃球場 Basketball" },
  { key: "田徑場", color: "#ef5350", label: "田徑場 Track & Field" },
  { key: "羽球場", color: "#ffca28", label: "羽球場 Badminton" },
  { key: "排球場", color: "#26a69a", label: "排球場 Volleyball" },
  { key: "游泳池", color: "#29b6f6", label: "游泳池 Swimming Pool" },
  { key: "健身房", color: "#7e57c2", label: "健身房 Gym" },
  { key: "足球場", color: "#66bb6a", label: "足球場 Soccer" },
  { key: "躲避球場", color: "#ec407a", label: "躲避球場 Dodgeball" },
  { key: "網球場", color: "#9ccc65", label: "網球場 Tennis" },
  { key: "桌球場", color: "#5c6bc0", label: "桌球場 Table Tennis" },
  { key: "綜合體育館", color: "#ab47bc", label: "綜合體育館 Gymnasium" },
  { key: "舞蹈教室", color: "#f06292", label: "舞蹈教室 Dance Studio" },
  { key: "棒球場", color: "#8d6e63", label: "棒球場 Baseball" },
  { key: "棒壘打擊練習場", color: "#a1887f", label: "棒壘打擊練習場 Batting Cage" },
  { key: "直排輪/滑輪場", color: "#26c6da", label: "直排輪/滑輪場 Roller Skating" },
  { key: "壘球場", color: "#d4a373", label: "壘球場 Softball" },
  { key: "武術/技擊場", color: "#c62828", label: "武術/技擊場 Martial Arts" },
  { key: "高爾夫球場", color: "#2e7d32", label: "高爾夫球場 Golf" },
  { key: "撞球場", color: "#00695c", label: "撞球場 Billiards" },
  { key: "攀岩場", color: "#ff8f00", label: "攀岩場 Climbing" },
  { key: "射箭/射擊場", color: "#6d4c41", label: "射箭/射擊場 Archery/Shooting" },
  { key: "體操館", color: "#ba68c8", label: "體操館 Gymnastics" },
  { key: "慢跑道", color: "#9e9d24", label: "慢跑道 Jogging Track" },
  { key: "運動公園/廣場", color: "#43a047", label: "運動公園/廣場 Sports Park" },
  { key: "自由車場", color: "#3949ab", label: "自由車場 Cycling Track" },
  { key: "保齡球館", color: "#00838f", label: "保齡球館 Bowling" },
  { key: "其他/未分類", color: "#90a4ae", label: "其他/未分類 Other" },
];

export const SPORTS_CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  SPORTS_CATEGORIES.map((c) => [c.key, c.color]),
);

// match / 未知值 fallback（比 其他/未分類 略深，凸顯「連 category 都缺」的極少數）
export const SPORTS_FALLBACK_COLOR = "#607d8b";

/** circle-color 用：依 category 27 類 match 分色（+ default fallback）。cast 由呼叫端做。 */
export function sportsCategoryColorExpr(): unknown[] {
  const m: unknown[] = ["match", ["get", "category"]];
  for (const c of SPORTS_CATEGORIES) m.push(c.key, c.color);
  m.push(SPORTS_FALLBACK_COLOR); // default
  return m;
}

// ── 5 個 sublayer（layer 欄位互斥值 → 各自 toggle，共用 sports-venues source）──
export type SportsLayerId =
  | "sportsSchool"
  | "sportsPublicOther"
  | "sportsPrivate"
  | "sportsPark"
  | "sportsCenter";

export interface SportsLayerMeta {
  id: SportsLayerId;
  /** GeoJSON layer 欄位值（filter 比對用） */
  layerValue: string;
  /** overlay layer id 後綴（layer id = `sports-venues-${suffix}`） */
  suffix: string;
  label: string;
}

export const SPORTS_LAYERS: SportsLayerMeta[] = [
  { id: "sportsSchool", layerValue: "學校場館", suffix: "school", label: "學校場館 School" },
  { id: "sportsPublicOther", layerValue: "其他公共場館", suffix: "public-other", label: "其他公共場館 Public" },
  { id: "sportsPrivate", layerValue: "民營場館", suffix: "private", label: "民營場館 Private" },
  { id: "sportsPark", layerValue: "運動公園/開放空間", suffix: "park", label: "運動公園/開放空間 Park" },
  { id: "sportsCenter", layerValue: "國民運動中心", suffix: "center", label: "國民運動中心 Sports Center" },
];

// 圓圈大小：area_sqm log 尺標（錨 p5≈175 / p95≈15,000，兩端 clamp）。
// area_sqm 有 380 筆 NULL → 退化為固定半徑（SPORTS_RADIUS_FALLBACK_PX）。
export const SPORTS_AREA_DOMAIN: [number, number] = [200, 20000];
export const SPORTS_RADIUS_PX: [number, number] = [3, 16];
export const SPORTS_RADIUS_FALLBACK_PX = 4;

// open_status="不對外" 的場館淡化倍率（避免誤讀為可用場地）
export const SPORTS_CLOSED_DIM = 0.35;
