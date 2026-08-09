/**
 * 船舶軌跡列 → `Ship[]` 的**純函數**（EM-16 Phase 2 共用件）
 *
 * 原本住在 `shipLoader.ts`（主站，資料來自 `get_ship_trails` RPC）。
 * `/embed` 回放讀的是同一組欄位的靜態快照鏡像
 * （`scripts/export/export-embed-snapshot.sh ships`），解析邏輯完全相同，
 * 故抽出共用 —— **只是搬家，行為不變**。
 *
 * 與 `flightTrails.ts` 的差別（別互相共用解析器）：
 * - ship trail 是**三欄** `"lat,lng,ts"`（沒有高度，`TrailPoint` 的 alt 補 0）；
 *   flight trail 是四欄 `"lat,lng,alt,ts"`
 * - ship 多一道 **GPS 異常過濾**（>40 節的跳點），flight 沒有
 * - ship 不做 `splitTrailByGap`（一條 MMSI 就是一艘船，不像 callsign 會重用）
 *
 * ⚠️ 依賴必須單向：本檔**不得** import supabase / loadingRegistry / three，
 * 否則 embed 基礎 bundle 會被拖進 Supabase client。
 *   shipLoader（主站）→ shipTrails ← replayRuntime（embed）
 * 色票（`SHIP_TYPE_COLORS`）也住這裡而非 `ShipScene.ts`：LegendPanel 是 embed
 * 基礎 bundle 的 static import，若圖例去 Scene 拿色票就會把 three 拖進來。
 */
import type { Ship, TrailPoint } from "../types";

/** 匯出鏡像列（欄位順序與語意同 `get_ship_trails`）。 */
export interface ShipTrailRow {
  mmsi: string;
  ship_type: string | null;
  /** `"lat,lng,ts;lat,lng,ts;..."` */
  trail: string;
}

// ── GPS 異常過濾 ──

const MAX_SPEED_KNOTS = 40;
const KM_PER_DEG_LAT = 111.0;
const KM_PER_DEG_LNG = 101.0; // ~25°N 近似值

/** 濾掉相對前一個保留點速度 >40 節的跳點（AIS 常見的座標亂碼）。 */
export function filterGpsAnomalies(path: TrailPoint[]): TrailPoint[] {
  if (path.length < 2) return path;
  const filtered: TrailPoint[] = [path[0]!];
  for (let i = 1; i < path.length; i++) {
    const prev = filtered[filtered.length - 1]!;
    const cur = path[i]!;
    const dtHours = (cur[3] - prev[3]) / 3600;
    if (dtHours > 0) {
      const dLat = (cur[0] - prev[0]) * KM_PER_DEG_LAT;
      const dLon = (cur[1] - prev[1]) * KM_PER_DEG_LNG;
      const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
      const speedKnots = distKm / dtHours / 1.852;
      if (speedKnots > MAX_SPEED_KNOTS) continue;
    }
    filtered.push(cur);
  }
  return filtered;
}

// ── ship_type 中文 → AIS 數字碼映射 ──

const SHIP_TYPE_MAP: Record<string, number> = {
  "漁船": 30, "貨船": 70, "油輪": 80, "客輪": 60,
  "高速船": 40, "拖船": 52, "疏浚船": 33, "遊艇": 36,
  "帆船": 36, "引水船": 50, "執法船": 55, "港口小艇": 50,
  "未指定": 0,
};

/** 上游中文船種 → AIS vessel type 碼；未知一律 0（= 其他）。 */
export function parseShipType(t: string | null): number {
  if (!t) return 0;
  return SHIP_TYPE_MAP[t] ?? 0;
}

// ── 船種分桶與色票（ShipScene 與 LegendPanel 的單一出處）──

export type ShipTypeBucket = "passenger" | "cargo" | "tanker" | "fishing" | "special" | "other";

/** AIS vessel type 碼 → 顏色分桶。與 `shipTypeLabel` 的分界一致。 */
export function shipTypeBucket(vesselType: number): ShipTypeBucket {
  if (vesselType >= 60 && vesselType <= 69) return "passenger";
  if (vesselType >= 70 && vesselType <= 79) return "cargo";
  if (vesselType >= 80 && vesselType <= 89) return "tanker";
  if (vesselType >= 30 && vesselType <= 39) return "fishing";
  if (vesselType >= 50 && vesselType <= 59) return "special";
  return "other";
}

/**
 * 船種色票（hex）。`ShipScene` 用它建 `THREE.Color`、`LegendPanel` 直接吃字串
 * —— 兩邊同一份，改色只改這裡。
 */
export const SHIP_TYPE_COLORS_DARK: Record<ShipTypeBucket, string> = {
  passenger: "#a78bfa",
  cargo: "#38bdf8",
  tanker: "#f97316",
  fishing: "#22c55e",
  special: "#facc15",
  other: "#67e8f9",
};

export const SHIP_TYPE_COLORS_LIGHT: Record<ShipTypeBucket, string> = {
  passenger: "#6d28d9",
  cargo: "#0369a1",
  tanker: "#c2410c",
  fishing: "#15803d",
  special: "#a16207",
  other: "#0e7490",
};

/** 圖例列（順序即顯示順序）。 */
export const SHIP_TYPE_LEGEND: readonly { bucket: ShipTypeBucket; label: string }[] = [
  { bucket: "cargo", label: "貨船 Cargo" },
  { bucket: "tanker", label: "油輪 Tanker" },
  { bucket: "passenger", label: "客船 Passenger" },
  { bucket: "fishing", label: "漁船 Fishing" },
  { bucket: "special", label: "作業/拖船 Tug" },
  { bucket: "other", label: "其他 Other" },
];

// ── trail 解析 ──

/** 解析船舶 trail `"lat,lng,ts;..."` → TrailPoint[]（alt 恆為 0）。 */
export function parseShipTrail(trail: string): TrailPoint[] {
  const points = trail.split(";");
  const result: TrailPoint[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const parts = points[i]!.split(",");
    result[i] = [+parts[0]!, +parts[1]!, 0, +parts[2]!];
  }
  return result;
}

export interface ShipRowsResult {
  ships: Ship[];
  /** [最早, 最晚] unix 秒；無資料時為 [0, 0] */
  timeRange: [number, number];
  /** 被 GPS 異常過濾掉的總點數（呼叫端自行決定要不要 log） */
  filteredPoints: number;
}

/** 鏡像列 → Ship[]（含 GPS 異常過濾與時間範圍計算）。 */
export function shipRowsToShips(rows: readonly ShipTrailRow[]): ShipRowsResult {
  let tsMin = Infinity;
  let tsMax = -Infinity;
  let filteredPoints = 0;

  const ships: Ship[] = rows.map((row) => {
    const rawPath = parseShipTrail(row.trail);
    const path = filterGpsAnomalies(rawPath);
    filteredPoints += rawPath.length - path.length;
    for (const pt of path) {
      if (pt[3] < tsMin) tsMin = pt[3];
      if (pt[3] > tsMax) tsMax = pt[3];
    }
    return { mmsi: row.mmsi, vessel_type: parseShipType(row.ship_type), path };
  });

  return {
    ships,
    timeRange: [tsMin === Infinity ? 0 : tsMin, tsMax === -Infinity ? 0 : tsMax],
    filteredPoints,
  };
}
