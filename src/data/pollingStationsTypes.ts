// 2024 投開票所（公開）— overlay／圖例／popup／hook 共用的單一真實來源。
// 政黨色沿用 2026 選舉活動（electionEventsTypes.ts），不另造色號。
import { ELECTION_CAMP_COLOR } from "./electionEventsTypes";
import { STATISTICS_SEQUENTIAL_SCHEMES } from "./statisticsVisuals";

/**
 * 低於此 zoom 不抓、不畫（圖例改顯示「放大到街區層級才顯示」）。
 * 取 12 而非 11：雙北 z11 桌機視窗約 5,000 所，超過上限；z12 約 3,300–4,000（2026-11-03 dry-run 實測）。
 */
export const POLLING_MIN_ZOOM = 12;

/** 每次 bbox 查詢上限（RPC p_limit，DB 端夾在 5000 內；超過時 meta.truncated=true，RPC 以雜湊均勻取樣） */
export const POLLING_FETCH_LIMIT = 4000;

/** 2024 總統領先政黨（loader 依三組票數衍生 `lead`；同票＝tie） */
export type PollingLeadKey = "dpp" | "kmt" | "tpp" | "tie";

export const POLLING_LEAD_COLOR: Record<PollingLeadKey, string> = {
  dpp: ELECTION_CAMP_COLOR.dpp,
  kmt: ELECTION_CAMP_COLOR.kmt,
  tpp: ELECTION_CAMP_COLOR.tpp,
  tie: ELECTION_CAMP_COLOR.other,
};

export const POLLING_LEAD_KEYS: readonly PollingLeadKey[] = ["dpp", "kmt", "tpp", "tie"];

/**
 * 著色模式（layerParamsSpec select 的 encode 順序；idx 0＝領先政黨、1＝投票率、2＝中性）。
 * ⚠️ 只能往尾端 append：既有分享網址與黃金快照的 idx 0／1 語意不可變。選單 UI 的排序與預設另在 spec 宣告（中性排第一、預設中性）。
 */
export const POLLING_COLOR_MODES = ["lead", "turnout", "neutral"] as const;
export type PollingColorMode = (typeof POLLING_COLOR_MODES)[number];
export const POLLING_DEFAULT_COLOR_MODE: PollingColorMode = "neutral";

/** 中性模式的單色（點與熱區）：圖層代表色紫，刻意避開政黨色 */
export const POLLING_NEUTRAL_COLOR = "#8b5cf6";

// ── 低縮放熱區（zoom < POLLING_MIN_ZOOM；RPC get_polling_stations_2024_heat）──
/** 三黨熱區（領先政黨模式）；順序＝圖層疊放順序（後者在上）與開關順序 */
export const POLLING_HEAT_PARTIES = ["dpp", "kmt", "tpp"] as const;
export type PollingHeatParty = (typeof POLLING_HEAT_PARTIES)[number];
/** 熱區權重的除數：選舉人數 ÷ 1000、各黨票數 ÷ 500（三黨同一除數，強弱才可互比） */
export const POLLING_HEAT_ELECTORS_UNIT = 1000;
export const POLLING_HEAT_VOTES_UNIT = 500;
/**
 * 熱區與點位交接：熱區在 z11.5 前全不透明，z12.5 淡到 0；點位 z12 起出現、z12.5 淡入到滿。
 * 點位受 bbox 查詢上限限制只能 z ≥ 12 才抓（見 POLLING_MIN_ZOOM），交接區因此落在 z11.5–12.5。
 */
export const POLLING_HEAT_FADE: readonly [number, number] = [11.5, 12.5];
export const POLLING_POINT_FADE: readonly [number, number] = [12, 12.5];
/** 單一熱區 7 階色（同色、深淺）；alpha 淡入由 heatmapColorExpr 負責 */
export function pollingHeatRamp(hex: string): string[] {
  const n = Number.parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // 低密度偏淡（往白混 45%）→ 高密度原色
  return [0.45, 0.38, 0.3, 0.22, 0.14, 0.07, 0].map((w) =>
    `#${rgb.map((c) => Math.round(c + (255 - c) * w).toString(16).padStart(2, "0")).join("")}`,
  );
}

/** 投票率五階（%）：門檻取主圖層 15,626 所的約 20／40／60／80 百分位（69.7／72.1／73.9／75.6）取整 */
export const POLLING_TURNOUT_BREAKS: readonly number[] = [70, 72, 74, 76];
/** 序列色（低→高）：沿用統計色票 environment（紫），刻意避開政黨色 */
export const POLLING_TURNOUT_COLORS: readonly string[] = STATISTICS_SEQUENTIAL_SCHEMES.environment.colors;

/** precision='road'（僅路名、位置約略）的透明度倍率 */
export const POLLING_ROAD_OPACITY = 0.45;

export const POLLING_PRECISIONS = ["poi_name", "address_door", "tgos_door", "google", "road"] as const;
export type PollingPrecision = (typeof POLLING_PRECISIONS)[number];

export const POLLING_SOURCE_URL =
  "https://data.cec.gov.tw/第16任總統副總統及第11屆立法委員選舉投開票所/113.csv";

function finite(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** 三組票數 → 領先政黨；票數缺值或全 0 視為 tie（灰） */
export function pollingLead(props: Record<string, unknown>): PollingLeadKey {
  const votes: [PollingLeadKey, number][] = [
    ["dpp", finite(props.pres24_dpp_votes) ?? -1],
    ["kmt", finite(props.pres24_kmt_votes) ?? -1],
    ["tpp", finite(props.pres24_tpp_votes) ?? -1],
  ];
  const max = Math.max(...votes.map(([, v]) => v));
  if (max <= 0) return "tie";
  const leaders = votes.filter(([, v]) => v === max);
  return leaders.length === 1 ? leaders[0]![0] : "tie";
}

export { finite as pollingNumber };
