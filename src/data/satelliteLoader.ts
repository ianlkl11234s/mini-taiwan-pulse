// 衛星 TLE 載入 — 走 Supabase `satellite_classified` view（gis-platform 每 2h 從 Space-Track 同步）
//
// 不走 CelesTrak active.txt 是因為瀏覽器直接 fetch 會被 CelesTrak 用 403 擋（CORS / User-Agent）
// localStorage cache 6h 避免重 fetch。

import { withLoading } from "../lib/loadingRegistry";
import {
  CN_GAOFEN_RE,
  CN_JILIN_RE,
  CN_YAOGAN_RE,
  TW_NAME_RE,
  type SatelliteCategory,
  type SatelliteRecord,
} from "./satelliteTypes";
import { isTleActive } from "./satelliteSGP4";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const CACHE_KEY = "satellite-layer-tle-v3-grouped";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheBlob {
  fetchedAt: number;
  records: SatelliteRecord[];
}

interface SupabaseRow {
  norad_id: number;
  name: string;
  category: string;
  country_operator: string | null;
  tle_line1: string;
  tle_line2: string;
}

function readCache(): SatelliteRecord[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as CacheBlob;
    if (Date.now() - blob.fetchedAt > CACHE_TTL_MS) return null;
    return blob.records;
  } catch {
    return null;
  }
}

function writeCache(records: SatelliteRecord[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), records } satisfies CacheBlob));
  } catch { /* ignore */ }
}

async function fetchView(qs: string): Promise<SupabaseRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/satellite_classified?select=norad_id,name,category,country_operator,tle_line1,tle_line2&${qs}`;
  const resp = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!resp.ok) throw new Error(`Supabase satellite_classified ${resp.status}`);
  return (await resp.json()) as SupabaseRow[];
}

/** 把 Supabase row 轉成 SatelliteRecord，並決定本專案的 category（5 分群） */
function classify(row: SupabaseRow): SatelliteCategory | null {
  const country = row.country_operator;
  const cat = row.category;
  const name = row.name;
  // 台灣：country + 名稱保底（含 FS-8A、TRITON）
  if (country === "Taiwan") return "taiwan";
  if (TW_NAME_RE.test(name) && cat !== "debris") return "taiwan";
  // 中國分群（依名稱前綴）
  if (country === "China") {
    if (CN_YAOGAN_RE.test(name)) return "china_yaogan";
    if (CN_JILIN_RE.test(name)) return "china_jilin";
    if (CN_GAOFEN_RE.test(name)) return "china_gaofen";
    if (cat === "military" || cat === "earth_obs") return "china_other";
  }
  return null;
}

async function fetchAll(): Promise<SatelliteRecord[]> {
  const [cnRows, twRows, twNameRows] = await Promise.all([
    fetchView("country_operator=eq.China&category=in.(military,earth_obs)"),
    fetchView("country_operator=eq.Taiwan"),
    // 名稱保底：UCS country 還沒對齊的新衛星（FORMOSAT-8A、FORMOSAT-7R/TRITON）
    fetchView("or=(name.ilike.FORMOSAT*,name.ilike.TRITON*)&category=neq.debris"),
  ]);
  const seen = new Set<number>();
  const out: SatelliteRecord[] = [];
  for (const row of [...cnRows, ...twRows, ...twNameRows]) {
    if (seen.has(row.norad_id)) continue;
    seen.add(row.norad_id);
    const cat = classify(row);
    if (!cat) continue;
    if (!row.tle_line1 || !row.tle_line2) continue;
    if (!isTleActive(row.tle_line1)) continue;
    out.push({
      noradId: row.norad_id,
      name: row.name,
      category: cat,
      tleLine1: row.tle_line1,
      tleLine2: row.tle_line2,
    });
  }
  return out;
}

export async function loadSatellites(): Promise<SatelliteRecord[]> {
  const cached = readCache();
  if (cached) return cached;
  try {
    const records = await withLoading("satellite:tle", "衛星 TLE", fetchAll());
    writeCache(records);
    console.log(`[satellite] 載入 ${records.length} 顆衛星 (CN/TW)`);
    return records;
  } catch (e) {
    console.error("[satellite] Supabase fetch error", e);
    return [];
  }
}
