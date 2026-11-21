import { useEffect, useRef, useState } from "react";
import type { CircleLayer, GeoJSONSource, LineLayer, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import { hookLineLayout, hookLineOpacity, hookLinePaint } from "../map/lineFillSpec";
import { paramDefault } from "../data/layerParamsSpec";
import {
  COUNTY_MIGRATION_BASE_KEYS, COUNTY_MIGRATION_COLORS, COUNTY_MIGRATION_FLOWS_KEY, COUNTY_SEATS, countyFlowsGeoJSON, countyMigrationTotals,
  countyMigrationViewStore, countyMigrationYearOfRelease, countySeatsGeoJSON, defaultCountyFlows, focusCountyFlows, hiddenFlowCount,
  loadCountyMigrationOd, type CountyMigrationDocument,
} from "../data/countyMigrationFlows";
import { getAtlasRecipe, atlasRecipeReleaseOptions } from "../data/atlasStatisticsRecipes";
import { statisticsRecipe } from "../data/statisticsSelection";
import { regionalStatisticsStore } from "../state/regionalStatisticsStore";
import { layerParamsStore } from "../state/layerParamsStore";
import type { StatisticsRenderKey } from "../data/regionalStatisticsRecipes";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * 縣市間遷徙流向（台灣圖層延伸 B5 N11）：2D 地面弧線（二次貝茲），線寬依人數分 4 級。
 * - 預設：全國前 30 條 ∪ 每縣市最大遷出 1 條；點縣市（底色面或端點）：該縣市遷入前 5（青）、遷出前 5（黃）；再點一次或 Esc 取消。
 * - 弧線永遠疊在統計底色上面（底色第一次顯示才 addLayer，所以 styledata 時檢查順序再 moveLayer）。
 * - 年份與底色統計層（statsCountyOd*）雙向連動：流向層換年 → 開著的底色換同年期別；底色換期別 → 流向層跟著換。
 */
const KEY = COUNTY_MIGRATION_FLOWS_KEY;
const YEAR_PARAM = "twCountyMigrationYear";
const SOURCE_ID = "tw-county-migration-flows";
const SEAT_SOURCE_ID = "tw-county-migration-seats";
export const COUNTY_MIGRATION_LINE_LAYER_ID = "tw-county-migration-flows-line";
export const COUNTY_MIGRATION_SEAT_LAYER_ID = "tw-county-migration-flows-seat";
const OWN_LAYERS = [COUNTY_MIGRATION_LINE_LAYER_ID, COUNTY_MIGRATION_SEAT_LAYER_ID];
const BASE_FILL_IDS = COUNTY_MIGRATION_BASE_KEYS.map((key) => `${key}-fill`);
const OPACITY_DEFAULT = Number(paramDefault(KEY, `${KEY}Opacity`) ?? 0.85);
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function lineColor(): unknown[] {
  return ["match", ["get", "role"], "in", COUNTY_MIGRATION_COLORS.in, "out", COUNTY_MIGRATION_COLORS.out, COUNTY_MIGRATION_COLORS.flow];
}

function linePaint(opacity: number, isDark: boolean) {
  const base = {
    "line-color": lineColor(),
    // 資料驅動線寬（4 級，見 COUNTY_MIGRATION_WIDTH_TIERS）；拉近略加粗
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, ["*", ["get", "w"], 0.8], 10, ["*", ["get", "w"], 1.4]],
    "line-opacity": clamp01(opacity),
  };
  return hookLinePaint(KEY, COUNTY_MIGRATION_LINE_LAYER_ID, base, { ...base, "line-opacity": OPACITY_DEFAULT }, isDark);
}

function seatPaint(opacity: number) {
  return {
    "circle-radius": ["case", ["get", "focus"], 6, 3.5],
    "circle-color": ["case", ["get", "focus"], COUNTY_MIGRATION_COLORS.seatFocus, COUNTY_MIGRATION_COLORS.seat],
    "circle-stroke-color": "#0a0a14",
    "circle-stroke-width": 1,
    "circle-opacity": clamp01(opacity),
    "circle-stroke-opacity": clamp01(opacity),
  };
}

