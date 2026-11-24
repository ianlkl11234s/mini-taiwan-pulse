// 菲律賓國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { PhLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { ID_DATA_SPECS } from "../../data/idDataLayers";
import { categoryMultiSelect, heatmapPalette, opacitySlider, scaleSlider, serializeMultiSelectValues } from "../../data/layerParamsSpec";
import { VN_DATA_SPECS, VN_STATUSES } from "../vn/vnDataLayers";
import { densePointOpacity, RASTER } from "../../map/mapStyleScale";
import { PH_ADMIN_LEVELS, PH_DATA_SPECS, PH_PLANT_STATUS_DEFAULT, PH_PLANT_STATUSES, phCatOptions } from "./phDataLayers";
import { PH_RASTER_SPECS } from "./phWavesLayers";

export const PH_PACK_PARAMS = {
  // 菲律賓第 0–1 波（2026-11-13）：選項順序＝`data/phDataLayers.ts` PH_ADMIN_LEVELS；行政邊界預設 region、人口預設 province（國家全覽 z5 有圖磚）
  phAdminBoundaries: [
    opacitySlider("phAdminBoundariesOpacity", 0.85),
    {
      kind: "select", category: "data", name: "phAdminBoundariesLevel", label: "行政層級", default: "region",
      options: PH_ADMIN_LEVELS.map((x) => ({ label: x.label, value: x.value })),
      out: "phAdminBoundariesLevelIdx", encode: PH_ADMIN_LEVELS.map((x) => x.value),
    },
  ],
  phPopulation: [
    {
      kind: "select", category: "data", name: "phPopulationLevel", label: "行政層級", default: "province",
      options: PH_ADMIN_LEVELS.map((x) => ({ label: x.label, value: x.value })),
      out: "phPopulationLevelIdx", encode: PH_ADMIN_LEVELS.map((x) => x.value),
    },
    opacitySlider("phPopulationOpacity", 0.7),
  ],
  // 菲律賓規格驅動 8 層：類別多選（順序＝規格 cats＋「其他」＝bitmask）；電廠另有狀態多選（預設運轉中＋興建中）；加油站（≥1 萬點）加熱區顏色
  ...Object.fromEntries(PH_DATA_SPECS.map((spec) => {
    const hasPoint = spec.parts.some((p) => p.geom === "point");
    const pointOnly = spec.parts.every((p) => p.geom === "point");
    return [spec.key, [
      categoryMultiSelect(spec.key, phCatOptions(spec)),
      ...(spec.key === "phPowerPlants" ? [{
        kind: "multiSelect" as const, name: "phPowerPlantsStatus", label: "狀態", default: serializeMultiSelectValues([...PH_PLANT_STATUS_DEFAULT]),
        options: PH_PLANT_STATUSES.map((x) => ({ label: x.label.zh, value: x.id })), out: "phPowerPlantsStatusMask",
      }] : []),
      ...(spec.heat ? [heatmapPalette(spec.key)] : []),
      opacitySlider(`${spec.key}Opacity`, spec.opacity ?? (pointOnly ? densePointOpacity(spec.count) : 0.85)),
      ...(hasPoint ? [scaleSlider(`${spec.key}Scale`, 1)] : []),
    ]];
  })),
  // 菲律賓 raster 4 層（2026-11-16）：只有透明度（同 caHillshade）
  ...Object.fromEntries(PH_RASTER_SPECS.map((spec) => [spec.key, [
    { kind: "slider" as const, name: `${spec.key}Opacity`, labelPrefix: "透明度", digits: 2, default: spec.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 },
  ]])),
  // 印尼規格驅動 19 層：類別多選（順序＝規格 cats＋「其他」＝bitmask；沉降預設只開 2025）；≥1 萬點加熱區顏色
  ...Object.fromEntries(ID_DATA_SPECS.map((spec) => {
    const hasPoint = spec.parts.some((p) => p.geom === "point");
    const pointOnly = spec.parts.every((p) => p.geom === "point");
    return [spec.key, [
      categoryMultiSelect(spec.key, phCatOptions(spec), spec.defaultCats ? serializeMultiSelectValues([...spec.defaultCats]) : undefined),
      ...(spec.heat ? [heatmapPalette(spec.key)] : []),
      opacitySlider(`${spec.key}Opacity`, spec.opacity ?? (pointOnly ? densePointOpacity(spec.count) : 0.85)),
      ...(hasPoint ? [scaleSlider(`${spec.key}Scale`, 1)] : []),
    ]];
  })),
  // 越南規格驅動 10 層：類別多選（順序＝規格 cats＋「其他」＝bitmask）；GEM 電廠、風光、油氣另有狀態多選（預設見規格 statusDefault）
  ...Object.fromEntries(VN_DATA_SPECS.map((spec) => {
    const parts = [...spec.parts, ...(spec.more?.parts ?? [])];
    const hasPoint = parts.some((p) => p.geom === "point");
    const pointOnly = parts.every((p) => p.geom === "point");
    return [spec.key, [
      categoryMultiSelect(spec.key, phCatOptions(spec)),
      ...(spec.statusDefault ? [{
        kind: "multiSelect" as const, name: `${spec.key}Status`, label: "狀態", default: serializeMultiSelectValues([...spec.statusDefault]),
        options: VN_STATUSES.map((x) => ({ label: x.label.zh, value: x.id })), out: `${spec.key}StatusMask`,
      }] : []),
      opacitySlider(`${spec.key}Opacity`, spec.opacity ?? (pointOnly ? densePointOpacity(spec.count) : 0.85)),
      ...(hasPoint ? [scaleSlider(`${spec.key}Scale`, 1)] : []),
    ]];
  })),
  phOpenaqAir: [opacitySlider("phOpenaqAirOpacity", 0.9), scaleSlider("phOpenaqAirScale", 1)],
  // <codemod:append PH_PACK_PARAMS>
} satisfies Partial<Record<PhLayerKey, LayerParamSpec[]>>;
