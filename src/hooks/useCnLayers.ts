import { useEffect, useState } from "react";
import type { AnyLayer, Map as MapboxMap } from "mapbox-gl";
import { hookFillPaint, hookLineLayout, hookLinePaint } from "../map/lineFillSpec";
import { BOUNDARY_GRAY, LINE_DASH, MAP_SEAM, POINT_STROKE_DATA_ENCODED, densePointsFromZoom, heatmapMaxzoom, pointRadius, pointStrokePaint } from "../map/mapStyleScale";
import { paletteRamp, resampleRamp } from "../map/palettes";
import { paramDefault } from "../data/layerParamsSpec";
import { selectedMultiSelectValues } from "../data/multiSelectMapbox";
import { useHeatmapStyleSignature } from "../state/layerPalette";
import { useUser } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  CN_ADMIN_COLOR, CN_ADMIN_LEVELS, CN_DENSITY_BREAKS, CN_DENSITY_FIELD, CN_NOT_COVERED_COLOR, CN_PLANT_STATUSES, CN_PLANT_STATUS_DEFAULT,
  asPhSpec, cnOwnerUrl, type CnAdminLevel, type CnLayerSpec, type CnOwnerAsset, type CnPart,
} from "../data/cnDataLayers";
import { phColorExpr, phPartCatFilter } from "./usePhLayers";
import { gbAllOf, gbHeatmapBuild, useGbPmtilesLayers, type LayerBuild, type PrivatePmtilesSource, type SourceSpec } from "./useGbWaterLayers";

/**
 * 中國第 0–1 波（2026-11-13）：9 層全部站主限定。圖磚走私人 owner-data（同源 Range API，每次請求帶當下 token），
 * 沒有站主存取權（未登入、非站主、sidecar 尚未收錄該檔回 404）就不掛 source；撤權時連 source 一起移除。
 * - 行政界照台灣（map-layers L-5）：中性灰線、面透明度 0 只當點擊熱區；一次只顯示一個層級。
 * - 人口密度：序列色階（YlOrBr）依固定斷點分 6 級；省＝2020 普查、地級＝GHS 模型值；沒有值畫灰「未涵蓋」，不畫成 0。
 * - 人口網格：已上色 PNG raster（插在底圖第一個 symbol 下）。
 * - 規格驅動層：配色與類別篩選沿用菲律賓（phColorExpr／phPartCatFilter）；瘦身圖磚各 tile layer 最大縮放不同，子圖層有
 *   `srcMaxzoom` 者另開一個 source（同一個私人檔），超過靠 overzoom。
 */
type Expr = unknown[];
type MapRef = React.RefObject<MapboxMap | null>;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const opacityDefault = (key: string, fallback: number) => Number(paramDefault(key, `${key}Opacity`) ?? fallback);
const scaleDefault = (key: string) => Number(paramDefault(key, `${key}Scale`) ?? 1);
const sig = (v: unknown) => JSON.stringify(v);
const NONE: Expr = ["==", ["literal", "__cn_none__"], "__cn_part__"];
const levelAt = (idx: number | undefined, fallback: CnAdminLevel): CnAdminLevel => CN_ADMIN_LEVELS[idx ?? -1]?.value ?? fallback;

function setPaint(map: MapboxMap, id: string, paint: Record<string, unknown>) {
  for (const [k, v] of Object.entries(paint)) map.setPaintProperty(id, k as any, v as any);
}
function firstSymbolLayerId(map: MapboxMap): string | undefined {
  try { return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id; } catch { return undefined; }
}

// ═════════════════════════ 站主存取（owner-data） ═════════════════════════

export const CN_ACCESS_DENIED_EVENT = "cn-owner-data-access-denied";
/** 每個帳號只探一次（同一頁 9 個 host 共用）；撤權事件清掉重探。 */
const probes = new Map<string, Promise<boolean>>();

/**
 * 探 `?access=1`：200＋allowed 才算可讀；401／403（非站主）與 404（sidecar 白名單尚未收錄中國檔）一律靜默當成未開放，
 * 其他錯誤只記 console，不跳全站錯誤（使用者沒開的圖層不該報錯）。
 */
