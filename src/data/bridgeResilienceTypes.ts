import type { ExpressionSpecification } from "mapbox-gl";

/**
 * 雙北跨河橋梁韌性（研究中）站主限定私人資產契約。
 *
 * 來源：taipei-gis-analytics `bridge-display-bundle-20260930-v2`（專題 README §8／§8b）。
 * 一個私人 PMTiles（三個 source-layer）＋三份私人 JSON，全部只經同源 Range API
 * `/api/private-research/bridge-resilience/{tiles,summary,impacts,destinations}` 讀取（每個請求帶 Bearer，sidecar 驗站主）。
 * 授權為 HOLD_BSS_BULK_REUSE_RIGHTS_UNCONFIRMED：不得進公開 CDN／static／release allowlist。
 *
 * 語意（必守）：
 * - 自由車流模型時間、不含壅塞；是「單橋（或聯合）失效的後果」，不是風險（不含災害機率）；人口不等於實際旅次。
 * - 淡江大橋交流道匝道一併移除（使用者標「不確定」算不算橋體），指標屬上界。
 * - `village_impacts.villages[VILLCODE][field][i]` 對應 `scenarios[i]`；p90 為 null＝沒有受影響目的地，不是 0。
 * - 替代路線只是人口權重最大的 3 組起訖對（代表性起訖對），不一定是繞最遠的。
 * - 目的地視角（village_destinations）：只有「各目的地行政區彙整」與「前 20 名受影響目的地村里」，
 *   沒有逐村里的 ΔT。地圖顏色因此是「該村里所在行政區」的平均額外時間（只算受影響目的地），不是該村里自己的 ΔT。
 */

export const BRIDGE_RESILIENCE_KEY = "bridgeResilienceTwinCity" as const;
export type BridgeResilienceLayerKey = typeof BRIDGE_RESILIENCE_KEY;
export const BRIDGE_RESILIENCE_PRIVATE_LAYER_KEYS = [BRIDGE_RESILIENCE_KEY] as const;
export const isBridgeResiliencePrivateLayer = (key: string): key is BridgeResilienceLayerKey => key === BRIDGE_RESILIENCE_KEY;

export const BRIDGE_RESILIENCE_PRIVATE_ENDPOINT = "/api/private-research/bridge-resilience";
export const BRIDGE_RESILIENCE_ACCESS_DENIED_EVENT = "bridge-resilience-access-denied";
export const BRIDGE_RESILIENCE_SELECTION_CLEAR_EVENT = "bridge-resilience-selection-clear";

/** 資產契約；與 sidecar `BRIDGE_RESILIENCE_ASSETS`、上傳腳本共用同一組數字（測試逐一比對）。 */
export const BRIDGE_RESILIENCE_ASSETS = {
  tiles: { filename: "bridge-resilience-20260930-v2.pmtiles", size: 1944552, sha256: "434e38bdcdf63c940529a7320242feb3c6fe8d5d560c94443b433c1fc8b88852" },
  summary: { filename: "bridge_summary.json", size: 63004, sha256: "4b04d5bbcf5c76f7f3249fb0afe6b939dc1c02734e622ddb88188cfea9481574" },
  impacts: { filename: "village_impacts.json", size: 1333831, sha256: "4df8f4cb0b96d4fe2b2a1f75eae0c5d8da9b9d344e56cec21960aa4319f02764" },
  destinations: { filename: "village_destinations.json", size: 6425352, sha256: "d2da42284a26e7b14c76228bfd5cb901579dd8fe63621104a543eb56fb2864b5" },
} as const;
export type BridgeResilienceAssetName = keyof typeof BRIDGE_RESILIENCE_ASSETS;
export const bridgeResilienceAssetUrl = (name: BridgeResilienceAssetName) => `${BRIDGE_RESILIENCE_PRIVATE_ENDPOINT}/${name}`;

export const BRIDGE_RESILIENCE_SOURCE_ID = "bridge-resilience";
export const BRIDGE_RESILIENCE_SOURCE_LAYERS = { bridges: "bridges", routes: "replacement_routes", villages: "villages" } as const;
export const BRIDGE_RESILIENCE_MIN_ZOOM = 8;
export const BRIDGE_RESILIENCE_MAX_ZOOM = 14;
export const BRIDGE_RESILIENCE_RIGHTS_TEXT = "橋的身份判定鏈用到 BSS，批次重用權利待確認（HOLD；僅站主研究用，不公開散布）";
export const BRIDGE_RESILIENCE_ATTRIBUTION = "OpenStreetMap contributors (ODbL)；新北市政府橋梁清冊；內政部戶籍人口 114Y06M；BSS 判定鏈授權 HOLD，僅站主研究；研究中：自由車流失效後果，非風險";

