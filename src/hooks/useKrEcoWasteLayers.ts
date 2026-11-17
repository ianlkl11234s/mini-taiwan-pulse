import { useEffect, useMemo, useState } from "react";
import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hatchImageData, hatchImageId, mapSeamColor } from "../map/mapStyleScale";
import { hookLinePaint } from "../map/lineFillSpec";
import { loadKrEcoIndex, loadKrWasteRules } from "../data/krEcoWasteLoader";
import {
  KR_ECO_ANCHOR_FILL, KR_ECO_ANCHOR_SOURCE, KR_ECO_ATTRIBUTION, KR_ECO_CODES, KR_ECO_GRADES, KR_ECO_MIN_ZOOM, KR_ECO_SRC_MAXZOOM, KR_ECO_TEXT,
  KR_ECO_UNKNOWN_COLOR, KR_WASTE_ADMIN_FILE, KR_WASTE_ADMIN_SOURCE, KR_WASTE_ATTRIBUTION, KR_WASTE_COLOR, KR_WASTE_FILL, KR_WASTE_HATCH,
  KR_WASTE_LINE, KR_WASTE_MIN_ZOOM, KR_WASTE_TEXT, krEcoFillId, krEcoLineId, krEcoSourceId, KR_ECO_SOURCE_LAYER, type KrEcoIndexFile,
} from "../data/krEcoWasteTypes";
import { useGbPmtilesLayers, type LayerBuild, type SourceSpec } from "./useGbWaterLayers";
import { useViewportPmtilesShards, type PmtilesShard } from "./useViewportPmtilesShards";

type Expr = unknown[];
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** 等級色：match(eczmGr)；意外值用中性灰，不落進任何等級。 */
export function krEcoColorExpr(): Expr {
  const expr: unknown[] = ["match", ["to-string", ["coalesce", ["get", "eczmGr"], ""]]];
  for (const g of KR_ECO_GRADES) expr.push(g.value, g.color);
  expr.push(KR_ECO_UNKNOWN_COLOR);
  return expr;
}

/**
 * C117 南韓生態自然圖：17 個 시·도 PMTiles 依視窗載入（`useViewportPmtilesShards`），z10 起顯示。
 * 面之間 1 px 底圖色細縫（fill-outline-color），透明度＝滑桿（預設 0.55）。空白＝未評價，不畫任何顏色。
 */
export function useKrEcologyNaturalnessLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, isDark: boolean) {
  const [index, setIndex] = useState<KrEcoIndexFile[] | null>(null);
  useEffect(() => {
    if (!visible || index) return;
    let alive = true;
    loadKrEcoIndex().then((files) => { if (alive) setIndex(files); }).catch((err) => console.error("[krEcologyNaturalness] index", err));
    return () => { alive = false; };
  }, [visible, index]);
  const shards = useMemo<PmtilesShard[] | null>(() => index
    ? index.filter((f) => (KR_ECO_CODES as readonly string[]).includes(f.code)).map((f) => ({ id: f.code, file: f.file, bbox: f.bbox }))
    : null, [index]);
  useViewportPmtilesShards(mapRef, {
    visible, shards, minzoom: KR_ECO_MIN_ZOOM, srcMaxzoom: KR_ECO_SRC_MAXZOOM,
    sourceId: (s) => krEcoSourceId(s.id), attribution: KR_ECO_ATTRIBUTION, loading: KR_ECO_TEXT.loading.zh,
    anchor: { sourceId: KR_ECO_ANCHOR_SOURCE, layerId: KR_ECO_ANCHOR_FILL },
    build: (s, sourceId): LayerBuild[] => {
      const id = krEcoFillId(s.id);
      const lineId = krEcoLineId(s.id);
      const op = clamp01(opacity);
      const base = { source: sourceId, "source-layer": KR_ECO_SOURCE_LAYER, minzoom: KR_ECO_MIN_ZOOM };
      // 面之間 1 px 底圖色細縫（F-2：獨立 line 子圖層，不用 fill-outline-color）
      const seam = hookLinePaint("krEcologyNaturalness", lineId, { "line-color": mapSeamColor(isDark), "line-width": 1, "line-opacity": Math.min(1, op + 0.25) },
        { "line-color": mapSeamColor(isDark), "line-width": 1, "line-opacity": 0.8 }, isDark);
      return [
        {
          id,
          layer: () => ({ id, type: "fill", ...base, layout: { visibility: "none" }, paint: { "fill-color": krEcoColorExpr(), "fill-opacity": op } } as unknown as AnyLayer),
          update: (map) => { map.setPaintProperty(id, "fill-opacity", op); },
        },
        {
          id: lineId,
          layer: () => ({ id: lineId, type: "line", ...base, layout: { visibility: "none" }, paint: seam } as unknown as AnyLayer),
          update: (map) => { for (const [k, v] of Object.entries(seam)) map.setPaintProperty(lineId, k as any, v as any); },
        },
      ];
    },
  }, [opacity, isDark]);
}

