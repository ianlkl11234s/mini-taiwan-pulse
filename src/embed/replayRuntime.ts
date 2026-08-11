/**
 * `/embed` 回放執行期（EM-16）—— **只從 `import()` 進來**。
 *
 * 這是唯一會把 three 與 `src/three/*Scene.ts` 拉進 embed 的檔案。
 * `EmbedApp` 僅在「網址真的帶了回放圖層 + `date=`」時 `await import("./replayRuntime")`，
 * 純靜態嵌入因此完全不下載 three（交付 D 的驗收點：build 後 embed 基礎 chunk 無 three）。
 *
 * 流程：
 *   平行讀各層 gzip 快照（絕不打 Supabase）→ 鏡像列轉 domain 物件 →
 *   時間範圍取**聯集**、設定回放時鐘**一次** → 各層 Scene 掛上 MapLibre CustomLayer →
 *   自動播放、整日 loop
 *
 * 三層各自的時間範圍來源不同：flights / ships 取軌跡資料的實際跨度；
 * **rail 是時刻表推算型**，取該日台北 00:00–24:00 整天（理由見 `railReplayData.ts` 檔頭）。
 *
 * ⚠️ **多層共用同一個 `replayClock`**（singleton）。`layers=rail,flights` 時各層必須
 * 走同一把時鐘，否則後啟動者的 `setRange()` 會蓋掉前者、時間軸互相打架。因此
 * `setRange` 只在所有層都載完、算出聯集區間後呼叫一次 —— 這也讓兩種載具在同一
 * 時刻軸上對齊（船在港、飛機在空中，是同一分鐘的台灣）。
 *
 * 任何一層失敗（404 / 空檔 / 時間跨度為 0）→ 該層靜默略過；全部都失敗才回 `null`。
 */
import type { Map as MaplibreMap } from "maplibre-gl";
import type { Flight, LayerVisibility, RailData, Ship } from "../types";
import { FlightScene } from "../three/FlightScene";
import { ShipScene } from "../three/ShipScene";
import { RailScene } from "../three/RailScene";
import { RailEngine } from "../engines/RailEngine";
import { TraTrainEngine } from "../engines/TraTrainEngine";
import { flightRowsToFlights, type FlightTrailRow } from "../data/flightTrails";
import { shipRowsToShips, type ShipTrailRow } from "../data/shipTrails";
import { createThreeReplayLayer, type ReplayScene } from "./threeReplayLayer";
import { REPLAY_LAYERS, fetchReplaySnapshot } from "./replayLayers";
import { loadRailReplayData, railReplayRange } from "./railReplayData";
import { replayClock, resolveReplaySpeed, resolveReplayStart } from "./replayClock";

/**
 * 主站 `useLayerParamsRuntime` 的預設值（embed 沒有調參 UI，直接沿用同一組數字）。
 * 三種載具在主站是**各自獨立**的 slider，預設值不同 —— 別合併成一個常數。
 */
const DEFAULT_FLIGHT_ORB_SCALE = 0.000005;
const DEFAULT_SHIP_ORB_SCALE = 0.000003;
const DEFAULT_SHIP_TRAIL_OPACITY = 0.15;
const DEFAULT_RAIL_ORB_SCALE = 0.00001;
const DEFAULT_RAIL_TRACK_OPACITY = 0.35;
const DEFAULT_RAIL_ALT_OFFSET = 110;

export interface StartReplayOptions {
  map: MaplibreMap;
  /** 網址指定、且確實是回放層的 key（順序 = 疊放順序） */
  layerKeys: readonly (keyof LayerVisibility)[];
  /** YYYY-MM-DD（urlState 已驗格式） */
  date: string;
  isDark: boolean;
  /** `p.speed`（未帶或越界 → 用預設，讓一天約 90 秒播完） */
  speedParam?: number;
  /** `h=` 起始時刻 0–23（台北時區） */
  hour?: number;
  /**
   * `rsys=` 鐵路只顯示這幾個**代碼**（營運者級 `trtc` 或線路級 `trtc-bl`，可混用）；
   * 未指定 = 全部（只對 rail 層有意義）。代碼表見 `constants/railLines.ts`
   */
  railSystems?: readonly string[];
  /** effect 已被 cleanup（StrictMode 會掛兩次）—— 每個 await 後都要再查一次 */
  isCancelled: () => boolean;
}

