import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  fetchReservoirStatusDay,
  alertLevelFromPct,
  type ReservoirStatus,
  type ReservoirDayRow,
} from "../data/reservoirStatusLoader";
import { fetchReservoirOpsRecent } from "../data/reservoirOpsLoader";
import { ReservoirScene } from "../three/ReservoirScene";
import { createReservoirLayer } from "../map/reservoirCustomLayer";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { timeStore } from "../state/timeStore";

/**
 * 水庫 3D 水位計 hook — Timeline 驅動
 *
 * 管理：
 *   1. ReservoirScene 實例 + Mapbox custom layer 掛載
 *   2. 當日每小時時序（get_reservoir_status_day）→ 依 currentTime 切片 → setStatuses
 *   3. 暴露 sceneRef 供 useMapInteraction 做 pick
 *
 * 時間模型（CLAUDE.md 規則 6）：
 *   - visible=true 時 fetch 當日
 *   - timeStore.subscribeDate → 跨日換資料
 *   - timeStore.subscribeThrottled(500ms) → 依 currentTime 更新水位/顏色
 *   - scene.setStatuses 內含 fast path（站點組不變只改矩陣/顏色，不拆 GPU buffer）
 */

const THROTTLE_MS = 500;
const LAYER_ID = "reservoir-3d";

/** 一個水庫的當日時序（rows 按 snapshot_at ASC 排序） */
interface ReservoirSeries {
  reservoir_id: string;
  name: string | null;
  lat: number;
  lng: number;
  effective_capacity_wan: number | null;
  rows: Array<{
    t: number; // snapshot_at unix seconds
    water_level_m: number | null;
    effective_storage_wan_m3: number | null;
    storage_ratio_pct: number | null;
    basin_rainfall_mm: number | null;
  }>;
}

function groupByReservoir(rows: ReservoirDayRow[]): Map<string, ReservoirSeries> {
  const map = new Map<string, ReservoirSeries>();
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue;
    let entry = map.get(r.reservoir_id);
    if (!entry) {
      entry = {
        reservoir_id: r.reservoir_id,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        effective_capacity_wan: r.effective_capacity_wan,
        rows: [],
      };
      map.set(r.reservoir_id, entry);
    }
    entry.rows.push({
      t: Date.parse(r.snapshot_at) / 1000,
      water_level_m: r.water_level_m,
      effective_storage_wan_m3: r.effective_storage_wan_m3,
      storage_ratio_pct: r.storage_ratio_pct,
      basin_rainfall_mm: r.basin_rainfall_mm,
    });
  }
  for (const entry of map.values()) {
    entry.rows.sort((a, b) => a.t - b.t);
  }
  return map;
}

/** 依 currentT 取每庫最近一筆（t ≤ currentT），回 ReservoirStatus[] 給 scene */
function statusesAt(byId: Map<string, ReservoirSeries>, currentT: number): ReservoirStatus[] {
  const out: ReservoirStatus[] = [];
  for (const s of byId.values()) {
    let row: ReservoirSeries["rows"][number] | null = null;
    for (let i = s.rows.length - 1; i >= 0; i--) {
      if (s.rows[i]!.t <= currentT) {
        row = s.rows[i]!;
        break;
      }
    }
    // 找不到 → 用最早一筆作為 fallback（一天開頭畫面，讓水柱有初始高度）
    if (!row && s.rows.length > 0) row = s.rows[0]!;
    if (!row) continue;
    out.push({
      reservoir_id: s.reservoir_id,
      name: s.name,
      region: null,
      lat: s.lat,
      lng: s.lng,
      effective_capacity_wan: s.effective_capacity_wan,
      snapshot_at: new Date(row.t * 1000).toISOString(),
      water_level_m: row.water_level_m,
      effective_storage_wan_m3: row.effective_storage_wan_m3,
      storage_ratio_pct: row.storage_ratio_pct,
      alert_level: alertLevelFromPct(row.storage_ratio_pct),
      inflow_cms: null,
      total_outflow_cms: null,
      basin_rainfall_mm: row.basin_rainfall_mm,
    });
  }
  return out;
}

