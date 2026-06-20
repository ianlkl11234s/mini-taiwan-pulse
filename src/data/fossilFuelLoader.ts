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
  for (const r of rows) {
    const feKey = (FOSSIL_LAYER_MAP as Record<string, FossilLayerKey | undefined>)[r.layer];
    if (!feKey) continue;
    const f = rowToFeature(r);
    if (!f) continue;
    out[feKey].features.push(f);
  }

  const counts = Object.entries(out).map(([k, v]) => `${k}=${v.features.length}`).join(" ");
  console.log(
    `[FossilFuel] loaded ${rows.length} rows in ${(performance.now() - t0).toFixed(0)}ms · ${counts}`,
  );
  return out;
}
