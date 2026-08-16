/**
 * 監看模式「分割版面」（Split Dock）佈局 — 單一真實來源。
 *
 * Split = Monitor 只佔畫面右半邊，左半邊維持主站原樣（真實地圖 + rail + Layers +
 * 時間軸）。右半只有約 880px（dock 模式是 1800px），12 欄的欄寬砍半，所以另備
 * 這一套窄版座標，不與 `monitorLayout.ts` 的 `MONITOR_LAYOUT` 共用。
 *
 * 座標與幾何參數由**分割版面沙盒**拖曳定稿後匯出：
 *   docs/features/monitor-split/sandbox-split.html
 * 要改版面 → 回沙盒拖完重新匯出、整段覆蓋本檔的 `MONITOR_SPLIT_DOCK` 與
 * `MONITOR_LAYOUT_SPLIT`，**不要在 MonitorPanel.tsx 裡手調**。
 *
 * ⚠️ 窄版特有的兩條規則（沙盒已內建碰撞/推擠，但貼回前值得再核一次）：
 * 1. 下半部左右兩欄必須**同時結束**（最後一格的 y+h 相等）。若一欄先結束，
 *    剩下的區域只有另一欄 → guillotine 會在那裡切出貫穿全寬的橫切線，該區塊
 *    就不再是「右欄」而是撐滿 12 欄的獨立區塊（見 monitorLayout.ts:100-104）。
 * 2. `fit: "content"` 的 widget 不吃 `h` 當高度，`h` 只決定欄內順序與拆解結果。
 */

import type { MonitorGridItem, MonitorWidgetId } from "./monitorLayout";

/** Monitor 的三種呈現。dock = 原本的底部浮層（預設）；wall = 近全屏；split = 右半邊 */
export type MonitorMode = "dock" | "wall" | "split";

/** Split dock 的幾何 + 左半邊讓位參數（沙盒 dock 區塊） */
export interface MonitorSplitDock {
  /** dock 寬度佔視窗寬的比例（0..1） */
  widthPct: number;
  /** 上緣距視窗頂 px — 預設 56 是為了讓開右上角按鈕列（App.tsx 的 top:16 那排） */
  top: number;
  /** 右緣留白 px */
  right: number;
  /** 下緣留白 px */
  bottom: number;
  /** split 開啟時 Layers 浮動面板的高度上限（佔視高比例）— 縮短以免擋住台灣本島 */
  layersMaxVh: number;
  /** split 開啟時 Layers 浮動面板寬度 px（不縮就維持 288） */
  layersWidth: number;
  /** grid 容器實寬窄於此值 → 退化單欄堆疊。必須明顯低於 dock 實寬，否則一開就堆疊 */
  stackBreakpointPx: number;
  /**
   * 地圖視野右側 padding px（`map.easeTo({ padding })`）。
   * 0 = 不動視野 —— 主站預設視角台灣本來就偏左，dock 蓋不到。
   * 若拖完發現真的擋到台灣，把它調成 dock 實寬即可。
   */
  mapPaddingRight: number;
}

export const MONITOR_SPLIT_DOCK: MonitorSplitDock = {
  widthPct: 0.46,
  top: 56,
  right: 14,
  bottom: 14,
  layersMaxVh: 0.45,
  layersWidth: 288,
  stackBreakpointPx: 640,
  mapPaddingRight: 0,
};

/**
 * 切進 split 時自動帶到的鏡頭 —— 讓台灣整島落在左半可視區。
 *
 * 中心刻意偏東（122.69°E，本島東方外海）：dock 佔掉右半邊，鏡頭中心若擺在本島上，
 * 台灣會有一半被面板蓋住。這組值是 2026-08-16 用實機目視定的。
 *
 * `autoFrame: false` 可整個關掉自動定位（保留使用者當下視角）。
 * 只在「進入 split 的那一刻」飛一次，之後手動平移縮放不會被拉回；退出 split 也不還原。
 */
export const MONITOR_SPLIT_CAMERA = {
  autoFrame: true,
  /** [lon, lat] —— 注意與站台左上角除錯列的 `lat, lon` 顯示順序相反 */
  center: [122.6936, 23.6111] as [number, number],
  zoom: 7.3,
  pitch: 0,
  bearing: 0,
  /** 飛行時間 ms */
  durationMs: 900,
};