/** style layer id（字面值，供點擊接線 ratchet 比對）。 */
export const BRIDGE_RESILIENCE_LAYER_IDS = {
  villageFill: "bridge-resilience-village-fill",
  villageOutline: "bridge-resilience-village-outline",
  destTop: "bridge-resilience-dest-top",
  origin: "bridge-resilience-origin",
  highlight: "bridge-resilience-highlight",
  routeBefore: "bridge-resilience-route-before",
  routeAfter: "bridge-resilience-route-after",
  ground: "bridge-resilience-ground",
  structure: "bridge-resilience-structure",
  hit: "bridge-resilience-hit",
} as const;
/**
 * 可點選的層：橋梁線層開 popup；村里面（villageFill）只在選橋後顯示，點下去是「進入目的地視角」，
 * 不換 popup、不取消選橋（useMapInteraction 依 layer id 分流）。村里面在最底層，重疊時橋線先命中。
 */
export const BRIDGE_RESILIENCE_CLICK_LAYERS = [
  BRIDGE_RESILIENCE_LAYER_IDS.hit, BRIDGE_RESILIENCE_LAYER_IDS.structure, BRIDGE_RESILIENCE_LAYER_IDS.ground,
  BRIDGE_RESILIENCE_LAYER_IDS.villageFill,
] as const;

export type BridgeMode = "car" | "scooter";
export const BRIDGE_MODES: readonly BridgeMode[] = ["car", "scooter"];
export const BRIDGE_MODE_LABELS: Record<BridgeMode, string> = { car: "汽車", scooter: "機車" };
export type VillageMetric = "p90" | "share";
export const VILLAGE_METRICS: readonly VillageMetric[] = ["p90", "share"];

/** 資料色（不進 chrome token）：汽車、機車分色，地面引道以同色淡化＋虛線。 */
export const BRIDGE_RESILIENCE_COLORS = {
  car: "#f59e0b",
  scooter: "#22d3ee",
  highlight: "#ffffff",
  routeBefore: "#94a3b8",
  routeAfter: "#f43f5e",
  villageNeutral: "#64748b",
  villageOutline: "#e2e8f0",
  /** 目的地視角：不可達（移除後無路可達）與起點、前 20 名外框。 */
  destUnreachable: "#a855f7",
  destOrigin: "#ffffff",
  destTop: "#38bdf8",
} as const;
export const BRIDGE_RESILIENCE_GROUND_OPACITY_FACTOR = 0.45;

/** 村里色階（資料色）。p90 單位為秒；share 為 0–1 比例。 */
export const BRIDGE_RESILIENCE_RAMP = ["#fef3c7", "#fcd34d", "#fb923c", "#ef4444", "#991b1b", "#4c0519"] as const;
export const VILLAGE_METRIC_BREAKS: Record<VillageMetric, readonly number[]> = {
  p90: [60, 120, 180, 300, 600],
  share: [0.01, 0.05, 0.1, 0.2, 0.4],
};
export const VILLAGE_METRIC_LABELS: Record<VillageMetric, string> = {
  p90: "額外時間 p90",
  share: "受影響目的地人口比",
};

/** 聯合情境：沒有自己的線，以兩座成員橋的線高亮。 */
export const BRIDGE_JOINT_KEY = "關渡大橋+淡江大橋";
export const BRIDGE_JOINT_MEMBERS: readonly string[] = ["關渡大橋", "淡江大橋"];
export const isJointMember = (uid: string | null | undefined) => !!uid && BRIDGE_JOINT_MEMBERS.includes(uid);

export const BRIDGE_RESILIENCE_LIMITS_TEXT = [
  "自由車流模型時間，不含壅塞；是單橋失效的後果，不是風險（不含災害機率）。",
  "人口為戶籍人口，不等於實際旅次；日夜間人口為模擬資料，僅供對照。",
  "淡江大橋的交流道匝道一併移除（是否算橋體待確認），指標屬上界。",
] as const;

