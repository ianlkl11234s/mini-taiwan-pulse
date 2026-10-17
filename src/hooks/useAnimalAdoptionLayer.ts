import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { fetchAnimalAdoptionSummary, type AnimalAdoptionShelterRow } from "../data/animalAdoptionLoader";
import { useMapReadyTick } from "./useMapReadyTick";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { paramDefault } from "../data/layerParamsSpec";
import { pointStrokePaint } from "../map/mapStyleScale";

const SOURCE_ID = "animal-adoption";
const GLOW_ID = "animal-adoption-glow";
const CIRCLE_ID = "animal-adoption-circle";
const OPACITY_DEFAULT = Number(paramDefault("animalAdoption", "animalAdoptionOpacity"));
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function dominantColor(species: Record<string, number>) {
  const dog = Number(species.dog ?? species.DOG ?? species.犬 ?? species.狗 ?? 0);
  const cat = Number(species.cat ?? species.CAT ?? species.貓 ?? 0);
  return dog >= cat ? "#f59e0b" : "#a855f7";
}

function speciesCount(species: Record<string, number>, ...keys: string[]) {
  return keys.reduce((sum, key) => sum + Number(species[key] ?? 0), 0);
}

function ensureLayers(map: MapboxMap, opacity: number, scale: number, isDark: boolean) {
  if (!map.getSource(SOURCE_ID)) map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY });
  if (!map.getLayer(GLOW_ID)) map.addLayer({
    id: GLOW_ID, type: "circle", source: SOURCE_ID,
    paint: { "circle-radius": ["*", ["interpolate", ["linear"], ["get", "listed_count"], 1, 5, 50, 10, 300, 18], scale * 1.7], "circle-color": ["get", "species_color"], "circle-opacity": 0, "circle-blur": 0.8 },
  });
  if (!map.getLayer(CIRCLE_ID)) map.addLayer({
    id: CIRCLE_ID, type: "circle", source: SOURCE_ID,
    paint: { "circle-radius": ["*", ["interpolate", ["linear"], ["get", "listed_count"], 1, 3, 50, 6, 300, 12], scale], "circle-color": ["get", "species_color"], "circle-opacity": 0.9 * opacity, ...pointStrokePaint(isDark, opacity / OPACITY_DEFAULT) },
  });
}

function setVisible(map: MapboxMap, visible: boolean) {
  for (const id of [GLOW_ID, CIRCLE_ID]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
}

function setData(map: MapboxMap, rows: AnimalAdoptionShelterRow[]) {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({ type: "FeatureCollection", features: rows.map((r) => ({
    type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] },
    properties: {
      canonical_shelter_id: r.canonical_shelter_id,
      shelter_name: r.shelter_name,
      county_code: r.county_code,
      county_name: r.county_name,
      listed_count: r.listed_count,
      dog_count: speciesCount(r.species_counts, "dog", "DOG", "犬", "狗"),
      cat_count: speciesCount(r.species_counts, "cat", "CAT", "貓"),
      species_counts_json: JSON.stringify(r.species_counts),
      latest_snapshot_date: r.latest_snapshot_date,
      latest_collected_at: r.latest_collected_at,
      species_color: dominantColor(r.species_counts),
    },
  })) });
}

export function useAnimalAdoptionLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity = 0.85, scale = 1, isDark = true) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const loaded = useRef(false);
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    const run = async () => {
      ensureLayers(map, opacity, scale, isDarkRef.current);
      if (!visible) { setVisible(map, false); return; }
      if (!loaded.current) {
        const rows = await fetchAnimalAdoptionSummary();
        if (cancelled) return;
        setData(map, rows); loaded.current = true;
        keepLoadingUntilMapIdle(map, "animal-adoption-render", "動物認領養圖層渲染中", SOURCE_ID);
      }
      // 光暈：靜態快照資料 → 透明度 0，子圖層保留（gisClickRegistry 引用它當點擊範圍）
      if (map.getLayer(GLOW_ID)) map.setPaintProperty(GLOW_ID, "circle-opacity", 0);
      if (map.getLayer(CIRCLE_ID)) {
        map.setPaintProperty(CIRCLE_ID, "circle-opacity", 0.9 * opacity);
        map.setPaintProperty(CIRCLE_ID, "circle-radius", ["*", ["interpolate", ["linear"], ["get", "listed_count"], 1, 3, 50, 6, 300, 12], scale]);
      }
      if (map.getLayer(GLOW_ID)) map.setPaintProperty(GLOW_ID, "circle-radius", ["*", ["interpolate", ["linear"], ["get", "listed_count"], 1, 5, 50, 10, 300, 18], scale * 1.7]);
      setVisible(map, true);
    };
    run().catch((error) => console.warn("[AnimalAdoption] summary unavailable", error));
    return () => { cancelled = true; };
  }, [mapRef, visible, opacity, scale, mapTick]);

  // 主題／透明度只改描邊 paint，不進上面抓資料的 effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.getLayer(CIRCLE_ID)) return;
    const stroke = pointStrokePaint(isDark, opacity / OPACITY_DEFAULT);
    map.setPaintProperty(CIRCLE_ID, "circle-stroke-color", stroke["circle-stroke-color"]);
    map.setPaintProperty(CIRCLE_ID, "circle-stroke-width", stroke["circle-stroke-width"]);
    map.setPaintProperty(CIRCLE_ID, "circle-stroke-opacity", stroke["circle-stroke-opacity"]);
  }, [mapRef, visible, isDark, opacity, mapTick]);
}