function ensureHatchImages(map: MapboxMap) {
  for (const dark of [true, false]) {
    const id = hatchImageId("missing", dark);
    if (!map.hasImage(id)) map.addImage(id, hatchImageData("missing", dark));
  }
}

const WASTE_SOURCE: SourceSpec = {
  id: KR_WASTE_ADMIN_SOURCE, file: KR_WASTE_ADMIN_FILE, minzoom: 2, maxzoom: 12, attribution: KR_WASTE_ATTRIBUTION, loading: KR_WASTE_TEXT.loading.zh,
};

/**
 * C086 南韓生活垃圾排出規則：JSON 依 sgg_code 索引，掛既有 kr_admin_boundaries.pmtiles 的 sgg 層。
 * 有 key 的區＝單一淡色（只表示有資料，不依時段上色）；沒有 key 的區＝缺值斜線「未涵蓋」，不畫成 0 或「不收」。
 * 與行政界共用 source id（同檔同縮放），layer id 用自己的字首。
 */
export function useKrWasteDisposalRulesLayer(mapRef: React.RefObject<MapboxMap | null>, visible: boolean, opacity: number, isDark: boolean) {
  const [codes, setCodes] = useState<string[] | null>(null);
  useEffect(() => {
    if (!visible || codes) return;
    let alive = true;
    loadKrWasteRules().then((d) => { if (alive) setCodes(Object.keys(d.sgg)); }).catch((err) => console.error("[krWasteDisposalRules] rules", err));
    return () => { alive = false; };
  }, [visible, codes]);
  const has: Expr = ["in", ["to-string", ["get", "sgg_code"]], ["literal", codes ?? []]];
  const op = clamp01(opacity);
  useGbPmtilesLayers(mapRef, WASTE_SOURCE, visible && !!codes, () => {
    const base = { source: KR_WASTE_ADMIN_SOURCE, "source-layer": "sgg", minzoom: KR_WASTE_MIN_ZOOM };
    const hatchId = hatchImageId("missing", isDark);
    return [
      {
        id: KR_WASTE_FILL,
        layer: () => ({ id: KR_WASTE_FILL, type: "fill", ...base, filter: has, layout: { visibility: "none" }, paint: { "fill-color": KR_WASTE_COLOR, "fill-opacity": op } } as unknown as AnyLayer),
        update: (map) => { map.setFilter(KR_WASTE_FILL, has as any); map.setPaintProperty(KR_WASTE_FILL, "fill-opacity", op); },
      },
      {
        id: KR_WASTE_HATCH,
        layer: () => { ensureHatchImages(mapRef.current!); return { id: KR_WASTE_HATCH, type: "fill", ...base, filter: ["!", has], layout: { visibility: "none" }, paint: { "fill-pattern": hatchId, "fill-opacity": Math.min(1, op + 0.3) } } as unknown as AnyLayer; },
        update: (map) => {
          ensureHatchImages(map);
          map.setFilter(KR_WASTE_HATCH, ["!", has] as any);
          map.setPaintProperty(KR_WASTE_HATCH, "fill-pattern", hatchId);
          map.setPaintProperty(KR_WASTE_HATCH, "fill-opacity", Math.min(1, op + 0.3));
        },
      },
      {
        id: KR_WASTE_LINE,
        layer: () => ({ id: KR_WASTE_LINE, type: "line", ...base, layout: { visibility: "none" }, paint: { "line-color": mapSeamColor(isDark), "line-width": 1, "line-opacity": Math.min(1, op + 0.25) } } as unknown as AnyLayer),
        update: (map) => { map.setPaintProperty(KR_WASTE_LINE, "line-color", mapSeamColor(isDark)); map.setPaintProperty(KR_WASTE_LINE, "line-opacity", Math.min(1, op + 0.25)); },
      },
    ];
  }, [opacity, isDark, codes]);
}
