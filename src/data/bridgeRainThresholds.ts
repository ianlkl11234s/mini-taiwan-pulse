import type { RainGaugeLatestRow } from "./rainGaugeLoader";

// 前期記錄的 THB 一級監控橋梁彙整表 115 年第 4 版（1150904）；
// 2026-09-24 官方頁有安全挑戰，現行版次與原表無法重新讀回，須保留版本待覆核標示。
// 位置是 OSM 同名 way 的
// Nominatim 候選中心點，僅供地圖定位；不代表公路局核定橋位或身份配對。
export const BRIDGE_TABLE_URL = "https://www.thb.gov.tw/News_Content.aspx?n=206&s=162102";
export const BRIDGE_TABLE_VERSION = "115年第4版（1150904；現行版本待覆核）";
export const RAIN_FRESH_MS = 30 * 60_000;

type Period = "precipitation_1hr" | "precipitation_3hr" | "precipitation_6hr" | "precipitation_24hr";
type Limit = readonly [Period, number];
type Clause = readonly Limit[]; // AND；多個 clause 為 OR
export interface RainRule { label: string; clauses: readonly Clause[] }
export interface BridgeRainDefinition {
  id: string; name: string; route: string; lng: number; lat: number; osmWay: number;
  stations: readonly string[]; rules: readonly RainRule[];
  note?: string;
}

const one = (period: Period, mm: number): Clause => [[period, mm]];
const all = (...limits: Limit[]): Clause => limits;
const tier = (label: string, ...clauses: Clause[]): RainRule => ({ label, clauses });

export const BRIDGE_RAIN_DEFINITIONS: readonly BridgeRainDefinition[] = [
  { id: "101", name: "龍門橋", route: "台2 98K+164", lng: 121.9265758, lat: 25.0261425, osmWay: 304931330, stations: ["C0A890"], rules: [
    tier("行動1雨量", one("precipitation_24hr", 400)),
    tier("警戒雨量", one("precipitation_24hr", 300)),
    tier("預警雨量", one("precipitation_1hr", 50), one("precipitation_3hr", 150), one("precipitation_24hr", 200)),
  ] },
  { id: "201", name: "中彰大橋", route: "台61 160K+545～163K+287", lng: 120.5052804, lat: 24.1857663, osmWay: 1291619075, stations: ["C0I420", "01H720"], rules: [
    tier("行動2雨量", all(["precipitation_1hr", 65], ["precipitation_24hr", 900])),
    tier("警戒雨量", all(["precipitation_1hr", 50], ["precipitation_24hr", 700])),
    tier("預警雨量", all(["precipitation_1hr", 40], ["precipitation_24hr", 500])),
  ], note: "警戒／行動另有水位條件；此處只評估雨量部分。" },
  { id: "202", name: "炎峰橋", route: "台14 26K+710～27K+165", lng: 120.7563073, lat: 23.9840011, osmWay: 1303924883, stations: ["C1H941"], rules: [
    tier("行動2雨量", all(["precipitation_1hr", 75], ["precipitation_3hr", 200], ["precipitation_24hr", 600])),
    tier("警戒雨量", all(["precipitation_1hr", 65], ["precipitation_3hr", 180], ["precipitation_24hr", 500])),
    tier("預警雨量", one("precipitation_1hr", 55), one("precipitation_24hr", 350)),
  ] },
  { id: "203", name: "雙冬橋", route: "台14 29K+282～29K+702", lng: 120.7804452, lat: 23.9832734, osmWay: 1006654672, stations: ["01H680", "01H720"], rules: [], note: "雙測站分別有不同門檻，尚待逐列覆核；暫不自動判讀。" },
  { id: "204", name: "南雲大橋", route: "台3 236K+010～236K+930", lng: 120.6539599, lat: 23.7598824, osmWay: 372951867, stations: ["C1I131"], rules: [
    tier("行動2雨量", all(["precipitation_1hr", 80], ["precipitation_3hr", 260], ["precipitation_24hr", 850])),
    tier("警戒雨量", all(["precipitation_1hr", 65], ["precipitation_3hr", 200], ["precipitation_24hr", 700])),
    tier("預警雨量", all(["precipitation_1hr", 50], ["precipitation_3hr", 150]), one("precipitation_24hr", 500)),
  ] },
  { id: "205", name: "愛玉橋", route: "台21 108K+272～108K+689", lng: 120.8658242, lat: 23.5462028, osmWay: 340092909, stations: ["C0H9A0"], rules: [
    tier("行動2雨量", all(["precipitation_1hr", 60], ["precipitation_24hr", 350])),
    tier("警戒雨量", one("precipitation_1hr", 50), one("precipitation_24hr", 300)),
    tier("預警雨量", one("precipitation_1hr", 40), one("precipitation_24hr", 250)),
  ] },
  { id: "301", name: "勝境橋", route: "台20 88K+000～88K+500", lng: 120.7566964, lat: 23.1501778, osmWay: 398296533, stations: ["C1V231", "C1V220"], rules: [
    tier("行動2雨量", one("precipitation_24hr", 200)),
  ], note: "官方表未列預警、警戒雨量欄。" },
  { id: "401", name: "百韜橋", route: "台7甲 0K+000～0K+046", lng: 121.5131582, lat: 24.5971882, osmWay: 207565260, stations: ["C0UB60", "21U110", "01U060"], rules: [], note: "多測站且含水位與多組行動條件，尚待逐列覆核；暫不自動判讀。" },
  { id: "501", name: "八掌溪橋", route: "台1 277K+639～277K+943", lng: 120.3822469, lat: 23.4040587, osmWay: 197175910, stations: ["C0M640"], rules: [
    tier("行動3雨量", all(["precipitation_1hr", 80], ["precipitation_24hr", 480])),
    tier("行動2雨量", all(["precipitation_1hr", 90], ["precipitation_24hr", 450])),
    tier("行動1雨量", all(["precipitation_1hr", 100], ["precipitation_24hr", 420])),
    tier("警戒雨量", one("precipitation_1hr", 100), one("precipitation_24hr", 320)),
    tier("預警雨量", one("precipitation_1hr", 70), one("precipitation_24hr", 220)),
  ], note: "表列水位與現場判斷條件未納入。" },
  { id: "502", name: "新榮橋", route: "台1丁 3K+720～4K", lng: 120.5194094, lat: 23.7312888, osmWay: 37982435, stations: ["C0K400"], rules: [
    tier("行動3雨量", all(["precipitation_1hr", 80], ["precipitation_24hr", 520])),
    tier("行動2雨量", all(["precipitation_1hr", 90], ["precipitation_24hr", 480])),
    tier("行動1雨量", all(["precipitation_1hr", 100], ["precipitation_24hr", 450])),
    tier("警戒雨量", one("precipitation_1hr", 100), one("precipitation_24hr", 300)),
    tier("預警雨量", one("precipitation_1hr", 70), one("precipitation_24hr", 200)),
  ], note: "表列現場判斷條件未納入。" },
];

