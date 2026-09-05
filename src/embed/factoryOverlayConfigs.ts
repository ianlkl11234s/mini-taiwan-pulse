/**
 * 主站以 custom factory 建立、但適合在 `/embed` 安全載入的靜態圖層。
 *
 * 這些 config 必須符合 embed 的兩個邊界：只讀 CDN 靜態資產、不得是 owner-gated。
 * PMTiles source 仍由 EmbedApp 注入 MapLibre adapter，不可直接呼叫綁定 mapbox-gl 的
 * factory。視覺參數需與對應 factory 保持一致，相關測試會釘住 source 與 layer 契約。
 */
import type { OverlayConfig } from "../types";

/** 與 `agricultureLayerFactory.ensureAgricultureLayers` 的 FTW 田區樣式對齊。 */
const agriculture: OverlayConfig = {
  id: "agriculture",
  sourceUrl: "./agriculture/ftw_fields_2025.pmtiles",
  sourceId: "agri-ftw-fields",
  opacityParam: "agricultureOpacity",
  pmtiles: { sourceLayer: "fields", minzoom: 5, maxzoom: 14 },
  attribution: "Fields of The World (CC BY 4.0)",
  layers: [
    {
      suffix: "fill",
      type: "fill",
      minzoom: 5,
      paint: (_isDark, params) => ({
        "fill-color": "#2e7d32",
        "fill-opacity": [
          "interpolate", ["linear"],
          ["coalesce", ["get", "confidence_mean"], 0.5],
          0.5, 0.18,
          0.6, 0.42,
        ],
        "fill-outline-color": "rgba(46, 125, 50, 0.6)",
        "fill-translate": [0, -(params?.agricultureZ ?? 0)],
        "fill-translate-anchor": "viewport",
      }),
    },
    {
      suffix: "outline",
      type: "line",
      minzoom: 10,
      layout: (_isDark, params) => ({
        visibility: (params?.agricultureShowOutline ?? 1) > 0 ? "visible" : "none",
      }),
      paint: (_isDark, params) => {
        const width = params?.agricultureOutlineWidth ?? 1;
        return {
          "line-color": "#1b5e20",
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            10, 0.2 * width,
            13, 0.6 * width,
            16, 1.2 * width,
          ],
          "line-opacity": 0.55,
        };
      },
    },
  ],
};

export const EMBED_FACTORY_OVERLAY_CONFIGS: readonly OverlayConfig[] = [agriculture];
