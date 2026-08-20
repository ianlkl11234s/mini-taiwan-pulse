import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, FillLayer, LineLayer, Map as MapboxMap } from "mapbox-gl";
import { fetchAnimalShelterPressureLatest, type AnimalShelterPressureRow } from "../data/animalShelterOutcomesLoader";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 借用既有 NLSC 22 縣市界 PMTiles：資料只給月報數值，不另載全國 polygon。
 * 獨立 source 是必要的：countyBoundary 本身沒有 promoteId，兩個 toggle 也不能互搶生命週期。
 */
const SOURCE_ID = "animal-shelter-pressure";
const SOURCE_LAYER = "county_boundary";
const SOURCE_URL = "./base_map/county_boundary.pmtiles";
const FILL_LAYER = "animal-shelter-pressure-fill";
const LINE_LAYER = "animal-shelter-pressure-line";

/** NLSC county_boundary 的行政區域代碼；RPC 的 source county_code 保留原樣，不假設其編碼系統。 */
const NLSC_COUNTY_CODE_BY_NAME: Record<string, string> = {
  "臺北市": "63000", "台北市": "63000", "新北市": "65000", "桃園市": "68000", "臺中市": "66000", "台中市": "66000",
  "臺南市": "67000", "台南市": "67000", "高雄市": "64000", "基隆市": "10017", "新竹市": "10018", "嘉義市": "10020",
  "新竹縣": "10004", "苗栗縣": "10005", "彰化縣": "10007", "南投縣": "10008", "雲林縣": "10009", "嘉義縣": "10010",
  "屏東縣": "10013", "宜蘭縣": "10002", "花蓮縣": "10015", "臺東縣": "10014", "台東縣": "10014", "澎湖縣": "10016",
  "金門縣": "09020", "連江縣": "09007",
};

function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

const UTILIZATION_COLOR: ExpressionSpecification = [
  "case",
  ["==", ["feature-state", "capacity_utilization"], null], "rgba(0,0,0,0)",
  ["interpolate", ["linear"], ["feature-state", "capacity_utilization"],
    0, "#d1fae5", 60, "#86efac", 80, "#facc15", 100, "#f97316", 120, "#dc2626"],
] as unknown as ExpressionSpecification;

function setVisible(map: MapboxMap, visible: boolean) {
  for (const id of [FILL_LAYER, LINE_LAYER]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
}

function applyPressureState(map: MapboxMap, rows: AnimalShelterPressureRow[]) {
  if (!map.isSourceLoaded(SOURCE_ID)) return false;
  for (const row of rows) {
    if (!row.county_code && !row.county_name) continue;
    // Feature state 只放 primitive，且略過 null；缺官方數值才能維持透明，而不是被誤認為 0。
    const state = Object.fromEntries(Object.entries({
      source_dataset_id: row.source_dataset_id,
      source_record_id: row.source_record_id,
      report_year: row.report_year,
      source_report_year: row.source_report_year,
      report_month: row.report_month,
      period_start: row.period_start,
      county_code: row.county_code,
      county_name: row.county_name,
      report_grain_key: row.report_grain_key,
      source_retrieved_at: row.source_retrieved_at,
      revision_index: row.revision_index,
      duplicate_grain_count: row.duplicate_grain_count,
      is_ambiguous: row.is_ambiguous,
      excluded_ambiguous_grain_count: row.excluded_ambiguous_grain_count,
      capacity_utilization: row.capacity_utilization,
      in_shelter_count: row.in_shelter_count,
      capacity: row.capacity,
      quality_flags_json: JSON.stringify(row.quality_flags),
      official_metrics_json: JSON.stringify(row.official_metrics),
    }).filter(([, value]) => value != null));
    const ids = new Set([row.county_code, ...(row.county_name ? [NLSC_COUNTY_CODE_BY_NAME[row.county_name]] : [])]);
    for (const id of ids) {
      if (id) map.setFeatureState({ source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id }, state);
    }
  }
  return true;
}

export function useAnimalShelterPressureLayer(
  mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const rowsRef = useRef<AnimalShelterPressureRow[] | null>(null);
  const [dataTick, setDataTick] = useState(0);

  useEffect(() => {
    if (!visible || rowsRef.current) return;
    let cancelled = false;
    fetchAnimalShelterPressureLatest().then((rows) => {
      if (cancelled) return;
      rowsRef.current = rows;
      setDataTick((tick) => tick + 1);
    }).catch((error) => console.warn("[AnimalShelterPressure] latest monthly pressure unavailable", error));
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) { setVisible(map, false); return; }

    registerPmtilesSourceTypeOnce();
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: PMTILES_SOURCE_TYPE, url: SOURCE_URL, minzoom: 0, maxzoom: 14,
        promoteId: { [SOURCE_LAYER]: "行政區域代碼" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }
    const before = firstSymbolLayerId(map);
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER, type: "fill", source: SOURCE_ID, "source-layer": SOURCE_LAYER, minzoom: 4,
        paint: { "fill-color": UTILIZATION_COLOR, "fill-opacity": opacity, "fill-outline-color": "rgba(0,0,0,0)" },
      } as unknown as FillLayer, before);
    } else map.setPaintProperty(FILL_LAYER, "fill-opacity", opacity);
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER, type: "line", source: SOURCE_ID, "source-layer": SOURCE_LAYER, minzoom: 4,
        paint: { "line-color": "#9a3412", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 10, 1.2], "line-opacity": opacity * 0.7 },
      } as unknown as LineLayer, before);
    } else map.setPaintProperty(LINE_LAYER, "line-opacity", opacity * 0.7);
    setVisible(map, true);

    const flush = () => {
      if (rowsRef.current) applyPressureState(map, rowsRef.current);
    };
    flush();
    map.on("sourcedata", flush);
    return () => { map.off("sourcedata", flush); };
  }, [mapRef, visible, opacity, mapTick, dataTick]);
}
