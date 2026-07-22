import type { CustomLayerInterface, Map as MapboxMap, MapSourceDataEvent } from "mapbox-gl";
import { GlowPointsScene, type GlowPoint } from "../three/GlowPointsScene";

/**
 * 夜景燈光 mode 3 專用的高樓 bloom 疊層 — 在 Mapbox fill「一片橘光」上，
 * 給 ≥N m 的高樓額外一層 Three.js additive 光暈（真爆白，補 Mapbox fill 沒有的 bloom 觀感）。
 *
 * 資料來源直接復用 buildingsGba 的 pmtile source（同一份，不另外載）：
 * 每次 moveend 從 map.querySourceFeatures 撈視野內建物 → 篩 height ≥ 門檻 → 算中心點 →
 * 去重 → 取最高前 4096 棟（對齊 GlowPointsScene 上限）餵光暈。因此低 zoom（全城）為城市地標
 * 群聚發亮、高 zoom（街廓）為逐棟高樓 beacon，都自動貼合視野。
 *
 * ⚠️ 一份 gl context 只掛一個「同時 render」的 GlowPointsScene（見 bloom-experiments README
 * 雙 Scene 打架 pitfall）：本層與發電廠/變電所 Bloom 測試層互斥 —— 只要不同時「可見」即安全
 * （render 在不可見時提前 return，不會污染 GL state）。
 */

export const BUILDINGS_NIGHT_BLOOM_LAYER_ID = "buildings-night-bloom-3d";

const MAX_BLOOM = 4096; // 對齊 GlowPointsScene.MAX_POINT_COUNT
const BLOOM_COLOR = "#fff2d8"; // 暖白；核心經 coreBoost 推到純白
const HEIGHT_MAX = 300; // sizeNorm 正規化上界（m），約台北 101 之下的高樓級距

export interface BuildingsNightBloomLayerOptions {
  getIsVisible: () => boolean;
  getOpacity: () => number;
  getMinHeight: () => number;
  sourceId: string;
  sourceLayer: string;
}

function ringCentroid(coords: number[][]): [number, number] {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const c of coords) {
    if (!c || c.length < 2) continue;
    x += c[0]!;
    y += c[1]!;
    n++;
  }
  return n ? [x / n, y / n] : [NaN, NaN];
}

function featureCentroid(geom: GeoJSON.Geometry | null | undefined): [number, number] | null {
  if (!geom) return null;
  if (geom.type === "Polygon") {
    const ring = geom.coordinates[0];
    return ring && ring.length >= 3 ? ringCentroid(ring as number[][]) : null;
  }
  if (geom.type === "MultiPolygon") {
    const ring = geom.coordinates[0]?.[0];
    return ring && ring.length >= 3 ? ringCentroid(ring as number[][]) : null;
  }
  return null;
}

export function createBuildingsNightBloomLayer(
  opts: BuildingsNightBloomLayerOptions,
): CustomLayerInterface {
  const scene = new GlowPointsScene({ minSizePx: 8, maxSizePx: 90, coreBoost: 1.0 });
  let map: MapboxMap | null = null;
  let dirty = true;

  const markDirty = () => {
    dirty = true;
  };
  const onSourceData = (e: MapSourceDataEvent) => {
    if (e.sourceId === opts.sourceId && e.isSourceLoaded) dirty = true;
  };

  function rebuild() {
    if (!map) return;
    const minH = opts.getMinHeight();
    const denom = Math.max(1, HEIGHT_MAX - minH);
    let feats: GeoJSON.Feature[];
    try {
      feats = map.querySourceFeatures(opts.sourceId, {
        sourceLayer: opts.sourceLayer,
      }) as unknown as GeoJSON.Feature[];
    } catch {
      return;
    }

    const seen = new Set<string>();
    const rows: { lon: number; lat: number; h: number }[] = [];
    for (const f of feats) {
      const h = Number((f.properties as { height?: number } | null)?.height);
      if (!Number.isFinite(h) || h < minH) continue;
      const c = featureCentroid(f.geometry);
      if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
      const key = `${c[0].toFixed(5)},${c[1].toFixed(5)}`;
      if (seen.has(key)) continue; // 去重（querySourceFeatures 跨 tile 會重複回傳）
      seen.add(key);
      rows.push({ lon: c[0], lat: c[1], h });
    }
    rows.sort((a, b) => b.h - a.h); // 最高的優先
    const points: GlowPoint[] = rows.slice(0, MAX_BLOOM).map((r) => ({
      lon: r.lon,
      lat: r.lat,
      colorHex: BLOOM_COLOR,
      sizeNorm: Math.min(1, Math.max(0, (r.h - minH) / denom)),
    }));
    scene.setData(points);
  }

  return {
    id: BUILDINGS_NIGHT_BLOOM_LAYER_ID,
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance, gl) {
      map = mapInstance;
      scene.init(gl);
      map.on("moveend", markDirty);
      map.on("sourcedata", onSourceData);
    },

    render(_gl, matrix) {
      const visible = opts.getIsVisible();
      scene.setVisible(visible);
      if (!visible) return;
      if (dirty) {
        rebuild();
        dirty = false;
      }
      scene.setOpacity(opts.getOpacity());
      if (map) scene.setZoom(map.getZoom());
      const moving = scene.render(matrix);
      if (moving) map?.triggerRepaint();
    },

    onRemove() {
      map?.off("moveend", markDirty);
      map?.off("sourcedata", onSourceData);
      scene.dispose();
    },
  };
}
