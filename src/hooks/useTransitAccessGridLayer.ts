/**
 * 雙北大眾運輸可及性「網格指標」圖層 hook（模擬面板，公開）：H3 res9 一般 fill。
 *
 * - 切類別／時段／公車版本：載入該組檔（near／count／arg）→ 目前類別的原始值寫進 properties → setData（一次）。
 * - 切指標／分位數／門檻滑桿／開車基準：**只改 paint expression**（三級分區、比值、深夜比例都在 expression 裡算），
 *   拖滑桿不重建 GeoJSON。
 * - 不可達（120 分內到不了）是結果、不是缺資料：中性灰，不當 0。
 */
import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { loadH3 } from "../map/h3Runtime";
import { keepLoadingUntilMapIdle, withLoading } from "../lib/loadingRegistry";
import { reportSimBundleError } from "../data/simBundle";
import {
  loadTransitAccessGridBase, loadTransitAccessSlot, setTransitAccessGridNotice, setTransitAccessGridState,
  type TransitAccessGridBase,
} from "../data/transitAccessStore";
import {
  COMPARE_METRICS, NIGHT_COLORS, PUOR, PUOR_NEG, PUOR_POS, TIER_COLORS, TRANSIT_ACCESS_NA, TRANSIT_ACCESS_SLUG, TRANSIT_ACCESS_UNREACHED_COLOR,
  countColors, gridClassification, nearColors, spreadColors,
  type TransitAccessClassification, type TransitAccessGroup, type TransitAccessMetric, type TransitAccessNetwork, type TransitAccessSlot, type TierSettings,
} from "../data/transitAccessTypes";
import { useMapReadyTick } from "./useMapReadyTick";

export const TRANSIT_ACCESS_GRID_IDS = { fill: "transit-access-grid-fill", outline: "transit-access-grid-outline" } as const;
const SRC = "transit-access-grid-src";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export interface TransitAccessGridControls {
  group: TransitAccessGroup;
  slot: TransitAccessSlot;
  network: TransitAccessNetwork;
  metric: TransitAccessMetric;
  /** 分位數（5／25／50／75／95） */
  pct: number;
  /** 據點數的時間門檻（30／45／60） */
  countTh: number;
  /** 已依類別預設補齊的三級門檻與開車基準 */
  tier: TierSettings;
  /** 時間內可達比例的 T（分） */
  nightT: number;
}

// ══════════════════════════════════════════════════════════════════
//  paint expression（純函式，測試與圖例共用）
// ══════════════════════════════════════════════════════════════════

type Expr = ExpressionSpecification;
const get = (p: string) => ["get", p] as unknown as Expr;
const has = (p: string) => ["==", ["typeof", ["get", p]], "number"] as unknown as Expr;
function stepExpr(input: unknown, colors: readonly string[], breaks: readonly number[]): Expr {
  const s: unknown[] = ["step", input, colors[0]!];
  breaks.forEach((b, k) => s.push(b, colors[k + 1]!));
  return s as unknown as Expr;
}
const carExpr = (s: TierSettings, cls: TransitAccessClassification) => ["+", ["/", get("car"), s.peak ? cls.peakFactor : 1], s.overhead];

/** 三級分區（字串 ok／edge／dep），prefix＝p（主檔）或 s（表定） */
export function tierExpr(prefix: "p" | "s", pct: number, s: TierSettings, cls: TransitAccessClassification): Expr {
  const p = `${prefix}${pct}`;
  return ["case",
    ["!", has(p)], "dep",
    ["<=", get(p), s.a], "ok",
    [">", get(p), s.b], "dep",
    ["all", has("car"), [">", ["/", get(p), carExpr(s, cls)], s.r]], "dep",
    "edge"] as unknown as Expr;
}

const tierRank = (e: Expr) => ["match", e, "ok", 0, "edge", 1, 2];
/** 差值（GPS−表定）分 7 色：|d| ≤ tol 中性；與原型 p2.html cmpRgb 相同界 */
function divergeExpr(d: unknown, tol: number): Expr {
  const t = Math.max(0, Math.min(8, tol));
  return ["step", d, PUOR_NEG[0], -19, PUOR_NEG[1], -9, PUOR_NEG[2], -t, TRANSIT_ACCESS_UNREACHED_COLOR, t + 1, PUOR_POS[0], 10, PUOR_POS[1], 20, PUOR_POS[2]] as unknown as Expr;
}

