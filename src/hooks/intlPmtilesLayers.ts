/**
 * 多國共用的 PMTiles 圖層建構器與代表點／熱區 hook（B1 P2b，2026-11-24）。
 * 原本放在 useGbWaterLayers.ts（名稱叫 Gb，實際是 20 個國家 hook 共用）；搬到中性檔，國家 hook 不再互相 import。
 * 原檔對外 re-export 同名符號。本檔不得 import 任何國家模組。
 */
import { useEffect } from "react";
import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { PMTILES_SOURCE_TYPE } from "../map/pmtilesConstants";
import { registerPmtilesSourceTypeOnce } from "../map/pmtilesSourceType";
import { pmtilesRasterCustomSource } from "../map/pmtilesRasterCustomSource";
import { PRIVATE_CORAL_PMTILES_SOURCE_TYPE, PrivateCoralFetchSource, registerPrivateCoralSourceOnce } from "../map/privateCoralPmtiles";
import { densePointOpacity, densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { selectedMultiSelectValues } from "../data/multiSelectMapbox";
import { paramDefault } from "../data/layerParamsSpec";
import { repPointHeatIntensity, repPointLayer, repPointThinnedWeight } from "../data/repPointLayers";
import { applyHeatmapStyle, heatmapLayerPaint } from "../state/layerPalette";
import { useMapReadyTick } from "./useMapReadyTick";

export type Expr = unknown[];
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
export const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);

function absoluteUrl(relativeFile: string): string {
  const relative = `${import.meta.env.BASE_URL ?? "/"}world/${relativeFile}`;
  return new URL(relative, window.location.href).href;
}

