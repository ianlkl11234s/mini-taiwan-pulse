// 衛星 TLE 載入 — 走 Supabase `satellite_classified` view（gis-platform 每 2h 從 Space-Track 同步）
//
// 不走 CelesTrak active.txt 是因為瀏覽器直接 fetch 會被 CelesTrak 用 403 擋（CORS / User-Agent）
// localStorage cache 6h 避免重 fetch。

import { withLoading } from "../lib/loadingRegistry";
import {
  classifyByCountryName,
  type SatelliteCategory,
  type SatelliteRecord,
} from "./satelliteTypes";
import { isTleActive } from "./satelliteSGP4";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const CACHE_KEY = "satellite-layer-tle-v5-multi-country";
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

/** 把 Supabase row 轉成 SatelliteRecord，並決定 16 分群（CN 6 + TW 1 + 9 國）*/
function classify(row: SupabaseRow): SatelliteCategory | null {
  if (row.category === "debris") return null;
  return classifyByCountryName(row.country_operator, row.name);
}

async function fetchAll(): Promise<SatelliteRecord[]> {
  const [cnRows, twRows, twNameRows, intlRows, intlNameRows] = await Promise.all([
    // 中國 6 群
    fetchView("country_operator=eq.China&category=in.(military,earth_obs,navigation,geo_comms,science,tech_demo)"),
    // 台灣
    fetchView("country_operator=eq.Taiwan"),
    fetchView("or=(name.ilike.FORMOSAT*,name.ilike.TRITON*,name.ilike.YUSHAN*,name.ilike.IRIS-*)&category=neq.debris"),
    // 9 國 LEO 遙測偵察（UCS earth_obs/military，由 country_operator 區分）
    fetchView("country_operator=in.(USA,Japan,Russia,India,\"South Korea\",France,Germany,Italy,Israel)&category=in.(military,earth_obs)"),
    // 名稱保底（catalog country 缺失的）
    fetchView("or=(name.ilike.IGS-*,name.ilike.ALOS*,name.ilike.PERSONA*,name.ilike.CARTOSAT*,name.ilike.RISAT*,name.ilike.CSO*,name.ilike.PLEIADES*,name.ilike.SAR-LUPE*,name.ilike.SARAH*,name.ilike.TERRASAR*,name.ilike.OFEQ*,name.ilike.KOMPSAT*,name.ilike.COSMO-SKYMED*)&category=neq.debris"),
  ]);
  const seen = new Set<number>();
  const out: SatelliteRecord[] = [];
  for (const row of [...cnRows, ...twRows, ...twNameRows, ...intlRows, ...intlNameRows]) {
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
