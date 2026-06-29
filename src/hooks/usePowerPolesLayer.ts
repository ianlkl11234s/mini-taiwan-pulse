import { useEffect } from "react";
import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap } from "mapbox-gl";
// @ts-expect-error 套件未提供 ESM build 的型別宣告
import { PmTilesSource } from "mapbox-pmtiles/dist/mapbox-pmtiles.js";

/**
 * 台電全國電桿 PMTiles 圖層 — 2,959,326 點
 *
 * 資料來源：
 *   taipei-gis-analytics/data/processed/energy/power_poles/*.geojson (22 縣市)
 *   → tippecanoe -Z8 -z14 --cluster-densest-as-needed --drop-densest-as-needed
 *   → /public/coverage/power_poles.pmtiles（26 MB）
 *   → S3 deploy-assets/coverage/ → Zeabur volume → nginx
 *
 * 路線：純 PMTiles 靜態，零 DB / 零 API 呼叫。
 * 視覺：circle by pole_type 5 類分色：
 *   水泥桿（83.7%）/ 水泥併桿（14.4%）/ 木桿（1.0%）/ H桿（0.7%）/ 其他（0.2%）
 */

const SOURCE_TYPE = (PmTilesSource as unknown as { SOURCE_TYPE: string }).SOURCE_TYPE;

let sourceTypeRegistered = false;
function registerSourceTypeOnce() {
  if (sourceTypeRegistered) return;
  sourceTypeRegistered = true;
  try {
    const Style = (mapboxgl as unknown as {
      Style: { setSourceType: (t: string, impl: unknown) => void };
    }).Style;
    Style.setSourceType(SOURCE_TYPE, PmTilesSource);
  } catch {
    // 其他 PMTiles factory 已註冊過
  }
}

const BASE = `${import.meta.env.BASE_URL ?? "/"}coverage`;
const SOURCE_ID = "power-poles";
const SOURCE_LAYER = "power_poles";
const HEAT_ID = "power-poles-heat";
const CIRCLE_ID = "power-poles-circle";

// pole_type → color（5 類，全表保留原 12 種值，其他 8 種歸為「其他」）
const POLE_TYPE_COLOR_EXPR: mapboxgl.ExpressionSpecification = [
  "match",
  ["get", "pole_type"],
  "水泥桿", "#94a3b8",
  "水泥併桿", "#64748b",
  "木桿", "#a16207",
  "H桿", "#0ea5e9",
  "#f43f5e", // default = 其他（鋼桿 / 用戶自備桿 / 木併桿 / 3T桿 / 併桿 / 鋼併桿 / 電塔 / 接桿）
] as unknown as mapboxgl.ExpressionSpecification;