/** L-1 線寬：z10／z14 兩點插值，`at(idx)` 回傳該插值點的（可 data-driven）寬度。 */
export function zoomWidth(at: (idx: 0 | 1) => unknown): Expr {
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

export interface SourceSpec {
  id: string; file: string; minzoom: number; maxzoom: number; attribution: string; loading: string;
  /** 點陣 PMTiles 改走 Mapbox 原生 custom source（globe 投影正確；見 map/pmtilesRasterCustomSource.ts） */
  raster?: { tileSize: number };
  /** 站主限定：改走同源私人 Range API（`url`），每次請求帶當下 token；不給＝公開 ./world/<file> */
  private?: PrivatePmtilesSource;
}
export interface PrivatePmtilesSource { url: string; getToken: () => Promise<string>; onAccessDenied: () => void }
/** `before`（選填）：addLayer 的 beforeId（地形 raster 插在底圖第一個 symbol 下）；不給＝疊在最上面。 */
export interface LayerBuild { id: string; layer: () => AnyLayer; update: (map: MapboxMap) => void; before?: (map: MapboxMap) => string | undefined }

/**
 * R5（P-4／G-2）英國密集點熱區：畫在出點縮放以下、不可點擊；filter 與對應 circle 相同（null＝不篩）。
 * 呼叫端把它排在 circle 之前（先加的在下面），maxzoom 傳 `heatmapMaxzoom(出點縮放)`，並把
 * `useHeatmapStyleSignature([key])` 放進 deps（換色盤、多層疊放倍率才會重套）。
 */
export function gbHeatmapBuild(o: {
  id: string; key: string; sourceId: string; sourceLayer: string; maxzoom: number; filter?: unknown[] | null;
  isDark: boolean; opacityScale: number; intensity: number; weight?: unknown;
}): LayerBuild {
  return {
    id: o.id,
    layer: () => ({
      id: o.id, type: "heatmap", source: o.sourceId, "source-layer": o.sourceLayer, maxzoom: o.maxzoom,
      ...(o.filter ? { filter: o.filter } : {}),
      layout: { visibility: "none" }, paint: heatmapLayerPaint(o.key, o.isDark, o.opacityScale, o.intensity, o.weight ?? 1),
    } as unknown as AnyLayer),
    update: (map) => {
      map.setFilter(o.id, (o.filter ?? null) as any);
      applyHeatmapStyle(map, o.id, o.key, o.isDark, o.opacityScale);
    },
  };
}

/** 各 map 上本 hook 建立的 source id → 檔名（換檔偵測用；style 重載後 source 消失會重記）。 */
const SOURCE_FILES = new WeakMap<MapboxMap, Map<string, string>>();
function sourceFiles(map: MapboxMap): Map<string, string> {
  let m = SOURCE_FILES.get(map);
  if (!m) SOURCE_FILES.set(map, (m = new Map()));
  return m;
}

/** 共用掛載流程：加 source → 逐一加 layer（初始隱藏）→ 顯示並更新 paint／filter；換底圖（style.load）重掛。
 *  第 4 波交通層也用（同一 source 可被多個 key 各自呼叫；隱藏只關自己的 layer，不移除 source）。 */
export function useGbPmtilesLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  source: SourceSpec,
  visible: boolean,
  build: () => LayerBuild[],
  deps: readonly unknown[],
) {
  const mapTick = useMapReadyTick(mapRef, visible);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = build();
    if (!visible) {
      for (const l of layers) if (map.getLayer(l.id)) map.setLayoutProperty(l.id, "visibility", "none");
      return;
    }
    const mount = () => {
      registerPmtilesSourceTypeOnce();
      let sourceAdded = false;
      // 同一個 source id 換檔（愛爾蘭淹水情境等依參數換 PMTiles）：先拆掉本 hook 的 layer 與舊 source，再用新檔重建
      const files = sourceFiles(map);
      if (map.getSource(source.id) && files.get(source.id) !== undefined && files.get(source.id) !== source.file) {
        for (const l of layers) if (map.getLayer(l.id)) map.removeLayer(l.id);
        map.removeSource(source.id);
      }
      if (!map.getSource(source.id)) {
        files.set(source.id, source.file);
        sourceAdded = true;
        const priv = source.private;
        if (priv) registerPrivateCoralSourceOnce();
        const url = priv ? new URL(priv.url, window.location.href).href : absoluteUrl(source.file);
        map.addSource(source.id, (source.raster
          ? pmtilesRasterCustomSource({
            id: source.id, url, attribution: source.attribution,
            minzoom: source.minzoom, maxzoom: source.maxzoom, tileSize: source.raster.tileSize,
            ...(priv ? { source: new PrivateCoralFetchSource(url, priv.getToken, undefined, priv.onAccessDenied) } : {}),
          })
          : priv
            ? { type: PRIVATE_CORAL_PMTILES_SOURCE_TYPE, url, getToken: priv.getToken, onAccessDenied: priv.onAccessDenied, attribution: source.attribution, minzoom: source.minzoom, maxzoom: source.maxzoom }
            : {
              type: PMTILES_SOURCE_TYPE, url, attribution: source.attribution,
              minzoom: source.minzoom, maxzoom: source.maxzoom,
            }) as any);
      }
      for (const l of layers) {
        if (!map.getLayer(l.id)) {
          const spec = l.layer();
          // Mapbox GL v3 不替自訂 source type 建 symbol 用的 source cache：symbol layer 掛在 PMTiles 上，
          // 標籤放置會拋錯讓整張地圖停止繪製（越南省名 2026-11-14）。改用 GeoJSON source 畫標籤。
          if (spec.type === "symbol") { console.error(`[pmtiles] ${l.id}: symbol layer 不可掛在 PMTiles source（${source.id}）`); continue; }
          map.addLayer(spec, l.before?.(map));
        }
        map.setLayoutProperty(l.id, "visibility", "visible");
        l.update(map);
      }
      if (sourceAdded) keepLoadingUntilMapIdle(map, `${source.id}:render`, source.loading, source.id);
    };
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, visible, mapTick, source.file, ...deps]);
}

// ─────────────────── §3.8 共用：類別多選篩選（V-4）、點／面切換代表點（V-5） ───────────────────

/** 多選 mask → filter（`undefined` 或全選＝null 不篩，全關＝不可能命中）；mask 由 layerParamsSpec multiSelect 的 `out` 編出。 */
export function gbMaskFilter(field: string, mask: number | undefined, values: readonly string[]): Expr | null {
  if (mask === undefined) return null;
  const selected = selectedMultiSelectValues(mask, values);
  if (selected.length === values.length) return null;
  if (selected.length === 0) return ["==", ["get", field], "__multi_select_none__"];
  return ["in", ["coalesce", ["get", field], ""], ["literal", selected]];
}

/** 合併多個 filter（略過 null）；全空回 null。 */
export function gbAllOf(...parts: readonly (Expr | null | undefined)[]): Expr | null {
  const kept = parts.filter((p): p is Expr => Array.isArray(p));
  if (kept.length === 0) return null;
  return kept.length === 1 ? kept[0]! : ["all", ...kept];
}

/**
 * 把類別篩選疊到一組 LayerBuild 上：每個子圖層的 filter＝原 filter AND `extra`，update 時重設（extra 變 null 會還原原 filter）。
 * 讓既有 hook 只多包一層就能接 multiSelect，不用逐個子圖層改 filter／update。
 */