/** 弧線與端點移到統計底色之上（只在底色層在我們上面時才動，避免與其他「移到最上層」的層互搶）。 */
function keepAboveBase(map: MapboxMap) {
  const layers = map.getStyle?.()?.layers;
  if (!layers || !map.getLayer(COUNTY_MIGRATION_LINE_LAYER_ID)) return;
  const index = new Map(layers.map((layer, i) => [layer.id, i]));
  const ownMin = Math.min(...OWN_LAYERS.map((id) => index.get(id) ?? Infinity));
  const baseMax = Math.max(-1, ...layers.filter((layer) => /-(fill|line|missing|suppressed)$/.test(layer.id) && layer.id.startsWith("stats")).map((layer) => index.get(layer.id)!));
  if (baseMax > ownMin) for (const id of OWN_LAYERS) if (map.getLayer(id)) map.moveLayer(id);
}

function releaseIdForYear(key: string, year: string): string | null {
  const recipe = getAtlasRecipe(key);
  if (!recipe) return null;
  return atlasRecipeReleaseOptions(recipe).find((option) => option.period_start.startsWith(`${year}-`))?.release_id ?? null;
}

/** 流向層年份 → 開著的底色層期別。 */
function pushYearToBase(key: string, year: string) {
  const target = releaseIdForYear(key, year);
  const snapshot = regionalStatisticsStore.getSnapshot(key);
  if (!target || !snapshot.selection || snapshot.selection.releaseId === target) return;
  regionalStatisticsStore.setSelection(key, { ...(snapshot.selection ?? statisticsRecipe(key as StatisticsRenderKey)), releaseId: target, allowReleaseFallback: false });
  void regionalStatisticsStore.load(key);
}

