import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { GB_EA_POLLUTION_RPC } from "./gbEnvPlanningTypes";

/**
 * 英格蘭 EA Pollution Inventory 2024 申報場址（站主限定，見 docs/features/owner-gated-layers）。
 *
 * public.get_gb_ea_pollution_inventory() → jsonb
 *   { type: "FeatureCollection", meta: { total, mapped, released, excluded, year, loaded_at }, features: [Point…] }
 * RPC 由 gis-platform migration 499 建立並登記 public.gated_layers（owner）；
 * 非站主前端 toggle 已擋（不會呼叫本檔），後端 enforce_layer_access 再擋一次（42501）。
 * 授權：EA Conditional Licence 限 internal or personal purposes → 不快取到 localStorage、不輸出成任何檔。
 */

/** RPC 錯誤：保留 PostgREST code，讓 hook 分辨無權限（42501）與函式不存在（PGRST202） */
export class GbEaPollutionError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "GbEaPollutionError";
    this.code = code;
    this.status = status;
  }
}

/** 函式尚未部署（migration 未套）：PostgREST 回 PGRST202／404 */
export function isMissingGbEaPollutionRpc(err: unknown): boolean {
  const v = err as { code?: unknown; status?: unknown; message?: unknown } | null;
  return String(v?.code ?? "") === "PGRST202" || v?.status === 404
    || /could not find the function/i.test(String(v?.message ?? ""));
}

/** RPC 原始回應 → 只留 Point features（純函式，測試用） */
export function normalizeGbEaPollution(raw: unknown): GeoJSON.FeatureCollection {
  const obj = (raw ?? {}) as { features?: unknown };
  const rawFeatures = Array.isArray(obj.features) ? (obj.features as GeoJSON.Feature[]) : [];
  const features = rawFeatures
    .filter((f) => f?.geometry?.type === "Point")
    .map((f): GeoJSON.Feature => ({ type: "Feature", geometry: f.geometry, properties: { ...(f.properties ?? {}) } }));
  return { type: "FeatureCollection", features };
}

export async function fetchGbEaPollution(): Promise<GeoJSON.FeatureCollection> {
  const { data, error, status } = await withLoading(
    "gb:eaPollutionInventory",
    "英格蘭污染排放申報載入中",
    supabase.rpc(GB_EA_POLLUTION_RPC),
  );
  if (error) {
    throw new GbEaPollutionError(`${GB_EA_POLLUTION_RPC}: ${error.message}`, String(error.code ?? ""), status);
  }
  return normalizeGbEaPollution(data);
}
