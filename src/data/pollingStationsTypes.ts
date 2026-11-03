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

/** 著色模式（layerParamsSpec select 的 encode 順序；idx 0＝領先政黨） */
export const POLLING_COLOR_MODES = ["lead", "turnout"] as const;

/** 投票率五階（%）：門檻取主圖層 15,626 所的約 20／40／60／80 百分位（69.7／72.1／73.9／75.6）取整 */
export const POLLING_TURNOUT_BREAKS: readonly number[] = [70, 72, 74, 76];
/** 序列色（低→高）：沿用統計色票 environment（紫），刻意避開政黨色 */
export const POLLING_TURNOUT_COLORS: readonly string[] = STATISTICS_SEQUENTIAL_SCHEMES.environment.colors;

/** precision='road'（僅路名、位置約略）的透明度倍率 */
export const POLLING_ROAD_OPACITY = 0.45;

export const POLLING_PRECISIONS = ["poi_name", "address_door", "tgos_door", "road"] as const;
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
