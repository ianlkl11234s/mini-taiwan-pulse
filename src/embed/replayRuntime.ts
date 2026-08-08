/**
 * `/embed` 回放執行期（EM-16）—— **只從 `import()` 進來**。
 *
 * 這是唯一會把 three 與 `src/three/*Scene.ts` 拉進 embed 的檔案。
 * `EmbedApp` 僅在「網址真的帶了回放圖層 + `date=`」時 `await import("./replayRuntime")`，
 * 純靜態嵌入因此完全不下載 three（交付 D 的驗收點：build 後 embed 基礎 chunk 無 three）。
 *
 * 流程：
 *   讀 gzip 快照（絕不打 Supabase）→ 鏡像列轉 Flight[] → 設定回放時鐘 →
 *   FlightScene 掛上 MapLibre CustomLayer → 自動播放、整日 loop
 *
 * 任何一步失敗（404 / 空檔 / 時間跨度為 0）→ 回 `null`，呼叫端靜默略過該層。
 */
import type { Map as MaplibreMap } from "maplibre-gl";
import type { Flight, LayerVisibility } from "../types";
import { FlightScene } from "../three/FlightScene";
import { flightRowsToFlights, type FlightTrailRow } from "../data/flightTrails";
import { createThreeReplayLayer, type ReplayScene } from "./threeReplayLayer";
import { REPLAY_LAYERS, fetchReplaySnapshot } from "./replayLayers";
import { replayClock, resolveReplaySpeed, resolveReplayStart } from "./replayClock";

/** 主站 useTransportParams 的預設值（embed 沒有調參 UI，直接沿用同一組數字） */
const DEFAULT_ORB_SCALE = 0.000005;

export interface StartReplayOptions {
  map: MaplibreMap;
  layerKey: keyof LayerVisibility;
  /** YYYY-MM-DD（urlState 已驗格式） */
  date: string;
  isDark: boolean;
  /** `p.speed`（未帶或越界 → 用預設，讓一天約 90 秒播完） */
  speedParam?: number;
  /** `h=` 起始時刻 0–23（台北時區） */
  hour?: number;
  /** effect 已被 cleanup（StrictMode 會掛兩次）—— 每個 await 後都要再查一次 */
  isCancelled: () => boolean;
}

export interface ReplayHandle {
  stop: () => void;
  flightCount: number;
  timeRange: [number, number];
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
      scene.setOrbScale(DEFAULT_ORB_SCALE);
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

export async function startReplay(opts: StartReplayOptions): Promise<ReplayHandle | null> {
  const spec = REPLAY_LAYERS[opts.layerKey];
  if (!spec) return null;

  const rows = await fetchReplaySnapshot<FlightTrailRow>(spec.snapshotDir, opts.date);
  if (!rows || rows.length === 0 || opts.isCancelled()) return null;

  const { flights, timeRange, splitCount } = flightRowsToFlights(rows);
  const [t0, t1] = timeRange;
  if (flights.length === 0 || t1 <= t0) return null;

  const speed = resolveReplaySpeed(opts.speedParam, t0, t1);
  const start = resolveReplayStart(opts.date, opts.hour, t0, t1);
  replayClock.setRange(t0, t1, speed, start);

  const scene = createFlightReplayScene(flights, opts.isDark);
  const layer = createThreeReplayLayer({
    id: spec.layerId,
    scene,
    getTime: () => replayClock.get(),
  });

  if (opts.isCancelled()) return null;
  opts.map.addLayer(layer);
  replayClock.play();

  console.log(
    `[embed/replay] ${spec.snapshotDir} ${opts.date}: ${flights.length} flights ` +
      `from ${rows.length} rows (split ${splitCount}), speed ${speed.toFixed(0)}x`,
  );

  return {
    flightCount: flights.length,
    timeRange: [t0, t1],
    stop() {
      replayClock.clear();
      // map.remove() 已經跑過的話 layer 早被拆掉（onRemove → dispose），別重複拆
      if (opts.map.getLayer(spec.layerId)) opts.map.removeLayer(spec.layerId);
    },
  };
}
