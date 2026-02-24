import type { Flight, TrailPoint } from "../types";
import { AIRPORT_INFO } from "../map/cameraPresets";

/** ICAO → IATA 對照表：台灣機場 + 常見國際航點 */
const ICAO_TO_IATA: Record<string, string> = {
  // 台灣機場（從 AIRPORT_INFO 展開）
  ...Object.fromEntries(
    Object.entries(AIRPORT_INFO).map(([icao, info]) => [icao, info.iata]),
  ),
  // 日本
  RJTT: "HND", RJAA: "NRT", RJBB: "KIX", RJOO: "ITM",
  RJFF: "FUK", RJCC: "CTS", RJFK: "KOJ", RJNS: "FSZ",
  RJNK: "KMQ", RJOT: "OKJ", RJOM: "MYJ", RJSN: "KIJ",
  RJGG: "NGO", RJBE: "UKB", RJCH: "OBO", RJFO: "OIT",
  RJFR: "KKJ", RJFT: "KMJ", RJNT: "TOY", RJOA: "HIJ",
  RJOB: "IWJ", RJOK: "KCZ", RJSS: "SDJ",
  // 沖繩
  ROAH: "OKA", ROIG: "ISG", RORS: "MMY",
  // 韓國
  RKSI: "ICN", RKSS: "GMP", RKPK: "PUS", RKPC: "CJU",
  RKTN: "TAE", RKTU: "CJJ",
  // 港澳中國
  VHHH: "HKG", VMMC: "MFM", ZGGG: "CAN", ZSPD: "PVG",
  ZSSS: "SHA", ZBAA: "PEK", ZGSZ: "SZX", ZUUU: "CTU",
  ZGHA: "CSX", ZUCK: "CKG", ZHCC: "CGO", ZSNJ: "NKG",
  ZHHH: "WUH", ZSAM: "XMN", ZSFZ: "FOC", ZSHC: "HGH",
  ZSNB: "NGB", ZUTF: "TFU",
  // 台灣離島 / 軍用
  RCCM: "CMJ", RCGI: "GNI", RCMT: "MFK",
  // 東南亞
  WSSS: "SIN", WMKK: "KUL", WMKP: "PEN", VTBS: "BKK",
  VTBD: "DMK", VTSP: "HKT", VTCC: "CNX",
  RPLL: "MNL", RPVM: "CEB", RPLC: "CRK",
  VVTS: "SGN", VVNB: "HAN", VVDN: "DAD", VVCR: "CXR",
  VVDL: "DLI", VVPQ: "PQC",
  WADD: "DPS", WIII: "CGK", WAMM: "MDC", WBKK: "BKI",
  VDPP: "PNH", VDTI: "REP", VLVT: "VTE", VYYY: "RGN",
  VIDP: "DEL",
  // 大洋洲
  NZAA: "AKL", YBBN: "BNE", YMML: "MEL",
  // 中東
  OMDB: "DXB", OMAA: "AUH", OMDW: "DWC",
  // 美洲
  KJFK: "JFK", KLAX: "LAX", KSFO: "SFO", KORD: "ORD",
  KSEA: "SEA", KDFW: "DFW", KIAH: "IAH", KONT: "ONT",
  KPHX: "PHX", PANC: "ANC", PHNL: "HNL", PGUM: "GUM",
  CYVR: "YVR", CYYZ: "YYZ",
  // 歐洲
  EGLL: "LHR", EHAM: "AMS", LFPG: "CDG", EDDF: "FRA",
  EDDM: "MUC", LIMC: "MXP", LKPR: "PRG", LOWW: "VIE",
  LTFM: "IST",
  // 其他
  PTRO: "TRO",
};

/** 解析 IATA 代碼：優先用既有值，其次查表，最後 fallback 到 ICAO */
function resolveIata(icao: string, existingIata: string): string {
  if (existingIata) return existingIata;
  return ICAO_TO_IATA[icao] ?? icao;
}

/**
 * 展開路徑經度，避免跨越 ±180° 換日線時折返
 * 例：lng 從 170 → -170 會被修正為 170 → 190
 */
