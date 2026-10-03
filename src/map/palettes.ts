/**
 * 熱區／網格色盤庫（R7，map-layers.md §3.4 G-2／G-3；提案 docs/features/layer-color-picker/PROPOSAL.md §0.1）。
 *
 * 17 組序列色階，每組暗／淡兩版各 7 階（低密度 → 高密度）：
 * - 暗底圖：越密越亮；淡底圖：越密越深（兩版都讓低密度融進底圖，最密處最顯眼）。
 * - 色值沿用 `ramp-validation.md` §5（dataviz validate_palette.js --ordinal 在暗 #262626／#1f1f1f、
 *   淡 #f5f5f3／#ffffff 四種陸地色全部通過）；不要手調，改值要重跑驗證器（`palettes.test.ts` 鎖階數與方向）。
 * - 清單順序刻意把彼此太像的組分開（magma／rocket、PuBu／oslo、batlow／cividis／turku）。
 * - 只給熱區與網格用；點、面、類別圖層不換色。狀態／災害語意色（K-3）不進本庫。
 */

export interface SequentialPalette {
  /** 存檔、場景、Agent 用的 id（色階原名） */
  id: string;
  /** 使用者看到的中文名 */
  zh: string;
  /** 色階出處（只當附註） */
  source: string;
  /** 暗底圖 7 階，低 → 高（越密越亮） */
  dark: readonly string[];
  /** 淡底圖 7 階，低 → 高（越密越深） */
  light: readonly string[];
}

export const PALETTE_STEPS = 7;

export const SEQUENTIAL_PALETTES = [
  { id: "magma", zh: "岩漿", source: "matplotlib",
    dark: ["#8e2a81", "#ba3878", "#e24d66", "#f8745c", "#fea06d", "#fec98d", "#fcf0b2"],
    light: ["#f9795d", "#e95561", "#ca3e72", "#a4317e", "#7e2482", "#5a167e", "#37106c"] },
  { id: "viridis", zh: "翠綠", source: "matplotlib",
    dark: ["#365c8d", "#287c8e", "#1f9a8a", "#34b779", "#6fcf58", "#b8de29", "#fde725"],
    light: ["#46c06f", "#21a685", "#238a8d", "#2e6e8e", "#3c4e8a", "#472b7a", "#46085c"] },
  { id: "YlOrBr", zh: "黃橙褐", source: "ColorBrewer",
    dark: ["#9a3504", "#bd4503", "#db5d0b", "#f27d1b", "#fea332", "#fecc61", "#ffefac"],
    light: ["#f5841e", "#e66911", "#d25306", "#b94303", "#9e3604", "#822d05", "#662506"] },
  { id: "PuBuGn", zh: "紫藍綠", source: "ColorBrewer",
    dark: ["#016b58", "#02818a", "#3b93c2", "#6baad0", "#a5bddb", "#d2d2e7", "#f4ebf5"],
    light: ["#72add1", "#4c9bc7", "#258baf", "#027d81", "#016c59", "#015947", "#014636"] },
  { id: "Burg", zh: "酒紅", source: "CARTO",
    dark: ["#91345c", "#ab456b", "#c45979", "#d87288", "#e98c99", "#f6a9ac", "#ffc6c4"],
    light: ["#e68895", "#d77087", "#c55a79", "#af486d", "#983860", "#802b52", "#672044"] },
  { id: "speed", zh: "流速", source: "cmocean",
    dark: ["#116d2a", "#3e851a", "#739806", "#a5aa1b", "#cdbd4b", "#e7d583", "#f8f1b8"],
    light: ["#aaac21", "#809d06", "#528d12", "#257a24", "#0b632c", "#144c2a", "#193520"] },
  { id: "batlow", zh: "巴特洛", source: "Crameri",
    dark: ["#2c665d", "#607942", "#91862d", "#c19036", "#ec9a60", "#fdb0a7", "#faccfa"],
    light: ["#d89448", "#aa8c2d", "#7b8034", "#49714f", "#1e5d62", "#114561", "#0b2c5c"] },
  { id: "BuPu", zh: "藍紫", source: "ColorBrewer",
    dark: ["#852e90", "#8a59a8", "#8c7eba", "#91a0cb", "#a1bedb", "#c4d7e8", "#e6f0f6"],
    light: ["#93a4cd", "#8c87bf", "#8c67af", "#88449e", "#831a83", "#6a0866", "#4f014d"] },
  { id: "bilbao", zh: "畢爾包", source: "Crameri",
    dark: ["#8d3e45", "#9f5c56", "#a8805e", "#b2a06b", "#c1bb9f", "#d5d4d1", "#eeeeee"],
    light: ["#b4a46f", "#ab8860", "#a26a59", "#984c4f", "#84343b", "#6f2024", "#580b10"] },
  { id: "YlGnBu", zh: "黃綠藍", source: "ColorBrewer",
    dark: ["#2259a5", "#2077b4", "#2196c0", "#3eb3c4", "#7dccbb", "#b5e2b6", "#eaf7b1"],
    light: ["#44b7c4", "#299dc1", "#1e83b9", "#2168ad", "#234da0", "#23328f", "#11246b"] },
  { id: "acton", zh: "阿克頓", source: "Crameri",
    dark: ["#595481", "#84638e", "#bd6992", "#d484a9", "#dea6c6", "#e7c8e0", "#f0eafa"],
    light: ["#d689ad", "#c76e96", "#9c658f", "#675f8a", "#524b78", "#433665", "#352152"] },
  { id: "tokyo", zh: "東京", source: "Crameri",
    dark: ["#6f5351", "#747454", "#7a9358", "#84b163", "#96cd79", "#b3e59c", "#def9cb"],
    light: ["#86b565", "#7c9b5a", "#778055", "#726352", "#6b464f", "#5b2e4a", "#431c41"] },
  { id: "rocket", zh: "火箭", source: "seaborn",
    dark: ["#a01a5b", "#cd1c4e", "#ea453e", "#f37852", "#f6a37b", "#f7c9ab", "#faebdd"],
    light: ["#f47e57", "#ee533f", "#da2947", "#b71657", "#8e1d5b", "#661f54", "#421b46"] },
  { id: "PuBu", zh: "紫藍", source: "ColorBrewer",
    dark: ["#046096", "#1278b4", "#3c93c2", "#73a8cf", "#a5bddb", "#d1d2e7", "#f2ecf5"],
    light: ["#79abd0", "#4e9ac6", "#2685bb", "#056faf", "#045c90", "#034a74", "#023858"] },
  { id: "turku", zh: "圖爾庫", source: "Crameri",
    dark: ["#5d5d43", "#75744e", "#918a5a", "#b49e6b", "#e4aa90", "#fbc3be", "#ffe6e6"],
    light: ["#bba16f", "#9a905e", "#7f7d52", "#696849", "#54543f", "#414135", "#2e2e28"] },
  { id: "cividis", zh: "色盲友善", source: "matplotlib",
    dark: ["#545a6d", "#6f7073", "#8a8678", "#a89d73", "#c5b568", "#e3ce53", "#fee838"],
    light: ["#b1a570", "#968f77", "#7b7a78", "#62666f", "#48526c", "#273e6e", "#002b62"] },
  { id: "oslo", zh: "奧斯陸", source: "Crameri",
    dark: ["#2b5c95", "#4472b3", "#658ac6", "#8ca2c9", "#b2bbcc", "#d1d4d9", "#eeeeef"],
    light: ["#91a5c9", "#6e90c9", "#4f7bbc", "#3667a5", "#245488", "#194269", "#122f4c"] },
] as const satisfies readonly SequentialPalette[];