/**
 * 窄版定稿佈局 — 2026-08-16 用戶沙盒定稿
 *
 * 結構：**上半 2 欄（止於 y15）＋ 下半以全寬為主的縱向流**
 *   y0–16   newsFeed(w6)     | timeline → alertBoard → hotZones（右欄三段）
 *           triage(w6, y14)  |
 *   y17–    liveWall → hazardStrip → 災害四卡（一列四格 w3）→ foodPriceBoard
 *           → taiex|situationCards → prison|airportPax → powerCard
 *           → erCongestion → situationOverview → plaBoard
 *
 * 下半刻意走全寬：窄欄（~415px）放不下影像牆與趨勢圖，全寬（~835px）才讀得出來。
 * 全寬區塊之間都是乾淨的水平切線，guillotine 拆解不會有互卡。
 *
 * ⚠️ 檔頭第 1 條「左右兩欄同時結束」的鐵則只約束**長段兩欄結構**。
 * 本版下半沒有長段兩欄（y46–53 那兩組 2 欄各自成段且已對齊），故不適用。
 */
export const MONITOR_LAYOUT_SPLIT: MonitorGridItem[] = [
  // ── 上半 2 欄：左 = 新聞 Feed + 信號分級；右 = 時間軸 → 警訊 → 熱區（兩欄同止於 y17）──
  //
  // 固定高 widget 的 h 是**實際高度**（h*40 + (h-1)*10 px），實測內容需求：
  // alertBoard 需 264px（h6=290 ✓，h5=240 會讓六宮格的數字溢出卡片外）、
  // hotZones 需 234px（h5=240 ✓，h4=190 只露得出 4 筆）。
  { i: "newsFeed", x: 0, y: 0, w: 6, h: 14 },
  { i: "timeline", x: 6, y: 0, w: 6, h: 6 },
  { i: "alertBoard", x: 6, y: 6, w: 6, h: 6 },
  { i: "hotZones", x: 6, y: 12, w: 6, h: 5 },
  { i: "triage", x: 0, y: 14, w: 6, h: 3 },

  // ── 下半：全寬縱向流 ──
  { i: "liveWall", x: 0, y: 17, w: 12, h: 13, fit: "content" },
  { i: "hazardStrip", x: 0, y: 30, w: 12, h: 7, fit: "content" },
  // 災害四卡改一列四格（各 w3 ≈ 200px），不再是 2×2
  { i: "typhoon", x: 0, y: 37, w: 3, h: 4, fit: "content" },
  { i: "radiation", x: 3, y: 37, w: 3, h: 4, fit: "content" },
  { i: "lightning", x: 6, y: 37, w: 3, h: 4, fit: "content" },
  { i: "earthquake", x: 9, y: 37, w: 3, h: 4, fit: "content" },
  { i: "foodPriceBoard", x: 0, y: 41, w: 12, h: 7, fit: "content" },
  { i: "taiex", x: 0, y: 48, w: 6, h: 3, fit: "content" },
  { i: "situationCards", x: 6, y: 48, w: 6, h: 3, fit: "content" },
  { i: "prison", x: 0, y: 51, w: 6, h: 5, fit: "content" },
  { i: "airportPax", x: 6, y: 51, w: 6, h: 5, fit: "content" },
  { i: "powerCard", x: 0, y: 56, w: 12, h: 11, fit: "content" },
  { i: "erCongestion", x: 0, y: 67, w: 12, h: 11, fit: "content" },
  { i: "situationOverview", x: 0, y: 78, w: 12, h: 4, fit: "content" },
  { i: "plaBoard", x: 0, y: 82, w: 12, h: 12, fit: "content" },
];

/** 沙盒 hidden 清單 — split 模式不隱藏任何 widget（histogram 全站停用，沿用 dock 版） */
export const MONITOR_SPLIT_HIDDEN: MonitorWidgetId[] = ["histogram"];

/** 實際要渲染的格子（過濾 hidden，資料驅動） */
export const MONITOR_SPLIT_VISIBLE_LAYOUT: MonitorGridItem[] =
  MONITOR_LAYOUT_SPLIT.filter((item) => !MONITOR_SPLIT_HIDDEN.includes(item.i));
