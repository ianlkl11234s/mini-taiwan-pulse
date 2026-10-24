/**
 * 公車擁擠模擬的地圖／圖例色與 paint expression（依賴 mapStyleScale token，故與 manifest 會 import 的
 * busCrowdingSimTypes.ts 分開：vite.config 載入 manifest 時不能拉進 designTokens → i18n 的 import.meta.glob）。
 */
import { paletteRamp, resampleRamp } from "../map/palettes";
import { BOUNDARY_GRAY, FILL_OUTLINE, LINE_OPACITY, LINE_WIDTH } from "../map/mapStyleScale";
import { BUS_CROWDING_BREAKS, BUS_CROWDING_MIN_TRIPS, BUS_CROWDING_NONZERO } from "./busCrowdingSimTypes";

/**
 * 四級色（map-layers F-3「分析結果」→ viz-library DECISIONS §1 magma；暗／淡方向相反）：
 * - 0（無超載）＝背景參考線：行政界中性灰 BOUNDARY_GRAY，寬度／透明度同 F-2 背景面外框（0.5px、0.6）。
 * - 三個 > 0 級＝專案既有 magma 7 階（palettes.ts，ramp-validation §5 驗過）用 resampleRamp 取 3 階（第 1、4、7 階）：
 *   暗底圖越高越亮、淡底圖越高越深。不自調色號。
 */
const MAGMA = { dark: resampleRamp(paletteRamp("magma", true)!, 3), light: resampleRamp(paletteRamp("magma", false)!, 3) };
export const busCrowdingColors = (isDark: boolean): readonly [string, string, string, string] => {
  const theme = isDark ? "dark" : "light";
  const [a, b, c] = MAGMA[theme];
  return [BOUNDARY_GRAY[theme], a!, b!, c!];
};
/** 0 級參考線（F-2 背景面外框那組 token）。 */
export const BUS_CROWDING_ZERO_LINE = FILL_OUTLINE.background;

const NONZERO = BUS_CROWDING_NONZERO;
/** 數值寫在 GeoJSON properties（切版本／方案時 setData 重建）：ov＝超載比例（缺值 -1）、t＝班次。 */
const OV = ["coalesce", ["get", "ov"], -1] as const;
const IS_ZERO = ["<", [...OV], NONZERO] as const;

/** 不畫：ov 缺（-1）或班次 < 5。line 與命中層共用（命中層也就點不到不畫的段）。 */
export const BUS_CROWDING_DRAWN_FILTER: unknown[] = ["all", [">=", [...OV], 0], [">=", ["coalesce", ["get", "t"], 0], BUS_CROWDING_MIN_TRIPS]];

export const busCrowdingColorExpression = (isDark: boolean): unknown[] => {
  const c = busCrowdingColors(isDark);
  return ["step", [...OV], c[0], NONZERO, c[1], BUS_CROWDING_BREAKS[0], c[2], BUS_CROWDING_BREAKS[1], c[3]];
};

/** 0 級＝F-2 背景參考線透明度；有值＝L-4 標準透明度。滑桿值 o 兩者都乘。 */
export const busCrowdingOpacityExpression = (o: number): unknown[] => [
  "case", [...IS_ZERO], o * BUS_CROWDING_ZERO_LINE.opacity, o * LINE_OPACITY.standard,
];

/** 0 級固定 0.5px；有值＝L-1 標準線階（z10 1px → z14 2px）。zoom 必須在最外層。 */
export const busCrowdingWidthExpression = (): unknown[] => {
  const [z10, z14] = LINE_WIDTH.standard;
  return ["interpolate", ["linear"], ["zoom"],
    10, ["case", [...IS_ZERO], BUS_CROWDING_ZERO_LINE.width, z10],
    14, ["case", [...IS_ZERO], BUS_CROWDING_ZERO_LINE.width, z14]];
};

/** 高值畫在上面（line-sort-key 越大越後畫）。 */
export const BUS_CROWDING_SORT_KEY: unknown[] = [...OV];
