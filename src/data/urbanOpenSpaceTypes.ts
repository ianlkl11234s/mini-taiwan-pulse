/**
 * 都市開放空間 Urban Open Space 三層（受保護樹木 / 河濱喬木 / 台北公園）的
 * 顏色、分級與 select 選項單一真實來源。
 * 給 overlayRegistry 配色（circle-color 表達式）、LegendPanel 圖例、
 * useLayerParamsRuntime select options 三處共用（同 streetTreeColors.ts 慣例）。
 *
 * 分級 / 分類由 public/urban/*.geojson 全量統計決定（2026-07 jq 抽樣）：
 * - 受保護樹木 6,544 點（8 城市 count desc；city 實際值是「嘉義縣」非嘉義市）
 * - 河濱喬木 10,917 點（樹種前 10 大 + 30 座河濱公園 count desc）
 * - 台北公園 2,917 點（7 種 category）
 *
 * ⚠️ 表達式不得含 ["zoom"]：zoom 只能在最外層 interpolate/step（見 streetTreeColors.ts 註）。
 */

import {
  STREET_TREE_SPECIES, STREET_TREE_OTHER_COLOR, STREET_TREE_MISSING_COLOR,
  STREET_TREE_DIAMETER_BANDS, STREET_TREE_HEIGHT_BANDS, type StreetTreeBand,
} from "./streetTreeColors";

// 缺值共用中性灰
export const URBAN_MISSING_COLOR = "#9e9e9e";

// ── 🌳 受保護樹木 Protected Trees（全國 6,544 點）──

export interface ProtectedTreeAgeBand {
  /** 該級上界（不含）；最後一級為 null（無上界） */
  max: number | null;
  color: string;
  label: string;
}

// 推估樹齡 5 級（冷→暖 = 年輕→老樹）；null / <=0 → 灰
export const PROTECTED_TREE_AGE_BANDS: ProtectedTreeAgeBand[] = [
  { max: 50,   color: "#4c9be0", label: "< 50 年" },
  { max: 100,  color: "#59b359", label: "50–100 年" },
  { max: 200,  color: "#f2d64b", label: "100–200 年" },
  { max: 500,  color: "#f28e2b", label: "200–500 年" },
  { max: null, color: "#d7191c", label: "≥ 500 年" },
];

// 8 城市 categorical（count desc）
export const PROTECTED_TREE_CITIES: { name: string; color: string }[] = [
  { name: "台北市", color: "#4c9be0" }, // 3,874
  { name: "新北市", color: "#f28e2b" }, // 996
  { name: "高雄市", color: "#e15759" }, // 717
  { name: "桃園市", color: "#59b359" }, // 595
  { name: "花蓮縣", color: "#b07ad9" }, // 113
  { name: "新竹市", color: "#2fc2d4" }, // 104
  { name: "嘉義縣", color: "#f2d64b" }, // 92
  { name: "新竹縣", color: "#f58ebc" }, // 53
];

// 染色模式 select 選項；index 對齊 overlayRegistry 讀的 protectedTreesNationalColorModeIdx
export const PROTECTED_TREE_COLOR_MODES = ["age", "city"] as const;

/** 樹齡分級 step：null / <=0 → 灰；否則依 5 級 band 上色（冷→暖） */
export function protectedTreeAgeColorExpr(): unknown[] {
  const val: unknown[] = ["to-number", ["get", "estimated_age_years"], 0]; // null → 0 → 判為缺值
  const step: unknown[] = ["step", val, PROTECTED_TREE_AGE_BANDS[0]!.color];
  for (let i = 1; i < PROTECTED_TREE_AGE_BANDS.length; i++) {
    step.push(PROTECTED_TREE_AGE_BANDS[i - 1]!.max as number, PROTECTED_TREE_AGE_BANDS[i]!.color);
  }
  return ["case", ["<=", val, 0], URBAN_MISSING_COLOR, step];
}

/** 城市：match city → 8 色，其餘灰 */
export function protectedTreeCityColorExpr(): unknown[] {
  return [
    "match", ["get", "city"],
    ...PROTECTED_TREE_CITIES.flatMap((c) => [c.name, c.color]),
    URBAN_MISSING_COLOR,
  ];
}