export function useReservoirStatusLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  isDark: boolean,
  heightScale: number,
  sceneRef: React.RefObject<ReservoirScene | null>,
  statusesRef: React.RefObject<ReservoirStatus[]>,
  activeReservoirId: number | null,
) {
  const visibleRef = useRef(visible);
  const isDarkRef = useRef(isDark);
  const heightScaleRef = useRef(heightScale);
  const mountedRef = useRef(false);
  const byIdRef = useRef<Map<string, ReservoirSeries>>(new Map());
  const currentDateRef = useRef<string>("");

  visibleRef.current = visible;
  isDarkRef.current = isDark;
  heightScaleRef.current = heightScale;

  // ── 首次 visible = true 時建 scene + 掛 custom layer ──
  useEffect(() => {
    console.log("[Reservoir] mount effect", { visible, mounted: mountedRef.current, map: !!mapRef.current });
    if (!visible) return;
    if (mountedRef.current) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const attach = () => {
      console.log("[Reservoir] attaching custom layer", { styleLoaded: map.isStyleLoaded() });
      mountedRef.current = true;
      const scene = new ReservoirScene();
      sceneRef.current = scene;

      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      const layer = createReservoirLayer({
        scene,
        getStatuses: () => statusesRef.current ?? [],
        getIsVisible: () => visibleRef.current,
        getIsDarkTheme: () => isDarkRef.current,
        getHeightScale: () => heightScaleRef.current,
      });
      try {
        map.addLayer(layer);
      } catch (err) {
        console.warn("[Reservoir] addLayer failed:", err);
        mountedRef.current = false;
        sceneRef.current = null;
        return false;
      }
      const existing = statusesRef.current ?? [];
      if (existing.length > 0) scene.setStatuses(existing);
      map.triggerRepaint();
      return true;
    };

    const tryAttach = () => {
      if (cancelled || mountedRef.current) {
        if (pollTimer) clearInterval(pollTimer);
        return;
      }
      if (!map.isStyleLoaded()) return;
      if (attach() && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    if (map.isStyleLoaded()) {
      attach();
    } else {
      pollTimer = setInterval(tryAttach, 200);
      tryAttach();
    }

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [mapRef, visible, sceneRef, statusesRef]);

  // ── visible=true：fetch day + 訂閱 date/time ──
  useEffect(() => {
    if (!visible) return;
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    /** 依當下時間計算 statuses 並推給 scene */
    const redraw = () => {
      if (cancelled) return;
      const t = timeStore.getTime();
      const list = statusesAt(byIdRef.current, t);
      statusesRef.current = list;
      const scene = sceneRef.current;
      if (scene) scene.setStatuses(list);
      map.triggerRepaint();
    };

    const loadDay = async (dateKey: string) => {
      if (cancelled) return;
      try {
        console.log("[Reservoir] fetching day", dateKey);
        const rows = await fetchReservoirStatusDay(dateKey);
        if (cancelled || currentDateRef.current !== dateKey) return;
        byIdRef.current = groupByReservoir(rows);
        console.log(`[Reservoir] loaded ${rows.length} rows, ${byIdRef.current.size} reservoirs`);
        redraw();
        keepLoadingUntilMapIdle(map, "reservoir-status-render", "水庫水情 渲染中", null);
      } catch (err) {
        console.warn("[Reservoir] day fetch failed:", err);
      }
    };

    currentDateRef.current = timeStore.getDateKey();
    loadDay(currentDateRef.current);

    const unsubDate = timeStore.subscribeDate((key) => {
      currentDateRef.current = key;
      byIdRef.current = new Map();
      loadDay(key);
    });
    const unsubTime = timeStore.subscribeThrottled(THROTTLE_MS, redraw);

    return () => {
      cancelled = true;
      unsubDate();
      unsubTime();
    };
  }, [mapRef, sceneRef, statusesRef, visible]);

  // ── heightScale 變化觸發 repaint（Scene.updateMatrices 會 apply heightScale）──
  useEffect(() => {
    const map = mapRef.current;
    if (map && visible) map.triggerRepaint();
  }, [heightScale, visible, mapRef]);

  // ── activeReservoirId：點選水庫後撈近 3 日進/出流量，推給 scene 畫雙柱 ──
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (activeReservoirId == null) {
      scene.setActiveOps(null);
      mapRef.current?.triggerRepaint();
      return;
    }

    let cancelled = false;
    const reservoirIdText = String(activeReservoirId);

    (async () => {
      try {
        console.log(`[Reservoir] fetching ops for ${reservoirIdText}`);
        const ops = await fetchReservoirOpsRecent(reservoirIdText, 3);
        if (cancelled) return;
        console.log("[Reservoir] ops", ops);
        // scene.data 可能還沒 load（首次點擊太快）→ 重試幾次
        let tries = 0;
        const tryApply = () => {
          if (cancelled) return;
          const s = sceneRef.current;
          if (!s) return;
          const has = statusesRef.current?.some((x) => x.reservoir_id === reservoirIdText);
          if (!has && tries < 10) {
            tries++;
            setTimeout(tryApply, 200);
            return;
          }
          s.setActiveOps({
            reservoir_id: reservoirIdText,
            avg_inflow_cms: ops.avg_inflow_cms,
            avg_outflow_cms: ops.avg_outflow_cms,
          });
          mapRef.current?.triggerRepaint();
        };
        tryApply();
      } catch (err) {
        console.warn("[Reservoir] ops fetch failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeReservoirId, sceneRef, statusesRef, mapRef]);
}
