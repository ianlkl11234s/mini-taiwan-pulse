// 愛爾蘭國家包：overlays.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { OverlayConfig } from "../../types";
import { densePointOpacity, densePointsFromZoom, LINE_WIDTH, pointRadius, pointStrokePaint } from "../../map/mapStyleScale";
import { denseHeatmapLayer } from "../../map/overlayRegistry";
import { IE_COILLTE_ATTRIBUTION, IE_COILLTE_FOREST_ROADS, IE_COILLTE_RECREATION, IE_COILLTE_ROADS_MIN_ZOOM, ieCoillteColorExpr, ieCoillteKindFilter } from "./ieCoillteTypes";

/** 愛爾蘭 Coillte 森林入口 12,888 點：P-4 出點縮放（之下熱區）。 */
const IE_COILLTE_ENTRANCE_POINTS_FROM = densePointsFromZoom(12_888, 4);

/** Coillte 遊憩點／入口共用點樣式（P-1 分階、P-2 描邊；顏色依 kind）。 */
function ieCoillteCirclePaint(isDark: boolean, p: Record<string, number> | undefined, tier: "S" | "M") {
  const def = densePointOpacity(IE_COILLTE_RECREATION.count);
  const op = p?.ieCoillteRecreationOpacity ?? def;
  return {
    "circle-radius": pointRadius(tier, p?.ieCoillteRecreationScale ?? 1),
    "circle-color": ieCoillteColorExpr(IE_COILLTE_RECREATION) as unknown as string,
    "circle-opacity": op,
    ...pointStrokePaint(isDark, op / def),
  };
}


/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("IE", n)。 */
export const IE_PACK_OVERLAY_SLOTS: Readonly<Record<number, readonly OverlayConfig[]>> = {
  1: [
  // ── 🇮🇪 愛爾蘭 Coillte 國有林（第 5c 波，站主限定）──
  // dynamicData：useIeCoillteLayer 從 owner-only RPC（gis-platform mig 512）拉一次後 setData；Coillte 條款不得轉供 → 不走任何公開檔。
  // 遊憩點 153 z4 起直接畫（M）；森林入口 12,888 拉遠畫熱區（V-1／P-4，z10 起 S 點）。V-4：kind 類別多選，熱區與點共用 filter。
  {
    id: "ieCoillteRecreation",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: IE_COILLTE_RECREATION.sourceId,
    dynamicData: true,
    attribution: IE_COILLTE_ATTRIBUTION,
    rebuildOnParamChange: ["heatmap", "entrance-circle", "site-circle"],
    layers: [
      denseHeatmapLayer({
        pointsFromZoom: IE_COILLTE_ENTRANCE_POINTS_FROM, intensity: 1,
        opacity: { layer: "ieCoillteRecreation", param: "ieCoillteRecreationOpacity" },
        filter: (p) => ["all", ["==", ["get", "kind"], "entrance"], ieCoillteKindFilter(IE_COILLTE_RECREATION, p?.ieCoillteRecreationCategoryMask)],
      }),
      {
        suffix: "entrance-circle",
        type: "circle",
        minzoom: IE_COILLTE_ENTRANCE_POINTS_FROM,
        filter: (p) => ["all", ["==", ["get", "kind"], "entrance"], ieCoillteKindFilter(IE_COILLTE_RECREATION, p?.ieCoillteRecreationCategoryMask)],
        paint: (isDark, p) => ieCoillteCirclePaint(isDark, p, "S"),
      },
      {
        suffix: "site-circle",
        type: "circle",
        minzoom: 4,
        filter: (p) => ["all", ["==", ["get", "kind"], "site"], ieCoillteKindFilter(IE_COILLTE_RECREATION, p?.ieCoillteRecreationCategoryMask)],
        paint: (isDark, p) => ieCoillteCirclePaint(isDark, p, "M"),
      },
    ],
  },
  // 林道 15,877（細）＋遊憩步道 1,199（標準寬、畫在上層）：useIeCoillteForestRoadsLayer 依畫面 bbox 分批 setData，
  // z10 起畫（整包約 7.9MB 超過 2MB 門檻；低縮放由視野提示卡提示放大）。
  {
    id: "ieCoillteForestRoads",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: IE_COILLTE_FOREST_ROADS.sourceId,
    dynamicData: true,
    attribution: IE_COILLTE_ATTRIBUTION,
    rebuildOnParamChange: ["line"],
    layers: [
      {
        suffix: "line",
        type: "line",
        minzoom: IE_COILLTE_ROADS_MIN_ZOOM,
        filter: (p) => ieCoillteKindFilter(IE_COILLTE_FOREST_ROADS, p?.ieCoillteForestRoadsCategoryMask),
        layout: { "line-cap": "round", "line-join": "round", "line-sort-key": ["match", ["get", "kind"], "recreation_trail", 1, 0] },
        paint: (_isDark, p) => ({
          "line-color": ieCoillteColorExpr(IE_COILLTE_FOREST_ROADS) as unknown as string,
          "line-width": ["interpolate", ["linear"], ["zoom"],
            10, ["match", ["get", "kind"], "recreation_trail", LINE_WIDTH.standard[0], LINE_WIDTH.thin[0]],
            14, ["match", ["get", "kind"], "recreation_trail", LINE_WIDTH.standard[1], LINE_WIDTH.thin[1]]] as unknown as number,
          "line-opacity": p?.ieCoillteForestRoadsOpacity ?? 0.85,
        }),
      },
    ],
  },
  ],
  // <codemod:append IE_PACK_OVERLAY_SLOTS>
};
