// 越南國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { VnLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { opacitySlider } from "../../data/layerParamsSpec";
import { RASTER } from "../../map/mapStyleScale";
import { VN_RASTER_SPECS } from "./vnWavesLayers";

export const VN_PACK_PARAMS = {
  // 越南第 0–1 波（2026-11-13）：行政邊界、人口只有 34 省一級（不需層級 select）
  vnAdminBoundaries: [opacitySlider("vnAdminBoundariesOpacity", 0.85)],
  vnPopulation: [opacitySlider("vnPopulationOpacity", 0.7)],
  // 越南 raster 4 層（2026-11-17）：只有透明度（同 caHillshade、菲律賓 raster）
  ...Object.fromEntries(VN_RASTER_SPECS.map((spec) => [spec.key, [
    { kind: "slider" as const, name: `${spec.key}Opacity`, labelPrefix: "透明度", digits: 2, default: spec.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 },
  ]])),
  // <codemod:append VN_PACK_PARAMS>
} satisfies Partial<Record<VnLayerKey, LayerParamSpec[]>>;
