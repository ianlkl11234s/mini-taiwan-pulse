import { useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { fetchReplayDetail, fetchReplayEvents } from "../data/earthquakeReplayLoader";
import {
  S_WAVE_KM_S,
  type EqReplayDetail,
} from "../data/earthquakeReplayTypes";
import { earthquakeReplayClock } from "../state/earthquakeReplayClock";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  EQ_REPLAY_EPICENTER_LAYER,
  EQ_REPLAY_GRID_SOURCE,
  EQ_REPLAY_STATION_SOURCE,
  EQ_REPLAY_TOWN_SOURCE,
  EQ_REPLAY_TOWN_SOURCE_LAYER,
  createBeachballMarker,
  ensureEarthquakeReplayLayers,
  epicenterToGeoJSON,
  gridToGeoJSON,
  metersToPixels,
  removeBeachballMarker,
  removeEarthquakeReplayLayers,
  setEarthquakeReplayVisible,
  setReplayEpicenterData,
  setReplayEpicenterFrame,
  setReplayGridData,
  setReplayGridOpacity,
  setReplayStationData,
  setReplayStationOpacity,
  setReplayTownOpacity,
  stationsToGeoJSON,
  updateBeachball,
  type BeachballHandle,
} from "../map/earthquakeReplayLayerFactory";

/**
 * 地震回放（earthquakeReplay）— 生命週期 + 回放引擎。
 *
 * ⚠️ 這是**獨立 scoped 播放器**，刻意不掛全域 timeStore：
 * 回放時鐘的單位是「震後真實秒數」，跟 timeline 的 unix 秒無關（開發規則 §8 約束的是
 * 消費 timeline 的圖層）。時鐘存 `earthquakeReplayClock`（external store，見該檔說明），
 * 由本檔自帶 RAF 推進（比照 useEarthquakeLayer 的 ripple 自帶 RAF），
 * **不進 React state deps**，所以整個回放期間 App.tsx 不會 re-render。
 *
 * 所有視覺都是「當前時鐘」的純函數 → scrub 只要把時鐘設到任意值，下一幀畫面自動正確。
 *
 * 五步編排（Tier A：has_town && has_grid）
 *   t=0        震央爆開（規模定大小）+ S 波前圈由震央向外擴張
 *   t=d/3.5    測站依震央距逐顆亮起（色=intensity_value / 大小=pga_int）
 *   同步        等震度網格 cell 隨同一波前淡入（cell 到震央距 ÷ 3.5 = 出現時刻）
 *   波前掃完    368 鄉鎮面量圖定格淡入（網格同時壓暗，讓面量圖讀得出來）
 *   收尾        震央彈出沙灘球（有 moment tensor 才有）
 * Tier B（只有測站）= 震央 → 測站 → 沙灘球 三步。
 */

/** 目標牆鐘播放長度（秒）；壓縮倍率由「回放總長 ÷ 此值」反推 */
const TARGET_WALL_SEC = 26;
const RATE_MIN = 0.4;
const RATE_MAX = 4;
/** 鄉鎮面量圖淡入時長（回放時鐘秒） */
const TOWN_FADE_SEC = 6;
/** 沙灘球彈出時長（回放時鐘秒） */
const BEACH_POP_SEC = 3;
/** 收尾定格（回放時鐘秒） */
const TAIL_SEC = 2.5;
/** 震央爆開時長（回放時鐘秒） */
const BURST_SEC = 1.2;

interface ReplayTimeline {
  waveEndSec: number;
  townStartSec: number;
  townFadeSec: number;
  beachStartSec: number;
  beachPopSec: number;
  durationSec: number;
  /** 回放時鐘秒 / 牆鐘秒 */
  rate: number;
  /** 測站淡入 / 彈跳時長（回放時鐘秒，隨 rate 縮放讓牆鐘觀感一致） */
  stationFadeSec: number;
  stationFlashSec: number;
  gridFadeSec: number;
}

function buildTimeline(d: EqReplayDetail): ReplayTimeline {
  const waveEndSec = Math.max(4, d.maxDistKm / S_WAVE_KM_S);
  const hasTown = d.tier === "A" && d.towns.length > 0;
  const townStartSec = waveEndSec;
  const townFadeSec = hasTown ? TOWN_FADE_SEC : 0;
  const beachStartSec = townStartSec + townFadeSec;
  const beachPopSec = d.tensor ? BEACH_POP_SEC : 0;
  const durationSec = beachStartSec + beachPopSec + TAIL_SEC;
  const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, durationSec / TARGET_WALL_SEC));
  return {
    waveEndSec,
    townStartSec,
    townFadeSec,
    beachStartSec,
    beachPopSec,
    durationSec,
    rate,
    stationFadeSec: 0.6 * rate,
    stationFlashSec: 1.8 * rate,
    gridFadeSec: 1.0 * rate,
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 震央圈半徑（px）依規模 */
function magRadiusPx(m: number): number {
  const stops: [number, number][] = [[2, 6], [4, 11], [5, 15], [6, 21], [7, 29]];
  if (m <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, y1] = stops[i]!;
    const [x0, y0] = stops[i - 1]!;
    if (m <= x1) return y0 + ((m - x0) / (x1 - x0)) * (y1 - y0);
  }
  return stops[stops.length - 1]![1];
}

