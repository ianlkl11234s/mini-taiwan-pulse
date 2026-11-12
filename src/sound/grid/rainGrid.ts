/**
 * 雨網格（W6-1）：把已載入的 rain set（雨量站列＋雷達每日包）算成一幀全 bbox 分級（0–4、255）。
 *
 * 和接收點查詢**同一套規則**（網格值＝queryReceiver(格心, t) 的雨分級，W6-1 決定 6）：
 * - coverage gate 用 receiverQuery.gateFamilyRecords（不在涵蓋窗＝255；沒有健康來源＝255）；
 * - 雨量站那一半：每格最近站用 nearestRainStation 同一支（同序、同 `<` 比較），逐小時用 gaugeEstimate；
 * - 雷達那一半：radarClassAt（區間內各幀最大）；
 * - 兩者用 combineRainClass 取較高者。
 * 只是把「每格最近站」預先算一次、每幀每站只算一次分級，所以一幀 < 幾 ms（W6-0 實測 rain 0.35 ms）。
 *
 * 範圍外（縣市遮罩 0）的格也算（雷達有值），顯示時由渲染器用遮罩隱藏。
 */
import { gateFamilyRecords } from "../engines/receiverQuery";
import { RAIN } from "../model/soundProfiles";
import {
  gaugeEstimate, isRadarRainRecord, nearestRainStation, type AnyRainRecord, type RainRecord,
} from "../sourceAdapters/rainFieldAdapter";
import { RADAR_RAIN_PROVIDER, radarClassAt, type RadarRainPack } from "./radarRainPack";
import { cellCenter, GRID_BBOX, GRID_CELLS, GRID_UNKNOWN, inScopeCells } from "./gridSpec";
import { combineRainClass, foldRainClasses, type RainClassCode } from "./rainClass";
import type { SoundSourceSet } from "../types";

/** 預算：每格最近站（5 km 內；否則 -1） */
export interface RainGaugeField {
  stationIds: string[];
  rowsByStation: RainRecord[][];
  /** 長度 GRID_CELLS；-1＝5 km 內沒有雨量站 */
  nearest: Int32Array;
}

/** 站點粗篩外擴（度）：> 5 km（緯度 0.045°、經度 25°N 約 0.05°），保證 5 km 內的最近站一定在候選裡 */
const STATION_PAD_DEG = 0.07;

export function buildRainGaugeField(records: readonly AnyRainRecord[], cells: Uint32Array = inScopeCells()): RainGaugeField {
  const [w, s, e, n] = GRID_BBOX;
  const firstPerStation: RainRecord[] = [];
  const rowsMap = new Map<string, RainRecord[]>();
  for (const r of records) {
    if (isRadarRainRecord(r)) continue;
    const id = r.payload.stationId;
    let list = rowsMap.get(id);
    if (!list) {
      list = [];
      rowsMap.set(id, list);
      const { lon, lat } = r.payload;
      // 粗篩只保留 bbox 外擴範圍內的站；同序保留（nearestRainStation 對同距離取先出現者）
      if (lon >= w - STATION_PAD_DEG && lon <= e + STATION_PAD_DEG && lat >= s - STATION_PAD_DEG && lat <= n + STATION_PAD_DEG) firstPerStation.push(r);
    }
    list.push(r);
  }
  const stationIds = firstPerStation.map((r) => r.payload.stationId);
  const idx = new Map(stationIds.map((id, i) => [id, i]));
  const nearest = new Int32Array(GRID_CELLS).fill(-1);
  const maxD = RAIN.maxStationDistanceM.value;
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k]!;
    const [lon, lat] = cellCenter(c);
    const hit = nearestRainStation(firstPerStation, lon, lat);
    if (hit && hit.distanceM <= maxD) nearest[c] = idx.get(hit.stationId)!;
  }
  return { stationIds, rowsByStation: stationIds.map((id) => rowsMap.get(id)!), nearest };
}

export interface RainGridFrame {
  /** 長度 GRID_CELLS 的分級碼 */
  values: Uint8Array;
  /** 本幀用到的來源（圖例／說明用） */
  gauge: boolean;
  radar: boolean;
  /** coverage gate 不通過的原因（整幀 255） */
  gateReason: string | null;
}

/**
 * 一幀：[t0, t1]（網格每 10 分一格：t0＝格起點、t1＝格終點前一點）。
 * set 為 null／gate 不通過 → 整幀 255（無法判斷，不是無雨）。
 */
export function rainGridFrame(
  set: SoundSourceSet | null,
  field: RainGaugeField | null,
  t0: number,
  t1: number,
  cells: Uint32Array = inScopeCells(),
  out: Uint8Array = new Uint8Array(GRID_CELLS),
): RainGridFrame {
  out.fill(GRID_UNKNOWN);
  if (!set || !field) return { values: out, gauge: false, radar: false, gateReason: "source_not_loaded" };
  const gate = gateFamilyRecords("rain", [set], t0, t1);
  if (gate.kind !== "ok") return { values: out, gauge: false, radar: false, gateReason: gate.reason };
  const gaugeOk = gate.records.some((r) => !isRadarRainRecord(r as AnyRainRecord));
  const packs: RadarRainPack[] = gate.okProviders.has(RADAR_RAIN_PROVIDER)
    ? (gate.records as AnyRainRecord[]).filter(isRadarRainRecord).map((r) => r.payload.pack)
    : [];
  // 每站一次：該區間的雨量站分級（null 不會出現：站已在 5 km 內）
  const stationClass = new Uint8Array(field.stationIds.length).fill(GRID_UNKNOWN);
  if (gaugeOk) {
    const near0 = { stationId: "", stationName: null, distanceM: 0 };
    field.rowsByStation.forEach((rows, i) => {
      stationClass[i] = gaugeEstimate(rows, near0, t0, t1).rainClass ?? GRID_UNKNOWN;
    });
  }
  const radarCodes: RainClassCode[] = [];
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k]!;
    const si = gaugeOk ? field.nearest[c]! : -1;
    const gauge: RainClassCode | null = si >= 0 ? (stationClass[si]! as RainClassCode) : null;
    let radar: RainClassCode | null = null;
    if (packs.length) {
      radarCodes.length = 0;
      for (const p of packs) {
        const hit = radarClassAt(p, c, t0, t1);
        if (hit) radarCodes.push(hit.rainClass);
      }
      radar = foldRainClasses(radarCodes);
    }
    out[c] = combineRainClass(radar, gauge).rainClass;
  }
  return { values: out, gauge: gaugeOk, radar: packs.length > 0, gateReason: null };
}