export type PaletteId = (typeof SEQUENTIAL_PALETTES)[number]["id"];

export const PALETTE_IDS: readonly PaletteId[] = SEQUENTIAL_PALETTES.map((p) => p.id);

const BY_ID = new Map<string, SequentialPalette>(SEQUENTIAL_PALETTES.map((p) => [p.id, p]));

export function isPaletteId(id: unknown): id is PaletteId {
  return typeof id === "string" && BY_ID.has(id);
}

export function paletteById(id: string): SequentialPalette | undefined {
  return BY_ID.get(id);
}

/** 該底圖的 7 階（低 → 高）；查無 id 回 undefined。 */
export function paletteRamp(id: string, isDark: boolean): readonly string[] | undefined {
  const p = BY_ID.get(id);
  return p ? (isDark ? p.dark : p.light) : undefined;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: readonly number[]): string {
  return `#${[r, g, b].map((v) => Math.round(v!).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 把 7 階重新取樣成 n 階（網格分級數不是 7 的層用，例：不動產總市值 9 級、預售 3 點）。
 * 兩端固定為第 1／第 7 階，中間在相鄰兩階之間線性內插；n = 7 原樣回傳。
 */
export function resampleRamp(ramp: readonly string[], n: number): string[] {
  if (n === ramp.length) return [...ramp];
  if (n <= 1) return [ramp[ramp.length - 1]!];
  const rgb = ramp.map(hexToRgb);
  return Array.from({ length: n }, (_, i) => {
    const s = (i / (n - 1)) * (rgb.length - 1);
    const lo = Math.min(rgb.length - 2, Math.floor(s));
    const f = s - lo;
    return rgbToHex(rgb[lo]!.map((v, c) => v + (rgb[lo + 1]![c]! - v) * f));
  });
}
