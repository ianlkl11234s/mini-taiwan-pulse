import { useEffect, useRef } from "react";
import type { ExpressionSpecification, FillLayer, LineLayer, Map as MapboxMap } from "mapbox-gl";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { useMapReadyTick } from "./useMapReadyTick";
import { fetchJmaWarnings, invalidateJmaWarnings, type JmaWarningsSnapshot, type JmaWarningArea } from "../data/jmaLiveLoaders";
import { JMA_ATTRIBUTION, jmaWarningColor } from "../data/jmaTypes";

/**
 * 日本警報・注意報 choropleth — 當下快照（5 分鐘輪詢，不接 timeStore）。
 *
 * 界線沿用既有 `public/world/jp_admin_boundaries.pmtiles`（市区町村界，admin_code＝5 碼 JIS），
 * 不另下載界線。對法：
 *   1. JMA class20 代碼（7 碼）前 5 碼 ＝ admin_code（一般市町村、東京 23 區、神戸市各區）
 *   2. 政令市分區（横浜市北部／南部、札幌市…）在界線裡是各「區」→ 用「縣碼 2 碼＋city_name」整市著色
 * 只畫發表中的區域（filter），同一區取最高級別；對不到的區域列在圖例。
 */

export const JMA_WARNINGS_SOURCE_ID = "jma-warnings-municipality";
export const JMA_WARNINGS_SOURCE_LAYER = "jp_admin_boundaries";
export const JMA_WARNINGS_FILL_LAYER_ID = "jma-warnings-fill";
export const JMA_WARNINGS_LINE_LAYER_ID = "jma-warnings-line";
const PMTILES_FILE = "jp_admin_boundaries.pmtiles";
const POLL_MS = 5 * 60_000;
const NONE = "__none__";

const CODE_KEY: ExpressionSpecification = ["get", "admin_code"];
const CITY_KEY: ExpressionSpecification = ["concat", ["slice", ["get", "admin_code"], 0, 2], ["get", "city_name"]];

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

function groupByColor(entries: Iterable<[string, JmaWarningArea]>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const [key, area] of entries) {
    const color = jmaWarningColor(area.level);
    const list = groups.get(color) ?? [];
    list.push(key);
    groups.set(color, list);
  }
  return groups;
}

function matchExpr(input: ExpressionSpecification, groups: Map<string, string[]>, fallback: unknown): unknown[] {
  if (groups.size === 0) return ["match", input, NONE, fallback, fallback];
  return ["match", input, ...[...groups].flatMap(([color, keys]) => [keys, color]), fallback];
}

/** 填色：先對 5 碼，再對「縣碼＋市名」；都對不到 → 透明（filter 也會擋掉）。 */
export function jmaWarningsColorExpr(snapshot: JmaWarningsSnapshot | null): ExpressionSpecification {
  const byCode = groupByColor(snapshot?.areas ?? []);
  const byCity = groupByColor(snapshot?.cityNameKeys ?? []);
  return matchExpr(CODE_KEY, byCode, matchExpr(CITY_KEY, byCity, "rgba(0,0,0,0)")) as unknown as ExpressionSpecification;
}

export function jmaWarningsFilter(snapshot: JmaWarningsSnapshot | null): ExpressionSpecification {
  const codes = [...(snapshot?.areas.keys() ?? [])];
  const cities = [...(snapshot?.cityNameKeys.keys() ?? [])];
  return ["any",
    ["match", CODE_KEY, codes.length ? codes : [NONE], true, false],
    ["match", CITY_KEY, cities.length ? cities : [NONE], true, false],
  ] as unknown as ExpressionSpecification;
}

export function useJmaWarningsLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  isDarkTheme: boolean,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const snapshotRef = useRef<JmaWarningsSnapshot | null>(null);
  const applyRef = useRef<() => void>(() => {});

  // 掛 source／layer，並把最新快照與透明度套上
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!visible) {
      if (map.getLayer(JMA_WARNINGS_FILL_LAYER_ID)) map.setLayoutProperty(JMA_WARNINGS_FILL_LAYER_ID, "visibility", "none");
      if (map.getLayer(JMA_WARNINGS_LINE_LAYER_ID)) map.setLayoutProperty(JMA_WARNINGS_LINE_LAYER_ID, "visibility", "none");
      return;
    }
    const op = Math.max(0, Math.min(1, opacity));
    const apply = () => {
      registerPmtilesSourceTypeOnce();
      if (!map.getSource(JMA_WARNINGS_SOURCE_ID)) {
        map.addSource(JMA_WARNINGS_SOURCE_ID, {
          type: PMTILES_SOURCE_TYPE, url: absoluteUrl(PMTILES_FILE), minzoom: 4, maxzoom: 11,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src = map.getSource(JMA_WARNINGS_SOURCE_ID) as any;
        if (src) src.attribution = JMA_ATTRIBUTION;
      }
      const snapshot = snapshotRef.current;
      const color = jmaWarningsColorExpr(snapshot);
      const filter = jmaWarningsFilter(snapshot);
      if (!map.getLayer(JMA_WARNINGS_FILL_LAYER_ID)) {
        map.addLayer({
          id: JMA_WARNINGS_FILL_LAYER_ID, type: "fill", source: JMA_WARNINGS_SOURCE_ID, "source-layer": JMA_WARNINGS_SOURCE_LAYER,
          filter, layout: { visibility: "visible" }, paint: { "fill-color": color, "fill-opacity": op },
        } as FillLayer);
      }
      if (!map.getLayer(JMA_WARNINGS_LINE_LAYER_ID)) {
        map.addLayer({
          id: JMA_WARNINGS_LINE_LAYER_ID, type: "line", source: JMA_WARNINGS_SOURCE_ID, "source-layer": JMA_WARNINGS_SOURCE_LAYER,
          filter, layout: { visibility: "visible", "line-join": "miter" },
          paint: { "line-color": color, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 10, 1.2], "line-opacity": Math.min(1, op + 0.2) },
        } as LineLayer);
      }
      map.setFilter(JMA_WARNINGS_FILL_LAYER_ID, filter);
      map.setFilter(JMA_WARNINGS_LINE_LAYER_ID, filter);
      map.setPaintProperty(JMA_WARNINGS_FILL_LAYER_ID, "fill-color", color);
      map.setPaintProperty(JMA_WARNINGS_FILL_LAYER_ID, "fill-opacity", op);
      map.setPaintProperty(JMA_WARNINGS_LINE_LAYER_ID, "line-color", color);
      map.setPaintProperty(JMA_WARNINGS_LINE_LAYER_ID, "line-opacity", Math.min(1, op + 0.2));
      map.setLayoutProperty(JMA_WARNINGS_FILL_LAYER_ID, "visibility", "visible");
      map.setLayoutProperty(JMA_WARNINGS_LINE_LAYER_ID, "visibility", "visible");
    };
    applyRef.current = apply;
    apply();
    map.on("style.load", apply);
    return () => { map.off("style.load", apply); };
  }, [mapRef, visible, opacity, mapTick, isDarkTheme]);

  // 載入與輪詢
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = () => {
      fetchJmaWarnings()
        .then((snapshot) => {
          if (cancelled) return;
          snapshotRef.current = snapshot;
          applyRef.current();
        })
        .catch((err) => {
          if (cancelled) return;
          console.warn("[jmaWarnings] load failed:", err);
          snapshotRef.current = null;
          applyRef.current();
        });
    };
    load();
    const id = window.setInterval(() => { invalidateJmaWarnings(); load(); }, POLL_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [visible, mapTick]);
}
