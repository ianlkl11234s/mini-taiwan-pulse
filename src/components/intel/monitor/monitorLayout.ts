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
  | "internetHealth"
  | "histogram"
  | "timeline"
  | "triage"
  | "hotZones"
  | "situationOverview"
  | "taiex"
  | "liveWall"
  | "situationCards"
  | "plaBoard"
  | "vesselZone"
  | "foodPriceBoard"
  | "hazardStrip"
  | "powerCard"
  | "erCongestion"
  | "prison"
  | "airportPax"
  | "typhoon"
  | "earthquake"
  | "radiation"
  | "lightning"
  | "traDelay"
  | "isrSatellitePasses";

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

/**
 * 監看模式內容區的整體縮放倍率（2026-08-20 用戶回報「字太小看不清楚」）。
 *
 * 為什麼用 CSS `zoom` 而不是逐處調 fontSize：
 * 卡片裡有 ~200 處 fontSize（8.5 / 9 / 9.5 px 的字面值 + FONT_SIZE token 混用），
 * 只放大字級不動 padding／固定高，會撐爆那些量過才定的固定高格子
 * （例如 monitorSplitLayout.ts 註記的 alertBoard「h5 會讓六宮格數字溢出卡片外」）。
 * `zoom` 是等比縮放整個內容座標系 —— 字、間距、圖表、卡片一起放大，
 * 相對排版完全不變，只是同樣的欄寬裡塞的邏輯 px 變少。
 *
 * 套用位置：`MonitorPanel.tsx` 裡 `gridRef` **內層**的包裹層。
 * 刻意不套在 gridRef 本身（量測 `isStacked` 的元素要維持實體 px），
 * 也不套 header（header 有 1440 寬就會溢出的既有限制，見該處註解）。
 *
 * 調整建議：1.0 = 原樣；> 1.25 在 split（實寬 ~835px）會讓兩欄各自窄到
 * 邏輯 330px 以下，趨勢圖開始看不出形狀。
 */
export const MONITOR_CONTENT_ZOOM = 1.15;

/**
 * 「密集卡」的額外縮放（疊在 MONITOR_CONTENT_ZOOM 之上）。
 *
 * 共機戰情板（PlaBoard）與特殊船舶接近帶（VesselZoneCard）是全站字級最小的兩張卡：
 * 內文大量用 8 / 8.5 / 9 / 9.5 px 的**字面值**，而其他卡走 FONT_SIZE token（11~12px）。
 * 2026-08-20 用戶點名這兩張「字都太小」——只套全域 1.15 後仍只有 9.2~11.5px。
 *
 * 用巢狀 zoom 而不是逐處改 fontSize：這兩張卡有大量「固定寬標籤欄 + 右對齊數字」
 * （PlaBoard 的 width:62/66/54/44、VesselZoneCard 的 width:52/46），
 * 只放大字不放大欄寬會把文字擠出欄外。zoom 連欄寬一起放大，比例完全不變。
 *
 * 實際倍率 = 1.15 × 1.12 ≈ 1.29 → 8.5px 讀起來約 11px、12px 約 15px，
 * 與其他卡的 token 字級對齊。
 */
export const MONITOR_DENSE_CARD_ZOOM = 1.12;

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
 * - 2026-08-22 十一版 — 新增 traDelay（台鐵誤點）；vesselZone h 11→6 讓出左欄尾段，
 *   維持左右欄同止 y68。⚠ 本版座標為接線時暫定、非沙盒匯出，定稿請回沙盒重拖。
 * - 2026-08-30 十二版 — 上半事件區與下半雙欄之間插入全寬 internetHealth 狀態卡；
 *   下半整體 +4，左右欄同止改為 y72。
 * - 2026-08-30 十三版 — 軍事態勢尾段改為特殊船舶 → ISR 衛星 → 台鐵；
 *   左右欄仍同止於 y80。
 * - 2026-09-01 十四版 — internetHealth 移到台鐵誤點後方，作為 Monitor 尾端全寬觀察卡。
 */
