// 房地產「點」WebGL CustomLayer 的共用狀態（module-level singleton）。
//
// 寫入者分兩路（避免 React re-render 進每幀路徑）：
//   - 時間欄位（cursorTs / mode / 季窗 / fade 窗）：useRealEstateTimeline 的 RAF / 靜態 apply 寫入
//   - 控制欄位（show / excludeTaipei / baseOpacity）：App 依 layerVisibility + params 寫入
// 讀取者：realEstatePointsCustomLayer 每幀 render 時讀，餵進 Scene uniforms。
//
// cursorTs / qStart / qEnd 為「絕對 unix 秒」；Scene 內會減去 RANGE_START 對齊 buffer 的相對 trade_ts。

export type RePointsMode = "realtime" | "quarter" | "fadewindow";

export interface RePointsState {
  cursorTs: number;                    // 絕對 unix 秒（fadewindow 用）
  mode: RePointsMode;
  full: number;                        // fadewindow 全亮窗（秒）
  fade: number;                        // fadewindow 淡出尾段（秒）
  qStart: number;                      // 當季起（絕對 unix 秒，quarter 用）
  qEnd: number;                        // 當季迄（絕對 unix 秒，quarter 用）
  show: [boolean, boolean, boolean];   // rental, sale, presale
  excludeTaipei: boolean;
  baseOpacity: number;
}

export const rePointsStore: RePointsState = {
  cursorTs: 0,
  mode: "realtime",
  full: 0,
  fade: 0,
  qStart: 0,
  qEnd: 0,
  show: [false, false, false],
  excludeTaipei: false,
  baseOpacity: 0.85,
};