// ── 型別：bridge_summary.json／village_impacts.json ─────────────────

export interface BridgeAltCandidate { label: string; weight_share: number; pairs: number }
export interface BridgeModeSummary {
  p90_dT_s: number | null;
  mean_dT_s: number | null;
  accessibility_loss: number | null;
  ES_pop_weighted?: number | null;
  exposed_population_gt60s: number | null;
  stranded_population: number | null;
  n_removed_edges?: number | null;
  replacement_bridges?: {
    basis?: string;
    same_river_within_5km?: BridgeAltCandidate[];
    other_bridges_on_route?: BridgeAltCandidate[];
  };
  alt_population_weights?: { day?: { p90_dT_s: number | null; accessibility_loss: number | null }; night?: { p90_dT_s: number | null; accessibility_loss: number | null } };
  sensitivity_scooter_expressway_ban?: { label?: string; p90_dT_s: number | null; accessibility_loss: number | null };
}
export interface BridgeSummaryEntry {
  bridge_uid: string;
  is_joint_scenario: boolean;
  members: string[];
  river: string;
  human_review: {
    status?: string;
    latest_review_date?: string | null;
    /** 單橋是字串；聯合情境是「成員 → 評級」物件。 */
    geometry_confidence?: string | Record<string, string> | null;
    notes?: string[];
  };
  modes: Partial<Record<BridgeMode, BridgeModeSummary>>;
}
export interface BridgeSummary { meta?: Record<string, unknown>; bridges: Record<string, BridgeSummaryEntry> }

export interface VillageImpacts {
  scenarios: string[];
  fields?: Record<string, unknown>;
  villages: Record<string, Record<string, Array<number | null>>>;
}
export interface BridgeResilienceData { summary: BridgeSummary; impacts: VillageImpacts }

// ── 純函式（測試涵蓋）──────────────────────────────────────────────

export const scenarioKey = (bridgeUid: string, mode: BridgeMode) => `${bridgeUid}|${mode}`;

/** 目前有效的情境橋名：聯合開關只對關渡／淡江生效。 */
export function effectiveScenarioUid(uid: string | null, joint: boolean): string | null {
  if (!uid) return null;
  return joint && isJointMember(uid) ? BRIDGE_JOINT_KEY : uid;
}
/** 要高亮的成員橋（聯合情境＝兩座）。 */
export function highlightUids(uid: string | null, joint: boolean): string[] {
  if (!uid) return [];
  return joint && isJointMember(uid) ? [...BRIDGE_JOINT_MEMBERS] : [uid];
}

/**
 * 解出一個情境下每個村里的值。null 保留為 null（不當 0）：
 * p90 為 null＝沒有受影響目的地；affected_dest_pop_share 的 0 是真實的 0，兩者不可混淆。
 * 情境不存在回 null（呼叫端據此清除村里色彩）。
 */
export function decodeVillageScenario(
  impacts: VillageImpacts, scenario: string, metric: VillageMetric,
): Map<number, number | null> | null {
  const index = impacts.scenarios.indexOf(scenario);
  if (index < 0) return null;
  const field = metric === "p90" ? "p90_dT_s" : "affected_dest_pop_share";
  const out = new Map<number, number | null>();
  for (const [code, fields] of Object.entries(impacts.villages)) {
    const raw = fields[field]?.[index];
    const id = Number(code);
    if (!Number.isSafeInteger(id)) continue;
    out.set(id, typeof raw === "number" && Number.isFinite(raw) ? raw : null);
  }
  return out;
}

/** 村里填色：有值走色階；沒有 has=1 的（null／未設定）一律中性色，不當 0。 */
export function villageFillColorExpression(metric: VillageMetric): ExpressionSpecification {
  const breaks = VILLAGE_METRIC_BREAKS[metric];
  const step: unknown[] = ["step", ["coalesce", ["feature-state", "v"], 0], BRIDGE_RESILIENCE_RAMP[0]];
  breaks.forEach((value, i) => step.push(value, BRIDGE_RESILIENCE_RAMP[i + 1]));
  return ["case", ["==", ["feature-state", "has"], 1], step, BRIDGE_RESILIENCE_COLORS.villageNeutral] as unknown as ExpressionSpecification;
}