export function usePowerPolesLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  size: number,
  heatStrength: number,
  z5Reveal: number,
) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(HEAT_ID)) map.setLayoutProperty(HEAT_ID, "visibility", "none");
      if (map.getLayer(CIRCLE_ID)) map.setLayoutProperty(CIRCLE_ID, "visibility", "none");
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const ensureLayer = () => {
      if (cancelled) return;
      if (!map.isStyleLoaded()) return;
      registerSourceTypeOnce();
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: SOURCE_TYPE,
          url: `${BASE}/power_poles.pmtiles`,
          minzoom: 5,
          maxzoom: 14,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      // Heatmap layer — z5-12 看密度（z<8 透明度由 z5Reveal 控制，預設關）
      // weight 用 point_count（cluster 代表 N 根桿時權重 = N），z5 cluster 可能代表 50k+ 根桿
      const heatWeight: mapboxgl.ExpressionSpecification = [
        "interpolate", ["linear"], ["coalesce", ["get", "point_count"], 1],
        1, 1,
        100, 8,
        1000, 30,
        10000, 80,
        50000, 200,
      ] as unknown as mapboxgl.ExpressionSpecification;
      // z5-7 用 z5Reveal 控制（0=透明，1=opacity*heatStrength），z8-11 正常，z11-13 淡出給 circle
      const heatOpacityExpr: mapboxgl.ExpressionSpecification = [
        "interpolate", ["linear"], ["zoom"],
        5, opacity * heatStrength * z5Reveal,
        7.9, opacity * heatStrength * z5Reveal,
        8, opacity * heatStrength,
        11, opacity * heatStrength,
        13, 0,
      ] as unknown as mapboxgl.ExpressionSpecification;
      if (!map.getLayer(HEAT_ID)) {
        map.addLayer({
          id: HEAT_ID,
          type: "heatmap",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 5,
          maxzoom: 13,
          paint: {
            "heatmap-weight": heatWeight,
            "heatmap-intensity": [
              "interpolate", ["linear"], ["zoom"],
              5, 0.6,
              8, 1.2,
              12, 3,
            ],
            "heatmap-radius": [
              "interpolate", ["linear"], ["zoom"],
              5, 4 * size,
              8, 8 * size,
              10, 18 * size,
              12, 30 * size,
            ],
            // 經典熱度 gradient：透明 → 藍 → 青 → 黃 → 橘 → 紅
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0,    "rgba(0,0,0,0)",
              0.1,  "rgba(56,189,248,0.5)",   // sky-400
              0.3,  "rgba(34,197,94,0.7)",    // green-500
              0.5,  "rgba(250,204,21,0.85)",  // yellow-400
              0.7,  "rgba(249,115,22,0.9)",   // orange-500
              1,    "rgba(239,68,68,1)",      // red-500
            ],
            "heatmap-opacity": heatOpacityExpr,
          },
        });
      } else {
        map.setPaintProperty(HEAT_ID, "heatmap-weight", heatWeight);
        map.setPaintProperty(HEAT_ID, "heatmap-opacity", heatOpacityExpr);
        map.setPaintProperty(HEAT_ID, "heatmap-radius", [
          "interpolate", ["linear"], ["zoom"],
          5, 4 * size, 8, 8 * size, 10, 18 * size, 12, 30 * size,
        ]);
      }

      // Circle layer — z11+ 看個體，z11 開始淡入
      if (!map.getLayer(CIRCLE_ID)) {
        map.addLayer({
          id: CIRCLE_ID,
          type: "circle",
          source: SOURCE_ID,
          "source-layer": SOURCE_LAYER,
          minzoom: 11,
          paint: {
            "circle-color": POLE_TYPE_COLOR_EXPR,
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              11, 0.6 * size,
              13, 1.8 * size,
              14, 3 * size,
            ],
            "circle-opacity": [
              "interpolate", ["linear"], ["zoom"],
              11, 0,
              12, opacity * 0.5,
              13, opacity,
            ],
            "circle-stroke-width": 0,
            "circle-blur": 0.2,
          },
        });
      } else {
        map.setPaintProperty(CIRCLE_ID, "circle-opacity", [
          "interpolate", ["linear"], ["zoom"],
          11, 0, 12, opacity * 0.5, 13, opacity,
        ]);
        map.setPaintProperty(CIRCLE_ID, "circle-radius", [
          "interpolate", ["linear"], ["zoom"],
          11, 0.6 * size, 13, 1.8 * size, 14, 3 * size,
        ]);
      }
      map.setLayoutProperty(HEAT_ID, "visibility", "visible");
      map.setLayoutProperty(CIRCLE_ID, "visibility", "visible");
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    };

    if (map.isStyleLoaded()) ensureLayer();
    else pollTimer = setInterval(ensureLayer, 200);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (map.getLayer(HEAT_ID)) map.setLayoutProperty(HEAT_ID, "visibility", "none");
      if (map.getLayer(CIRCLE_ID)) map.setLayoutProperty(CIRCLE_ID, "visibility", "none");
    };
  }, [mapRef, visible, opacity, size, heatStrength, z5Reveal]);
}