export interface ReplayHandle {
  stop: () => void;
  /** 實際啟動的層（快照缺失者不在內） */
  startedKeys: (keyof LayerVisibility)[];
  /** 各層的 domain 物件數（flights = 航班數、ships = 船數、rail = 全日班次數） */
  counts: Record<string, number>;
  /** 所有層的聯集時間範圍 */
  timeRange: [number, number];
}

/** 單層載入結果：已可直接建 Scene 的 domain 物件 + 自身時間範圍。 */
interface LoadedLayer {
  key: keyof LayerVisibility;
  layerId: string;
  count: number;
  timeRange: [number, number];
  /** 延到「聯集時間範圍算完」之後才建 Scene —— 建 Scene 會配置 GL 資源 */
  makeScene: () => ReplayScene;
}

/**
 * FlightScene → ReplayScene 轉接。
 *
 * 主站的 `createFlightLayer` 每幀要處理主題／高度／showTrails 等會變的參數；
 * 嵌入版全部凍結在網址裡，所以這裡只留 `update(flights, t)`。
 *
 * **刻意不呼叫 `updateStaticTrails`**（＝主站「Live Status」那種只留動態尾跡的模式）：
 * 一整天 5,000+ 航班的全路徑靜態 mesh 疊 AdditiveBlending 會把畫面糊成一片白，
 * 回放的「在動」反而看不出來（實測截圖確認）；而且那份 geometry 是同步建構、
 * 會阻塞主執行緒好幾秒 —— 主站為此還特地做了 loading gate，嵌入版不該付這個代價。
 * follow-up：真要底圖式的全路徑，改走預先算好的靜態 GeoJSON 疊層，不要即時建 mesh。
 */
function createFlightReplayScene(flights: Flight[], isDark: boolean): ReplayScene {
  const scene = new FlightScene();

  return {
    init(gl) {
      scene.init(gl as WebGLRenderingContext);
      // 淺色底圖下 AdditiveBlending 會把整條軌跡洗白（§9-4 spike 實測）。
      // FlightScene.setTheme(false) 原生就切成 NormalBlending + 深飽和 palette，
      // 不必另外發明一套 —— 這也是主站淺色底圖的既有行為。
      if (!isDark) scene.setTheme(false);
      scene.setOrbScale(DEFAULT_FLIGHT_ORB_SCALE);
    },
    update(timeSec) {
      scene.update(flights, timeSec);
    },
    render(matrix) {
      // FlightScene.render 宣告吃 number[]，maplibre 給的是 Float64Array；
      // 內部只做 `Matrix4.fromArray(matrix)`（吃 ArrayLike），執行期完全相容。
      scene.render(matrix as unknown as number[]);
    },
    dispose() {
      scene.dispose();
    },
  };
}

/**
 * ShipScene → ReplayScene 轉接（Phase 2）。
 *
 * ShipScene 的介面與 FlightScene 同形（`init/update(ships,t)/render/dispose`），
 * 泛化後的 `ReplayScene` 直接吃得下，不需要適配層以外的任何改動。
 *
 * 兩點與 flights 不同：
 * - **orb scale 走船舶自己的預設**（0.000003，主站 slider 預設值）；沿用航班的
 *   0.000005 會讓船明顯過大。
 * - `setTrailOpacity(0.15)`：ShipScene 的 trail 預設 opacity 是 0.8，主站船舶
 *   slider 預設卻是 0.15 —— 整日 12,000 艘的尾跡用 0.8 會糊成一片。
 *
 * 淺色主題同樣走原生 `setTheme(false)`（NormalBlending + 深飽和色票），
 * 與 flights 同一招防 additive 洗白。⚠️ 呼叫順序：`setTheme` 內部會覆寫
 * trail material 的 opacity，故 `setTrailOpacity` 必須排在它**之後**。
 *
 * **不呼叫 `setViewBounds`**：embed 沒有主站那套隨鏡頭更新 bounds 的 effect，
 * 傳 null（預設值）＝ 不做視口剔除、整片海都畫。z6.5 全景本來就要全畫，
 * 且同時在場船數遠低於 `maxInstances`（12,000）。
 */