export interface GridPaint { color: Expr; opacity: Expr }

/** 目前控制項 → fill-color／fill-opacity */
export function gridPaint(c: TransitAccessGridControls, cls: TransitAccessClassification, opacity: number): GridPaint {
  const o = Math.max(0, Math.min(1, opacity));
  const dim = 0.35 * o;
  const p = `p${c.pct}`, s = `s${c.pct}`;
  if (c.network === "cmp") {
    const metric = COMPARE_METRICS.includes(c.metric) ? c.metric : "near";
    if (metric === "tier") {
      const d = ["-", tierRank(tierExpr("p", c.pct, c.tier, cls)), tierRank(tierExpr("s", c.pct, c.tier, cls))];
      return {
        color: ["match", d, -2, PUOR_NEG[0], -1, PUOR_NEG[1], 0, TRANSIT_ACCESS_UNREACHED_COLOR, 1, PUOR_POS[1], PUOR_POS[2]] as unknown as Expr,
        opacity: ["case", ["==", d, 0], dim, o] as unknown as Expr,
      };
    }
    if (metric === "spread") {
      const both = ["all", has("p5"), has("p95"), has("s5"), has("s95")];
      const d = ["-", ["-", get("p95"), get("p5")], ["-", get("s95"), get("s5")]];
      return {
        color: ["case", both, divergeExpr(d, cls.compareTol), TRANSIT_ACCESS_UNREACHED_COLOR] as unknown as Expr,
        opacity: ["case", ["all", ["!", has("p5")], ["!", has("s5")]], 0, both, ["case", ["<=", ["abs", d], cls.compareTol], dim, o], o] as unknown as Expr,
      };
    }
    // near：只有一版到得了＝視為差無限大（最深色）
    const d = ["-", ["coalesce", get(p), 999], ["coalesce", get(s), 999]];
    return {
      color: divergeExpr(d, cls.compareTol),
      opacity: ["case", ["all", ["!", has(p)], ["!", has(s)]], 0, ["<=", ["abs", d], cls.compareTol], dim, o] as unknown as Expr,
    };
  }
  switch (c.metric) {
    case "count": {
      const prop = `c${c.countTh}`;
      return { color: stepExpr(get(prop), countColors(cls.countBreaks.length + 1), cls.countBreaks), opacity: ["case", [">", get(prop), 0], o, dim] as unknown as Expr };
    }
    case "spread":
      return {
        color: ["case", ["all", has("p5"), has("p95")], stepExpr(["-", get("p95"), get("p5")], spreadColors(cls.spreadBreaks.length + 1), cls.spreadBreaks),
          has("p5"), spreadColors(cls.spreadBreaks.length + 1)[cls.spreadBreaks.length]!, TRANSIT_ACCESS_UNREACHED_COLOR] as unknown as Expr,
        opacity: ["case", has("p5"), o, dim] as unknown as Expr,
      };
    case "ratio":
      return {
        color: ["case", ["all", has(p), has("car")], stepExpr(["/", get(p), carExpr(c.tier, cls)], PUOR, cls.ratioBreaks), TRANSIT_ACCESS_UNREACHED_COLOR] as unknown as Expr,
        opacity: ["case", ["all", has(p), has("car")], o, dim] as unknown as Expr,
      };
    case "tier":
      return { color: ["match", tierExpr("p", c.pct, c.tier, cls), "ok", TIER_COLORS.ok, "edge", TIER_COLORS.edge, TIER_COLORS.dep] as unknown as Expr, opacity: o as unknown as Expr };
    case "night": {
      const bucket: unknown[] = ["case"];
      [95, 75, 50, 25, 5].forEach((q, k) => bucket.push(["all", has(`p${q}`), ["<=", get(`p${q}`), c.nightT]], 5 - k));
      bucket.push(0);
      return { color: ["match", bucket, 5, NIGHT_COLORS[5], 4, NIGHT_COLORS[4], 3, NIGHT_COLORS[3], 2, NIGHT_COLORS[2], 1, NIGHT_COLORS[1], NIGHT_COLORS[0]] as unknown as Expr, opacity: o as unknown as Expr };
    }
    default:
      return {
        color: ["case", has(p), stepExpr(get(p), nearColors(cls.nearBreaks.length + 1), cls.nearBreaks), TRANSIT_ACCESS_UNREACHED_COLOR] as unknown as Expr,
        opacity: ["case", has(p), o, dim] as unknown as Expr,
      };
  }
}

