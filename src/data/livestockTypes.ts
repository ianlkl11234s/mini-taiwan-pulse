// 畜牧分類定義 — overlay 分色 / legend / popup 共用的單一真實來源。
// 鏡像 fireTypes.ts 的做法：色與 label 只在這裡定義一次。

export interface CatStyle {
  key: string;
  color: string;
  label: string;
}

// ── 畜禽飼養場：依主畜種分 4 層（每層單色）──
export const FARM_SPECIES: CatStyle[] = [
  { key: "豬", color: "#ec6a5e", label: "豬 Pig" },
  { key: "雞", color: "#f4b400", label: "雞 Chicken" },
  { key: "牛", color: "#6d4c41", label: "牛 Cattle" },
  { key: "鴨", color: "#00897b", label: "鴨 Duck" },
  { key: "鵝", color: "#26c6da", label: "鵝 Goose" },
  { key: "羊", color: "#ab47bc", label: "羊 Sheep/Goat" },
  { key: "其他", color: "#9e9e9e", label: "其他 Other" },
];

export const FARM_COLOR: Record<string, string> = Object.fromEntries(
  FARM_SPECIES.map((c) => [c.key, c.color]),
);

// 各畜種同色系「淺 → 深」ramp（越多隻越深），circle-color 依總隻數內插（domain 同 radius）
export const FARM_COLOR_RAMP: Record<string, [string, string]> = {
  豬: ["#f6b9b0", "#b02b1a"],   // 珊瑚淺 → 深紅褐
  雞: ["#ffe3a3", "#c77800"],   // 淡黃 → 琥珀深
  牛: ["#c9b7af", "#3e2723"],   // 淺褐 → 深咖
  鴨: ["#80cbc4", "#004d40"],   // 淺青 → 深墨綠
  鵝: ["#a5e5ef", "#00838f"],   // 淺天藍 → 深藍綠
  羊: ["#e1bee7", "#6a1b9a"],   // 淺紫 → 深紫
  其他: ["#dcdcdc", "#4a4a4a"], // 淺灰 → 深灰
};

// per-species 圓圈大小 domain（總隻數 log 尺標，錨 p95 + 兩端 clamp）。
// key = LayerVisibility key。⚠️ 各層獨立正規化 → 大小只在同層內可比。
export const FARM_SIZE_DOMAIN: Record<string, [number, number]> = {
  livestockFarmPig: [100, 4000], // p95 ≈ 3,685
  livestockFarmChicken: [1000, 75000], // p95 ≈ 74,000（max 708,802 clamp）
  livestockFarmCattle: [20, 700], // max 才 1,003，用 p99
  livestockFarmDuck: [100, 16000], // p95 ≈ 16,337
  livestockFarmGoose: [100, 8000], // p95 ≈ 7,819
  livestockFarmSheep: [20, 600], // p95 ≈ 603
  livestockFarmOther: [50, 3000], // 拆出鴨/鵝/羊後剩鹿/馬/鵪鶉/兔/鴕鳥
};

// 「其他」層混多物種、量級差極大（鵪鶉可達 15 萬、鹿多在數百）→ size 依主畜種各自正規化
export const OTHER_SPECIES_SIZE_DOMAIN: Record<string, [number, number]> = {
  鹿: [30, 300],        // max 611
  鵪鶉: [5000, 120000], // 9k ~ 15萬
  馬: [5, 80],          // max 100
  兔: [200, 1500],      // max 1502
  鴕鳥: [50, 200],      // max 206
};
export const OTHER_SIZE_DOMAIN_DEFAULT: [number, number] = [50, 3000];

// 「其他」層各物種色系「淺→深」ramp（依各自 size domain 內插，越多越深）；default 灰
export const OTHER_SPECIES_COLOR_RAMP: Record<string, [string, string]> = {
  鹿: ["#a5d6a7", "#1b5e20"],   // 綠
  鵪鶉: ["#ffcc80", "#e65100"], // 橙
  馬: ["#9fa8da", "#283593"],   // 靛
  兔: ["#f8bbd0", "#ad1457"],   // 粉
  鴕鳥: ["#e6ee9c", "#827717"], // 橄欖
};
export const OTHER_COLOR_RAMP_DEFAULT: [string, string] = ["#dcdcdc", "#4a4a4a"];

// 「其他」層 legend 用（各物種代表色 = ramp 中間調）
export const OTHER_SPECIES_LEGEND: CatStyle[] = [
  { key: "鹿", color: "#43a047", label: "鹿 Deer" },
  { key: "鵪鶉", color: "#fb8c00", label: "鵪鶉 Quail" },
  { key: "馬", color: "#5c6bc0", label: "馬 Horse" },
  { key: "兔", color: "#ec407a", label: "兔 Rabbit" },
  { key: "鴕鳥", color: "#9e9d24", label: "鴕鳥 Ostrich" },
];

export const FARM_RADIUS_PX: [number, number] = [3, 20];

// 各飼養場層的「品項高亮」下拉選項（依 種類明細 子字串比對）；index 0 = 全部（不高亮）
export const FARM_HIGHLIGHT_OPTIONS: Record<
  "livestockFarmPig" | "livestockFarmChicken" | "livestockFarmCattle"
  | "livestockFarmDuck" | "livestockFarmGoose" | "livestockFarmSheep" | "livestockFarmOther",
  string[]
> = {
  livestockFarmPig: ["全部", "肉豬", "種母豬", "種公豬"],
  livestockFarmChicken: ["全部", "有色肉雞", "蛋雞", "白肉雞", "放山雞", "種雞", "火雞"],
  livestockFarmCattle: ["全部", "乳牛", "肉牛", "種牛"],
  livestockFarmDuck: ["全部", "肉鴨", "蛋鴨", "種鴨"],
  livestockFarmGoose: ["全部", "肉鵝", "種鵝"],
  livestockFarmSheep: ["全部", "肉羊", "乳羊"],
  livestockFarmOther: ["全部", "鹿", "肉兔", "鵪鶉", "馬", "鴕鳥"],
};

// ── 屠宰場：依「種類」首字判定家畜/家禽（豬牛羊=家畜 / 雞鴨鵝=家禽，資料中兩者不混寫）──
export const POULTRY_HEADS = ["雞", "鴨", "鵝"];

export const SLAUGHTER_CATS: CatStyle[] = [
  { key: "家畜", color: "#c62828", label: "家畜 Livestock（豬/牛/羊）" },
  { key: "家禽", color: "#ef6c00", label: "家禽 Poultry（雞/鴨/鵝）" },
];

export const SLAUGHTER_COLOR = { livestock: "#c62828", poultry: "#ef6c00" } as const;

/** 由「種類」原字串（如「豬或羊」「雞或鴨或鵝」）判定家畜/家禽 */
export function slaughterKind(raw: unknown): "家畜" | "家禽" {
  const head = String(raw ?? "").charAt(0);
  return POULTRY_HEADS.includes(head) ? "家禽" : "家畜";
}

// ── 設施單色 ──
export const FEED_COLOR = "#455a64";
export const MARKET_COLOR = "#d500f9";
