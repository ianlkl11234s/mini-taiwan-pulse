/**
 * 圖層登記簿的「長期時間」欄位（`LayerManifestEntry.longTerm`）。
 *
 * 規範正本：`docs/features/longterm-time/STANDARD.md`（五類、共同規則、新圖層檢查清單）。
 * 本檔只定義形狀；檢查在 `src/data/__tests__/layerLongTerm.test.ts`，
 * 播放速度、熱區門檻等 UI 共用常數在 `src/lib/longTermTime.ts`。
 *
 * 適用：資料涵蓋超過 30 天、而且「隨時間變化」有意義的圖層。
 * 靜態圖層、只保留 30 天內的即時圖層、情境模擬與地震回放**不寫本欄**（缺席＝不適用）。
 *
 * 日期一律寫西元 `YYYY-MM-DD`；台灣圖層顯示民國年是 UI 的事，登記簿不存民國年。
 */

/**
 * 五類（STANDARD.md §1）。
 * - `event` 事件點：一筆一筆、各帶日期的事件，能整包載進瀏覽器（每期約 5 MB 以內）
 * - `eventTiles` 大量事件：同上但必須切圖磚；件數一律讀件數檔，不能數圖磚
 * - `dailyValue` 每日數值：測站或全台系統每天一個數值
 * - `periodStats` 分期統計：區域統計（縣市、鄉鎮、村里），每期一份
 * - `periodSnapshot` 分期快照：整片網格或面，每期一份
 */
export type LongTermKind = "event" | "eventTiles" | "dailyValue" | "periodStats" | "periodSnapshot";

/** 資料的最細粒度。 */
export type LongTermGranularity = "day" | "month" | "quarter" | "year";

/**
 * 能不能「拖一段」選一個期間（STANDARD.md §1、§4 第 2 題）。由類別決定，不在各層手填：
 * 只有事件點與大量事件可以；每日數值、分期統計、分期快照只能點一格，對照多期用「多年份並排」。
 */
export const LONG_TERM_RANGE_SELECT: Readonly<Record<LongTermKind, boolean>> = {
  event: true,
  eventTiles: true,
  dailyValue: false,
  periodStats: false,
  periodSnapshot: false,
};

/** 各類允許的最細粒度（測試據此檢查「類別與粒度相容」）。 */
export const LONG_TERM_GRANULARITIES: Readonly<Record<LongTermKind, readonly LongTermGranularity[]>> = {
  event: ["day", "month", "quarter", "year"],
  /** 圖磚只保留整數欄 `ym`（YYYYMM），最細到月 */
  eventTiles: ["month", "quarter", "year"],
  dailyValue: ["day"],
  periodStats: ["month", "quarter", "year"],
  periodSnapshot: ["month", "quarter", "year"],
};

/**
 * 路徑樣式：靜態檔寫法同 manifest `url`（`./dir/file`），static-rpc 快照寫 `/static-rpc/…json`。
 * 每年一檔時以 `<year>`（西元）或 `<rocYear>`（民國）佔位，測試依涵蓋年份展開後逐檔檢查部署。
 * 佔位用角括號是刻意的：`deploy/cloudflare/site_manifest.py` 會掃 src 字串，含 `<>` 的視為範例而不當成實體檔。
 */
export type LongTermAssetPattern = string;

/** 每期一檔（事件點的年檔、分期快照的年檔）。 */
export interface LongTermPeriodFiles {
  form: "periodFiles";
  files: readonly LongTermAssetPattern[];
  /** 每筆的時間欄與口徑（人讀） */
  note: string;
}

/** 單一檔案，以檔內欄位切期（房地產網格的 `period`、交易點的 `trade_ts`）。 */
export interface LongTermSingleFile {
  form: "singleFile";
  file: LongTermAssetPattern;
  /** 檔內用來切期的欄位名 */
  timeField: string;
  note: string;
}

/**
 * 大量事件：圖磚＋同版件數檔。圖磚每筆保留整數欄 `ym`（YYYYMM）；
 * 件數檔與圖磚由同一支 pipeline 產生、同版發布，且必須登記在 source 的 `companionAssets`。
 */
export interface LongTermTilesWithCounts {
  form: "tilesWithCounts";
  tiles: LongTermAssetPattern;
  counts: LongTermAssetPattern;
  note: string;
}

/**
 * 序列檔（每日數值、分期統計）：已結束的期別做成 R2 檔；每日數值的「今天」才走 RPC。
 * 不為時間條另開 Supabase 表（ADR-0026）。
 */
export interface LongTermSeries {
  form: "series";
  file: LongTermAssetPattern;
  /** 每日數值補今天用的 RPC 名稱 */
  todayRpc?: string;
  /** 有「每站每日」檔時填；沒有就只畫圖，地圖標「顯示的是現在」 */
  perStationFile?: LongTermAssetPattern;
  note: string;
}

/** 斷點：口徑在這天改變（縣市改制、定義變更…），時間條畫直線並附說明，不連成一條線。 */
export interface LongTermBreak {
  /** 西元日期，必須落在涵蓋範圍內 */
  at: string;
  note: string;
}

/**
 * 細節分層：哪段有完整細節、哪段只剩彙總或較粗的版本（時間條用另一種畫法）。
 * 各段必須落在涵蓋範圍內、彼此不重疊。
 */
export interface LongTermDetailTier {
  from: string;
  to: string;
  /** `full`＝完整（逐筆或最細）；`reduced`＝只剩彙總、較粗或不完整 */
  level: "full" | "reduced";
  note: string;
  /** 只有這段才有的額外檔（例：人口 res8 只到 108 年），佔位規則同 `LongTermAssetPattern` */
  files?: readonly LongTermAssetPattern[];
}

/** 涵蓋起訖。`end: "ongoing"`＝持續更新中（每日數值、仍在收的事件）。 */
export interface LongTermCoverage {
  start: string;
  end: string | "ongoing";
}

interface LongTermBase<K extends LongTermKind, D> {
  kind: K;
  coverage: LongTermCoverage;
  granularity: LongTermGranularity;
  data: D;
  /** 能否加總成全國／整層總量。比率、平均、中位數、密度一律 false（只畫期別刻度或點選區域的折線）。 */
  summable: boolean;
  /** 沒有斷點寫空陣列（有意識地確認過） */
  breaks: readonly LongTermBreak[];
  detailTiers?: readonly LongTermDetailTier[];
}

/**
 * 長期時間欄位。依類別限定資料形式（型別護欄），其餘相容性由測試檢查。
 * 圖層標記（時鐘 icon＋tooltip）、時間條軸長與 tooltip 都從這裡產生，不另外手寫。
 */
export type LongTermSpec =
  | LongTermBase<"event", LongTermPeriodFiles | LongTermSingleFile>
  | LongTermBase<"eventTiles", LongTermTilesWithCounts>
  | LongTermBase<"dailyValue", LongTermSeries>
  | LongTermBase<"periodStats", LongTermSeries>
  | LongTermBase<"periodSnapshot", LongTermPeriodFiles | LongTermSingleFile>;