export const MONITOR_LAYOUT: MonitorGridItem[] = [
  { i: "newsFeed", x: 0, y: 0, w: 4, h: 12 },
  { i: "alertBoard", x: 4, y: 0, w: 3, h: 7 },
  { i: "timeline", x: 7, y: 0, w: 5, h: 9 },
  { i: "hotZones", x: 4, y: 7, w: 3, h: 5 },
  { i: "triage", x: 7, y: 9, w: 5, h: 3 },
  { i: "situationOverview", x: 0, y: 16, w: 5, h: 5, fit: "content" },
  { i: "liveWall", x: 5, y: 16, w: 7, h: 14, fit: "content" },
  // TAIEX 從 situationOverview 右側拆出成獨立 widget（2026-08-10）：
  // 原本擠在壓力環旁邊只放得下 150×24 的日線，拆出後給 260×44。
  // 其下同欄 widget y 各 +3。
  { i: "taiex", x: 0, y: 21, w: 5, h: 3, fit: "content" },
  // PLA 從 situationCards 拆出成獨立 plaBoard（2026-08-03）：嚴重度分級 + 120 天趨勢
  // + 空域方位 + 侵擾方式四段。
  // situationCards 只剩健康卡 → h 6→3；其下同欄 widget y 各 +12。
  { i: "situationCards", x: 0, y: 24, w: 5, h: 3, fit: "content" },
  // h 15→13（2026-08-10）：空域方位／侵擾方式改單欄（4+6 列，原本各佔 2+3 列）後，
  // 其餘區塊固定高約 450px，剩下的全歸 120 天趨勢柱狀圖（TrendRow flex:1）。
  // h13 → 柱狀圖約 190px（原本固定 54px）；再加高只會讓柱子過胖，量過才定的值。
  { i: "plaBoard", x: 0, y: 27, w: 5, h: 13, fit: "content" },
  { i: "erCongestion", x: 0, y: 40, w: 5, h: 15, fit: "content" },
  { i: "hazardStrip", x: 5, y: 30, w: 7, h: 8, fit: "content" },
  // 災害監看四卡（2026-08-10 十版）：颱風／地震／輻射／落雷，接在災防直播下方
  // 形成「影像 + 數據」的災害區塊。右欄 w7 拆 4+3，每格仍有 ~280px 以上。
  //
  // ⚠️ 位置不能改放到最下面（試過會壞）：左欄止於 y61，右欄若在那之後還有格線，
  // 那條格線就成為**貫穿全寬**的橫切線 —— guillotine 會先在那裡把版面切成上下兩段，
  // 右欄那塊就不再是「右欄」而是撐滿 12 欄的獨立區塊（monitorPacking.test.ts
  // 的「rows 子節點寬度 = 自身寬度」會抓到）。右欄在 y61 之後只能留一個
  // 跨過 61 的格子（現為 foodPriceBoard 60–72）。
  { i: "typhoon", x: 5, y: 38, w: 4, h: 4, fit: "content" },
  { i: "earthquake", x: 9, y: 38, w: 3, h: 4, fit: "content" },
  { i: "radiation", x: 5, y: 42, w: 4, h: 4, fit: "content" },
  { i: "lightning", x: 9, y: 42, w: 3, h: 4, fit: "content" },
  // y 34→42（四卡插隊 8 列）
  { i: "powerCard", x: 5, y: 46, w: 7, h: 14, fit: "content" },
  { i: "prison", x: 0, y: 55, w: 2, h: 4, fit: "content" },
  { i: "airportPax", x: 2, y: 55, w: 3, h: 6, fit: "content" },
  // 食品價格監測（2026-08-05）：四指數 2×2 × 180 天。
  // 走右欄 w7 而非比照 PLA 的 w5 —— 2×2 在 w5 每格只剩 ~190px，
  // 迷你走勢圖會擠到看不出形狀；w7 每格約 280px 才讀得出趨勢。
  // h 9→12（2026-08-10）：多出的高度全部灌進四張卡的走勢圖（SPARK_H 34→52 + flex:1）。
  // y 48→56（同上，跟著 powerCard 下移）
  // h 12→20：fit:"content" 不改實際高度，只讓右欄跨過軍事態勢尾段、同止 y80，
  // 維持頂層「下方左右兩欄（5+7）」而不切出第三個全寬段。
  { i: "foodPriceBoard", x: 5, y: 60, w: 7, h: 20, fit: "content" },
  // 特殊船舶接近帶（2026-08-20，VZ-4）：左欄收尾，與共機卡同寬 w5。
  // ⚠️ y61 起的三張左欄卡與 foodPriceBoard 同止 y80，頂層才維持
  // 「上方三欄 + 下方左右兩欄(5+7)」的兩段結構（packing test 有斷言）。
  // 也刻意不用 w12：全寬約 1200px，柱狀圖會被拉到看不出形狀，w5 與 plaBoard 一致。
  // h 11→6（2026-08-22）：純粹讓出左欄尾段給後續卡片。三格都是 fit:"content"，
  // h 不是實際高度、只決定欄內順序與拆解，所以縮 h 不會壓縮畫面上的船舶卡。
  { i: "vesselZone", x: 0, y: 61, w: 5, h: 6, fit: "content" },
  // 中國 ISR 衛星領海過境頻率：接在特殊船舶後，形成海域 → 太空的態勢順序。
  { i: "isrSatellitePasses", x: 0, y: 67, w: 5, h: 8, fit: "content" },
  // 台鐵誤點收尾；右欄由 foodPriceBoard 跨過同一排序範圍，左右同止 y80。
  // fit h 只影響 packing，不改卡片實際高度。
  { i: "traDelay", x: 0, y: 75, w: 5, h: 5, fit: "content" },
  // RIPE country/ASN 網路觀察接在 TRA DELAY 後方，不建立 map geometry。
  { i: "internetHealth", x: 0, y: 80, w: 12, h: 4, fit: "content" },
];

/** 沙盒 hidden 清單 — 列在這裡的 widget 不渲染（histogram 與時間軸新聞密度重複，2026-07-26 移除） */
export const MONITOR_HIDDEN: MonitorWidgetId[] = ["histogram"];

/** 實際要渲染的格子（過濾 hidden，資料驅動） */
export const MONITOR_VISIBLE_LAYOUT: MonitorGridItem[] = MONITOR_LAYOUT.filter(
  (item) => !MONITOR_HIDDEN.includes(item.i),
);
