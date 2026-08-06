import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { fetchWasteCleaningSquads, type WasteCleaningSquadRow } from "../data/wasteLoader";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 全國 清潔隊辦公點 layer — spatial.waste_cleaning_squads（359 / 23 縣市）。
 * 純靜態 POI，懶載入：toggle 開時才抓，之後永久 cache。
 *
 * 風格：綠色雙圓（glow + core）— 與既有 wasteStopsStatic 的橘色清運點區隔。
 * popup 顯示隊名 / 行政區 / 地址 / 電話 / 主管轄區。
 */

const SOURCE_ID = "waste-cleaning-squads-src";
const GLOW_LAYER_ID = "waste-cleaning-squads-glow";
const CORE_LAYER_ID = "waste-cleaning-squads-core";

const COLOR_DARK = "#22c55e";   // green-500
const COLOR_LIGHT = "#15803d";  // green-700

function ensureLayer(map: MapboxMap, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  const color = isDark ? COLOR_DARK : COLOR_LIGHT;
  if (!map.getLayer(GLOW_LAYER_ID)) {
    map.addLayer({
      id: GLOW_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      minzoom: 6,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3, 10, 6, 14, 10, 17, 16],
        "circle-color": color,
        "circle-blur": 0.7,
        "circle-opacity": isDark ? 0.35 : 0.25,
      },
    });
  }
  if (!map.getLayer(CORE_LAYER_ID)) {
    map.addLayer({
      id: CORE_LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      minzoom: 6,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 1.5, 10, 2.5, 14, 4, 17, 6],
        "circle-color": color,
        "circle-stroke-color": isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.35)",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0, 12, 0.6, 16, 1.2],
        "circle-opacity": 0.95,
      },
    });
  }
}

function setData(map: MapboxMap, rows: WasteCleaningSquadRow[]) {
  const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        city: r.city,
        district: r.district,
        squad_name: r.squad_name,
        address: r.address,
        phone: r.phone,
        jurisdiction: r.jurisdiction,
        source: r.source,
        source_url: r.source_url,
      },
    })),
  });
}

function setVisible(map: MapboxMap, visible: boolean) {
  for (const id of [GLOW_LAYER_ID, CORE_LAYER_ID]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export function useWasteCleaningSquadLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDarkTheme: boolean,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const loadedRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    const run = async () => {
      try {
        ensureLayer(map, isDarkTheme);
      } catch {
        return;
      }
      if (!visible) {
        setVisible(map, false);
        return;
      }
      if (!loadedRef.current) {
        const rows = await fetchWasteCleaningSquads();
        if (cancelled) return;
        setData(map, rows);
        loadedRef.current = true;
      }
      setVisible(map, true);
    };

    if (map.isStyleLoaded()) run();
    else map.once("style.load", run);

    return () => { cancelled = true; };
  }, [mapRef, visible, isDarkTheme, mapTick]);
}