export type RainAssessment = "triggered" | "below" | "unknown";
export interface BridgeRainAssessment {
  status: RainAssessment; label: string; matchedStation: string | null;
  stationReadings: readonly RainGaugeLatestRow[]; reason: string;
}

function evaluateClause(clause: Clause, row: RainGaugeLatestRow): boolean | null {
  let missing = false;
  for (const [period, limit] of clause) {
    const value = row[period];
    if (value == null || !Number.isFinite(Number(value))) { missing = true; continue; }
    if (Number(value) < limit) return false;
  }
  return missing ? null : true;
}

function evaluateRule(rule: RainRule, row: RainGaugeLatestRow): boolean | null {
  let missing = false;
  for (const clause of rule.clauses) {
    const result = evaluateClause(clause, row);
    if (result === true) return true;
    if (result === null) missing = true;
  }
  return missing ? null : false;
}

export function assessBridgeRain(bridge: BridgeRainDefinition, latest: ReadonlyMap<string, RainGaugeLatestRow>, now = Date.now()): BridgeRainAssessment {
  const rows = bridge.stations.map((id) => latest.get(id)).filter((r): r is RainGaugeLatestRow => !!r);
  const fresh = rows.filter((r) => {
    const age = now - Date.parse(r.observed_at);
    return Number.isFinite(age) && age >= 0 && age <= RAIN_FRESH_MS;
  });
  if (bridge.rules.length === 0) return { status: "unknown", label: "尚未判讀", matchedStation: null, stationReadings: rows, reason: bridge.note ?? "門檻待覆核" };
  if (fresh.length === 0) return { status: "unknown", label: "無新鮮雨量", matchedStation: null, stationReadings: rows, reason: "指定測站缺測或超過 30 分鐘" };
  let missing = fresh.length < bridge.stations.length;
  for (const rule of bridge.rules) {
    for (const row of fresh) {
      const result = evaluateRule(rule, row);
      if (result === true) return { status: "triggered", label: rule.label, matchedStation: row.station_id, stationReadings: rows, reason: "僅雨量條件觸發；非封橋或結構安全判定" };
      if (result === null) missing = true;
    }
  }
  return missing
    ? { status: "unknown", label: "資料不足", matchedStation: null, stationReadings: rows, reason: "指定測站或門檻所需雨量缺值" }
    : { status: "below", label: "未達雨量門檻", matchedStation: null, stationReadings: rows, reason: "僅就表列雨量條件評估；水位、巡查與通行狀態未評估" };
}
