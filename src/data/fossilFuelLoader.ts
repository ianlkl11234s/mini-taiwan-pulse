import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 化石燃料 13 layer 資料載入器。
 *
 * 後端：public.get_fossil_fuel_layers() — gis-platform commit cf12bde
 *   回 13 layer / ~7,730 rows / 86ms，欄位：
 *     layer (text)、id、name、attrs (jsonb)、source_code、source_org、source_url、
 *     license、source_tier、fetched_at、provenance (jsonb canonical SSOT 有)、
 *     geom_json (已 ST_AsGeoJSON cast)
 *
 * 一次 fetch 後 group-by layer 拆 14 個 FeatureCollection（SSOT canonical 3 個 + 子品牌 4 個 + 其他 7 個），
 * 對應前端 13 個 toggle。fetched FC 30 min cache，任一 visible 才觸發 fetch。
 */

/** 後端 RPC 的 layer key → 前端 LayerVisibility key（13 個 toggle，14 個 RPC layer） */
export const FOSSIL_LAYER_MAP = {
  gas_station_cpc: "gasStationCpc",
  gas_station_fpcc: "gasStationFpcc",
  gas_station_taisugar: "gasStationTaisugar",
  gas_station_other: "gasStationOther",
  gas_station_canonical: "gasStationCanonical",
  lpg_subpackaging: "lpgSubpackaging",
  lpg_retailers: "lpgRetailers",
  lng_terminal: "lngTerminal",
  pipeline_gas: "pipelineGas",
  pipeline_oilgas: "pipelineOilGas",
  industrial_refinery: "industrialRefinery",
  industrial_storage_tank: "industrialStorageTank",
  industrial_power_plant: "industrialPowerPlant",
  coal_terminal: "coalTerminal",
} as const;

export type FossilLayerKey = (typeof FOSSIL_LAYER_MAP)[keyof typeof FOSSIL_LAYER_MAP];

interface RawRow {
  layer: string;
  id: number;
  name: string | null;
  attrs: Record<string, unknown> | null;
  source_code: string | null;
  source_org: string | null;
  source_url: string | null;
  license: string | null;
  source_tier: number | null;
  fetched_at: string | null;
  provenance: unknown;
  geom_json: GeoJSON.Geometry | string | null;
}

export type FossilFuelLayers = Record<FossilLayerKey, GeoJSON.FeatureCollection>;

const EMPTY_FC = (): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: [] });

function emptyAll(): FossilFuelLayers {
  const out = {} as FossilFuelLayers;
  for (const k of Object.values(FOSSIL_LAYER_MAP)) {
    out[k] = EMPTY_FC();
  }
  return out;
}


const TRUE_REFINERY_CHEMICAL_NAME_ALLOWLIST = new Set([
  "林園產業園區",        // 高雄林園石化聚落（OSM 以園區 polygon 呈現）
  "台塑麥寮六輕工業區",  // 麥寮六輕石化園區
  "大林煉油廠",
  "亞東石化觀音一廠",
  "天弘化學 台中廠",
  "台塑石化彰濱摻配廠",
  "台塑石化麥寮煉油廠",
  "長春石化",
  "中油桃園煉油廠",
  "台塑仁武廠區",
  "聯豐精密 台中廠",   // OSM industrial=chemical（真化工廠，名稱無關鍵字會被規則誤殺，白名單補回）
]);

const INDUSTRIAL_REFINERY_EXCLUDE_RE = /(加油站|漁船加油|油庫|油槽|儲油|儲槽|儲運|庫區|材料庫|倉庫|供油|供輸|供氣|配氣|接收站|天然氣|發電廠|電廠|研究所|訓練中心|服務中心|營業部|工程處|管線處|探採|鑽探|油井|井場|交通|貨運|汽車|紙業|糖廠|生技|海洋基礎|資源莊|航空汽油中心|注儲)/;
const INDUSTRIAL_REFINERY_INCLUDE_RE = /(煉油|石化|化學|化工|塑化)/;

