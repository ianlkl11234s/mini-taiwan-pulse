// 印尼國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { IdLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { opacitySlider } from "../../data/layerParamsSpec";
import { RASTER } from "../../map/mapStyleScale";
import { ID_ADMIN_LEVELS, ID_LEVELS_2 } from "./idDataLayers";
import { ID_RASTER_SPECS } from "./idWavesLayers";

export const ID_PACK_PARAMS = {
  // 印尼第 0–3 波（2026-11-23）：選項順序＝ ID_ADMIN_LEVELS／ID_LEVELS_2；行政邊界、人口、IDM 預設 province（國家全覽 z4 有圖磚）
  idAdminBoundaries: [
    opacitySlider("idAdminBoundariesOpacity", 0.85),
    {
      kind: "select", category: "data", name: "idAdminBoundariesLevel", label: "行政層級", default: "province",
      options: ID_ADMIN_LEVELS.map((x) => ({ label: x.label, value: x.value })),
      out: "idAdminBoundariesLevelIdx", encode: ID_ADMIN_LEVELS.map((x) => x.value),
    },
  ],
  idPopulation: [
    {
      kind: "select", category: "data", name: "idPopulationLevel", label: "行政層級", default: "province",
      options: ID_LEVELS_2.map((x) => ({ label: x.label, value: x.value })),
      out: "idPopulationLevelIdx", encode: ID_LEVELS_2.map((x) => x.value),
    },
    opacitySlider("idPopulationOpacity", 0.7),
  ],
  idRuralDevelopment: [
    {
      kind: "select", category: "data", name: "idRuralDevelopmentLevel", label: "行政層級", default: "province",
      options: ID_LEVELS_2.map((x) => ({ label: x.label, value: x.value })),
      out: "idRuralDevelopmentLevelIdx", encode: ID_LEVELS_2.map((x) => x.value),
    },
    opacitySlider("idRuralDevelopmentOpacity", 0.7),
  ],
  // 印尼 raster 5 層（2026-11-23）：只有透明度（同 thTerrain）
  ...Object.fromEntries(ID_RASTER_SPECS.map((spec) => [spec.key, [
    { kind: "slider" as const, name: `${spec.key}Opacity`, labelPrefix: "透明度", digits: 2, default: spec.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 },
  ]])),
  // <codemod:append ID_PACK_PARAMS>
} satisfies Partial<Record<IdLayerKey, LayerParamSpec[]>>;