export const bridgeModeColorExpression: ExpressionSpecification = [
  "match", ["get", "mode"], "scooter", BRIDGE_RESILIENCE_COLORS.scooter, BRIDGE_RESILIENCE_COLORS.car,
];

// ── 目的地視角（village_destinations.json）──────────────────────────

/** 檔案格式見 analytics 專題 README §8b。d／t／u 都是攤平陣列（5／3／3 元組）。 */
export interface DestinationRecord { d?: number[]; t?: number[]; u?: number[] }
export interface VillageDestinations {
  scenarios: string[];
  villages: string[];
  village_names: string[];
  districts: [string, string][];
  village_district: number[];
  data: Record<string, Record<string, DestinationRecord>>;
}
export interface DestinationDistrictRow {
  district: number; label: string; affectedPop: number; sharePermille: number; meanDtS: number; maxDtS: number;
}
export interface DestinationTopRow { village: number; code: string; name: string; districtLabel: string; dtS: number; pop: number }
export interface DestinationUnreachableRow { district: number; label: string; pop: number; villages: number }
export interface DestinationView {
  originIndex: number; originCode: string; originName: string; originDistrictLabel: string; scenario: string;
  /** 依受影響人口比由大到小。只含有受影響目的地的區（稀疏）。 */
  districts: DestinationDistrictRow[];
  /** 前 20 名受影響目的地村里（ΔT 由大到小，檔案順序）。 */
  top: DestinationTopRow[];
  unreachable: DestinationUnreachableRow[];
  /** 這個起點在此情境沒有任何受影響（ΔT>60 秒）目的地：不是 0 分鐘變慢，而是未達門檻。 */
  noAffected: boolean;
}

export const districtLabel = (dest: VillageDestinations, index: number): string => {
  const pair = dest.districts[index];
  return pair ? (pair[0] === pair[1] ? pair[0] : `${pair[0]}${pair[1]}`) : "未知區";
};
/** 顯示用：行政區只留「區」名（雙北區名不重複），county 缺時退回全稱。 */
export const districtShortLabel = (dest: VillageDestinations, index: number): string => dest.districts[index]?.[1] ?? "未知區";

/** VILLCODE 字串 → 檔案內村里索引；找不到回 -1。 */
export function destinationVillageIndex(dest: VillageDestinations, code: string): number {
  return dest.villages.indexOf(code);
}

/**
 * 解出「起點 originCode 在情境 scenario 下」的目的地視角；情境或起點不存在回 null。
 * 稀疏記錄：起點沒有記錄＝沒有受影響（也沒有不可達）目的地，回傳 noAffected=true 而不是 null。
 */
export function decodeDestinationView(dest: VillageDestinations, scenario: string, originCode: string): DestinationView | null {
  const si = dest.scenarios.indexOf(scenario);
  const oi = destinationVillageIndex(dest, originCode);
  if (si < 0 || oi < 0) return null;
  const record: DestinationRecord = dest.data[String(si)]?.[String(oi)] ?? {};
  const districts: DestinationDistrictRow[] = [];
  const d = record.d ?? [];
  for (let i = 0; i + 4 < d.length; i += 5) {
    districts.push({ district: d[i]!, label: districtShortLabel(dest, d[i]!), affectedPop: d[i + 1]!, sharePermille: d[i + 2]!, meanDtS: d[i + 3]!, maxDtS: d[i + 4]! });
  }
  districts.sort((a, b) => b.sharePermille - a.sharePermille || b.affectedPop - a.affectedPop || a.district - b.district);
  const top: DestinationTopRow[] = [];
  const t = record.t ?? [];
  for (let i = 0; i + 2 < t.length; i += 3) {
    const v = t[i]!;
    top.push({ village: v, code: dest.villages[v] ?? "", name: dest.village_names[v] ?? "", districtLabel: districtShortLabel(dest, dest.village_district[v] ?? -1), dtS: t[i + 1]!, pop: t[i + 2]! });
  }
  const unreachable: DestinationUnreachableRow[] = [];
  const u = record.u ?? [];
  for (let i = 0; i + 2 < u.length; i += 3) unreachable.push({ district: u[i]!, label: districtShortLabel(dest, u[i]!), pop: u[i + 1]!, villages: u[i + 2]! });
  return {
    originIndex: oi, originCode, originName: dest.village_names[oi] ?? "", scenario,
    originDistrictLabel: districtLabel(dest, dest.village_district[oi] ?? -1),
    districts, top, unreachable, noAffected: districts.length === 0,
  };
}

