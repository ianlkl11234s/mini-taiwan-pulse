import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { geometryInteriorPoint } from "../map/interiorPoint";

/**
 * 2026 議員選區（公開）載入器。
 *
 * public.get_council_districts_2026() → GeoJSON FeatureCollection（gis-platform mig 496）
 *   properties: county, district_no, district_name, seats, member_units, is_indigenous, indigenous_type,
 *               caveat, basis, source_url, area_km2；meta: count, loaded_at, source
 * 2026-11-03 實測 161 面全為區域選區（原住民選區沒有對應範圍、不在資料內），約 2.2 MB。
 *
 * 一次抓全臺、session 快取。另為每個選區算一個面內代表點（`_label: 1` 的 Point feature）放進同一份資料，
 * 讓選區名標籤一區只出現一次（polygon 直接掛 symbol 會在每張 tile 各畫一次）。
 */


/** 選區外框與淡填色（圖層代表色紫，避開政黨色） */
export const COUNCIL_DISTRICT_COLOR = "#8b5cf6";

export interface CouncilDistrictsMeta {
  count: number | null;
  loadedAt: string | null;
}

export interface CouncilDistrictsData {
  fc: GeoJSON.FeatureCollection;
  meta: CouncilDistrictsMeta;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** RPC 原始回應 → 上圖用資料（面 + 每區一個標籤點；純函式，測試用） */
export function normalizeCouncilDistricts(raw: unknown): CouncilDistrictsData {
  const obj = (raw ?? {}) as { features?: unknown; meta?: Record<string, unknown> };
  const rawFeatures = Array.isArray(obj.features) ? (obj.features as GeoJSON.Feature[]) : [];
  const polys: GeoJSON.Feature[] = [];
  const labels: GeoJSON.Feature[] = [];
  for (const f of rawFeatures) {
    const t = f?.geometry?.type;
    if (t !== "Polygon" && t !== "MultiPolygon") continue;
    const props = { ...(f.properties ?? {}) } as Record<string, unknown>;
    props.is_indigenous = props.is_indigenous === true;
    polys.push({ type: "Feature", geometry: f.geometry, properties: props });
    const pt = geometryInteriorPoint(f.geometry);
    if (pt) {
      labels.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: pt },
        properties: { _label: 1, district_name: props.district_name ?? "", is_indigenous: props.is_indigenous },
      });
    }
  }
  const meta = obj.meta ?? {};
  return {
    fc: { type: "FeatureCollection", features: [...polys, ...labels] },
    meta: {
      count: num(meta.count),
      loadedAt: typeof meta.loaded_at === "string" ? meta.loaded_at : null,
    },
  };
}

let promise: Promise<CouncilDistrictsData> | null = null;

/** 測試用：清快取 */
export function clearCouncilDistrictsCache(): void {
  promise = null;
}

/** 全臺選區（session 內只抓一次；失敗不快取） */
export function fetchCouncilDistricts(): Promise<CouncilDistrictsData> {
  if (promise) return promise;
  if (!supabaseConfigured) return Promise.resolve(normalizeCouncilDistricts(null));
  const p = (async () => {
    const { data, error, status } = await withLoading(
      "politics:councilDistricts2026",
      "2026 議員選區",
      supabase.rpc("get_council_districts_2026"),
    );
    if (error) {
      const e = new Error(`get_council_districts_2026: ${error.message}`) as Error & { code?: string; status?: number };
      e.code = String(error.code ?? "");
      e.status = status;
      throw e;
    }
    return normalizeCouncilDistricts(data);
  })();
  promise = p;
  p.catch(() => { if (promise === p) promise = null; });
  return p;
}

/** `member_units` 可能是陣列或字串 → 顯示用字串 */
export function formatMemberUnits(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join("、");
  if (typeof v === "string") {
    const s = v.trim();
    if (s.startsWith("[")) {
      try {
        const arr = JSON.parse(s) as unknown;
        if (Array.isArray(arr)) return formatMemberUnits(arr);
      } catch { /* 原樣顯示 */ }
    }
    return s;
  }
  return "";
}
