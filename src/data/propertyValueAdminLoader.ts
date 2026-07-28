/**
 * 房地產總市值行政區聚合（`public/urban/property_value_admin.json`）loader。
 *
 * 上游 = taipei-gis-analytics `data/processed/urban_composite/property_value/admin_value.json`
 * （靜態一次性產物，一年級別更新 → TTL 拉 6h；同 erHospitalLoader 的 cachedOnce 慣例）。
 *
 * ⚠️ 金額單位：本檔所有 `value_*` 欄位是 **元**（不是萬元，跟 PMTiles 的 v/v_mkt 不同）。
 *    長條圖主數字一律用 `value_market_corrected`（市場only + per-county GFA 校正）。
 * ⚠️ `value_all` 未套校正係數 → **可能小於** `value_market_corrected`，兩者不可相減，
 *    也不能解讀成「排除了多少非市場」。前端只顯示主數字。
 */
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

const ADMIN_JSON_URL = `${import.meta.env.BASE_URL ?? "/"}urban/property_value_admin.json`;

export interface PropertyValueAdminRow {
  name: string;
  code: string;
  n_buildings: number;
  n_buildings_non_market: number;
  gfa_m2: number;
  /** ⭐ 主數字（元）：市場only + per-county GFA 校正 */
  value_market_corrected: number;
  /** 含非市場且未套校正係數（元）——僅供追溯，前端不顯示、不相減 */
  value_all: number;
  value_non_market_excluded: number;
  gfa_factor_used: number;
  /** township 列才有（county 欄位帶所屬縣市） */
  county?: string;
}

export interface PropertyValueAdminMeta {
  total_trillion: number;
  total_trillion_uncorrected: number;
  buildings_total: number;
  gfa_m2_total: number;
  generated_at: string;
  method: string;
  value_version: string;
  anchor: { verdict: string; rule: string; [k: string]: unknown };
  price_source_share_by_buildings: Record<string, number>;
  limitations: string[];
  attribution: string;
  license_note: string;
}

export interface PropertyValueAdmin {
  meta: PropertyValueAdminMeta;
  county: PropertyValueAdminRow[];
  township: PropertyValueAdminRow[];
}

async function fetchAdminUncached(): Promise<PropertyValueAdmin> {
  const resp = await withLoading(
    "propertyValueAdmin",
    "載入房地產總市值行政區統計",
    fetch(ADMIN_JSON_URL),
  );
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return (await resp.json()) as PropertyValueAdmin;
}

/** 靜態一次性產物 → 6h TTL；in-flight 去重同時擋掉 StrictMode 雙跑 */
export const loadPropertyValueAdmin = cachedOnce(fetchAdminUncached, 6 * 60 * 60_000);
