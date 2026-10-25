/**
 * 公車擁擠模擬的地圖／圖例色與 paint expression（依賴 mapStyleScale token，故與 manifest 會 import 的
 * busCrowdingSimTypes.ts 分開：vite.config 載入 manifest 時不能拉進 designTokens → i18n 的 import.meta.glob）。
 */
import { paletteRamp, resampleRamp } from "../map/palettes";
import { BOUNDARY_GRAY, FILL_OUTLINE, LINE_OPACITY, LINE_WIDTH } from "../map/mapStyleScale";

/**
 * 四級色（map-layers F-3「分析結果」→ viz-library DECISIONS §1 viridis；暗／淡方向相反。2026-10-25 使用者選乙：magma 的米黃頂級在白描邊車點上和灰色 0 級難分，改 viridis）：
 * - 0（無超載）＝背景參考線：行政界中性灰 BOUNDARY_GRAY，寬度／透明度同 F-2 背景面外框（0.5px、0.6）。
 * - 三個 > 0 級＝專案既有 viridis 7 階（palettes.ts，ramp-validation §5 驗過）用 resampleRamp 取 3 階（第 1、4、7 階）：
 *   暗底圖越高越亮、淡底圖越高越深。不自調色號。
 */
const RAMP = { dark: resampleRamp(paletteRamp("viridis", true)!, 3), light: resampleRamp(paletteRamp("viridis", false)!, 3) };
export const busCrowdingColors = (isDark: boolean): readonly [string, string, string, string] => {
  const theme = isDark ? "dark" : "light";
  const [a, b, c] = RAMP[theme];
  return [BOUNDARY_GRAY[theme], a!, b!, c!];
};
/** 0 級參考線（F-2 背景面外框那組 token）。 */
export const BUS_CROWDING_ZERO_LINE = FILL_OUTLINE.background;

/**
 * 路段數值寫在 GeoJSON properties（setData 重建）：
 * - lv：分級 0–3（−1／缺＝不畫）。全時段超載比例＝依 ov 門檻（busCrowdingLevel，含班次 < 5 不畫）；
 *   時間回放＝20 分鐘內最近一班離站的負載分級（原型 index.html:324–327）。兩種檢視共用同一套 paint。
 * - s：line-sort-key（全時段＝ov，比分級細；回放＝lv），高值畫在上面。
 * - ov／t：全時段的超載比例與班次（popup、點擊排序用）。
 */
const LV = ["coalesce", ["get", "lv"], -1] as const;
const IS_ZERO = ["==", [...LV], 0] as const;

/** 不畫：lv < 0。line 與命中層共用（命中層也就點不到不畫的段）。 */
export const BUS_CROWDING_DRAWN_FILTER: unknown[] = [">=", [...LV], 0];

export const busCrowdingColorExpression = (isDark: boolean): unknown[] => {
  const c = busCrowdingColors(isDark);
  return ["match", [...LV], 1, c[1], 2, c[2], 3, c[3], c[0]];
};

/**
 * 0 級＝背景參考線：暗底圖用 F-2 背景面外框透明度；淡底圖的深灰在 0.6 下會和最高級深紫混淆、也像底圖道路，
 * 降到 L-4 下限 min。有值＝L-4 標準透明度。滑桿值 o 兩者都乘。
 */
export const busCrowdingZeroOpacity = (isDark: boolean): number => (isDark ? BUS_CROWDING_ZERO_LINE.opacity : LINE_OPACITY.min);
export const busCrowdingOpacityExpression = (o: number, isDark = true): unknown[] => [
  "case", [...IS_ZERO], o * busCrowdingZeroOpacity(isDark), o * LINE_OPACITY.standard,
];

/** 0 級固定 0.5px；有值＝L-1 標準線階（z10 1px → z14 2px）。zoom 必須在最外層。 */
export const busCrowdingWidthExpression = (): unknown[] => {
  const [z10, z14] = LINE_WIDTH.standard;
  return ["interpolate", ["linear"], ["zoom"],
    10, ["case", [...IS_ZERO], BUS_CROWDING_ZERO_LINE.width, z10],
    14, ["case", [...IS_ZERO], BUS_CROWDING_ZERO_LINE.width, z14]];
};

/** 高值畫在上面（line-sort-key 越大越後畫）。 */
export const BUS_CROWDING_SORT_KEY: unknown[] = ["coalesce", ["get", "s"], -1];