export function useEarthquakeReplayLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  selectedEventId: string | null,
  playing: boolean,
  onEnded?: () => void,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const [detail, setDetail] = useState<EqReplayDetail | null>(null);
  /** mapRef 還沒填時的重試 tick（production 首載 map "load" 可能晚於資料就緒） */
  const [mapRetry, setMapRetry] = useState(0);

  const playingRef = useRef(playing);
  playingRef.current = playing;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const timelineRef = useRef<ReplayTimeline | null>(null);
  const beachballRef = useRef<BeachballHandle | null>(null);
  /** 各 feature 上次已套用的量化值（-1 = 從未寫入） */
  const stationAppliedRef = useRef<Int16Array | null>(null);
  const gridAppliedRef = useRef<Int16Array | null>(null);
  const townStateDoneRef = useRef(false);
  const lastTownBucketRef = useRef(-1);

  // ── 選中事件 → 載明細 ──
  useEffect(() => {
    if (!visible || !selectedEventId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetchReplayEvents()
      .then((events) => {
        const ev = events.find((e) => e.event_id === selectedEventId);
        if (!ev) throw new Error(`event ${selectedEventId} not in replay list`);
        return fetchReplayDetail(ev);
      })
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        console.warn("[EarthquakeReplay] detail load failed:", err);
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, selectedEventId]);

  // ── 建圖層 + 灌幾何 + 回放引擎（RAF）──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      if (!visible) return;
      const timer = setInterval(() => {
        if (mapRef.current) setMapRetry((v) => v + 1);
      }, 200);
      return () => clearInterval(timer);
    }

    if (!visible || !detail) {
      // 圖層關閉 / 未選事件 → 清乾淨，不留殘影
      removeBeachballMarker(beachballRef.current);
      beachballRef.current = null;
      if (map.getLayer(EQ_REPLAY_EPICENTER_LAYER)) setEarthquakeReplayVisible(map, false);
      earthquakeReplayClock.clear();
      return;
    }

    if (!ensureEarthquakeReplayLayers(map, opacityRef.current)) return;

    const tl = buildTimeline(detail);
    timelineRef.current = tl;
    earthquakeReplayClock.setTimeline(tl.durationSec, tl.rate);

    const { event, stations, towns, grid, tensor } = detail;
    setReplayEpicenterData(map, epicenterToGeoJSON(event));
    setReplayStationData(map, stationsToGeoJSON(stations));
    setReplayGridData(map, gridToGeoJSON(grid));

    // 換事件：舊 feature-state 全清（不清會讓上一起地震的顏色殘留在網格 / 鄉鎮）
    map.removeFeatureState({ source: EQ_REPLAY_STATION_SOURCE });
    map.removeFeatureState({ source: EQ_REPLAY_GRID_SOURCE });
    map.removeFeatureState({ source: EQ_REPLAY_TOWN_SOURCE, sourceLayer: EQ_REPLAY_TOWN_SOURCE_LAYER });
    stationAppliedRef.current = new Int16Array(stations.length).fill(-1);
    gridAppliedRef.current = new Int16Array(grid.length).fill(-1);
    townStateDoneRef.current = false;
    lastTownBucketRef.current = -1;

    setEarthquakeReplayVisible(map, true);
    setReplayStationOpacity(map, opacityRef.current);
    setReplayGridOpacity(map, opacityRef.current, 1);
    setReplayTownOpacity(map, opacityRef.current, 0);

    // 沙灘球（有機制解才有；節面 1 即可畫，double-couple 對偶性見 beachball.ts）
    if (tensor) {
      beachballRef.current = createBeachballMarker(
        map,
        [event.epicenter_lng, event.epicenter_lat],
        { strike: tensor.strike1, dip: tensor.dip1, rake: tensor.rake1 },
      );
    }

    /** 368 鄉鎮 feature-state 一次寫完（顯示與否純靠 fill-opacity 淡入），source loaded 後才可靠 */
    const flushTownState = () => {
      if (townStateDoneRef.current || towns.length === 0) return;
      if (!map.isSourceLoaded(EQ_REPLAY_TOWN_SOURCE)) return;
      for (const t of towns) {
        map.setFeatureState(
          { source: EQ_REPLAY_TOWN_SOURCE, sourceLayer: EQ_REPLAY_TOWN_SOURCE_LAYER, id: t.pmtilesCode },
          { eqi: t.intensity_value },
        );
      }
      townStateDoneRef.current = true;
    };

    /** 把時鐘 t（震後真實秒數）對應的畫面套上去 —— 純函數，scrub 直接復用 */
    const render = (t: number) => {
      // 1) 震央爆開 + S 波前
      const burst = clamp01(t / BURST_SEC);
      const baseR = magRadiusPx(event.magnitude);
      const overshoot = 1 + 0.45 * Math.sin(Math.PI * burst);
      const waveKm = S_WAVE_KM_S * t;
      const waveLifetime = tl.waveEndSec + 2;
      setReplayEpicenterFrame(map, {
        coreRadiusPx: baseR * (0.25 + 0.75 * burst) * overshoot,
        coreOpacity: 0.85 * burst * opacityRef.current,
        waveRadiusPx: t <= 0 ? 0 : metersToPixels(waveKm * 1000, event.epicenter_lat, map.getZoom()),
        waveOpacity: t <= 0 ? 0 : 0.7 * clamp01(1 - t / waveLifetime) * opacityRef.current,
        waveWidth: 1 + 2.2 * clamp01(1 - t / waveLifetime),
      });

      // 2) 測站逐顆亮起（量化到 1/50，只寫差異）
      const stApplied = stationAppliedRef.current;
      if (stApplied && map.isSourceLoaded(EQ_REPLAY_STATION_SOURCE)) {
        for (let i = 0; i < stations.length; i++) {
          const age = t - stations[i]!.arrivalSec;
          const lit = clamp01(age / tl.stationFadeSec);
          const flash = age < 0 ? 0 : clamp01(1 - age / tl.stationFlashSec);
          // lit / flash 各 0–50 打包成一個整數，省一個陣列
          const packed = Math.round(lit * 50) * 64 + Math.round(flash * 50);
          if (stApplied[i] === packed) continue;
          stApplied[i] = packed;
          map.setFeatureState(
            { source: EQ_REPLAY_STATION_SOURCE, id: i },
            { lit, flash },
          );
        }
      }

      // 3) 網格 cell 隨波前淡入（量化到 1/10；未到波前的 cell 從不寫入 → 預設全透明）
      const gApplied = gridAppliedRef.current;
      if (gApplied && grid.length > 0 && map.isSourceLoaded(EQ_REPLAY_GRID_SOURCE)) {
        for (let i = 0; i < grid.length; i++) {
          const on = clamp01((t - grid[i]!.arrivalSec) / tl.gridFadeSec);
          const q = Math.round(on * 10);
          if (gApplied[i] === q) continue;
          if (gApplied[i] === -1 && q === 0) continue; // 預設已透明，不必寫
          gApplied[i] = q;
          map.setFeatureState({ source: EQ_REPLAY_GRID_SOURCE, id: i }, { on: q / 10 });
        }
      }

      // 4) 鄉鎮面量圖定格淡入（網格同步壓暗）
      if (tl.townFadeSec > 0) {
        flushTownState();
        const fade = clamp01((t - tl.townStartSec) / tl.townFadeSec);
        const bucket = Math.round(fade * 40);
        if (bucket !== lastTownBucketRef.current) {
          lastTownBucketRef.current = bucket;
          const f = bucket / 40;
          setReplayTownOpacity(map, opacityRef.current, f);
          setReplayGridOpacity(map, opacityRef.current, 1 - 0.55 * f);
        }
      }

      // 5) 沙灘球彈出
      const bb = beachballRef.current;
      if (bb) {
        const pop = tl.beachPopSec > 0 ? clamp01((t - tl.beachStartSec) / tl.beachPopSec) : 0;
        updateBeachball(bb, pop, opacityRef.current);
      }
    };

    // RAF：時鐘推進 + 每幀重算（暫停時仍跑，讓 scrub 立即反映）
    let raf = 0;
    let lastMs = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, (now - lastMs) / 1000); // 分頁切回來時 dt 可能極大 → clamp
      lastMs = now;
      if (playingRef.current) {
        const next = earthquakeReplayClock.get() + dt * tl.rate;
        if (next >= tl.durationSec) {
          earthquakeReplayClock.set(tl.durationSec, true);
          onEndedRef.current?.();
        } else {
          earthquakeReplayClock.set(next);
        }
      }
      render(earthquakeReplayClock.get());
    };
    raf = requestAnimationFrame(tick);
    // 註：不另接 sourcedata —— RAF 每幀都會 render，且 render 內部已用 isSourceLoaded
    //     把「source 尚未就緒」的 feature-state 寫入延到下一幀，自然重試。

    return () => {
      cancelAnimationFrame(raf);
      removeBeachballMarker(beachballRef.current);
      beachballRef.current = null;
      if (map.getLayer(EQ_REPLAY_EPICENTER_LAYER)) setEarthquakeReplayVisible(map, false);
    };
  }, [mapRef, visible, detail, mapRetry, mapTick]);

  // ── 圖層關閉：source / layer 一併拆掉，dispose 乾淨 ──
  useEffect(() => {
    if (visible) return;
    const map = mapRef.current;
    if (!map) return;
    removeEarthquakeReplayLayers(map);
    earthquakeReplayClock.clear();
  }, [mapRef, visible, mapTick]);

  // ── 透明度 slider ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    setReplayStationOpacity(map, opacity);
    setReplayGridOpacity(map, opacity, 1 - 0.55 * clamp01(lastTownBucketRef.current / 40));
  }, [mapRef, opacity, visible, detail, mapTick]);
}
