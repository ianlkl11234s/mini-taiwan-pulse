import { useEffect, useRef, useState, useCallback } from "react";
import type {
  Map as MapboxMap,
  FillLayer,
  LineLayer,
  CircleLayer,
  FilterSpecification,
  ExpressionSpecification,
} from "mapbox-gl";
import {
  fetchDisasterAlertsDay,
  alertsToGeoJSON,
  type DisasterAlert,
} from "../data/disasterAlertLoader";
import { ALERT_GROUP_KEYS, type AlertGroupKey } from "../data/disasterAlertTypes";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

/**
 * NCDR 災害示警 timeline 圖層（5 主題群組）
 *
 * - 一次載入一整天的所有 alert，共用單一 GeoJSON source
 * - 5 群組（民生中斷/水文防汛/氣象特報/交通阻斷/安全環境）各自
 *   fill/line/point 三層，filter 在 properties.group 上，可獨立 toggle
 * - 顏色依 event_term（tcolor），fill 透明度依 severity 分級
 * - 依 currentTime 過濾出當前 active（start <= now < end）
 * - 按日切換 + LRU 快取 7 天
 */

const SOURCE_ID = "disaster-alerts";
const CACHE_MAX = 7;

/**
 * B2 脈動層（W5 Phase 2）——「出事了一眼看到」
 *
 * 5 群組共用 2 個環（相位差半圈），不逐群組開層：ring 顏色走 feature 的
 * `color`（severity 色）而非 `tcolor`，所以一套 filter 就夠，每幀只要 4 次
 * setPaintProperty。可見群組變動時改 filter，不改層數。
 *
 * 只畫 `pulse=1` 的錨點 —— 該旗標在 loader 端已 gate 過 active ∧ severity≥Severe
 * ∧ 未超過 alertRules 的群組門檻（否則藤枝休園那種 Severe + expires 2027 會全年閃）。
 */
const PULSE_IDS = ["disaster-alert-pulse-0", "disaster-alert-pulse-1"];
const PULSE_CYCLE_MS = 2200;
const PULSE_FRAME_MS = 40;
const PULSE_R_MIN = 7;
const PULSE_R_MAX = 30;
const PULSE_PEAK_OPACITY = 0.85;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 可見群組 → pulse 層 filter（沒有可見群組時整層關掉） */
function pulseFilter(visibleGroups: AlertGroupKey[]): FilterSpecification {
  if (visibleGroups.length === 0) {
    return ["literal", false] as unknown as FilterSpecification;
  }
  return [
    "all",
    ["==", ["get", "pulse"], 1],
    [">", ["get", "is_pt"], 0],
    ["in", ["get", "group"], ["literal", visibleGroups]],
  ] as unknown as FilterSpecification;
}

const layerIds = (group: AlertGroupKey) => ({
  fill: `${group}-fill`,
  line: `${group}-line`,
  point: `${group}-point`,
});

/** 給 useMapInteraction 的可點擊 layer 清單 */
export const DISASTER_ALERT_CLICK_LAYERS = ALERT_GROUP_KEYS.flatMap((g) => {
  const ids = layerIds(g);
  return [ids.fill, ids.line, ids.point];
});

const SEVERITY_FILL_OPACITY: ExpressionSpecification = [
  "match",
  ["get", "severity"],
  "Extreme", 0.35,
  "Severe", 0.28,
  "Moderate", 0.22,
  "Minor", 0.15,
  0.18,
] as unknown as ExpressionSpecification;

interface CachedDay {
  data: DisasterAlert[];
  accessedAt: number;
}

function buildLayers(map: MapboxMap): boolean {
  if (!map.getSource(SOURCE_ID)) return false;

  for (const group of ALERT_GROUP_KEYS) {
    const ids = layerIds(group);
    // active + 群組 + polygon/point 區分
    const baseFilter = [
      "all",
      ["==", ["get", "active"], 1],
      ["==", ["get", "group"], group],
    ];
    const polyFilter = [...baseFilter, ["==", ["get", "is_pt"], 0]] as unknown as FilterSpecification;
    const ptFilter = [...baseFilter, ["==", ["get", "is_pt"], 1]] as unknown as FilterSpecification;

    if (!map.getLayer(ids.fill)) {
      map.addLayer({
        id: ids.fill,
        type: "fill",
        source: SOURCE_ID,
        filter: polyFilter,
        paint: {
          "fill-color": ["get", "tcolor"] as unknown as ExpressionSpecification,
          "fill-opacity": SEVERITY_FILL_OPACITY,
        },
      } as FillLayer);
    }

    if (!map.getLayer(ids.line)) {
      map.addLayer({
        id: ids.line,
        type: "line",
        source: SOURCE_ID,
        filter: polyFilter,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "tcolor"] as unknown as ExpressionSpecification,
          "line-width": 1.5,
          "line-opacity": 0.9,
        },
      } as LineLayer);
    }

    if (!map.getLayer(ids.point)) {
      map.addLayer({
        id: ids.point,
        type: "circle",
        source: SOURCE_ID,
        filter: ptFilter,
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            6, 3.5,
            10, 5.5,
            14, 7,
          ] as unknown as ExpressionSpecification,
          "circle-color": ["get", "tcolor"] as unknown as ExpressionSpecification,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.2,
          "circle-opacity": 0.85,
        },
      } as CircleLayer);
    }
  }

  // B2 脈動環（5 群組共用，畫在所有點層之上）
  for (const id of PULSE_IDS) {
    if (map.getLayer(id)) continue;
    map.addLayer({
      id,
      type: "circle",
      source: SOURCE_ID,
      filter: ["literal", false] as unknown as FilterSpecification,
      paint: {
        "circle-radius": PULSE_R_MIN,
        "circle-color": "transparent",
        // severity 色（Extreme #dc2626 / Severe #ea580c），與側欄嚴重度 chip 同語意
        "circle-stroke-color": ["get", "color"] as unknown as ExpressionSpecification,
        "circle-stroke-width": 2.5,
        "circle-stroke-opacity": 0,
      },
    } as CircleLayer);
  }

  return true;
}