function unwrapPathLongitudes(path: TrailPoint[]): TrailPoint[] {
  if (path.length < 2) return path;
  const result: TrailPoint[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const [lat, lng, alt, ts] = path[i]!;
    const prevLng = result[i - 1]![1];
    let adjustedLng = lng;
    while (adjustedLng - prevLng > 180) adjustedLng -= 360;
    while (adjustedLng - prevLng < -180) adjustedLng += 360;
    result.push([lat, adjustedLng, alt, ts]);
  }
  return result;
}

/**
 * 修正 FR24 資料中的英呎/公尺混用問題
 *
 * FR24 在低高度（~1000ft / ~300m）會從公尺切換成英呎回報，
 * 例如：降落時 ...320m, 312m, [1000ft, 975ft, 875ft...]
 * 被當作公尺渲染時，312→1000 會造成巨大的高度跳升。
 *
 * 策略：雙向掃描 + 黏著模式。初次偵測到英呎切換後，
 * 連續 3 次轉換即進入黏著模式，持續轉換直到明確回到公尺。
 */
function fixAltitudeUnits(path: TrailPoint[]): TrailPoint[] {
  if (path.length < 2) return path;
  const result: TrailPoint[] = path.map((pt) => [pt[0], pt[1], pt[2], pt[3]]);
  const FT_TO_M = 0.3048;
  const STICKY_THRESHOLD = 3; // 連續轉換幾次後進入黏著模式

  // 正向掃描：修正降落段（公尺→英呎切換）
  let streak = 0;
  for (let i = 1; i < result.length; i++) {
    const prevAlt = result[i - 1]![2];
    const currAlt = result[i]![2];
    const converted = Math.round(currAlt * FT_TO_M);
    const jumpRaw = Math.abs(currAlt - prevAlt);
    const jumpConv = Math.abs(converted - prevAlt);

    if (streak >= STICKY_THRESHOLD) {
      // 黏著模式：持續轉換，除非轉換結果明顯更差
      if (jumpConv <= jumpRaw * 2) {
        result[i]![2] = converted;
      } else {
        streak = 0;
      }
    } else if (jumpRaw > 200 && jumpConv < jumpRaw * 0.5) {
      result[i]![2] = converted;
      streak++;
    } else {
      streak = 0;
    }
  }

  // 反向掃描：修正起飛段（英呎→公尺切換）
  streak = 0;
  for (let i = result.length - 2; i >= 0; i--) {
    const nextAlt = result[i + 1]![2];
    const currAlt = result[i]![2];
    const converted = Math.round(currAlt * FT_TO_M);
    const jumpRaw = Math.abs(currAlt - nextAlt);
    const jumpConv = Math.abs(converted - nextAlt);

    if (streak >= STICKY_THRESHOLD) {
      if (jumpConv <= jumpRaw * 2) {
        result[i]![2] = converted;
      } else {
        streak = 0;
      }
    } else if (jumpRaw > 200 && jumpConv < jumpRaw * 0.5) {
      result[i]![2] = converted;
      streak++;
    } else {
      streak = 0;
    }
  }

  return result;
}

/** 前處理單筆航班：修正高度、展開經度、補齊 IATA、推算時間 */
export function preprocessFlight(f: Flight): Flight {
  return {
    ...f,
    path: unwrapPathLongitudes(fixAltitudeUnits(f.path)),
    origin_iata: resolveIata(f.origin_icao, f.origin_iata),
    dest_iata: resolveIata(f.dest_icao, f.dest_iata),
    dep_time: f.dep_time > 0 ? f.dep_time : (f.path[0]?.[3] ?? 0),
    arr_time: f.arr_time > 0 ? f.arr_time : (f.path[f.path.length - 1]?.[3] ?? 0),
  };
}

/** 前處理航班陣列 */
export function preprocessFlights(flights: Flight[]): Flight[] {
  return flights.filter((f) => f.path.length > 0).map(preprocessFlight);
}

let cachedFlights: Flight[] | null = null;