function createShipReplayScene(ships: Ship[], isDark: boolean): ReplayScene {
  const scene = new ShipScene();

  return {
    init(gl) {
      scene.init(gl as WebGLRenderingContext);
      if (!isDark) scene.setTheme(false);
      scene.setOrbScale(DEFAULT_SHIP_ORB_SCALE);
      scene.setTrailOpacity(DEFAULT_SHIP_TRAIL_OPACITY);
    },
    update(timeSec) {
      scene.update(ships, timeSec);
    },
    render(matrix) {
      scene.render(matrix as unknown as number[]);
    },
    dispose() {
      scene.dispose();
    },
  };
}

/**
 * RailScene → ReplayScene 轉接（Phase 3）。
 *
 * 與 flights / ships **根本不同**：那兩者的快照就是位置本身（Scene 吃 domain 物件），
 * rail 吃的是時刻表，位置得每幀由引擎現算 —— 所以這裡 `update()` 內含
 * `engine.update(t)`。這正是主站 `useRailEngine` 的做法（訂閱 timeStore 後每次
 * 通知都重算兩顆引擎），回放版只是把時間源換成 `replayClock`。
 *
 * 靜態軌道**要畫**（與 flights 的「不畫全路徑」相反）：軌道是固定的細線
 * （golden 37 條 + 5 系統，合計約 9.4k 點），既不會像整日航跡那樣糊成一片，
 * 又是「列車確實貼在軌道上」的視覺驗收依據。
 *
 * 每幀重設 orbScale / trackOpacity / altOffset 是照抄主站 `createRailLayer` 的
 * render loop —— 不是多餘：靜態軌道是 `update()` 內才 lazy build 的，
 * `setTrackOpacity` 在 mesh 建好前呼叫會沒效果。
 */
function createRailReplayScene(data: RailData, isDark: boolean): ReplayScene {
  const scene = new RailScene();
  const railEngine = new RailEngine(data.systems);
  const traEngine = data.traData ? new TraTrainEngine(data.traData) : null;

  return {
    init(gl) {
      scene.init(gl as WebGLRenderingContext);
      // setTheme 會標記靜態軌道重建，故必須排在 setStaticTracks 之前才不會白做一次。
      if (!isDark) scene.setTheme(false);
      scene.setStaticTracks(data.allTracks);
    },
    update(timeSec) {
      const trains = railEngine.update(timeSec);
      if (traEngine) {
        const traTrains = traEngine.update(timeSec);
        for (let i = 0; i < traTrains.length; i++) trains.push(traTrains[i]!);
      }
      scene.setOrbScale(DEFAULT_RAIL_ORB_SCALE);
      scene.setAltitudeOffset(DEFAULT_RAIL_ALT_OFFSET);
      scene.update(trains, timeSec);
      // 必須在 update() 之後：靜態軌道 mesh 在 update() 內才建好。
      scene.setTrackOpacity(DEFAULT_RAIL_TRACK_OPACITY);
    },
    render(matrix) {
      scene.render(matrix as unknown as number[]);
    },
    dispose() {
      scene.dispose();
    },
  };
}