// ── 🌊 台北河濱喬木 Riverside Trees（10,917 點）──

// 前 10 大樹種（count desc）→ 亮色 categorical；
// 與 streetTreeColors.ts 共通樹種沿用同色（榕樹藍 / 茄苳橙 / 樟樹綠 / 水黃皮棕），跨圖層一致。
export const RIVERSIDE_TREE_SPECIES: { name: string; color: string }[] = [
  { name: "榕樹",   color: "#4c9be0" }, // 3,458 blue
  { name: "茄苳",   color: "#f28e2b" }, // 626 orange
  { name: "垂榕",   color: "#9ed45a" }, // 480 lime
  { name: "構樹",   color: "#f2d64b" }, // 469 yellow
  { name: "桑樹",   color: "#b07ad9" }, // 457 purple
  { name: "榔榆",   color: "#2fc2d4" }, // 440 cyan
  { name: "水黃皮", color: "#c69c6d" }, // 439 tan
  { name: "雀榕",   color: "#e15759" }, // 358 red
  { name: "樟樹",   color: "#59b359" }, // 315 green
  { name: "水柳",   color: "#f58ebc" }, // 238 pink
];
export const RIVERSIDE_TREE_OTHER_COLOR = "#8c929b";

/** 樹種：match species → 前 10 色，其餘灰 */
export function riversideTreeSpeciesColorExpr(): unknown[] {
  return [
    "match", ["get", "species"],
    ...RIVERSIDE_TREE_SPECIES.flatMap((s) => [s.name, s.color]),
    RIVERSIDE_TREE_OTHER_COLOR,
  ];
}

// 30 座河濱公園（依喬木筆數 desc；供篩選 select，index 對齊 riversideTreesTaipeiParkIdx）
export const RIVERSIDE_PARKS: string[] = [
  "華中", "雙溪", "延平", "福和", "古亭", "百齡左岸", "關渡水岸", "大佳",
  "道南", "美堤", "迎風", "龍山", "中正", "百齡右岸", "社子島沿線", "觀山",
  "雁鴨", "景美", "彩虹", "成美右岸", "成美左岸", "福安", "雙園", "河雙21號",
  "馬場町紀念公園", "圓山", "木柵", "南湖右岸", "富州", "南湖左岸",
];

// ── 🏞️ 台北公園 Parks（2,917 點）──

// 7 種 category categorical（count desc）
export const TAIPEI_PARK_CATEGORIES: { name: string; color: string }[] = [
  { name: "公園",       color: "#59b359" }, // 1,044 green
  { name: "兒童遊戲場", color: "#f2d64b" }, // 738 yellow
  { name: "綠地",       color: "#9ed45a" }, // 588 lime
  { name: "鄰里公園",   color: "#2fc2d4" }, // 362 cyan
  { name: "區域公園",   color: "#4c9be0" }, // 124 blue
  { name: "廣場",       color: "#b07ad9" }, // 34 purple
  { name: "其他",       color: "#8c929b" }, // 27 gray
];

/** 分類：match category → 7 色，其餘灰 */
export function taipeiParkCategoryColorExpr(): unknown[] {
  return [
    "match", ["get", "category"],
    ...TAIPEI_PARK_CATEGORIES.flatMap((c) => [c.name, c.color]),
    URBAN_MISSING_COLOR,
  ];
}

// 公園面積 log 尺標 domain（m²，兩端 clamp）；area_sqm null/0 → fallback 固定最小半徑
export const PARK_AREA_DOMAIN: [number, number] = [200, 500000];

// ── 🌲 行道樹三時點 Street Trees 3-Epoch（105,675 點，PMTiles）──
// traj = 三期存在編碼（2022/2024/2026，1=存在）；實際 7 種（無 000）。

export interface StreetTree3epochTraj {
  code: string;
  color: string;
  label: string;
}