// ══════════════════════════════════════════════════════════════════
//  GeoJSON
// ══════════════════════════════════════════════════════════════════

/** 每格 Polygon（只建一次）；properties 依類別／時段／版本另外填 */
export function buildCellFeatures(h3: readonly string[], cellToBoundary: (id: string, geoJson: boolean) => number[][]): GeoJSON.Feature<GeoJSON.Polygon>[] {
  return h3.map((id, i) => {
    const ring = cellToBoundary(id, true);
    ring.push(ring[0]!);
    return { type: "Feature", id: i, properties: { i }, geometry: { type: "Polygon", coordinates: [ring] } };
  });
}

/** 目前類別的原始值：p<pct>／s<pct>（分；不可達不寫）、c<T>（據點數）、car（開車分；不可達不寫） */
export function fillCellProperties(
  features: GeoJSON.Feature[], base: TransitAccessGridBase, groupIdx: number,
  main: { near: Uint8Array; count: Uint16Array }, sched: { near: Uint8Array } | null,
): void {
  const { meta } = base;
  const n = base.cells.h3.length, P = meta.percentiles.length, T = meta.thresholds.length;
  for (let i = 0; i < n; i++) {
    const props: Record<string, number> = { i };
    meta.percentiles.forEach((q, k) => {
      const v = main.near[(groupIdx * P + k) * n + i]!;
      if (v !== TRANSIT_ACCESS_NA) props[`p${q}`] = v;
      if (sched) { const w = sched.near[(groupIdx * P + k) * n + i]!; if (w !== TRANSIT_ACCESS_NA) props[`s${q}`] = w; }
    });
    meta.thresholds.forEach((t, k) => { props[`c${t}`] = main.count[(groupIdx * T + k) * n + i]!; });
    const car = base.car[groupIdx * n + i]!;
    if (car !== TRANSIT_ACCESS_NA) props.car = car;
    features[i]!.properties = props;
  }
}

function removeAll(map: MapboxMap) {
  for (const id of [TRANSIT_ACCESS_GRID_IDS.outline, TRANSIT_ACCESS_GRID_IDS.fill]) { try { if (map.getLayer(id)) map.removeLayer(id); } catch { /* style replaced */ } }
  try { if (map.getSource(SRC)) map.removeSource(SRC); } catch { /* style replaced */ }
}