/** 讀單層快照並轉成 domain 物件。失敗（含快照 404 / 空檔）一律回 null。 */
async function loadLayer(
  key: keyof LayerVisibility,
  date: string,
  isDark: boolean,
  railSystems?: readonly string[],
): Promise<LoadedLayer | null> {
  const spec = REPLAY_LAYERS[key];
  if (!spec) return null;

  if (key === "rail") {
    // 時刻表推算型：時間範圍是**該日整天**而非資料跨度，理由見 railReplayData 檔頭。
    const range = railReplayRange(date);
    if (!range) return null;
    const data = await loadRailReplayData(date, railSystems);
    if (!data) return null;
    const total = Object.values(data.departureCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return null;
    console.log(
      `[embed/replay] rail ${date}: ${total} departures ` +
        `(${Object.entries(data.departureCounts).map(([k, v]) => `${k} ${v}`).join(", ")}), ` +
        `${data.allTracks.features.length} tracks`,
    );
    return {
      key, layerId: spec.layerId, count: total, timeRange: range,
      makeScene: () => createRailReplayScene(data, isDark),
    };
  }

  if (key === "ships") {
    const rows = await fetchReplaySnapshot<ShipTrailRow>(spec.snapshotDir, date);
    if (!rows || rows.length === 0) return null;
    const { ships, timeRange, filteredPoints } = shipRowsToShips(rows);
    const [t0, t1] = timeRange;
    if (ships.length === 0 || t1 <= t0) return null;
    console.log(
      `[embed/replay] ships ${date}: ${ships.length} ships from ${rows.length} rows` +
        (filteredPoints > 0 ? `, filtered ${filteredPoints} anomalous points` : ""),
    );
    return {
      key, layerId: spec.layerId, count: ships.length, timeRange: [t0, t1],
      makeScene: () => createShipReplayScene(ships, isDark),
    };
  }

  const rows = await fetchReplaySnapshot<FlightTrailRow>(spec.snapshotDir, date);
  if (!rows || rows.length === 0) return null;
  const { flights, timeRange, splitCount } = flightRowsToFlights(rows);
  const [t0, t1] = timeRange;
  if (flights.length === 0 || t1 <= t0) return null;
  console.log(
    `[embed/replay] flights ${date}: ${flights.length} flights from ${rows.length} rows (split ${splitCount})`,
  );
  return {
    key, layerId: spec.layerId, count: flights.length, timeRange: [t0, t1],
    makeScene: () => createFlightReplayScene(flights, isDark),
  };
}

export async function startReplay(opts: StartReplayOptions): Promise<ReplayHandle | null> {
  const keys = opts.layerKeys.filter((k) => k in REPLAY_LAYERS);
  if (keys.length === 0) return null;

  // 平行載入：兩層各自 fetch，慢的那層不該卡住快的那層開始解析。
  const settled = await Promise.all(
    keys.map((k) =>
      loadLayer(k, opts.date, opts.isDark, opts.railSystems).catch((err) => {
        console.warn(`[embed/replay] ${k} 載入失敗，略過該層`, err);
        return null;
      }),
    ),
  );
  if (opts.isCancelled()) return null;

  const loaded = settled.filter((x): x is LoadedLayer => x !== null);
  if (loaded.length === 0) return null;

  // 聯集時間範圍 —— 多層共用一把時鐘的關鍵（見檔頭）。
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const l of loaded) {
    if (l.timeRange[0] < t0) t0 = l.timeRange[0];
    if (l.timeRange[1] > t1) t1 = l.timeRange[1];
  }
  if (!(t1 > t0)) return null;

  const speed = resolveReplaySpeed(opts.speedParam, t0, t1);
  const start = resolveReplayStart(opts.date, opts.hour, t0, t1);
  replayClock.setRange(t0, t1, speed, start);

  const addedIds: string[] = [];
  for (const l of loaded) {
    const layer = createThreeReplayLayer({
      id: l.layerId,
      scene: l.makeScene(),
      getTime: () => replayClock.get(),
    });
    opts.map.addLayer(layer);
    addedIds.push(l.layerId);
  }

  if (opts.isCancelled()) {
    replayClock.clear();
    for (const id of addedIds) {
      if (opts.map.getLayer(id)) opts.map.removeLayer(id);
    }
    return null;
  }

  replayClock.play();

  const counts: Record<string, number> = {};
  for (const l of loaded) counts[l.key] = l.count;
  console.log(
    `[embed/replay] ${opts.date} 啟動 ${loaded.map((l) => l.key).join(", ")}，` +
      `speed ${speed.toFixed(0)}x`,
  );

  return {
    startedKeys: loaded.map((l) => l.key),
    counts,
    timeRange: [t0, t1],
    stop() {
      replayClock.clear();
      // map.remove() 已經跑過的話 layer 早被拆掉（onRemove → dispose），別重複拆
      for (const id of addedIds) {
        if (opts.map.getLayer(id)) opts.map.removeLayer(id);
      }
    },
  };
}
