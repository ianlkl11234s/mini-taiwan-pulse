// 中國國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { CnLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { categoryMultiSelect, heatmapPalette, opacitySlider, scaleSlider, serializeMultiSelectValues } from "../../data/layerParamsSpec";
import { densePointOpacity } from "../../map/mapStyleScale";
import { CN_ADMIN_LEVELS, CN_DATA_SPECS, CN_PLANT_SCOPES, CN_PLANT_STATUS_DEFAULT, CN_PLANT_STATUSES, CN_RASTER_SPECS, cnCatOptions } from "./cnDataLayers";

export const CN_PACK_PARAMS = {
  // 中國第 0–1 波（2026-11-13，站主限定）：選項順序＝`data/cnDataLayers.ts` CN_ADMIN_LEVELS；行政邊界、人口預設省級（國家全覽 z3.4 有圖磚）
  cnAdminBoundaries: [
    opacitySlider("cnAdminBoundariesOpacity", 0.85),
    {
      kind: "select", category: "data", name: "cnAdminBoundariesLevel", label: "行政層級", default: "province",
      options: CN_ADMIN_LEVELS.map((x) => ({ label: x.label, value: x.value })),
      out: "cnAdminBoundariesLevelIdx", encode: CN_ADMIN_LEVELS.map((x) => x.value),
    },
  ],
  cnPopulation: [
    {
      kind: "select", category: "data", name: "cnPopulationLevel", label: "行政層級", default: "province",
      options: CN_ADMIN_LEVELS.map((x) => ({ label: x.label, value: x.value })),
      out: "cnPopulationLevelIdx", encode: CN_ADMIN_LEVELS.map((x) => x.value),
    },
    opacitySlider("cnPopulationOpacity", 0.7),
  ],
  cnPopulationGrid: [opacitySlider("cnPopulationGridOpacity", 0.75)],
  // 中國第 2–5 波 raster（地形、養殖、土壤）：只有透明度
  ...Object.fromEntries(CN_RASTER_SPECS.map((spec) => [spec.key, [opacitySlider(`${spec.key}Opacity`, spec.opacity)]])),
  // 中國規格驅動 6 層：≥2 類者加類別多選（順序＝規格 cats＝bitmask）；電廠另有狀態多選（預設運轉中＋興建中）與範圍（C090 再生能源子集）；公交站（85 萬點）加熱區顏色
  ...Object.fromEntries(CN_DATA_SPECS.map((spec) => {
    const hasPoint = spec.parts.some((p) => p.geom === "point");
    const pointOnly = spec.parts.every((p) => p.geom === "point");
    return [spec.key, [
      ...(spec.cats.length >= 2 ? [categoryMultiSelect(spec.key, cnCatOptions(spec))] : []),
      ...(spec.key === "cnPowerPlants" ? [{
        kind: "multiSelect" as const, name: "cnPowerPlantsStatus", label: "狀態", default: serializeMultiSelectValues([...CN_PLANT_STATUS_DEFAULT]),
        options: CN_PLANT_STATUSES.map((x) => ({ label: x.label.zh, value: x.id })), out: "cnPowerPlantsStatusMask",
      }, {
        kind: "select" as const, category: "data" as const, name: "cnPowerPlantsScope", label: "範圍", default: "all",
        options: CN_PLANT_SCOPES.map((x) => ({ label: x.label, value: x.id })), out: "cnPowerPlantsScopeIdx", encode: CN_PLANT_SCOPES.map((x) => x.id),
      }] : []),
      ...(spec.heat ? [heatmapPalette(spec.key)] : []),
      opacitySlider(`${spec.key}Opacity`, pointOnly ? densePointOpacity(spec.count) : 0.85),
      ...(hasPoint ? [scaleSlider(`${spec.key}Scale`, 1)] : []),
    ]];
  })),
  // <codemod:append CN_PACK_PARAMS>
} satisfies Partial<Record<CnLayerKey, LayerParamSpec[]>>;