export function probeCnAccess(userId: string, token: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const hit = probes.get(userId);
  if (hit) return hit;
  const run = (async () => {
    try {
      const response = await fetchFn(`${cnOwnerUrl("cn-admin-boundaries")}?access=1`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) {
        if (![401, 403, 404].includes(response.status)) console.warn(`[cn] owner-data access probe HTTP ${response.status}`);
        return false;
      }
      return ((await response.json()) as { allowed?: unknown }).allowed === true;
    } catch (error) {
      console.warn("[cn] owner-data access probe failed", error);
      return false;
    }
  })();
  probes.set(userId, run);
  return run;
}
export function resetCnAccessProbe() { probes.clear(); }

async function cnAccessToken(expectedUserId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId) throw new Error("China owner data access denied");
  return data.session.access_token;
}

/** UI 便利判斷；sidecar 每次 Range 請求都重新驗證站主身分。`active`＝本 host 的圖層開著才探。 */
export function useCnPrivateAccess(active: boolean): { allowed: boolean; userId: string | null } {
  const { user, loading } = useUser();
  const [verified, setVerified] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const revoke = () => { resetCnAccessProbe(); setVerified(null); setRevision((r) => r + 1); };
    window.addEventListener(CN_ACCESS_DENIED_EVENT, revoke);
    return () => window.removeEventListener(CN_ACCESS_DENIED_EVENT, revoke);
  }, []);
  useEffect(() => {
    setVerified(null);
    if (!user || !active) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await cnAccessToken(user.id);
        const ok = await probeCnAccess(user.id, token);
        if (!cancelled && ok) setVerified(user.id);
      } catch { /* 未登入或 session 對不上：維持未開放 */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id, active, revision]);
  return { allowed: !loading && !!user && verified === user.id, userId: user?.id ?? null };
}

function privateSource(asset: CnOwnerAsset, userId: string): PrivatePmtilesSource {
  const deny = () => window.dispatchEvent(new Event(CN_ACCESS_DENIED_EVENT));
  return {
    url: cnOwnerUrl(asset),
    getToken: async () => {
      try { return await cnAccessToken(userId); } catch (error) { deny(); throw error; }
    },
    onAccessDenied: deny,
  };
}