export function useCountyMigrationFlowsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  year: string,
  isDarkTheme = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const [doc, setDoc] = useState<CountyMigrationDocument | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const latest = useRef({ opacity, isDarkTheme, year });
  latest.current = { opacity, isDarkTheme, year };

  useEffect(() => {
    if (!visible || doc) return;
    let cancelled = false;
    loadCountyMigrationOd().then((loaded) => { if (!cancelled) setDoc(loaded); }).catch((error: unknown) => console.error("[twCountyMigrationFlows] OD 載入失敗", error));
    return () => { cancelled = true; };
  }, [visible, doc]);

  useEffect(() => { if (!visible) setFocus(null); }, [visible]);

  // 圖層建立／拆除；換底圖（style.load）重建；底色晚建時保持在上面。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      for (const id of OWN_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      return;
    }
    const mount = () => {
      if (!map.getSource(SOURCE_ID)) map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY });
      if (!map.getSource(SEAT_SOURCE_ID)) map.addSource(SEAT_SOURCE_ID, { type: "geojson", data: EMPTY });
      const { opacity: o, isDarkTheme: dark } = latest.current;
      if (!map.getLayer(COUNTY_MIGRATION_LINE_LAYER_ID)) {
        map.addLayer({
          id: COUNTY_MIGRATION_LINE_LAYER_ID, type: "line", source: SOURCE_ID,
          layout: { ...hookLineLayout(KEY, COUNTY_MIGRATION_LINE_LAYER_ID), "line-sort-key": ["get", "persons"] },
          paint: linePaint(o, dark),
        } as LineLayer);
      }
      if (!map.getLayer(COUNTY_MIGRATION_SEAT_LAYER_ID)) {
        map.addLayer({ id: COUNTY_MIGRATION_SEAT_LAYER_ID, type: "circle", source: SEAT_SOURCE_ID, paint: seatPaint(o) } as CircleLayer);
      }
      for (const id of OWN_LAYERS) map.setLayoutProperty(id, "visibility", "visible");
      keepAboveBase(map);
    };
    const onStyleData = () => keepAboveBase(map);
    mount();
    map.on("style.load", mount);
    map.on("styledata", onStyleData);
    return () => { map.off("style.load", mount); map.off("styledata", onStyleData); };
  }, [mapRef, visible, mapTick]);

  // 資料（年份、選取縣市）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !doc) return;
    const rows = doc.years[year] ?? [];
    const valid = focus && COUNTY_SEATS[focus] ? focus : null;
    const flows = valid ? focusCountyFlows(rows, valid) : defaultCountyFlows(rows);
    (map.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(countyFlowsGeoJSON(flows, rows, year));
    (map.getSource(SEAT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(countySeatsGeoJSON(rows, year, valid));
    countyMigrationViewStore.set({
      year, focus: valid, shown: flows.length, hidden: hiddenFlowCount(rows, flows.length, valid),
      totals: valid ? countyMigrationTotals(rows, valid) : null, loaded: true,
    });
  }, [mapRef, visible, doc, year, focus, mapTick]);

  // 透明度／明暗
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !map.getLayer(COUNTY_MIGRATION_LINE_LAYER_ID)) return;
    map.setPaintProperty(COUNTY_MIGRATION_LINE_LAYER_ID, "line-opacity", hookLineOpacity(KEY, COUNTY_MIGRATION_LINE_LAYER_ID, clamp01(opacity), OPACITY_DEFAULT, isDarkTheme));
    for (const [name, value] of Object.entries(seatPaint(opacity))) map.setPaintProperty(COUNTY_MIGRATION_SEAT_LAYER_ID, name as never, value as never);
  }, [mapRef, visible, opacity, isDarkTheme, mapTick]);

  // 點縣市：底色面（area_code）或端點；點到弧線只開 popup（GIS_LAYERS），不改選取。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const onClick = (e: MapMouseEvent) => {
      // 端點優先（弧線都從端點出發，先查弧線會把點端點吃掉）
      const seat = map.getLayer(COUNTY_MIGRATION_SEAT_LAYER_ID) ? map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: [COUNTY_MIGRATION_SEAT_LAYER_ID] })[0] : undefined;
      let code = seat ? String(seat.properties?.code ?? "") : "";
      if (!code) {
        const box: [[number, number], [number, number]] = [[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]];
        if (map.getLayer(COUNTY_MIGRATION_LINE_LAYER_ID) && map.queryRenderedFeatures(box, { layers: [COUNTY_MIGRATION_LINE_LAYER_ID] }).length > 0) return;
        const fills = BASE_FILL_IDS.filter((id) => map.getLayer(id));
        const hit = fills.length ? map.queryRenderedFeatures(e.point, { layers: fills })[0] : undefined;
        code = String(hit?.properties?.area_code ?? "");
      }
      if (!code || !COUNTY_SEATS[code]) return;
      setFocus((current) => (current === code ? null : code));
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFocus(null); };
    map.on("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => { map.off("click", onClick); window.removeEventListener("keydown", onKey); };
  }, [mapRef, visible, mapTick]);

  // 年份 → 底色（開著且已登記選擇的底色層）
  useEffect(() => {
    if (!visible) return;
    for (const key of COUNTY_MIGRATION_BASE_KEYS) pushYearToBase(key, year);
  }, [visible, year]);

  // 底色換期別 → 流向層年份；底色第一次登記（還原舊選擇）時以流向層為準。
  useEffect(() => {
    if (!visible) return;
    const seen = new Map<string, string | undefined>(COUNTY_MIGRATION_BASE_KEYS.map((key) => [key, regionalStatisticsStore.getSnapshot(key).selection?.releaseId]));
    const unsubscribes = COUNTY_MIGRATION_BASE_KEYS.map((key) => regionalStatisticsStore.subscribe(key, () => {
      const releaseId = regionalStatisticsStore.getSnapshot(key).selection?.releaseId;
      const before = seen.get(key);
      if (releaseId === before) return;
      seen.set(key, releaseId);
      const baseYear = countyMigrationYearOfRelease(releaseId);
      const flowYear = latest.current.year;
      if (!baseYear || baseYear === flowYear) return;
      if (before === undefined) pushYearToBase(key, flowYear);
      else layerParamsStore.setParam(KEY, YEAR_PARAM, baseYear);
    }));
    return () => { for (const unsubscribe of unsubscribes) unsubscribe(); };
  }, [visible]);

  useEffect(() => () => { countyMigrationViewStore.set({ focus: null, loaded: false }); }, []);
}
