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

let cachedFlights: Flight[] | null = null;

/** 載入 aviation_data.json，並補齊 IATA 代碼、時間戳、展開經度 */
export async function loadFlights(): Promise<Flight[]> {
  if (cachedFlights) return cachedFlights;

  const res = await fetch("/aviation_data.json");
  const data: Flight[] = await res.json();

  cachedFlights = data
    .filter((f) => f.path.length > 0)
    .map((f) => ({
      ...f,
      // 展開跨換日線的經度
      path: unwrapPathLongitudes(f.path),
      // 補齊 IATA 代碼
      origin_iata: resolveIata(f.origin_icao, f.origin_iata),
      dest_iata: resolveIata(f.dest_icao, f.dest_iata),
      // dep_time / arr_time 為 0 時，從 path 首尾推算
      dep_time: f.dep_time > 0 ? f.dep_time : (f.path[0]?.[3] ?? 0),
      arr_time: f.arr_time > 0 ? f.arr_time : (f.path[f.path.length - 1]?.[3] ?? 0),
    }));

  return cachedFlights;
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