function isTrueRefineryChemicalPlant(r: RawRow): boolean {
  const name = (r.name ?? "").trim();
  if (!name) return false;
  if (TRUE_REFINERY_CHEMICAL_NAME_ALLOWLIST.has(name)) return true;
  if (INDUSTRIAL_REFINERY_EXCLUDE_RE.test(name)) return false;
  return INDUSTRIAL_REFINERY_INCLUDE_RE.test(name);
}

function parseGeom(g: GeoJSON.Geometry | string | null): GeoJSON.Geometry | null {
  if (g == null) return null;
  if (typeof g === "string") {
    try {
      return JSON.parse(g) as GeoJSON.Geometry;
    } catch {
      return null;
    }
  }
  return g;
}

/** industrial polygon 3 層加 halo point（centroid）讓低 zoom 也看得到。 */
const HALO_LAYERS = new Set<FossilLayerKey>([
  "industrialRefinery",
  "industrialStorageTank",
  "industrialPowerPlant",
]);

function centroidOf(geom: GeoJSON.Geometry): [number, number] | null {
  let ring: number[][] | null = null;
  if (geom.type === "Polygon") ring = geom.coordinates[0] ?? null;
  else if (geom.type === "MultiPolygon") ring = geom.coordinates[0]?.[0] ?? null;
  if (!ring || ring.length === 0) return null;
  let lng = 0, lat = 0;
  for (const c of ring) { lng += c[0] ?? 0; lat += c[1] ?? 0; }
  return [lng / ring.length, lat / ring.length];
}

function rowToFeature(r: RawRow): GeoJSON.Feature | null {
  const geom = parseGeom(r.geom_json);
  if (!geom) return null;
  const attrs = (r.attrs ?? {}) as Record<string, unknown>;
  // provenance 平鋪到 top-level（SourceFooter 直接讀 props.provenance）
  const properties: Record<string, unknown> = {
    ...attrs,
    id: r.id,
    name: r.name ?? "",
    source: r.source_code ?? "",   // SourceFooter 用 source 也能取
    source_code: r.source_code ?? "",
    source_org: r.source_org ?? "",
    source_url: r.source_url ?? "",
    license: r.license ?? "",
    source_tier: r.source_tier,
    fetched_at: r.fetched_at ?? "",
    provenance: r.provenance ?? null,
  };
  return { type: "Feature", geometry: geom, properties };
}

/** 載入化石燃料 13 layer。一次 RPC + client-side group by layer。 */
export async function fetchFossilFuelLayers(): Promise<FossilFuelLayers> {
  const t0 = performance.now();
  const { data, error } = await withLoading(
    "fossilFuel:all",
    "化石燃料 13 圖層",
    supabase.rpc("get_fossil_fuel_layers"),
  );
  if (error) throw new Error(`get_fossil_fuel_layers: ${error.message}`);

  const out = emptyAll();
  const rows = (data ?? []) as RawRow[];
  let industrialRefineryRaw = 0;
  let industrialRefineryKept = 0;
  for (const r of rows) {
    const feKey = (FOSSIL_LAYER_MAP as Record<string, FossilLayerKey | undefined>)[r.layer];
    if (!feKey) continue;
    if (feKey === "industrialRefinery") {
      industrialRefineryRaw += 1;
      if (!isTrueRefineryChemicalPlant(r)) continue;
      industrialRefineryKept += 1;
    }
    const f = rowToFeature(r);
    if (!f) continue;
    out[feKey].features.push(f);
    // industrial polygon 3 層：補一個 centroid point feature (properties._halo=true) 給 halo circle layer 用
    if (HALO_LAYERS.has(feKey)) {
      const c = centroidOf(f.geometry);
      if (c) {
        out[feKey].features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: c },
          properties: { _halo: true, id: r.id, name: r.name ?? "" },
        });
      }
    }
  }

  const counts = Object.entries(out).map(([k, v]) => `${k}=${v.features.length}`).join(" ");
  console.log(
    `[FossilFuel] loaded ${rows.length} rows in ${(performance.now() - t0).toFixed(0)}ms · ${counts}` +
    ` · industrialRefinery filtered ${industrialRefineryRaw}→${industrialRefineryKept} polygons`,
  );
  return out;
}
