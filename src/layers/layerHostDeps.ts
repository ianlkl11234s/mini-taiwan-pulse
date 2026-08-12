// ══════════════════════════════════════════════════════════════════
//  Layer Host Deps — Host 元件的跨切面依賴（AR-22 P1）
// ══════════════════════════════════════════════════════════════════
//
// App.tsx 原本用 66 個手寫 `use*Layer(...)` 把圖層掛起來。那份清單是**隱性**的：
// 漏 call 一個 hook 沒有任何機械訊號（tsc 綠、測試綠、畫面只是少一層）。
// P1 把清單搬進 `layerHookRegistry.tsx` 的有序陣列，每個 entry 一個 Host 元件，
// 由 `LayerHost.tsx` 固定迴圈渲染 —— 清單變成資料，就守得住（見
// `__tests__/layerHookRegistry.test.ts` 的三桶雙向凍結）。
//
// 本檔是「Host 需要、但不屬於任何單一圖層」的那些依賴的集散地：地圖 ref、
// 主題、大模式、歷史時間軸、面板狀態、跨 hook 共享的 scene / data ref。
//
// ⚠️ **參數不走這裡**。圖層自己的 slider / toggle / select 一律由 Host 內部
// `useLayerParams(key)` 訂閱（見 `layerParamsAccess.ts`），不經 App 的
// `useLayerParamsRuntime()` 整包快照 —— 那正是本次搬遷要拆掉的耦合。
//
// ⚠️ **不要 memo 這個物件，也不要 `React.memo` 任何 Host**：現況是「App 一 render
// 全部 hook 重跑」，本棒是**等價重構**，行為必須逐位保真。per-key 訂閱帶來的
// re-render 收斂是第 4 階段的事（那時 App 端才解除全店訂閱）。

import type { Map as MapboxMap } from "mapbox-gl";
import type { AppMode, AqiProduct, FeatureInfo, LayerVisibility, RailData, TimeMode } from "../types";
import type { useH3Data } from "../hooks/useH3Data";
import type { useDemographicsH3, useDemographicsYearlyH3 } from "../hooks/useDemographicsH3";
import type { useH3Socioeconomic } from "../hooks/useH3Socioeconomic";
import type { useH3SpatialEconomy } from "../hooks/useH3SpatialEconomy";
import type { useYoubikeH3 } from "../hooks/useYoubikeH3";
import type { HistoricalGranularity } from "../components/HistoricalTimeline";
import type { ReGran } from "../lib/realEstateTime";
import type { ReservoirScene } from "../three/ReservoirScene";
import type { ReservoirStatus } from "../data/reservoirStatusLoader";
import type { TemperatureGridData } from "../data/temperatureLoader";
import type { PowerDashboard } from "../data/energyLoader";

/**
 * Host 的跨切面依賴。**單一 props bundle**（不用 context）——
 * context 要多包一層 Provider 且讀取端隱形，props 反而讓「這個 Host 吃了什麼」
 * 在 registry 檔裡一眼可見。App 每次 render 直接組一個新字面即可（見上方 ⚠️）。
 */
export interface LayerHostDeps {
  // ── 地圖與外觀 ──
  mapRef: React.RefObject<MapboxMap | null>;
  /** 整包傳入。本棒不動 visibility 訂閱粒度（那是 AR-21 已定案的 store，另案再拆） */
  layerVisibility: LayerVisibility;
  isDarkTheme: boolean;
  /** 底圖 id —— slope / aspect 兩層依底圖換色帶 */
  mapStyleId: string;
  /** 時間軸模式（replay / live）—— parking 等「當下快照」層據此切資料源 */
  timeMode: TimeMode;

  // ── App 大模式 + 歷史時間軸 ──
  appMode: AppMode;
  historicalYear: number;
  historicalMonth: number;
  historicalDay: number;
  historicalGranularity: HistoricalGranularity;
  historicalPlaying: boolean;
  historicalSpeed: number;
  /** 共機活動區：歷史模式下由年/月/日算出的視窗結束日；realtime 為 null */
  plaHistoricalDate: string | null;

  // ── 房地產時間軸（RAF 播放引擎在 useRealEstateTimeline 內）──
  realEstateActive: boolean;
  reGran: ReGran;
  reCursorTs: number;
  onReCursorChange: (ts: number) => void;
  onHistoricalStop: () => void;

  // ── 互動 / 面板狀態 ──
  featureInfo: FeatureInfo | null;
  /** 點到水庫且帶 compare_id 時的水庫 id（context 疊層 + 3D 水位計高亮共用） */
  activeReservoirId: number | null;
  aqiProduct: AqiProduct;
  eqReplaySelectedId: string | null;
  eqReplayPlaying: boolean;
  onEqReplayEnd: () => void;
  satConsoleOpen: boolean;
  satShowAllOrbits: boolean;
  maneuverNorads: Set<number>;

  // ── 跨 hook 共享的資料 / 場景 ref ──
  temperatureData: TemperatureGridData | null;
  reservoirSceneRef: React.RefObject<ReservoirScene | null>;
  reservoirStatusesRef: React.RefObject<ReservoirStatus[]>;
  powerDashboardRef: React.RefObject<PowerDashboard | null>;

  // ── 網格圖層的資料源（AR-22 P4）────────────────────────────────
  // 這幾支 hook 的**資料**留在 App（loader + zoom 驅動的 resolution state），
  // 但「把資料畫上去」的 effect 搬進 Host —— 因為那一段吃參數，留在 App
  // 等於拖任何一根 slider 都讓整棵樹 reconcile。型別用 ReturnType 取，
  // 免得在這裡重抄一份 loader 的 cell 型別（抄了就會漂移）。
  railData: RailData | null;
  h3DataMap: ReturnType<typeof useH3Data>["h3DataMap"];
  h3Resolution: number;
  demographicsDataMap: ReturnType<typeof useDemographicsH3>["demographicsDataMap"];
  demoResolution: number;
  getYearlyCells: ReturnType<typeof useDemographicsYearlyH3>["getCells"];
  socioDataMap: ReturnType<typeof useH3Socioeconomic>["socioDataMap"];
  spatialDataMap: ReturnType<typeof useH3SpatialEconomy>["spatialDataMap"];
  getYoubikeCellsForTime: ReturnType<typeof useYoubikeH3>["getCellsForTime"];
  /** timeStore 分鐘粒度的 tick（App 訂閱 timeStore 換算，不走 4Hz re-render） */
  youbikeTimeKey: number;
}

/** registry entry 的 Host 元件型別（一律 `return null`，只掛 hook 不畫東西） */
export type LayerHostComponent = React.FC<{ deps: LayerHostDeps }>;

/**
 * dev-only render 計數器 —— `window.__layerRenderCounts`。
 *
 * 第 4 階段（App 端解除全店訂閱）的驗收要證明「拖一個 slider 只有那一個 Host
 * 重跑」。那件事**測不出來**除非有計數：目前 App 與每個 Host 都會隨 App re-render
 * 一起跳，Phase 4 後應該只有目標 Host 跳。先埋點，收尾時用 agent-browser 讀。
 *
 * production build 由 `import.meta.env.DEV` 常數摺疊整段剔除。
 */
export function bumpHostRender(id: string): void {
  if (!import.meta.env.DEV) return;
  const w = window as Window & { __layerRenderCounts?: Record<string, number> };
  const counts = (w.__layerRenderCounts ??= {});
  counts[id] = (counts[id] ?? 0) + 1;
}
