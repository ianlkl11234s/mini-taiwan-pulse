// 衛星 TLE 載入：CelesTrak active.txt 取全量 → 名稱 regex 過濾出中國軍事/遙測 + 台灣 NORAD 白名單
// localStorage cache 6h 避免 reload 重打 CelesTrak。

import { withLoading } from "../lib/loadingRegistry";
import {
  CN_EARTH_OBS_RE,
  CN_MILITARY_RE,
  TAIWAN_NORAD_IDS,
  type SatelliteCategory,
  type SatelliteRecord,
} from "./satelliteTypes";
import { isTleActive } from "./satelliteSGP4";

const CELESTRAK_ACTIVE_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";

const CACHE_KEY = "satellite-layer-tle-v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

interface CacheBlob {
  fetchedAt: number;
  records: SatelliteRecord[];
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
    const blob: CacheBlob = { fetchedAt: Date.now(), records };
    localStorage.setItem(CACHE_KEY, JSON.stringify(blob));
  } catch {
    // localStorage 滿了/disabled 都不致命
  }
}

/** 把名稱對應到 category；不符合白名單則 null */
function classify(name: string, noradId: number): SatelliteCategory | null {
  if (TAIWAN_NORAD_IDS.includes(noradId)) return "taiwan";
  if (CN_MILITARY_RE.test(name)) return "china_military";
  if (CN_EARTH_OBS_RE.test(name)) return "china_earth_obs";
  return null;
}

/** 解析 CelesTrak TLE 3-line 格式（name / line1 / line2 重複） */
function parseTleText(text: string): SatelliteRecord[] {
  const lines = text.split(/\r?\n/);
  const out: SatelliteRecord[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i]!.trim();
    const l1 = lines[i + 1] ?? "";
    const l2 = lines[i + 2] ?? "";
    if (!l1.startsWith("1 ") || !l2.startsWith("2 ")) continue;
    const noradId = parseInt(l1.substring(2, 7), 10);
    if (!isFinite(noradId)) continue;
    const cat = classify(name, noradId);
    if (!cat) continue;
    if (!isTleActive(l1)) continue;
    out.push({ noradId, name, category: cat, tleLine1: l1, tleLine2: l2 });
  }
  return out;
}

async function fetchActiveTle(): Promise<SatelliteRecord[]> {
  const resp = await fetch(CELESTRAK_ACTIVE_URL);
  if (!resp.ok) throw new Error(`CelesTrak fetch failed: ${resp.status}`);
  const text = await resp.text();
  return parseTleText(text);
}

/**
 * 載入衛星 TLE（含 cache）
 * 若 CelesTrak 失敗且 cache 過期，回 [] 由 UI 顯示空狀態。
 */
export async function loadSatellites(): Promise<SatelliteRecord[]> {
  const cached = readCache();
  if (cached) return cached;
  try {
    const records = await withLoading(
      "satellite:tle",
      "衛星 TLE",
      fetchActiveTle(),
    );
    writeCache(records);
    return records;
  } catch (e) {
    console.error("[satellite] CelesTrak fetch error", e);
    return [];
  }
}