export function gbWithFilter(builds: readonly LayerBuild[], extra: Expr | null): LayerBuild[] {
  return builds.map((b) => {
    const base = ((b.layer() as { filter?: Expr }).filter) ?? null;
    const combined = gbAllOf(base, extra);
    return {
      ...b,
      layer: () => {
        const { filter: _drop, ...rest } = b.layer() as { filter?: Expr } & Record<string, unknown>;
        return { ...rest, ...(combined ? { filter: combined } : {}) } as unknown as AnyLayer;
      },
      update: (map) => { b.update(map); map.setFilter(b.id, (combined ?? null) as any); },
    };
  });
}

/** 點／面切換（layerParamsSpec `displayModeSelect`）：0＝點、1＝面，與 encode 順序一致。 */
export type GbDisplayMode = "point" | "polygon";
export const gbDisplayModeFromIdx = (idx: number | undefined, fallback: GbDisplayMode): GbDisplayMode =>
  idx === 0 ? "point" : idx === 1 ? "polygon" : fallback;

/**
 * 日本（與其他非英國）面層代表點的 `GbRepPointsSpec`：檔名／tile layer／點數／maxzoom 全讀 `repPointLayer(key)` 登記表。
 * heatWeight 預設用 `repPointThinnedWeight(2.5)`（低縮放抽稀補償）。
 */
