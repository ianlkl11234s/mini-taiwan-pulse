import { fetchOwnerJson } from "../lib/ownerData";
import { slaughterKind } from "./livestockTypes";

/**
 * 畜牧 owner-only 載入器（見 docs/features/owner-gated-layers）。
 *
 * 2026-11-08 起改讀站主私人檔（owner-data 家族，coral-private sidecar 驗站主後回 Range），
 * 取代原本的 owner-only Supabase RPC。檔案內容就是原 RPC 的完整輸出（GeoJSON FeatureCollection）：
 *   - livestock-farms           ← public.get_livestock_farms()
 *   - livestock-slaughterhouses ← public.get_livestock_slaughterhouses()
 * properties 不變（farms：證號/場名/縣市/主畜種/總隻數/種類明細/段/地號/定位來源/精度；
 * slaughter：場名/種類/來源/地址/geocode_type），故 overlayRegistry paint/filter、popup、legend 全不變。
 * 非 owner 前端 toggle 已擋（不會呼叫本檔）；sidecar 端非站主一律 401／403。
 */

export async function fetchLivestockFarms(): Promise<GeoJSON.FeatureCollection> {
  return fetchOwnerJson<GeoJSON.FeatureCollection>("livestock-farms", "livestock:farms", "畜禽飼養場");
}

export async function fetchLivestockSlaughterhouses(): Promise<GeoJSON.FeatureCollection> {
  const fc = await fetchOwnerJson<GeoJSON.FeatureCollection>("livestock-slaughterhouses", "livestock:slaughter", "屠宰場");
  // V-4 類別篩選用：由「種類」首字衍生家畜／家禽（與圖例、paint 判定同一份 slaughterKind）
  for (const f of fc.features) {
    if (f.properties) f.properties.kind = slaughterKind(f.properties["種類"]);
  }
  return fc;
}