import { S3_BASE, FLIGHT_PREFIX } from "./s3Loader";

/** 從 S3 manifest 載入全部航班（本地檔案不存在時的 fallback） */
async function loadFromS3(): Promise<Flight[]> {
  const base = `${S3_BASE}/${FLIGHT_PREFIX}`;
  const manifestRes = await fetch(`${base}/manifest.json`);
  if (!manifestRes.ok) throw new Error("S3 manifest not available");
  const manifest: { dates: { date: string }[] } = await manifestRes.json();

  const fetches = manifest.dates.map(async (d) => {
    const [y, m, dd] = d.date.split("-");
    const res = await fetch(`${base}/${y}/${m}/${dd}/data.json`);
    if (!res.ok) return [];
    return (await res.json()) as Flight[];
  });

  const results = await Promise.all(fetches);
  return results.flat();
}

/** 載入航班資料：優先本地 aviation_data.json，失敗則從 S3 載入 */
export async function loadFlights(): Promise<Flight[]> {
  if (cachedFlights) return cachedFlights;

  let data: Flight[];
  try {
    const res = await fetch("/aviation_data.json");
    const text = await res.text();
    // SPA fallback 會回傳 HTML，檢查是否為合法 JSON
    if (text.trimStart().startsWith("<")) throw new Error("Got HTML, not JSON");
    data = JSON.parse(text);
  } catch {
    console.log("[Loader] Local file unavailable, loading from S3...");
    data = await loadFromS3();
  }

  cachedFlights = preprocessFlights(data);
  return cachedFlights;
}

/** 更新快取（S3 合併後使用） */
export function updateCachedFlights(flights: Flight[]): void {
  cachedFlights = flights;
}

/** 依目的地機場 ICAO 篩選（降落航班） */
export function filterByArrivalAirport(
  flights: Flight[],
  icao: string,
): Flight[] {
  return flights.filter((f) => f.dest_icao === icao);
}

/** 依出發機場 ICAO 篩選（起飛航班） */
export function filterByDepartureAirport(
  flights: Flight[],
  icao: string,
): Flight[] {
  return flights.filter((f) => f.origin_icao === icao);
}

/** 依機場篩選（起飛或降落） */
export function filterByAirport(flights: Flight[], icao: string): Flight[] {
  return flights.filter(
    (f) => f.dest_icao === icao || f.origin_icao === icao,
  );
}

/** 取得資料中所有出現的台灣機場 ICAO */
export function getTaiwanAirports(flights: Flight[]): string[] {
  const twIcaoPrefix = "RC";
  const airports = new Set<string>();
  for (const f of flights) {
    if (f.origin_icao.startsWith(twIcaoPrefix)) airports.add(f.origin_icao);
    if (f.dest_icao.startsWith(twIcaoPrefix)) airports.add(f.dest_icao);
  }
  return [...airports].sort();
}

/** 依時間窗口篩選：當前時間 ±12h 內與指定機場相關的航班 */
export function filterByTimeWindow(
  flights: Flight[],
  icao: string,
  currentTime: number,
  windowHours: number = 12,
): Flight[] {
  const windowSec = windowHours * 3600;
  const tMin = currentTime - windowSec;
  const tMax = currentTime + windowSec;

  return flights.filter((f) => {
    // 必須與指定機場相關
    if (f.dest_icao !== icao && f.origin_icao !== icao) return false;
    // 軌跡時間範圍必須與窗口重疊
    if (f.path.length === 0) return false;
    const pathStart = f.path[0]![3];
    const pathEnd = f.path[f.path.length - 1]![3];
    return pathEnd >= tMin && pathStart <= tMax;
  });
}

/** 取得航班群的時間範圍 */
export function getTimeRange(flights: Flight[]): {
  start: number;
  end: number;
} {
  let start = Infinity;
  let end = -Infinity;
  for (const f of flights) {
    for (const pt of f.path) {
      const t = pt[3];
      if (t < start) start = t;
      if (t > end) end = t;
    }
  }
  return { start, end };
}
