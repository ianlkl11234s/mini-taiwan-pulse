// 泰國國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { ThLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { categoryMultiSelect, heatmapPalette, opacitySlider, scaleSlider, serializeMultiSelectValues } from "../../data/layerParamsSpec";
import { phCatOptions } from "../../data/phDataLayers";
import { densePointOpacity, RASTER } from "../../map/mapStyleScale";
import { TH_ADMIN_LEVELS, TH_DATA_SPECS, TH_POP_LEVELS, TH_STATUSES } from "./thDataLayers";
import { TH_RASTER_SPECS } from "./thWavesLayers";

export const TH_PACK_PARAMS = {
  // 泰國第 0–1 波（2026-11-22）：選項順序＝`data/thDataLayers.ts` TH_ADMIN_LEVELS／TH_POP_LEVELS；行政邊界、人口預設 province（國家全覽 z5 有圖磚）
  thAdminBoundaries: [
    opacitySlider("thAdminBoundariesOpacity", 0.85),
    {
      kind: "select", category: "data", name: "thAdminBoundariesLevel", label: "行政層級", default: "province",
      options: TH_ADMIN_LEVELS.map((x) => ({ label: x.label, value: x.value })),
      out: "thAdminBoundariesLevelIdx", encode: TH_ADMIN_LEVELS.map((x) => x.value),
    },
  ],
  thPopulation: [
    {
      kind: "select", category: "data", name: "thPopulationLevel", label: "行政層級", default: "province",
      options: TH_POP_LEVELS.map((x) => ({ label: x.label, value: x.value })),
      out: "thPopulationLevelIdx", encode: TH_POP_LEVELS.map((x) => x.value),
    },
    opacitySlider("thPopulationOpacity", 0.7),
  ],
  // 泰國規格驅動 8 層：類別多選（順序＝規格 cats＋「其他」＝bitmask）；GEM 電廠另有狀態多選（預設運轉中＋興建中）；儲槽與管線預設只開油氣與 LNG；加油站（≥1 萬點）加熱區顏色
  ...Object.fromEntries(TH_DATA_SPECS.map((spec) => {
    const hasPoint = spec.parts.some((p) => p.geom === "point");
    const pointOnly = spec.parts.every((p) => p.geom === "point");
    return [spec.key, [
      categoryMultiSelect(spec.key, phCatOptions(spec), spec.defaultCats ? serializeMultiSelectValues([...spec.defaultCats]) : undefined),
      ...(spec.statusDefault ? [{
        kind: "multiSelect" as const, name: `${spec.key}Status`, label: "狀態", default: serializeMultiSelectValues([...spec.statusDefault]),
        options: TH_STATUSES.map((x) => ({ label: x.label.zh, value: x.id })), out: `${spec.key}StatusMask`,
      }] : []),
      ...(spec.heat ? [heatmapPalette(spec.key)] : []),
      opacitySlider(`${spec.key}Opacity`, spec.opacity ?? (pointOnly ? densePointOpacity(spec.count) : 0.85)),
      ...(hasPoint ? [scaleSlider(`${spec.key}Scale`, 1)] : []),
    ]];
  })),
  // 泰國 raster 2 層（2026-11-22）：只有透明度（同 phTerrain）
  ...Object.fromEntries(TH_RASTER_SPECS.map((spec) => [spec.key, [
    { kind: "slider" as const, name: `${spec.key}Opacity`, labelPrefix: "透明度", digits: 2, default: spec.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 },
  ]])),
  // <codemod:append TH_PACK_PARAMS>
} satisfies Partial<Record<ThLayerKey, LayerParamSpec[]>>;