/** 撤權（或換帳號）時移除本層 layer 與 source，不留已載入的圖磚。 */
function useRevokeCleanup(mapRef: MapRef, allowed: boolean, layerIds: readonly string[], sourceIds: readonly string[]) {
  useEffect(() => {
    if (allowed) return;
    const map = mapRef.current;
    if (!map) return;
    try {
      for (const id of layerIds) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of sourceIds) if (map.getSource(id)) map.removeSource(id);
    } catch { /* style 已換掉 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, mapRef, sig(layerIds), sig(sourceIds)]);
}

const UNMOUNTED: PrivatePmtilesSource = { url: "", getToken: async () => { throw new Error("no access"); }, onAccessDenied: () => {} };

// ═════════════════════════ 行政邊界 ═════════════════════════

export const CN_ADMIN_KEY = "cnAdminBoundaries";
/** layer id 寫成字面值（gisClickRegistry／lineFillTiers 的契約測試以字面值比對）；順序＝CN_ADMIN_LEVELS。 */
export const CN_ADMIN_LAYER_IDS = {
  province: { fill: "cn-admin-province-fill", line: "cn-admin-province-line" },
  prefecture: { fill: "cn-admin-prefecture-fill", line: "cn-admin-prefecture-line" },
} as const;

function levelSource(prefix: string, asset: CnOwnerAsset, level: CnAdminLevel, zooms: readonly [number, number], loading: string, attribution: string, priv: PrivatePmtilesSource): SourceSpec {
  return { id: `${prefix}-${level}`, file: asset, minzoom: zooms[0], maxzoom: zooms[1], attribution, loading, private: priv };
}

function useAdminLevel(mapRef: MapRef, i: number, visible: boolean, opacity: number, isDark: boolean, priv: PrivatePmtilesSource) {
  const level = CN_ADMIN_LEVELS[i]!;
  const ids = CN_ADMIN_LAYER_IDS[level.value];
  const source = levelSource("cn-admin", "cn-admin-boundaries", level.value, level.admin, "中國行政邊界載入中", "© OCHA COD-AB China（CC BY-IGO）；邊界依 OCHA 資料，不代表任何立場", priv);
  const color = BOUNDARY_GRAY[isDark ? "dark" : "light"];
  const def = opacityDefault(CN_ADMIN_KEY, 0.85);
  const linePaint = () => ({
    ...hookLinePaint(CN_ADMIN_KEY, ids.line, { "line-color": color, "line-opacity": clamp01(opacity), "line-width": 1 }, { "line-color": color, "line-opacity": def, "line-width": 1 }, isDark),
    "line-color": color,
  });
  useGbPmtilesLayers(mapRef, source, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: source.id, "source-layer": level.value, minzoom: level.admin[0],
        layout: { visibility: "none" }, paint: { "fill-color": CN_ADMIN_COLOR, "fill-opacity": 0 } } as unknown as AnyLayer),
      update: () => {},
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: source.id, "source-layer": level.value, minzoom: level.admin[0],
        layout: { visibility: "none", ...hookLineLayout(CN_ADMIN_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** `levelIdx`：CN_ADMIN_LEVELS 順序（0 省、1 地級）；一次只顯示一層。 */
export function useCnAdminLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const access = useCnPrivateAccess(visible);
  const priv = access.allowed && access.userId ? privateSource("cn-admin-boundaries", access.userId) : UNMOUNTED;
  const level = levelAt(levelIdx, "province");
  const on = visible && access.allowed;
  useAdminLevel(mapRef, 0, on && level === "province", opacity, isDark, priv);
  useAdminLevel(mapRef, 1, on && level === "prefecture", opacity, isDark, priv);
  useRevokeCleanup(mapRef, access.allowed,
    Object.values(CN_ADMIN_LAYER_IDS).flatMap((x) => [x.fill, x.line]), CN_ADMIN_LEVELS.map((lv) => `cn-admin-${lv.value}`));
}

// ═════════════════════════ 人口（面量） ═════════════════════════

export const CN_POP_KEY = "cnPopulation";
export const CN_POP_LAYER_IDS = {
  province: { fill: "cn-population-province-fill", line: "cn-population-province-line" },
  prefecture: { fill: "cn-population-prefecture-fill", line: "cn-population-prefecture-line" },
} as const;

/** 6 級密度色（色盤庫 YlOrBr 暗／淡版重新取樣；圖例共用）。 */
export function cnDensityColors(isDark: boolean): string[] {
  return resampleRamp(paletteRamp("YlOrBr", isDark)!, CN_DENSITY_BREAKS.length + 1);
}
/** 沒有密度欄（未涵蓋）→ 灰；其餘依密度 step。 */
export function cnDensityColorExpr(level: CnAdminLevel, isDark: boolean): Expr {
  const field = CN_DENSITY_FIELD[level];
  const colors = cnDensityColors(isDark);
  const step: unknown[] = ["step", ["to-number", ["get", field], 0], colors[0]];
  CN_DENSITY_BREAKS.forEach((b, i) => step.push(b, colors[i + 1]));
  return ["case", ["!", ["has", field]], CN_NOT_COVERED_COLOR, step];
}

function usePopLevel(mapRef: MapRef, i: number, visible: boolean, opacity: number, isDark: boolean, priv: PrivatePmtilesSource) {
  const level = CN_ADMIN_LEVELS[i]!;
  const ids = CN_POP_LAYER_IDS[level.value];
  const source = levelSource("cn-population", "cn-population", level.value, level.population, "中國人口載入中", "國家統計局 2020 普查；GHS-POP 2025 © European Union（JRC，CC BY 4.0，模型值）", priv);
  const def = opacityDefault(CN_POP_KEY, 0.7);
  const fillPaint = () => hookFillPaint(CN_POP_KEY, ids.fill, { "fill-color": cnDensityColorExpr(level.value, isDark), "fill-opacity": clamp01(opacity) },
    { "fill-color": cnDensityColorExpr(level.value, isDark), "fill-opacity": def }, isDark);
  const seam = MAP_SEAM[isDark ? "dark" : "light"];
  const linePaint = () => hookLinePaint(CN_POP_KEY, ids.line, { "line-color": seam, "line-width": 0.5, "line-opacity": clamp01(opacity) },
    { "line-color": seam, "line-width": 0.5, "line-opacity": def }, isDark);
  useGbPmtilesLayers(mapRef, source, visible, () => [
    {
      id: ids.fill,
      layer: () => ({ id: ids.fill, type: "fill", source: source.id, "source-layer": level.value, minzoom: level.population[0],
        layout: { visibility: "none" }, paint: fillPaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.fill, fillPaint()),
    },
    {
      id: ids.line,
      layer: () => ({ id: ids.line, type: "line", source: source.id, "source-layer": level.value, minzoom: level.population[0],
        layout: { visibility: "none", ...hookLineLayout(CN_POP_KEY, ids.line) }, paint: linePaint() } as unknown as AnyLayer),
      update: (map) => setPaint(map, ids.line, linePaint()),
    },
  ], [opacity, isDark]);
}

/** 人口預設省級（國家全覽 z3.4 就有圖磚）。 */
export function useCnPopulationLayers(mapRef: MapRef, visible: boolean, opacity: number, levelIdx: number | undefined, isDark: boolean) {
  const access = useCnPrivateAccess(visible);
  const priv = access.allowed && access.userId ? privateSource("cn-population", access.userId) : UNMOUNTED;
  const level = levelAt(levelIdx, "province");
  const on = visible && access.allowed;
  usePopLevel(mapRef, 0, on && level === "province", opacity, isDark, priv);
  usePopLevel(mapRef, 1, on && level === "prefecture", opacity, isDark, priv);
  useRevokeCleanup(mapRef, access.allowed,
    Object.values(CN_POP_LAYER_IDS).flatMap((x) => [x.fill, x.line]), CN_ADMIN_LEVELS.map((lv) => `cn-population-${lv.value}`));
}

// ═════════════════════════ 人口網格（raster） ═════════════════════════

export const CN_POP_GRID_RASTER_ID = "cn-population-grid-raster";
const GRID_SOURCE_ID = "cn-population-grid";

export function useCnPopulationGridLayer(mapRef: MapRef, visible: boolean, opacity: number) {
  const access = useCnPrivateAccess(visible);
  const priv = access.allowed && access.userId ? privateSource("cn-population-grid", access.userId) : UNMOUNTED;
  const source: SourceSpec = {
    id: GRID_SOURCE_ID, file: "cn-population-grid", minzoom: 2, maxzoom: 8, raster: { tileSize: 256 }, private: priv,
    attribution: "GHS-POP R2023A E2025 © European Union（JRC，CC BY 4.0，模型值）", loading: "中國人口網格載入中",
  };
  useGbPmtilesLayers(mapRef, source, visible && access.allowed, () => [{
    id: CN_POP_GRID_RASTER_ID,
    layer: () => ({
      id: CN_POP_GRID_RASTER_ID, type: "raster", source: GRID_SOURCE_ID, minzoom: 2,
      layout: { visibility: "none" }, paint: { "raster-opacity": clamp01(opacity), "raster-fade-duration": 0 },
    } as unknown as AnyLayer),
    update: (map) => map.setPaintProperty(CN_POP_GRID_RASTER_ID, "raster-opacity", clamp01(opacity)),
    before: firstSymbolLayerId,
  }], [opacity]);
  useRevokeCleanup(mapRef, access.allowed, [CN_POP_GRID_RASTER_ID], [GRID_SOURCE_ID]);
}

// ═════════════════════════ 規格驅動 6 層 ═════════════════════════

/** 電廠狀態多選（預設運轉中＋興建中）。 */
export function cnPlantStatusFilter(mask: number | undefined): Expr | null {
  const ids = CN_PLANT_STATUSES.map((s) => s.id);
  const selected = mask === undefined || !Number.isFinite(mask) ? [...CN_PLANT_STATUS_DEFAULT] : selectedMultiSelectValues(mask, ids);
  if (selected.length === ids.length) return null;
  if (selected.length === 0) return NONE;
  return ["in", ["get", "status"], ["literal", selected]];
}
/** 電廠範圍：0＝全部、1＝只看再生能源（C090 子集）。 */
export function cnPlantScopeFilter(scopeIdx: number | undefined): Expr | null {
  return scopeIdx === 1 ? ["==", ["get", "renewable_c090"], true] : null;
}

function pointRadiusExpr(spec: CnLayerSpec, part: CnPart, scale: number): Expr | number {
  const k = scale / scaleDefault(spec.key);
  if (part.size) {
    const bands = part.size.bands;
    const step: unknown[] = ["step", ["to-number", ["get", part.size.prop], 0], bands[0]!.radius];
    for (const b of bands.slice(1)) step.push(b.min, b.radius);
    return ["*", step, k];
  }
  const sized = spec.cats.filter((c) => c.radius !== undefined && (!c.parts || c.parts.includes(part.id)));
  if (sized.length) {
    const m: unknown[] = ["match", part.cat.expr];
    for (const c of sized) m.push(c.values.length === 1 ? c.values[0] : [...c.values], c.radius);
    m.push(pointRadius("S"));
    return ["*", m, k];
  }
  return pointRadius(part.id === "cn-power-substations-circle" ? "S" : "M", k);
}

function pointPaint(spec: CnLayerSpec, part: CnPart, isDark: boolean, opacity: number, scale: number) {
  const op = clamp01(opacity);
  const def = opacityDefault(spec.key, 0.85);
  const base = { "circle-radius": pointRadiusExpr(spec, part, scale), "circle-color": phColorExpr(asPhSpec(spec), part), "circle-opacity": op, ...pointStrokePaint(isDark, op / def) };
  if (!part.ring) return base;
  // 描邊＝資料編碼（mapStyleScale POINT_STROKE_DATA_ENCODED）：符合者白框 2px，其餘底圖色細縫
  const theme = isDark ? "dark" : "light";
  return {
    ...base,
    "circle-stroke-color": ["case", part.ring.when, isDark ? "#ffffff" : "#111827", POINT_STROKE_DATA_ENCODED.color[theme]],
    "circle-stroke-width": ["case", part.ring.when, 2, 1],
    "circle-stroke-opacity": Math.min(1, POINT_STROKE_DATA_ENCODED.opacity[theme] * (op / def)),
  };
}

function lineWidthExpr(part: CnPart): Expr | number {
  if (!part.lineWidth) return ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 2];
  const at = (i: 0 | 1) => {
    const m: unknown[] = ["match", part.cat.expr];
    for (const [v, w] of Object.entries(part.lineWidth!)) m.push(v, w[i]);
    m.push(i === 0 ? 0.5 : 1);
    return m;
  };
  return ["interpolate", ["linear"], ["zoom"], 10, at(0), 14, at(1)];
}

function linePaint(spec: CnLayerSpec, part: CnPart, isDark: boolean, opacity: number) {
  const def = opacityDefault(spec.key, 0.85);
  const dash = part.dashed ? { "line-dasharray": [...LINE_DASH.general] } : {};
  const paint = hookLinePaint(spec.key, part.id,
    { "line-color": phColorExpr(asPhSpec(spec), part), "line-width": lineWidthExpr(part), "line-opacity": clamp01(opacity), ...dash },
    { "line-color": phColorExpr(asPhSpec(spec), part), "line-width": lineWidthExpr(part), "line-opacity": def, ...dash }, isDark);
  const lineOpacity = paint["line-opacity"];
  if (part.fadeWhen && typeof lineOpacity === "number") paint["line-opacity"] = ["case", part.fadeWhen, lineOpacity * 0.45, lineOpacity];
  return paint;
}

export const cnHeatmapId = (spec: CnLayerSpec) => `${spec.parts[0]!.id.replace(/-circle$/, "")}-heatmap`;
/** 子圖層所屬 source：有自己的 srcMaxzoom 者另開 `<sourceId>-z<maxzoom>`。 */
export const cnPartSourceId = (spec: CnLayerSpec, part: CnPart) => (part.srcMaxzoom && part.srcMaxzoom !== spec.srcMaxzoom ? `${spec.sourceId}-z${part.srcMaxzoom}` : spec.sourceId);
export const cnSpecSourceIds = (spec: CnLayerSpec) => [...new Set(spec.parts.map((p) => cnPartSourceId(spec, p)))];

function buildParts(spec: CnLayerSpec, parts: readonly CnPart[], sourceId: string, filters: readonly (Expr | null)[], o: { isDark: boolean; opacity: number; scale: number }): LayerBuild[] {
  const builds: LayerBuild[] = [];
  const def = opacityDefault(spec.key, 0.85);
  parts.forEach((part) => {
    const filter = filters[spec.parts.indexOf(part)] ?? null;
    const pointsFrom = spec.heat && part.geom === "point" ? densePointsFromZoom(spec.count, part.minzoom) : part.minzoom;
    if (spec.heat && part.geom === "point") {
      builds.push(gbHeatmapBuild({
        id: cnHeatmapId(spec), key: spec.key, sourceId, sourceLayer: part.sourceLayer, maxzoom: heatmapMaxzoom(pointsFrom), filter,
        isDark: o.isDark, opacityScale: clamp01(o.opacity) / def, intensity: spec.heat.intensity,
      }));
    }
    const base = { source: sourceId, "source-layer": part.sourceLayer, minzoom: pointsFrom, ...(filter ? { filter } : {}) };
    if (part.geom === "point") {
      builds.push({
        id: part.id,
        layer: () => ({ id: part.id, type: "circle", ...base, layout: { visibility: "none", ...(part.size ? { "circle-sort-key": ["-", 0, ["to-number", ["get", part.size.prop], 0]] } : {}) },
          paint: pointPaint(spec, part, o.isDark, o.opacity, o.scale) } as unknown as AnyLayer),
        update: (map) => { map.setFilter(part.id, (filter ?? null) as any); setPaint(map, part.id, pointPaint(spec, part, o.isDark, o.opacity, o.scale)); },
      });
      return;
    }
    builds.push({
      id: part.id,
      layer: () => ({ id: part.id, type: "line", ...base, layout: { visibility: "none", ...hookLineLayout(spec.key, part.id) }, paint: linePaint(spec, part, o.isDark, o.opacity) } as unknown as AnyLayer),
      update: (map) => { map.setFilter(part.id, (filter ?? null) as any); map.setPaintProperty(part.id, "line-opacity", linePaint(spec, part, o.isDark, o.opacity)["line-opacity"] as any); },
    });
  });
  return builds;
}

/** 規格驅動層：主 source 一個＋（電網變電所）第二個 source；`extraFilter`（電廠狀態、範圍）疊在所有子圖層上。 */
export function useCnDataLayer(mapRef: MapRef, spec: CnLayerSpec, visible: boolean, opacity: number, scale: number, isDark: boolean, catMask?: number, extraFilter?: Expr | null) {
  const access = useCnPrivateAccess(visible);
  const priv = access.allowed && access.userId ? privateSource(spec.asset, access.userId) : UNMOUNTED;
  const on = visible && access.allowed;
  const heatStyle = useHeatmapStyleSignature(spec.heat ? [spec.key] : []);
  const filters = spec.parts.map((part) => gbAllOf(part.filter, phPartCatFilter(asPhSpec(spec), part, catMask), extraFilter ?? null));
  const mainParts = spec.parts.filter((p) => cnPartSourceId(spec, p) === spec.sourceId);
  const extraParts = spec.parts.filter((p) => cnPartSourceId(spec, p) !== spec.sourceId);
  const extra = extraParts[0];
  const mainSource: SourceSpec = { id: spec.sourceId, file: spec.asset, minzoom: spec.srcMinzoom, maxzoom: spec.srcMaxzoom, attribution: spec.sourceOrg, loading: spec.loading.zh, private: priv };
  const extraSource: SourceSpec = extra
    ? { id: cnPartSourceId(spec, extra), file: spec.asset, minzoom: Math.min(...extraParts.map((p) => p.minzoom)), maxzoom: extra.srcMaxzoom!, attribution: spec.sourceOrg, loading: spec.loading.zh, private: priv }
    : { ...mainSource, id: `${spec.sourceId}-unused` };
  const o = { isDark, opacity, scale };
  const deps = [spec.key, opacity, scale, isDark, heatStyle, sig(filters)];
  useGbPmtilesLayers(mapRef, mainSource, on, () => buildParts(spec, mainParts, mainSource.id, filters, o), deps);
  useGbPmtilesLayers(mapRef, extraSource, on && !!extra, () => buildParts(spec, extraParts, extraSource.id, filters, o), deps);
  useRevokeCleanup(mapRef, access.allowed, [...(spec.heat ? [cnHeatmapId(spec)] : []), ...spec.parts.map((p) => p.id)], cnSpecSourceIds(spec));
}
