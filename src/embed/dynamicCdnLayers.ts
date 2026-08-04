/**
 * 「動態但已 CDN 化」的圖層（EM-14 / Phase A）
 *
 * 背景：有一批圖層在 `overlayRegistry` 標成 `dynamicData: true`（source 由 loader setData
 * 餵入），但它們的資料其實**不會動** —— 是設施位置，只是走 RPC 讀。`static-to-cdn`
 * 已把它們的 RPC 輸出匯成 `/static-rpc/<rpc>.json` 快照（見 docs/features/static-to-cdn）。
 *
 * 所以 embed 不必打 Supabase，只要讀那份 CDN 快照即可 → **成本仍是 $0**。
 *
 * ⚠️ 這份表是**明確白名單，不是規則**：每加一層都代表「我確認過這層的快照存在且不會動」。
 *    gated 圖層即使有快照也不會進來（`embedWhitelist` 會再擋一次）。
 */
import type { LayerVisibility } from "../types";

/** layer key → static-rpc 快照名（= RPC 名，檔案為 `/static-rpc/<name>.json`） */
export const EMBED_CDN_LAYERS: Readonly<Partial<Record<keyof LayerVisibility, string>>> = {
  osmWindTurbines: "get_osm_wind_turbines",
  osmSolarFarms: "get_osm_solar_farms",
  offshoreWindZones: "get_offshore_wind_zones",
  geothermalWells: "get_geothermal_wells",
  evChargingStations: "get_ev_charging_stations",
  islandPowerGrid: "get_island_power_grid",
  renewablePermitsTaipei: "get_renewable_permits_taipei",
  // gasStation* 5 層待補：loader 已用 staticRpc("get_gas_station_layers")，
  // 但 public/static-rpc/ 尚無該檔（一直靜默 fallback 打 RPC）。補產快照後再加進來。
};

export const EMBED_CDN_KEYS = Object.keys(EMBED_CDN_LAYERS) as (keyof LayerVisibility)[];

type Row = Record<string, unknown>;

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * RPC row array → GeoJSON。
 *
 * 主站每層各有一支客製 `xxxToGeoJSON`（挑特定 properties），但它們的**幾何來源只有兩種**：
 * `geom_json` 欄位，或 `lon`/`lat` 組成的 Point。這裡用通用版吃下兩者，
 * properties 則全帶（多帶欄位對 paint/filter 無害，popup 反而資料更全）。
 *
 * 刻意不 import 主站的 transform：那些函式住在 `useEnergyPoiLayer.ts`（799 行、含 React hook），
 * 為了 7 個圖層把整檔拉進 embed bundle 不划算。
 */
export function rowsToGeoJSON(rows: unknown): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (!Array.isArray(rows)) return { type: "FeatureCollection", features };

  for (const raw of rows as Row[]) {
    if (!raw || typeof raw !== "object") continue;

    let geometry: GeoJSON.Geometry | null = null;
    const geomJson = raw.geom_json;
    if (geomJson && typeof geomJson === "object") {
      geometry = geomJson as GeoJSON.Geometry;
    } else if (isFiniteNum(raw.lon) && isFiniteNum(raw.lat)) {
      geometry = { type: "Point", coordinates: [raw.lon, raw.lat] };
    }
    if (!geometry) continue;

    const properties: Row = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k === "geom_json") continue;          // 幾何不重複塞進 properties
      properties[k] = v ?? null;                 // undefined 會被 Mapbox filter 當成缺欄位
    }
    features.push({ type: "Feature", geometry, properties });
  }
  return { type: "FeatureCollection", features };
}

/**
 * 載入一層的 CDN 快照。**只讀靜態檔，任何情況都不 fallback 到 Supabase**
 * —— 主站的 `staticRpc()` 會 fallback（rollout 安全網），但 embed 不行：
 * 那會讓別人文章的流量變成你的 DB egress。快照不存在就視同該層不可用。
 */
export async function fetchCdnLayer(rpcName: string): Promise<GeoJSON.FeatureCollection | null> {
  try {
    const res = await fetch(`/static-rpc/${rpcName}.json`);
    if (!res.ok) return null;
    return rowsToGeoJSON(await res.json());
  } catch {
    return null;
  }
}
