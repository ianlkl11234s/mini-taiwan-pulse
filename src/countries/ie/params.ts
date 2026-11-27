// 愛爾蘭國家包：params.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { IeLayerKey } from "./keys";
import type { LayerParamSpec } from "../../data/layerParamsSpec";
import { asKrSpec } from "../../data/intlSpecBridge";
import { categoryMultiSelect, heatmapPalette, krCatFilterSpecs, opacitySlider, scaleSlider } from "../../data/layerParamsSpec";
import { densePointOpacity, RASTER } from "../../map/mapStyleScale";
import { IE_COILLTE_FOREST_ROADS, IE_COILLTE_RECREATION } from "./ieCoillteTypes";
import { IE_DATA_SPECS, IE_FLOOD_SCENARIO_DEFAULT, IE_FLOOD_SCENARIOS, IE_GW_FLOOD_DEFAULT, IE_GW_FLOOD_PRODUCTS, IE_NOISE_METRIC_DEFAULT, IE_NOISE_METRICS } from "./ieDataLayers";

export const IE_PACK_PARAMS = {
  // 愛爾蘭第 0 波（2026-11-07）：選項順序＝`data/ieAdminTypes.ts` IE_ADMIN_LEVELS
  ieAdminBoundaries: [
    opacitySlider("ieAdminBoundariesOpacity", 0.85),
    {
      kind: "select", category: "data", name: "ieAdminBoundariesLevel", label: "行政層級", default: "la",
      options: [{ label: "地方政府（Local authority）", value: "la" }, { label: "選舉分區（Electoral division）", value: "ed" }, { label: "統計小區（Small area）", value: "sa" }],
      out: "ieAdminBoundariesLevelIdx", encode: ["la", "ed", "sa"],
    },
  ],
  // 愛爾蘭第 1 波起（2026-11-07）：規格驅動層同南韓（點＝透明度＋大小、線／面＝透明度、有分類者加類別多選、有熱區者加熱區顏色）；公園、國有登記土地的點／面切換由 repPointLayers 補
  ...Object.fromEntries(IE_DATA_SPECS.map((spec) => [spec.key, [
    // 第 3a 波河川淹水（NIFM）：情境 × 重現期一組一支 PMTiles，host 依 ieRiverFloodExtentsScenarioIdx 換檔（同台灣淹水情境）
    ...(spec.key === "ieRiverFloodExtents" ? [{
      kind: "select" as const, category: "data" as const, name: "ieRiverFloodExtentsScenario", label: "淹水情境", default: IE_FLOOD_SCENARIO_DEFAULT,
      options: IE_FLOOD_SCENARIOS.map((x) => ({ label: x.label.zh, value: x.value })),
      out: "ieRiverFloodExtentsScenarioIdx", encode: IE_FLOOD_SCENARIOS.map((x) => x.value),
    }] : []),
    // 第 9 波策略噪音地圖：Lden／Lnight 各一支 PMTiles，host 依 ieNoiseMapsMetricIdx 換檔
    ...(spec.key === "ieNoiseMaps" ? [{
      kind: "select" as const, category: "data" as const, name: "ieNoiseMapsMetric", label: "噪音指標", default: IE_NOISE_METRIC_DEFAULT,
      options: IE_NOISE_METRICS.map((x) => ({ label: x.label.zh, value: x.value })),
      out: "ieNoiseMapsMetricIdx", encode: IE_NOISE_METRICS.map((x) => x.value),
    }] : []),
    // 第 11 波 GSI 地下水淹水（ND）：一產品一支 PMTiles，host 依 ieGroundwaterFloodingProductIdx 換檔
    ...(spec.key === "ieGroundwaterFlooding" ? [{
      kind: "select" as const, category: "data" as const, name: "ieGroundwaterFloodingProduct", label: "淹水圖種類", default: IE_GW_FLOOD_DEFAULT,
      options: IE_GW_FLOOD_PRODUCTS.map((x) => ({ label: x.label.zh, value: x.value })),
      out: "ieGroundwaterFloodingProductIdx", encode: IE_GW_FLOOD_PRODUCTS.map((x) => x.value),
    }] : []),
    ...krCatFilterSpecs(asKrSpec(spec)),
    ...(spec.heat ? [heatmapPalette(spec.key)] : []),
    ...(spec.geom === "point"
      ? [opacitySlider(`${spec.key}Opacity`, densePointOpacity(spec.count)), scaleSlider(`${spec.key}Scale`, 1)]
      : [opacitySlider(`${spec.key}Opacity`, spec.key === "ieGaeltacht" ? 0.6 : spec.key === "ieRiverFloodExtents" || spec.key === "ieNoiseMaps" || spec.key === "ieGroundwaterFlooding" ? 0.55 : spec.geom === "polygon" ? 0.7 : 0.85)]),
  ]])),
  // 愛爾蘭第 5c 波（站主限定 Coillte）：類別多選（順序＝ieCoillteTypes cats＝bitmask）；遊憩點另有入口熱區色盤與點大小
  ieCoillteRecreation: [
    categoryMultiSelect("ieCoillteRecreation", IE_COILLTE_RECREATION.cats.map((c) => ({ label: c.label.zh, value: c.id }))),
    heatmapPalette("ieCoillteRecreation"),
    opacitySlider("ieCoillteRecreationOpacity", densePointOpacity(IE_COILLTE_RECREATION.count)), scaleSlider("ieCoillteRecreationScale", 1),
  ],
  ieCoillteForestRoads: [
    categoryMultiSelect("ieCoillteForestRoads", IE_COILLTE_FOREST_ROADS.cats.map((c) => ({ label: c.label.zh, value: c.id }))),
    opacitySlider("ieCoillteForestRoadsOpacity", 0.85),
  ],
  ieBathymetry: [{ kind: "slider", name: "ieBathymetryOpacity", labelPrefix: "透明度", digits: 2, default: RASTER.opacity, min: RASTER.sliderMin, max: RASTER.sliderMax, step: 0.05 }],
  // <codemod:append IE_PACK_PARAMS>
} satisfies Partial<Record<IeLayerKey, LayerParamSpec[]>>;