// 7 類軌跡 categorical；語意分組配色：存續綠 / 消失暖色系 / 新增冷色系 / 異常紫紅系
export const STREET_TREE_3EPOCH_TRAJ: StreetTree3epochTraj[] = [
  { code: "111", color: "#2e7d32", label: "持續存在" },
  { code: "110", color: "#ef6c00", label: "2026 消失" },
  { code: "100", color: "#c62828", label: "2024 消失" },
  { code: "101", color: "#8e24aa", label: "消失復現" },
  { code: "011", color: "#1565c0", label: "2024 新增" },
  { code: "010", color: "#d81b60", label: "曇花一現" },
  { code: "001", color: "#00acc1", label: "2026 新增" },
];

// 染色模式 select 選項；index 對齊 overlayRegistry 讀的 streetTreesTaipei3epochColorModeIdx
export const STREET_TREE_3EPOCH_COLOR_MODES = ["traj", "species", "diameter", "height"] as const;

// 軌跡篩選 select（index 對齊 streetTreesTaipei3epochTrajFilterIdx）；codes=null 表示不篩選
export const STREET_TREE_3EPOCH_TRAJ_FILTERS: { value: string; label: string; codes: string[] | null }[] = [
  { value: "all", label: "全部", codes: null },
  { value: "persisted", label: "持續存在 (111)", codes: ["111"] },
  { value: "disappeared", label: "已消失 (110/100)", codes: ["110", "100"] },
  { value: "appeared", label: "新增 (011/001)", codes: ["011", "001"] },
  { value: "anomaly", label: "波動異常 (101/010)", codes: ["101", "010"] },
];

/** 軌跡：match traj → 7 色，其餘灰 */
export function streetTree3epochTrajColorExpr(): unknown[] {
  return [
    "match", ["get", "traj"],
    ...STREET_TREE_3EPOCH_TRAJ.flatMap((t) => [t.code, t.color]),
    URBAN_MISSING_COLOR,
  ];
}

// 樹種/胸徑/樹高三模式：分級與顏色照抄 streetTreeColors.ts（跨層視覺可比），
// 僅欄位名不同（本層 species/dbh_cm/height_m vs diff 層 TreeType/Diameter/TreeHeight），
// 該檔 expr 函數欄位寫死無法帶參數 → 在此建本層版本。

/** 樹種：match species → 前 10 色（同 streetTreeColors 色票），其餘灰 */
export function streetTree3epochSpeciesColorExpr(): unknown[] {
  return [
    "match", ["get", "species"],
    ...STREET_TREE_SPECIES.flatMap((s) => [s.name, s.color]),
    STREET_TREE_OTHER_COLOR,
  ];
}

/** 分級 step：缺值/<=0 → 灰；否則依 band break 上色（同 streetTreeColors 的 bandStepColorExpr） */
function bandStepColorExpr(field: string, bands: StreetTreeBand[]): unknown[] {
  const val: unknown[] = ["to-number", ["get", field], 0]; // null → 0 → 判為缺值
  const step: unknown[] = ["step", val, bands[0]!.color];
  for (let i = 1; i < bands.length; i++) {
    step.push(bands[i - 1]!.max as number, bands[i]!.color);
  }
  return ["case", ["<=", val, 0], STREET_TREE_MISSING_COLOR, step];
}

export function streetTree3epochDiameterColorExpr(): unknown[] {
  return bandStepColorExpr("dbh_cm", STREET_TREE_DIAMETER_BANDS);
}

export function streetTree3epochHeightColorExpr(): unknown[] {
  return bandStepColorExpr("height_m", STREET_TREE_HEIGHT_BANDS);
}

// ── 🌏 行道樹全國 Street Trees TW（210,436 點：台北 92,033 + 台中 118,403，PMTiles）──
// 前 10 大樹種由 street_trees_national/stats.json（2026-07）count desc 決定；
// 「台灣欒樹 7,377」與「臺灣欒樹 6,500」為同種異體字（兩市來源寫法不同）→ 合併計 13,877
// 第 3 大，match 兩寫法同臂同色。與 streetTreeColors.ts 既有樹種沿用同色（跨層可比）；
// 印度紫檀為既有色票沒有的新種 → 配 cyan #2fc2d4（本層 10 色內不重複）。