export function useDisasterAlertLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: Record<AlertGroupKey, boolean>,
  opacity: number = 1,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef);

  const cacheRef = useRef<Map<string, CachedDay>>(new Map());
  const activeDayRef = useRef<DisasterAlert[] | null>(null);
  const activeDateRef = useRef<string>("");
  const layersReadyRef = useRef(false);
  const fetchingRef = useRef<string>("");
  const lastActiveSetRef = useRef<string>("");
  /** 當前畫面有沒有該 pulse 的警報 —— 沒有就不開 rAF */
  const [hasPulse, setHasPulse] = useState(false);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  const anyVisible = ALERT_GROUP_KEYS.some((k) => visibility[k]);
  // effect dep 用的穩定 key（避免物件 identity 每 render 變動）
  const visKey = ALERT_GROUP_KEYS.map((k) => (visibility[k] ? "1" : "0")).join("");
  const visRef = useRef(visibility);
  visRef.current = visibility;

  const writeCache = useCallback((dateStr: string, data: DisasterAlert[]) => {
    const cache = cacheRef.current;
    cache.set(dateStr, { data, accessedAt: Date.now() });
    if (cache.size > CACHE_MAX) {
      let oldestKey = "";
      let oldestTime = Infinity;
      for (const [k, v] of cache) {
        if (v.accessedAt < oldestTime) {
          oldestTime = v.accessedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) cache.delete(oldestKey);
    }
  }, []);

  const ensureLayers = useCallback((map: MapboxMap) => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    const probe = layerIds(ALERT_GROUP_KEYS[0]!).fill;
    if (!layersReadyRef.current || !map.getLayer(probe)) {
      layersReadyRef.current = buildLayers(map);
    }
    return layersReadyRef.current;
  }, []);

  const refreshSource = useCallback((map: MapboxMap, t: number) => {
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    const day = activeDayRef.current ?? [];
    const fc = alertsToGeoJSON(day, t);
    src.setData(fc);
    let pulses = 0;
    for (const f of fc.features) {
      const p = f.properties as { pulse?: number; is_pt?: number } | null;
      if (p?.pulse === 1 && (p.is_pt ?? 0) > 0) pulses++;
    }
    setHasPulse(pulses > 0);
  }, []);

  const loadDay = useCallback(
    (dateStr: string) => {
      if (dateStr === activeDateRef.current) return;
      if (dateStr === fetchingRef.current) return;

      const cached = cacheRef.current.get(dateStr);
      if (cached) {
        cached.accessedAt = Date.now();
        activeDayRef.current = cached.data;
        activeDateRef.current = dateStr;
        lastActiveSetRef.current = "";
        const map = mapRef.current;
        if (map && ensureLayers(map)) refreshSource(map, timeStore.getTime());
        return;
      }

      fetchingRef.current = dateStr;
      fetchDisasterAlertsDay(dateStr)
        .then((alerts) => {
          writeCache(dateStr, alerts);
          if (fetchingRef.current !== dateStr) return;
          activeDayRef.current = alerts;
          activeDateRef.current = dateStr;
          lastActiveSetRef.current = "";
          const map = mapRef.current;
          if (map && ensureLayers(map)) {
            refreshSource(map, timeStore.getTime());
            keepLoadingUntilMapIdle(map, `disaster-render:${dateStr}`, "災害示警 渲染中", SOURCE_ID);
          }
        })
        .catch((err) => {
          console.warn(`[DisasterAlerts] load ${dateStr} failed:`, err);
        })
        .finally(() => {
          if (fetchingRef.current === dateStr) fetchingRef.current = "";
        });
    },
    [ensureLayers, refreshSource, writeCache, mapRef],
  );

  // ── 訂閱 timeStore 日期變化載入當日資料 ──
  useEffect(() => {
    if (!anyVisible) return;
    const handler = (dateStr: string) => {
      if (dateStr) loadDay(dateStr);
    };
    handler(timeStore.getDateKey());
    return timeStore.subscribeDate(handler);
  }, [anyVisible, loadDay]);

  // ── 群組可見性 + 訂閱 timeStore 節流更新 active filter ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyVisibility = () => {
      for (const group of ALERT_GROUP_KEYS) {
        const ids = layerIds(group);
        const vis = visRef.current[group] ? "visible" : "none";
        for (const id of [ids.fill, ids.line, ids.point]) {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
        }
      }
      // pulse 是 5 群組共用層 → 用 filter（而非 visibility）挑可見群組
      const visibleGroups = ALERT_GROUP_KEYS.filter((k) => visRef.current[k]);
      for (const id of PULSE_IDS) {
        if (map.getLayer(id)) map.setFilter(id, pulseFilter(visibleGroups));
      }
    };

    if (!anyVisible) {
      applyVisibility();
      return;
    }
    if (!ensureLayers(map)) return;
    applyVisibility();

    const tick = (currentTime: number) => {
      const m = mapRef.current;
      if (!m) return;
      const day = activeDayRef.current;
      if (!day) return;

      // 計算當前 active 集合的 hash，沒變動就不重 setData。
      // 前綴帶小時桶：pulse 的 fresh gate 是 48/72h 門檻，active 集合不變時也會
      // 隨時間翻面，每個 timeline 小時強制重算一次（成本 = 每小時 1 次 setData）
      let key = `h${Math.floor(currentTime / 3600)}|`;
      for (const a of day) {
        if (currentTime >= a.start_ts && currentTime < a.end_ts) {
          key += a.identifier + "|";
        }
      }
      if (key !== lastActiveSetRef.current) {
        lastActiveSetRef.current = key;
        refreshSource(m, currentTime);
      }
    };

    tick(timeStore.getTime()); // 初始化
    return timeStore.subscribeThrottled(500, tick);
  }, [anyVisible, visKey, ensureLayers, refreshSource, mapRef, mapTick]);

  // ── B2 脈動動畫（只在畫面真有 severe+fresh 警報時才開 rAF）──
  useEffect(() => {
    if (!anyVisible || !hasPulse) return;
    const map = mapRef.current;
    if (!map) return;

    // 減少動態偏好：不跑 rAF，畫一個靜態中徑環（仍看得出「這裡有嚴重警報」）
    if (prefersReducedMotion()) {
      for (const id of PULSE_IDS) {
        if (!map.getLayer(id)) continue;
        map.setPaintProperty(id, "circle-radius", (PULSE_R_MIN + PULSE_R_MAX) / 2);
        map.setPaintProperty(id, "circle-stroke-opacity", 0.5 * opacityRef.current);
      }
      return;
    }

    let raf = 0;
    let lastFrame = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const m = mapRef.current;
      if (!m) return;
      const now = performance.now();
      if (now - lastFrame < PULSE_FRAME_MS) return;
      lastFrame = now;

      for (let i = 0; i < PULSE_IDS.length; i++) {
        const id = PULSE_IDS[i]!;
        if (!m.getLayer(id)) continue; // style 切換後層會消失
        const phase =
          ((now + i * (PULSE_CYCLE_MS / PULSE_IDS.length)) % PULSE_CYCLE_MS) / PULSE_CYCLE_MS;
        const eased = 1 - Math.pow(1 - phase, 2);
        m.setPaintProperty(id, "circle-radius", PULSE_R_MIN + (PULSE_R_MAX - PULSE_R_MIN) * eased);
        m.setPaintProperty(
          id,
          "circle-stroke-opacity",
          (1 - phase) * PULSE_PEAK_OPACITY * opacityRef.current,
        );
      }
    };
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      const m = mapRef.current;
      if (!m) return;
      for (const id of PULSE_IDS) {
        if (m.getLayer(id)) m.setPaintProperty(id, "circle-stroke-opacity", 0);
      }
    };
  }, [anyVisible, hasPulse, visKey, mapRef, mapTick]);

  // 套用 opacity（乘以各 layer 的 base opacity，5 群組共用）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!layersReadyRef.current) return;
    const o = Math.max(0, Math.min(1, opacity));
    for (const group of ALERT_GROUP_KEYS) {
      const ids = layerIds(group);
      if (map.getLayer(ids.fill)) {
        map.setPaintProperty(ids.fill, "fill-opacity", [
          "*",
          o,
          SEVERITY_FILL_OPACITY,
        ] as unknown as ExpressionSpecification);
      }
      if (map.getLayer(ids.line)) {
        map.setPaintProperty(ids.line, "line-opacity", 0.9 * o);
      }
      if (map.getLayer(ids.point)) {
        map.setPaintProperty(ids.point, "circle-opacity", 0.85 * o);
        map.setPaintProperty(ids.point, "circle-stroke-opacity", o);
      }
    }
    // pulse 的 opacity 平常由 rAF 每幀寫（讀 opacityRef），只有 reduced-motion
    // 的靜態環需要在這裡跟著滑桿更新
    if (prefersReducedMotion()) {
      for (const id of PULSE_IDS) {
        if (map.getLayer(id)) map.setPaintProperty(id, "circle-stroke-opacity", 0.5 * o);
      }
    }
  }, [opacity, visKey, mapRef, mapTick]);
}
