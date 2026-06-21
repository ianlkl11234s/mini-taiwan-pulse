import { withLoading } from "../lib/loadingRegistry";

/**
 * 雲林 POC 覆蓋分析 5 圖層 — 30km 路網可達 isochrone 結果。
 *
 * 由 taipei-gis-analytics/scripts/road_isochrone/yunlin_poc.py 預先算好（OSRM /table
 * grid sample + shapely concave_hull），輸出靜態 GeoJSON 放在 public/coverage/。
 *
 * 5 個 layer key → 5 個檔案，命中時各自 fetch 一次後 in-memory cache 30 min。
 */

export type CoverageKey =
  | "gasCoverageAll"
  | "gasCoverageCpc"
  | "gasCoverageFpcc"
  | "gasCoverageTaisugar"
  | "evIsland";

const FILE_OF: Record<CoverageKey, string> = {
  gasCoverageAll: "/coverage/yunlin_all_density_hex.geojson",
  gasCoverageCpc: "/coverage/yunlin_cpc_30km.geojson",
  gasCoverageFpcc: "/coverage/yunlin_fpcc_30km.geojson",
  gasCoverageTaisugar: "/coverage/yunlin_taisugar_30km.geojson",
  evIsland: "/coverage/yunlin_ev_island_hex.geojson",
};

const LABEL_OF: Record<CoverageKey, string> = {
  gasCoverageAll: "雲林 加油站總覆蓋密度",
  gasCoverageCpc: "雲林 中油 30km 可達",
  gasCoverageFpcc: "雲林 台塑 30km 可達",
  gasCoverageTaisugar: "雲林 台糖 30km 可達",
  evIsland: "雲林 充電站 30km 孤島",
};

const CACHE_TTL_MS = 30 * 60_000;

interface Entry {
  data: GeoJSON.FeatureCollection;
  at: number;
}
const cache = new Map<CoverageKey, Entry>();
const inflight = new Map<CoverageKey, Promise<GeoJSON.FeatureCollection>>();

const EMPTY_FC = (): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: [] });

export async function fetchCoverageLayer(key: CoverageKey): Promise<GeoJSON.FeatureCollection> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.data;
  const pending = inflight.get(key);
  if (pending) return pending;

  const url = FILE_OF[key];
  const p = withLoading(`coverage:${key}`, LABEL_OF[key], (async () => {
    const t0 = performance.now();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
      const fc = (await res.json()) as GeoJSON.FeatureCollection;
      cache.set(key, { data: fc, at: Date.now() });
      console.log(
        `[Coverage] ${key} loaded ${fc.features?.length ?? 0} features in ${(performance.now() - t0).toFixed(0)}ms`,
      );
      return fc;
    } catch (err) {
      console.warn(`[Coverage] ${key} load failed:`, err);
      return EMPTY_FC();
    }
  })());

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}