export function repPointSpecFor(key: string, o: {
  sourceId: string; heatId: string; circleId: string; attribution: string; loading: string;
  polygonMinzoom: number; opacityDefault: number; tier?: "S" | "M"; thinned?: number;
}): GbRepPointsSpec {
  const layer = repPointLayer(key);
  if (!layer) throw new Error(`repPointLayers 沒有登記 ${key}`);
  return {
    key,
    source: {
      id: o.sourceId, file: layer.file.replace(/^\.?\//, ""), minzoom: 4, maxzoom: layer.maxzoom ?? 10,
      attribution: o.attribution, loading: o.loading,
    },
    sourceLayer: layer.sourceLayer, heatId: o.heatId, circleId: o.circleId, count: layer.count,
    polygonMinzoom: o.polygonMinzoom, heatIntensity: repPointHeatIntensity(layer), opacityDefault: o.opacityDefault,
    ...(o.tier ? { tier: o.tier } : {}), heatWeight: repPointThinnedWeight(o.thinned ?? 2.5),
  };
}

/**
 * 面圖層的代表點（analytics 另出的 `*_points.pmtiles`，每面一點、落在面內）：
 * - ≥ 1 萬點：兩種模式都有熱區（P-4），讓全英視角看得到；
 * - 「點」模式：熱區到出點縮放（`densePointsFromZoom`），之後畫代表點 circle；面不畫；
 * - 「面」模式：熱區到面出現的縮放，之後交給面（呼叫端把面 hook 的 visible 設成 `mode === "polygon"`）；
 *   < 1 萬點的層沒有熱區，改在面出現前畫代表點。
 * 代表點透明度＝點預設（依點數，P-3）× 滑桿相對預設的倍率，避免面的低透明度把點變得看不見。
 */
export interface GbRepPointsSpec {
  key: string;
  source: SourceSpec;
  sourceLayer: string;
  heatId: string;
  circleId: string;
  count: number;
  /** 面模式下面出現的縮放（熱區畫到這裡） */
  polygonMinzoom: number;
  heatIntensity: number;
  opacityDefault: number;
  tier?: "S" | "M";
  /** 代表點檔低縮放有抽稀（每降一級約剩 1/2.5）時，用隨縮放放大的 heatmap-weight 補回密度（見 GB_THINNED_POINTS_WEIGHT） */
  heatWeight?: unknown;
}

/**
 * analytics 代表點檔 z4–9 抽稀、z10 起全量（林地、樹木保護 2026-10-31 實測每級約 ×2.5），用 heatmap-weight 補回低縮放密度。
 * ⚠️ Mapbox 的 `["exponential", b]` interpolate 不是幾何衰減：t＝(b^(z−z0)−1)/(b^(z1−z0)−1)，值＝A(1−t)+Bt。
 * 這條（4→244、10→1、底數 2.5）實際是 w(z)＝245.14−2.5^(z−4)：z8≈206、z9≈147、z9.5≈91、z10＝1，
 * 也就是在 z9–10 之間從約 147 掉到 1（不是每級 ÷2.5）。出點縮放＝z10 的層（海岸侵蝕）z10 就換成點，看不出來；
 * 出點縮放晚於 z10 的層要改用 GB_THINNED_POINTS_WEIGHT_TO_Z12。
 */
export const GB_THINNED_POINTS_WEIGHT: Expr = ["interpolate", ["exponential", 2.5], ["zoom"], 4, 2.5 ** 6, 10, 1];

/**
 * 出點縮放＝z12 的抽稀代表點層（> 10 萬點：林地 gbWoodland、樹木保護 gbTreeProtection）用。
 * 根因（2026-11-01 VIS 追加）：沿用 GB_THINNED_POINTS_WEIGHT 時 weight×intensity 在 z9≈0.92、z10≈0.0125（約 74 倍斷崖），
 * 低於熱區色階第一個可見節點（density 0.05），點模式 z10–11.99 熱區看不到、z12 才出點 → 畫面全空。
 * z4–9 的整數縮放值與舊曲線相同（線性插值逐級寫出；全國視角與「面」模式熱區不變），z10–12 依瀏覽器目視校正，
 * 讓熱區一路接到 z12 出點。
 */
export const GB_THINNED_POINTS_WEIGHT_TO_Z12: Expr = [
  "interpolate", ["linear"], ["zoom"],
  // z9.5 起改載 z10 全量圖磚，權重同步降到 z10 的量級，避免 z9.5–10 過飽和
  4, 244.141, 5, 242.641, 6, 238.891, 7, 229.516, 8, 206.078, 9, 147.484, 9.5, 68, 10, 48, 11, 64, 12, 128,
];

export function useGbRepPointLayers(
  mapRef: React.RefObject<MapboxMap | null>, spec: GbRepPointsSpec,
  o: { visible: boolean; mode: GbDisplayMode; opacity: number; scale: number; isDark: boolean; color: unknown; filter: Expr | null },
  heatStyle: string,
) {
  const dense = spec.count >= 10_000;
  const pointsFrom = densePointsFromZoom(spec.count, spec.source.minzoom);
  const heatMax = heatmapMaxzoom(o.mode === "point" ? pointsFrom : spec.polygonMinzoom);
  const rel = clamp01(o.opacity) / spec.opacityDefault;
  const pointPaint = () => {
    const op = clamp01(densePointOpacity(spec.count) * rel);
    return {
      "circle-radius": pointRadius(spec.tier ?? "S", o.scale),
      "circle-color": o.color,
      "circle-opacity": op,
      ...pointStrokePaint(o.isDark, rel),
    };
  };
  const heat = gbHeatmapBuild({
    id: spec.heatId, key: spec.key, sourceId: spec.source.id, sourceLayer: spec.sourceLayer, maxzoom: heatMax,
    filter: o.filter, isDark: o.isDark, opacityScale: rel, intensity: spec.heatIntensity, weight: spec.heatWeight,
  });
  // < 1 萬點的層沒有熱區：「面」模式在面出現前改畫代表點（V-2 全英視角看得到），面出現後交給面
  const circleVisible = o.mode === "point" || !dense;
  const circleMax = o.mode === "point" ? 24 : heatmapMaxzoom(spec.polygonMinzoom); // +0.01：z9.5–10 的 tile 仍建 bucket，標記不提早消失
  useGbPmtilesLayers(mapRef, spec.source, o.visible, () => [
    ...(dense ? [{
      ...heat,
      update: (map: MapboxMap) => { map.setLayerZoomRange(spec.heatId, 0, heatMax); heat.update(map); },
    }] : []),
    {
      id: spec.circleId,
      layer: () => ({
        id: spec.circleId, type: "circle", source: spec.source.id, "source-layer": spec.sourceLayer, minzoom: pointsFrom,
        ...(o.filter ? { filter: o.filter } : {}), layout: { visibility: "none" }, paint: pointPaint(),
      } as unknown as AnyLayer),
      update: (map: MapboxMap) => {
        map.setFilter(spec.circleId, (o.filter ?? null) as any);
        for (const [k, v] of Object.entries(pointPaint())) map.setPaintProperty(spec.circleId, k as any, v as any);
        map.setLayerZoomRange(spec.circleId, pointsFrom, circleMax);
        map.setLayoutProperty(spec.circleId, "visibility", circleVisible ? "visible" : "none");
      },
    },
  ], [o.mode, o.opacity, o.scale, o.isDark, JSON.stringify(o.color), JSON.stringify(o.filter), heatStyle]);
}

