import type { Flight } from "../types";
import { preprocessFlights } from "./flightLoader";

export const S3_BASE =
  "https://migu-gis-data-collector.s3.ap-southeast-2.amazonaws.com";
export const FLIGHT_PREFIX = "flight-arc";
export const SHIP_PREFIX = "ship-data";
export const RAIL_PREFIX = "rail-data";

interface ManifestDate {
  date: string;
  flightCount: number;
  airports: string[];
}

interface Manifest {
  lastUpdated: string;
  totalFlights: number;
  dates: ManifestDate[];
}

/**
 * 從 S3 manifest 檢查是否有新資料（新日期或新機場），
 * 若有則下載缺少的日期資料並回傳新航班。
 *
 * @param localFlights 目前本地已載入的航班
 * @returns 合併後的航班陣列（若無更新則回傳原陣列）
 */
export async function mergeS3Updates(localFlights: Flight[]): Promise<Flight[]> {
  try {
    // 1. 取得 S3 manifest（幾 KB）
    const manifestRes = await fetch(`${S3_BASE}/${FLIGHT_PREFIX}/manifest.json`);
    if (!manifestRes.ok) return localFlights;
    const manifest: Manifest = await manifestRes.json();

    // 2. 計算本地已有的日期集合
    const localDates = new Set<string>();
    for (const f of localFlights) {
      const ts = f.dep_time > 0 ? f.dep_time : (f.path[0]?.[3] ?? 0);
      if (ts > 0) localDates.add(new Date(ts * 1000).toISOString().slice(0, 10));
    }

    // 3. 計算本地已有的機場集合
    const localAirports = new Set<string>();
    for (const f of localFlights) {
      if (f.origin_icao?.startsWith("RC")) localAirports.add(f.origin_icao);
      if (f.dest_icao?.startsWith("RC")) localAirports.add(f.dest_icao);
    }

    // 4. 找出需要下載的日期
    const datesToFetch: ManifestDate[] = manifest.dates.filter((d) => {
      // (a) 新日期
      if (!localDates.has(d.date)) return true;
      // (b) 同日期但有新機場
      if (d.airports.some((a) => !localAirports.has(a))) return true;
      return false;
    });

    if (datesToFetch.length === 0) {
      console.log("[S3] No new data available.");
      return localFlights;
    }

    console.log(`[S3] Found ${datesToFetch.length} date(s) to fetch:`,
      datesToFetch.map((d) => d.date).join(", "));

    // 5. 平行下載所有新日期的資料
    const localIds = new Set(localFlights.map((f) => f.fr24_id));
    const fetches = datesToFetch.map(async (d) => {
      const [y, m, dd] = d.date.split("-");
      const url = `${S3_BASE}/${FLIGHT_PREFIX}/${y}/${m}/${dd}/data.json`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const flights: Flight[] = await res.json();
      // 前處理 + 去重：只保留本地沒有的航班
      return preprocessFlights(flights).filter((f) => !localIds.has(f.fr24_id));
    });

    const results = await Promise.all(fetches);
    const newFlights = results.flat();

    if (newFlights.length === 0) {
      console.log("[S3] All flights already present locally.");
      return localFlights;
    }

    console.log(`[S3] Merged ${newFlights.length} new flights.`);
    return [...localFlights, ...newFlights];
  } catch (e) {
    console.warn("[S3] Failed to check for updates:", e);
    return localFlights;
  }
}
