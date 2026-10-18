import { useEffect, useRef } from "react";
import type { ExpressionSpecification, FillLayer, Map as MapboxMap } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import { useJmaTimeDriver } from "./useJmaTimeDriver";
import { fetchJmaRainyAt, invalidateJmaTimed, setLatestJmaRainy, type JmaRainySnapshot } from "../data/jmaLiveLoaders";
import { JMA_ATTRIBUTION } from "../data/jmaTypes";
import { JMA_RAINY_AMAMI_CODES, JMA_RAINY_REGION_PREFS, jmaRainyPhaseColor } from "../data/jmaPointTypes";
import { JMA_WARNINGS_SOURCE_ID, JMA_WARNINGS_SOURCE_LAYER } from "./useJmaWarningsLayer";

/**
 * 梅雨入り・明け choropleth（12 地方，as-of 日本日期）。
 *
 * RPC 只給地方名、沒有幾何 → 共用警報層的市区町村界 PMTiles（同一個 source），
 * 依「縣碼 2 碼」整縣著色；奄美地方先用 12 個市町村 5 碼切出（鹿児島縣其他市町村屬九州南部）。
 * 北海道沒有梅雨 → 不著色（filter 擋掉）。時間桶＝JST 日；季外（RPC 0 列）＝未涵蓋。
 */

export const JMA_RAINY_FILL_LAYER_ID = "jma-rainy-season-fill";
const PMTILES_FILE = "jp_admin_boundaries.pmtiles";
const POLL_MS = 30 * 60_000;
const NONE = "__none__";

const CODE_KEY: ExpressionSpecification = ["get", "admin_code"];
const PREF_KEY: ExpressionSpecification = ["slice", ["get", "admin_code"], 0, 2];

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

/** 縣碼 2 碼 → 地方名（奄美另以市町村碼處理） */
export function jmaRainyPrefToRegion(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [region, prefs] of Object.entries(JMA_RAINY_REGION_PREFS)) for (const pref of prefs) map.set(pref, region);
  return map;
}

function prefColorGroups(snapshot: JmaRainySnapshot | null): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const [pref, region] of jmaRainyPrefToRegion()) {
    const r = snapshot?.regions.get(region);
    if (!r) continue;
    const color = jmaRainyPhaseColor(r.phase);
    const list = groups.get(color) ?? [];
    list.push(pref);
    groups.set(color, list);
  }
  return groups;
}

function match(input: ExpressionSpecification, groups: Map<string, string[]>, fallback: unknown): unknown[] {
  if (groups.size === 0) return ["match", input, NONE, fallback, fallback];
  return ["match", input, ...[...groups].flatMap(([color, keys]) => [keys, color]), fallback];
}

export function jmaRainyColorExpr(snapshot: JmaRainySnapshot | null): ExpressionSpecification {
  const amami = snapshot?.regions.get("奄美");
  const prefExpr = match(PREF_KEY, prefColorGroups(snapshot), "rgba(0,0,0,0)");
  if (!amami) {
    // 奄美沒資料 → 奄美市町村不可沿用鹿児島（九州南部）的色
    return ["match", CODE_KEY, [...JMA_RAINY_AMAMI_CODES], "rgba(0,0,0,0)", prefExpr] as unknown as ExpressionSpecification;
  }
  return ["match", CODE_KEY, [...JMA_RAINY_AMAMI_CODES], jmaRainyPhaseColor(amami.phase), prefExpr] as unknown as ExpressionSpecification;
}

export function jmaRainyFilter(snapshot: JmaRainySnapshot | null): ExpressionSpecification {
  const prefs = [...prefColorGroups(snapshot).values()].flat();
  const amami = snapshot?.regions.has("奄美") ?? false;
  return ["case",
    ["match", CODE_KEY, [...JMA_RAINY_AMAMI_CODES], true, false], amami,
    ["match", PREF_KEY, prefs.length ? prefs : [NONE], true, false],
  ] as unknown as ExpressionSpecification;
}

/** popup 用：市町村 admin_code → 地方名（北海道 → null） */
export function jmaRainyRegionForCode(adminCode: string): string | null {
  if ((JMA_RAINY_AMAMI_CODES as readonly string[]).includes(adminCode)) return "奄美";
  return jmaRainyPrefToRegion().get(adminCode.slice(0, 2)) ?? null;
}

export function useJmaRainySeasonLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const snapshotRef = useRef<JmaRainySnapshot | null>(null);
  const applyRef = useRef<() => void>(() => {});

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(JMA_RAINY_FILL_LAYER_ID)) map.setLayoutProperty(JMA_RAINY_FILL_LAYER_ID, "visibility", "none");
      return;
    }
    const op = Math.max(0, Math.min(1, opacity));
    const apply = () => {
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(JMA_WARNINGS_SOURCE_ID)) {
        map.addSource(JMA_WARNINGS_SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE, url: absoluteUrl(PMTILES_FILE), minzoom: 4, maxzoom: 11,
        } as any);
        const src = map.getSource(JMA_WARNINGS_SOURCE_ID) as any;
        if (src) src.attribution = JMA_ATTRIBUTION;
      }
      const snapshot = snapshotRef.current;
      const color = jmaRainyColorExpr(snapshot);
      const filter = jmaRainyFilter(snapshot);
      if (!map.getLayer(JMA_RAINY_FILL_LAYER_ID)) {
        map.addLayer({
          id: JMA_RAINY_FILL_LAYER_ID, type: "fill", source: JMA_WARNINGS_SOURCE_ID, "source-layer": JMA_WARNINGS_SOURCE_LAYER,
          filter, layout: { visibility: "visible" }, paint: { "fill-color": color, "fill-opacity": op },
        } as FillLayer);
      }
      map.setFilter(JMA_RAINY_FILL_LAYER_ID, filter);
      map.setPaintProperty(JMA_RAINY_FILL_LAYER_ID, "fill-color", color);
      map.setPaintProperty(JMA_RAINY_FILL_LAYER_ID, "fill-opacity", op);
      map.setLayoutProperty(JMA_RAINY_FILL_LAYER_ID, "visibility", "visible");
    };
    applyRef.current = apply;
    apply();
    map.on("style.load", apply);
    return () => { map.off("style.load", apply); };
  }, [mapRef, visible, opacity, mapTick]);

  useJmaTimeDriver({
    visible,
    key: "jmaRainySeason",
    pollMs: POLL_MS,
    tick: mapTick,
    fetch: (req) => fetchJmaRainyAt(req.cacheKey),
    invalidate: (req) => invalidateJmaTimed("jmaRainySeason", req.cacheKey),
    apply: (snapshot) => {
      snapshotRef.current = snapshot;
      setLatestJmaRainy(snapshot);
      applyRef.current();
    },
  });
}
