/**
 * 監看模式（Monitor）靜態 12 欄網格佈局 — 單一真實來源。
 *
 * 座標由**排版沙盒**拖曳定稿後匯出，格式刻意與 react-grid-layout 的 `layout`
 * 陣列相容（`{ i, x, y, w, h }`，x/y/w/h 以 grid cell 為單位、x 值域 0..11）。
 * 目前執行期不做拖曳，只用這份資料驅動 CSS grid 的 gridColumn / gridRow。
 *
 * 要改版面 → 回沙盒拖完重新匯出、覆蓋 `MONITOR_LAYOUT`，
 * 不要在 `MonitorPanel.tsx` 裡手調座標。
 */

export type MonitorWidgetId =
  | "newsFeed"
  | "alertBoard"
  | "histogram"
  | "timeline"
  | "triage"
  | "hotZones"
  | "situationOverview"
  | "taiex"
  | "liveWall"
  | "situationCards"
  | "plaBoard"
  | "foodPriceBoard"
  | "hazardStrip"
  | "powerCard"
  | "erCongestion"
  | "prison"
  | "airportPax";

export interface MonitorGridItem {
  /** widget id（對應 MonitorPanel 的 widget 對照表） */
  i: MonitorWidgetId;
  /** 起始欄（0-based） */
  x: number;
  /** 起始列（0-based） */
  y: number;
  /** 跨欄數 */
  w: number;
  /**
   * 跨列數。
   *
   * ⚠️ `fit: "content"` 的 widget **不吃這個值當高度**（高度由內容決定），
   * 但仍用它與 `y` 決定欄／列的拆解與同欄內的前後順序 —— 沙盒拖曳的縱向尺寸
   * 對這些 widget 只是「排序用的佔位」，不是實際高度。
   */
  h: number;
  /**
   * `"content"` = 高度跟著內容走（不留白、不格內捲，下方 widget 順勢下移）。
   *
   * 沒標的預設吃 `h` 當固定高、超出的部分格內捲 —— 清單／影音類（新聞 Feed、
   * 警報、時間軸、熱區、信號分級）必須維持固定高，否則會被幾百筆內容拉成無限長。
   */
  fit?: "content";
}

/** 欄數（沙盒 cols） */
export const MONITOR_GRID_COLS = 12;
/** 單列高度 px（沙盒 rowHeight） */
export const MONITOR_GRID_ROW_HEIGHT = 40;
/** 格線間距 px（沙盒 margin） */
export const MONITOR_GRID_GAP = 10;

/**
 * 沙盒定稿佈局
 * - 2026-08-03 六版 — PLA 拆出獨立戰情板，與 ER 同寬同高 w5 h15
 * - 2026-08-05 七版 — 新增 foodPriceBoard（食品價格監測）
 * - 2026-08-10 八版 — TAIEX 拆出獨立 widget；plaBoard / foodPriceBoard 加高給圖表
 * - 2026-08-10 九版 — 資訊卡改 `fit: "content"`（高度跟內容、欄內流式下推）
 */
export const MONITOR_LAYOUT: MonitorGridItem[] = [
  { i: "newsFeed", x: 0, y: 0, w: 4, h: 12 },
  { i: "alertBoard", x: 4, y: 0, w: 3, h: 7 },
  { i: "timeline", x: 7, y: 0, w: 5, h: 9 },
  { i: "hotZones", x: 4, y: 7, w: 3, h: 5 },
  { i: "triage", x: 7, y: 9, w: 5, h: 3 },
  { i: "situationOverview", x: 0, y: 12, w: 5, h: 5, fit: "content" },
  { i: "liveWall", x: 5, y: 12, w: 7, h: 14, fit: "content" },
  // TAIEX 從 situationOverview 右側拆出成獨立 widget（2026-08-10）：
  // 原本擠在壓力環旁邊只放得下 150×24 的日線，拆出後給 260×44。
  // 其下同欄 widget y 各 +3。
  { i: "taiex", x: 0, y: 17, w: 5, h: 3, fit: "content" },
  // PLA 從 situationCards 拆出成獨立 plaBoard（2026-08-03）：嚴重度分級 + 120 天趨勢
  // + 空域方位 + 侵擾方式四段。
  // situationCards 只剩健康卡 → h 6→3；其下同欄 widget y 各 +12。
  { i: "situationCards", x: 0, y: 20, w: 5, h: 3, fit: "content" },
  // h 15→13（2026-08-10）：空域方位／侵擾方式改單欄（4+6 列，原本各佔 2+3 列）後，
  // 其餘區塊固定高約 450px，剩下的全歸 120 天趨勢柱狀圖（TrendRow flex:1）。
  // h13 → 柱狀圖約 190px（原本固定 54px）；再加高只會讓柱子過胖，量過才定的值。
  { i: "plaBoard", x: 0, y: 23, w: 5, h: 13, fit: "content" },
  { i: "erCongestion", x: 0, y: 36, w: 5, h: 15, fit: "content" },
  { i: "hazardStrip", x: 5, y: 26, w: 7, h: 8, fit: "content" },
  { i: "powerCard", x: 5, y: 34, w: 7, h: 14, fit: "content" },
  { i: "prison", x: 0, y: 51, w: 2, h: 4, fit: "content" },
  { i: "airportPax", x: 2, y: 51, w: 3, h: 6, fit: "content" },
  // 食品價格監測（2026-08-05）：四指數 2×2 × 180 天。
  // 走右欄 w7 而非比照 PLA 的 w5 —— 2×2 在 w5 每格只剩 ~190px，
  // 迷你走勢圖會擠到看不出形狀；w7 每格約 280px 才讀得出趨勢。
  // h 9→12（2026-08-10）：多出的高度全部灌進四張卡的走勢圖（SPARK_H 34→52 + flex:1）。
  { i: "foodPriceBoard", x: 5, y: 48, w: 7, h: 12, fit: "content" },
];

/** 沙盒 hidden 清單 — 列在這裡的 widget 不渲染（histogram 與時間軸新聞密度重複，2026-07-26 移除） */
export const MONITOR_HIDDEN: MonitorWidgetId[] = ["histogram"];

/** 實際要渲染的格子（過濾 hidden，資料驅動） */
export const MONITOR_VISIBLE_LAYOUT: MonitorGridItem[] = MONITOR_LAYOUT.filter(
  (item) => !MONITOR_HIDDEN.includes(item.i),
);
