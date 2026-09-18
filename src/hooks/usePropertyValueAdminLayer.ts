import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, FillLayer, LineLayer, Map as MapboxMap } from "mapbox-gl";
import { loadPropertyValueAdmin, type PropertyValueAdmin } from "../data/propertyValueAdminLoader";
import {
  PROPERTY_VALUE_ADMIN_LEVELS,
  propertyValueAdminColorExpression,
  propertyValueAdminFeatureState,
  resolvePropertyValueAdminLevel,
  type PropertyValueAdminLevel,
} from "../data/propertyValueAdminTypes";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { useMapReadyTick } from "./useMapReadyTick";

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}
function setLevelVisible(map: MapboxMap, level: PropertyValueAdminLevel, visible: boolean) {
  const config = PROPERTY_VALUE_ADMIN_LEVELS[level];
  for (const id of [config.fillLayerId, config.lineLayerId]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

function applyLevelState(map: MapboxMap, data: PropertyValueAdmin, level: PropertyValueAdminLevel): boolean {
  const config = PROPERTY_VALUE_ADMIN_LEVELS[level];
  if (!map.isSourceLoaded(config.sourceId)) return false;
  for (const row of data[level]) {
    map.setFeatureState(
      { source: config.sourceId, sourceLayer: config.sourceLayer, id: row.code },
      propertyValueAdminFeatureState(row, level),
    );
  }
  return true;
}

/**
 * 行政區總市值：沿用全國 boundary PMTiles，把靜態 admin JSON 以 code 寫入 feature-state。
 * county / township 使用獨立 source，避免與底圖邊界 toggle 互相清掉 state。
 */
export function usePropertyValueAdminLayer(
  mapRef: React.RefObject<MapboxMap | null>, visible: boolean, levelIdx: number, opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const dataRef = useRef<PropertyValueAdmin | null>(null);
  const [dataTick, setDataTick] = useState(0);
  const level = resolvePropertyValueAdminLevel(levelIdx);

  useEffect(() => {
    if (!visible || dataRef.current) return;
    let cancelled = false;
    loadPropertyValueAdmin().then((data) => {
      if (cancelled) return;
      dataRef.current = data;
      setDataTick((tick) => tick + 1);
    }).catch((error) => console.warn("[PropertyValueAdmin] administrative statistics unavailable", error));
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      setLevelVisible(map, "county", false);
      setLevelVisible(map, "township", false);
      return;
    }

    registerPmtilesSourceTypeOnce();
    const config = PROPERTY_VALUE_ADMIN_LEVELS[level];
    if (!map.getSource(config.sourceId)) {
      map.addSource(config.sourceId, {
        type: PMTILES_SOURCE_TYPE,
        url: config.sourceUrl,
        minzoom: config.minzoom,
        maxzoom: 14,
        promoteId: { [config.sourceLayer]: config.codeProperty },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }
    const before = firstSymbolLayerId(map);
    if (!map.getLayer(config.fillLayerId)) {
      map.addLayer({
        id: config.fillLayerId,
        type: "fill",
        source: config.sourceId,
        "source-layer": config.sourceLayer,
        minzoom: config.minzoom,
        paint: {
          "fill-color": propertyValueAdminColorExpression(level) as ExpressionSpecification,
          "fill-opacity": opacity,
          "fill-outline-color": "rgba(0,0,0,0)",
        },
      } as unknown as FillLayer, before);
    } else map.setPaintProperty(config.fillLayerId, "fill-opacity", opacity);
    if (!map.getLayer(config.lineLayerId)) {
      map.addLayer({
        id: config.lineLayerId,
        type: "line",
        source: config.sourceId,
        "source-layer": config.sourceLayer,
        minzoom: config.minzoom,
        paint: {
          "line-color": "#fef3c7",
          "line-width": ["interpolate", ["linear"], ["zoom"], config.minzoom, 0.4, 10, 1.1],
          "line-opacity": Math.min(1, opacity + 0.15),
        },
      } as unknown as LineLayer, before);
    } else map.setPaintProperty(config.lineLayerId, "line-opacity", Math.min(1, opacity + 0.15));

    setLevelVisible(map, level === "county" ? "township" : "county", false);
    setLevelVisible(map, level, true);
    const flush = () => { if (dataRef.current) applyLevelState(map, dataRef.current, level); };
    flush();
    map.on("sourcedata", flush);
    return () => { map.off("sourcedata", flush); };
  }, [mapRef, visible, level, opacity, mapTick, dataTick]);
}