export const STREET_TREE_NATIONAL_SPECIES: { names: string[]; label: string; color: string }[] = [
  { names: ["樟樹"],               label: "樟樹",     color: "#59b359" }, // 17,189 green（同 streetTreeColors）
  { names: ["榕樹"],               label: "榕樹",     color: "#4c9be0" }, // 14,777 blue（同 streetTreeColors）
  { names: ["台灣欒樹", "臺灣欒樹"], label: "台灣欒樹", color: "#b07ad9" }, // 13,877 purple（同 streetTreeColors 臺灣欒樹）
  { names: ["黑板樹"],             label: "黑板樹",   color: "#e15759" }, // 13,401 red（同 streetTreeColors）
  { names: ["茄苳"],               label: "茄苳",     color: "#f28e2b" }, // 13,003 orange（同 streetTreeColors）
  { names: ["小葉欖仁"],           label: "小葉欖仁", color: "#f58ebc" }, // 11,885 pink（同 streetTreeColors）
  { names: ["楓香"],               label: "楓香",     color: "#f2d64b" }, // 11,212 yellow（同 streetTreeColors）
  { names: ["印度紫檀"],           label: "印度紫檀", color: "#2fc2d4" }, // 5,769 cyan（新種）
  { names: ["大花紫薇"],           label: "大花紫薇", color: "#9ed45a" }, // 4,896 lime（同 streetTreeColors）
  { names: ["水黃皮"],             label: "水黃皮",   color: "#c69c6d" }, // 4,841 tan（同 streetTreeColors）
];

// 城市二色（value 對齊 PMTiles city 欄位值；供染色/篩選/popup 中文顯示三處共用）
export const STREET_TREE_NATIONAL_CITIES: { value: string; label: string; color: string }[] = [
  { value: "taipei",   label: "台北", color: "#1565c0" },
  { value: "taichung", label: "台中", color: "#ef6c00" },
];

// 染色模式 select 選項；index 對齊 overlayRegistry 讀的 streetTreesNationalColorModeIdx。
// 胸徑/樹高兩模式欄位（dbh_cm/height_m）與 3epoch 層相同 → 直接沿用
// streetTree3epochDiameterColorExpr / streetTree3epochHeightColorExpr（分級與顏色照抄 streetTreeColors）。
export const STREET_TREE_NATIONAL_COLOR_MODES = ["species", "diameter", "height", "city"] as const;

/** 樹種：match species → 前 10 色（異體字同臂），其餘灰 */
export function streetTreeNationalSpeciesColorExpr(): unknown[] {
  return [
    "match", ["get", "species"],
    ...STREET_TREE_NATIONAL_SPECIES.flatMap((s) => [s.names, s.color]), // match 臂用字串陣列＝一臂多值
    STREET_TREE_OTHER_COLOR,
  ];
}

/** 城市：match city → 台北藍 / 台中橙，其餘灰 */
export function streetTreeNationalCityColorExpr(): unknown[] {
  return [
    "match", ["get", "city"],
    ...STREET_TREE_NATIONAL_CITIES.flatMap((c) => [c.value, c.color]),
    URBAN_MISSING_COLOR,
  ];
}

// ── 🕳️ 台北人行道樹穴 Tree Pits（56,720 MultiPolygon，PMTiles z11-16）──

// pit_type 二分類（樹穴 綠 / 花圃 黃）；供 fill/line 染色、Legend、篩選 select 三處共用。
export const TREE_PIT_TYPES: { name: string; color: string }[] = [
  { name: "樹穴", color: "#2e7d32" },
  { name: "花圃", color: "#f9a825" },
];

/** 類型：match pit_type → 2 色，其餘灰 */
export function treePitTypeColorExpr(): unknown[] {
  return [
    "match", ["get", "pit_type"],
    ...TREE_PIT_TYPES.flatMap((t) => [t.name, t.color]),
    URBAN_MISSING_COLOR,
  ];
}

// ── 🌳 樹冠高度 Canopy Height（全台 raster PNG PMTiles，Meta/WRI 2020 10m）──
// 顏色已預烤進 PNG（ColorBrewer Greens sequential，低植被端半透明）；
// 本色帶僅供 LegendPanel 漸層條使用，需與 raster 實際 colormap 一致。
export const CANOPY_HEIGHT_RAMP = ["#f7fcf5", "#c7e9c0", "#74c476", "#238b45", "#00441b"];