/** feature-state `has`：0 中性（未受影響）、1 有受影響（v＝所在區平均 ΔT 秒）、2 不可達、3 起點。 */
export const DEST_STATE = { neutral: 0, affected: 1, unreachable: 2, origin: 3 } as const;
export interface DestinationVillageState { has: number; v: number }

/**
 * 每個村里的目的地視角著色：繼承其所在行政區的平均 ΔT（只算受影響者）；
 * 該區有不可達目的地且沒有受影響者時標為不可達；起點自己是 origin；其餘中性。
 * 資料只到「區」層級（前 20 名以外沒有逐村里 ΔT），所以同區村里同色。
 */
export function destinationVillageStates(dest: VillageDestinations, view: DestinationView): Map<number, DestinationVillageState> {
  const byDistrict = new Map(view.districts.map((row) => [row.district, row]));
  const unreachable = new Set(view.unreachable.map((row) => row.district));
  const out = new Map<number, DestinationVillageState>();
  dest.villages.forEach((code, index) => {
    const id = Number(code);
    if (!Number.isSafeInteger(id)) return;
    if (index === view.originIndex) { out.set(id, { has: DEST_STATE.origin, v: 0 }); return; }
    const district = dest.village_district[index] ?? -1;
    const row = byDistrict.get(district);
    if (row) out.set(id, { has: DEST_STATE.affected, v: row.meanDtS });
    else if (unreachable.has(district)) out.set(id, { has: DEST_STATE.unreachable, v: 0 });
    else out.set(id, { has: DEST_STATE.neutral, v: 0 });
  });
  return out;
}

/** 目的地視角色階（秒，行政區平均 ΔT）；沿用 p90 的分界，讓兩種視角的顏色可以對照。 */
export const DEST_MEAN_BREAKS: readonly number[] = VILLAGE_METRIC_BREAKS.p90;

/** 目的地視角的村里填色：origin／不可達／中性各自一色，受影響走色階。 */
export function destinationFillColorExpression(): ExpressionSpecification {
  const step: unknown[] = ["step", ["coalesce", ["feature-state", "v"], 0], BRIDGE_RESILIENCE_RAMP[0]];
  DEST_MEAN_BREAKS.forEach((value, i) => step.push(value, BRIDGE_RESILIENCE_RAMP[i + 1]));
  return ["case",
    ["==", ["feature-state", "has"], DEST_STATE.affected], step,
    ["==", ["feature-state", "has"], DEST_STATE.unreachable], BRIDGE_RESILIENCE_COLORS.destUnreachable,
    BRIDGE_RESILIENCE_COLORS.villageNeutral,
  ] as unknown as ExpressionSpecification;
}

/** 目的地視角外框 filter 用的 feature id 清單（前 20 名目的地）。 */
export const destinationTopIds = (view: DestinationView | null): number[] =>
  view ? view.top.map((row) => Number(row.code)).filter((id) => Number.isSafeInteger(id)) : [];

/** 人口比（‰）→ 百分比文字；0.4% 以下保留 1 位小數。 */
export function sharePermilleText(permille: number): string {
  const pct = permille / 10;
  return `${pct.toLocaleString("zh-TW", { minimumFractionDigits: pct < 10 && pct !== Math.round(pct) ? 1 : 0, maximumFractionDigits: 1 })}%`;
}

// ── 格式化（popup 用）────────────────────────────────────────────────

/** 秒 → 分鐘（1 位小數）；null／非有限值回 null，由呼叫端決定顯示語意。 */
export function secondsToMinutes(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value / 6) / 10 : null;
}
export function minutesText(value: unknown, nullText = "無受影響目的地"): string {
  const minutes = secondsToMinutes(value);
  return minutes === null ? nullText : `${minutes.toLocaleString("zh-TW", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} 分鐘`;
}
/** 0.001 = 0.1%；null → 未提供。 */
export function lossPercentText(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
    : "未提供";
}
export function populationText(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value).toLocaleString("zh-TW")} 人` : "未提供";
}
export function geometryConfidenceText(value: string | Record<string, string> | null | undefined): string {
  if (!value) return "未提供";
  if (typeof value === "string") return value;
  return Object.entries(value).map(([name, grade]) => `${name} ${grade}`).join("；");
}
