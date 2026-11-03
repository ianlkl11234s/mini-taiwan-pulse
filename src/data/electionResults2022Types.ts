// 2022 村里得票（公開）— overlay／圖例／popup／hook 共用的單一真實來源。
// 政黨色沿用 2026 選舉活動（electionEventsTypes.ts）；無黨籍、其他另給色，不併入同一類。
import { ELECTION_CAMP_COLOR } from "./electionEventsTypes";
import { POLLING_TURNOUT_COLORS } from "./pollingStationsTypes";

/** 低於此 zoom 不抓、不畫（RPC 在 z<8 也回空） */
export const VILLAGE_RESULTS_MIN_ZOOM = 8;
/** RPC 在 z ≥ 10 才回完整欄位（縣市、鄉鎮、合併組、各黨得票率）；z8–9 只回精簡欄位 */
export const VILLAGE_RESULTS_FULL_ZOOM = 10;
/** 傳給 RPC 的 zoom 上限（再放大幾何不再變細，共用快取） */
export const VILLAGE_RESULTS_MAX_QUERY_ZOOM = 14;

/** 選舉（select encode 順序；idx 0＝縣市長、1＝議員政黨合計）→ 欄位前綴 */
export const VILLAGE_ELECTIONS = ["mayor", "council"] as const;
export type VillageElection = (typeof VILLAGE_ELECTIONS)[number];
export const VILLAGE_ELECTION_PREFIX: Record<VillageElection, "m" | "c"> = { mayor: "m", council: "c" };

/** 著色（select encode 順序；idx 0＝最高黨、1＝領先差距、2＝投票率） */
export const VILLAGE_COLOR_MODES = ["top", "margin", "turnout"] as const;
export type VillageColorMode = (typeof VILLAGE_COLOR_MODES)[number];

export type VillageTopKey = "dpp" | "kmt" | "tpp" | "ind" | "other";
/** 最高黨的類別；縣市長沒有 ind（無黨籍候選人併在 other），議員的無黨籍單獨一類 */
export const VILLAGE_TOP_KEYS: Record<VillageElection, readonly VillageTopKey[]> = {
  mayor: ["dpp", "kmt", "tpp", "other"],
  council: ["dpp", "kmt", "tpp", "ind", "other"],
};

export const VILLAGE_TOP_COLOR: Record<VillageTopKey, string> = {
  dpp: ELECTION_CAMP_COLOR.dpp,
  kmt: ELECTION_CAMP_COLOR.kmt,
  tpp: ELECTION_CAMP_COLOR.tpp,
  ind: "#f08c2e",
  other: "#b08968",
};

/** status='missing'（2022 無對應結果）與數值缺漏一律灰，不畫成 0 */
export const VILLAGE_MISSING_COLOR = "#9ca3af";

/**
 * 領先差距（百分點）：以最高黨為方向的雙向色階——民進黨領先往綠、國民黨領先往藍，越深差越多；
 * 其他黨（民眾黨、無黨籍、其他）領先時直接用該類色。只用 *_top＋*_margin_pp，z8–9 的精簡欄位也畫得出來。
 */
export const VILLAGE_MARGIN_BREAKS: readonly number[] = [5, 15, 30];
export const VILLAGE_MARGIN_DPP: readonly string[] = ["#c7e9c0", "#74c476", "#31a354", "#006d2c"];
export const VILLAGE_MARGIN_KMT: readonly string[] = ["#c6dbef", "#6baed6", "#3182bd", "#08519c"];

/** 投票率五階（%）：2022 地方選舉投票率約 60%，門檻比 2024 總統低一截 */
export const VILLAGE_TURNOUT_BREAKS: readonly number[] = [52, 56, 60, 64];
export const VILLAGE_TURNOUT_COLORS: readonly string[] = POLLING_TURNOUT_COLORS;

export const VILLAGE_STATUSES = ["ok", "merged", "missing"] as const;
export type VillageStatus = (typeof VILLAGE_STATUSES)[number];

export const VILLAGE_RESULTS_SOURCE_URL = "https://data.cec.gov.tw/選舉資料庫/votedata.zip";

/** fill-color 表達式（overlay paint 與測試共用） */
export function villageFillColor(election: VillageElection, mode: VillageColorMode): unknown[] {
  const px = VILLAGE_ELECTION_PREFIX[election];
  const top = ["get", `${px}_top`];
  const topMatch = [
    "match", top,
    ...VILLAGE_TOP_KEYS[election].flatMap((k) => [k, VILLAGE_TOP_COLOR[k]]),
    VILLAGE_MISSING_COLOR,
  ];
  let body: unknown[];
  if (mode === "turnout") {
    const v = ["get", `${px}_turnout`];
    body = [
      "case", ["!=", ["typeof", v], "number"], VILLAGE_MISSING_COLOR,
      ["step", v, VILLAGE_TURNOUT_COLORS[0], ...VILLAGE_TURNOUT_BREAKS.flatMap((b, i) => [b, VILLAGE_TURNOUT_COLORS[i + 1]])],
    ];
  } else if (mode === "margin") {
    const m = ["coalesce", ["get", `${px}_margin_pp`], 0];
    const ramp = (colors: readonly string[]) => ["step", m, colors[0], ...VILLAGE_MARGIN_BREAKS.flatMap((b, i) => [b, colors[i + 1]])];
    body = [
      "match", top,
      "dpp", ramp(VILLAGE_MARGIN_DPP),
      "kmt", ramp(VILLAGE_MARGIN_KMT),
      ...VILLAGE_TOP_KEYS[election].filter((k) => k !== "dpp" && k !== "kmt").flatMap((k) => [k, VILLAGE_TOP_COLOR[k]]),
      VILLAGE_MISSING_COLOR,
    ];
  } else {
    body = topMatch;
  }
  return ["case", ["==", ["get", "status"], "missing"], VILLAGE_MISSING_COLOR, body];
}
