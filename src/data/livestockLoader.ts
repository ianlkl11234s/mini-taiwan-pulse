import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";

/**
 * 畜牧 owner-only 動態載入器（見 docs/features/owner-gated-layers）。
 *
 * 原本走靜態 `./agriculture/livestock_farms.geojson` / `slaughterhouses.geojson`（公開 CDN），
 * 改為 owner-only Supabase RPC：
 *   - public.get_livestock_farms()           → GeoJSON FeatureCollection（jsonb）
 *   - public.get_livestock_slaughterhouses() → GeoJSON FeatureCollection（jsonb）
 * properties 與原靜態檔完全相同（farms：證號/場名/縣市/主畜種/總隻數/種類明細/段/地號/定位來源/精度；
 * slaughter：場名/種類/來源/地址/geocode_type），故 overlayRegistry paint/filter、popup、legend 全不變。
 *
 * migration 275 對這兩支 RPC 加 owner 檢查 + REVOKE anon；非 owner 前端 toggle 已擋（不會呼叫本檔）。
 */

const EMPTY_FC = (): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features: [] });

export async function fetchLivestockFarms(): Promise<GeoJSON.FeatureCollection> {
  const { data, error } = await withLoading(
    "livestock:farms",
    "畜禽飼養場",
    supabase.rpc("get_livestock_farms"),
  );
  if (error) throw new Error(`get_livestock_farms: ${error.message}`);
  return (data ?? EMPTY_FC()) as unknown as GeoJSON.FeatureCollection;
}

export async function fetchLivestockSlaughterhouses(): Promise<GeoJSON.FeatureCollection> {
  const { data, error } = await withLoading(
    "livestock:slaughter",
    "屠宰場",
    supabase.rpc("get_livestock_slaughterhouses"),
  );
  if (error) throw new Error(`get_livestock_slaughterhouses: ${error.message}`);
  return (data ?? EMPTY_FC()) as unknown as GeoJSON.FeatureCollection;
}