export function useTransitAccessGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  controls: TransitAccessGridControls,
  isDark = true,
) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const [base, setBase] = useState<TransitAccessGridBase | null>(null);
  const [features, setFeatures] = useState<GeoJSON.Feature<GeoJSON.Polygon>[] | null>(null);
  /** 目前 properties 對應的組合（類別|版本|時段）；資料換了才 bump，觸發 setData */
  const [dataRevision, setDataRevision] = useState(0);
  const [mountRevision, setMountRevision] = useState(0);
  const latest = useRef({ controls, opacity });
  latest.current = { controls, opacity };

  // 基本檔＋幾何（h3 延遲載入）：第一次開圖層才抓
  useEffect(() => {
    if (!visible || (base && features)) return;
    let cancelled = false;
    loadTransitAccessGridBase().then((b) => withLoading("transit-access-grid-geometry", "雙北大眾運輸可及性網格幾何", loadH3().then((h3) => {
      if (cancelled) return;
      setFeatures(buildCellFeatures(b.cells.h3, (id, g) => h3.cellToBoundary(id, g)));
      setBase(b);
    }))).catch((error: unknown) => { if (!cancelled) reportSimBundleError(TRANSIT_ACCESS_SLUG, "grid", error); });
    return () => { cancelled = true; };
  }, [visible, base, features]);

  // 類別／時段／版本：載入該組檔 → 寫 properties
  const { group, slot, network } = controls;
  useEffect(() => {
    if (!visible || !base || !features) return;
    const needed = network === "cmp" ? ["observed", "scheduled"] : [network];
    const missing = needed.filter((net) => !base.meta.done.has(`${net}/${slot}`));
    if (missing.length) {
      setTransitAccessGridNotice(`${missing.join("、")}/${slot}`);
      setTransitAccessGridState(null);
      for (const f of features) f.properties = { i: f.properties!.i };
      setDataRevision((r) => r + 1);
      return;
    }
    setTransitAccessGridNotice(null);
    let cancelled = false;
    Promise.all(needed.map((net) => loadTransitAccessSlot(base, net, slot))).then(([main, sched]) => {
      if (cancelled) return;
      const g = base.meta.groups.indexOf(group);
      if (g < 0) throw new Error(`bundle 沒有類別 ${group}`);
      fillCellProperties(features, base, g, main!, network === "cmp" ? sched! : null);
      setTransitAccessGridState({ base, network, slot, main: main!, sched: network === "cmp" ? sched! : null });
      setDataRevision((r) => r + 1);
    }).catch((error: unknown) => {
      if (!cancelled) { setTransitAccessGridState(null); reportSimBundleError(TRANSIT_ACCESS_SLUG, "grid slot", error); }
    });
    return () => { cancelled = true; };
  }, [visible, base, features, group, slot, network]);

  // 關圖層：清掉圖例／popup 用的狀態
  useEffect(() => { if (!visible) { setTransitAccessGridState(null); setTransitAccessGridNotice(null); } }, [visible]);

  // source／layer：關閉就拆，換底圖（style.load）重建
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const mount = () => {
      if (!visible || !base || !features) { removeAll(map); return; }
      if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: "geojson", data: EMPTY });
        keepLoadingUntilMapIdle(map, `${SRC}:render`, "雙北大眾運輸可及性網格繪製中", SRC);
      }
      const paint = gridPaint(latest.current.controls, gridClassification(base.bundle.manifest), latest.current.opacity);
      if (!map.getLayer(TRANSIT_ACCESS_GRID_IDS.fill)) map.addLayer({
        id: TRANSIT_ACCESS_GRID_IDS.fill, type: "fill", source: SRC,
        paint: { "fill-color": paint.color, "fill-opacity": paint.opacity },
      });
      if (!map.getLayer(TRANSIT_ACCESS_GRID_IDS.outline)) map.addLayer({
        id: TRANSIT_ACCESS_GRID_IDS.outline, type: "line", source: SRC, minzoom: 11,
        paint: { "line-color": isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.2)", "line-width": 0.5 },
      });
      setMountRevision((r) => r + 1);
    };
    mount(); map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, visible, base, features, mapTick, isDark]);

  useEffect(() => () => { const map = mapRef.current; if (map) removeAll(map); }, [mapRef, mapTick]);

  // 資料：properties 換了才 setData
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible || !features) return;
    (map.getSource(SRC) as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  }, [mapRef, visible, features, dataRevision, mountRevision, mapTick]);

  // 指標／分位數／門檻／透明度：只改 paint
  const t = controls.tier;
  useEffect(() => {
    const map = mapRef.current; if (!map || !visible || !base || !map.getLayer(TRANSIT_ACCESS_GRID_IDS.fill)) return;
    const paint = gridPaint(latest.current.controls, gridClassification(base.bundle.manifest), opacity);
    map.setPaintProperty(TRANSIT_ACCESS_GRID_IDS.fill, "fill-color", paint.color);
    map.setPaintProperty(TRANSIT_ACCESS_GRID_IDS.fill, "fill-opacity", paint.opacity);
    map.setPaintProperty(TRANSIT_ACCESS_GRID_IDS.outline, "line-color", isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.2)");
  }, [mapRef, visible, base, controls.metric, controls.network, controls.pct, controls.countTh, controls.nightT, t.a, t.b, t.r, t.overhead, t.peak, opacity, isDark, mountRevision, mapTick]);
}
