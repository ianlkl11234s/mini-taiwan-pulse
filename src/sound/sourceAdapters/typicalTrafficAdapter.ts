/**
 * 道路車流：臺北市 VD「平日典型值」（family 沿用 road_traffic；決策見 MODEL_DECISIONS「典型車流」）。
 *
 * - 資料：public/sound-atlas/vd-baseline-taipei.json（build-sound-vd-baseline.py；2025-12-26～2026-01-14 平日、
 *   有效流量約 8 天）。每 VD 24 小時流量中位數（輛／小時）＋樣本天數。
 * - **這是歷史期間的典型值，不是當日觀測**：evidence=estimated、proxyKind=typical_weekday_volume，UI 必須照寫。
 * - 只有「臺北市平日」套用：週末、國定假日（TYPICAL_TRAFFIC.nonWorkdays）、異常日（anomalyDays，例：颱風）、
 *   放假日表範圍外 → unknown「無可靠典型值」，不退回 0、不退回國道 proxy。
 * - 流量 null 或樣本天數不足 → unknown（不當 0）；典型流量真的是 0（夜間無車）→ 不產生貢獻（＝0，資料有效）。
 * - 無座標 VD 不建 record（不合成座標）。
 *
 * W6-2 起：VD 不再當點聲源；src/sound/grid/roadNetwork.ts 把每支 VD 沿路延伸成路段（假設），
 * 這裡只留典型值檔案讀取、平日判定與逐小時取值（網格與接收點共用）。
 */
import { withLoading } from "../../lib/loadingRegistry";
import { TYPICAL_TRAFFIC } from "../model/soundProfiles";

export interface VdBaselineEntry {
  id: string;
  road: string | null;
  lanes?: number | null;
  lon: number;
  lat: number;
  /** 平日每小時典型流量（輛／小時）；null＝該小時無有效流量 */
  wd_flow: (number | null)[];
  wd_flow_days: number[];
  wd_speed: (number | null)[];
}

export interface VdBaselineFile {
  meta: { period?: { start: string; end: string }; weekday_flow_days_median?: number; [k: string]: unknown };
  vds: VdBaselineEntry[];
}

/** 該日能否套用平日典型值；不能時回機器可讀原因 */
export function typicalDayVerdict(date: string): { applies: true } | { applies: false; reason: string } {
  const anomaly = TYPICAL_TRAFFIC.anomalyDays.value[date];
  if (anomaly) return { applies: false, reason: "anomaly_day" };
  const cov = TYPICAL_TRAFFIC.calendarCoverage.value;
  if (date < cov.start || date > cov.end) return { applies: false, reason: "calendar_not_covered" };
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) return { applies: false, reason: "weekend" };
  if (TYPICAL_TRAFFIC.nonWorkdays.value.includes(date)) return { applies: false, reason: "national_holiday" };
  return { applies: true };
}

/** 臺灣當地小時（0–23） */
const taipeiHour = (t: number) => new Date((t + 8 * 3600) * 1000).getUTCHours();

/** 時間 t 該 VD 的典型流量；null＝缺值或樣本不足（不是 0） */
export function typicalFlowAt(p: { flow: readonly (number | null)[]; flowDays: readonly number[] }, t: number): { vehPerHour: number; days: number } | { missing: "flow_null" | "sample_insufficient" } {
  const h = taipeiHour(t);
  const q = p.flow[h];
  if (q == null || !Number.isFinite(q)) return { missing: "flow_null" };
  const days = p.flowDays[h] ?? 0;
  if (days < TYPICAL_TRAFFIC.minFlowDays.value) return { missing: "sample_insufficient" };
  return { vehPerHour: q, days };
}

let filePromise: Promise<VdBaselineFile> | null = null;
export function fetchVdBaseline(): Promise<VdBaselineFile> {
  filePromise ??= withLoading(
    "sound:vd-baseline",
    "臺北 VD 典型車流",
    fetch(TYPICAL_TRAFFIC.assetUrl.value).then((r) => {
      if (!r.ok) throw new Error(`vd baseline HTTP ${r.status}`);
      return r.json() as Promise<VdBaselineFile>;
    }),
  ).catch((e) => {
    filePromise = null;
    throw e;
  });
  return filePromise;
}
