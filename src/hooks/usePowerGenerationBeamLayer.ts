import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import {
  createPowerGenerationBeamLayer,
  POWER_GENERATION_BEAM_LAYER_ID,
} from "../map/powerGenerationBeamCustomLayer";
import {
  fetchPowerGeneration24h,
  invalidatePowerGeneration24h,
  resolvePowerGenerationAt,
  fuelColorOf,
  radiusForCapacity,
  type PowerGenerationDay,
  type PowerGenerationRow,
} from "../data/energyLoader";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";

/** 透明 hit-test source — 提供「點 beam 也會出 PowerPlantPanel」 */
const HIT_SOURCE_ID = "energy-power-generation-hit";

function plantsToHitFC(rows: PowerGenerationRow[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [r.lon, r.lat] },
      properties: {
        // 跟 layer 1 plants 同 shape，PowerPlantPanel 直接相容
        source_table: "energy.power_facilities",
        source_id: r.facility_id ?? r.plant_name,
        facility_id: r.facility_id,
        name: r.plant_name,
        fuel_type: r.fuel_type ?? "",
        capacity_mw: r.capacity_mw,
        output_mw: r.output_mw,
        output_load_rate: r.output_load_rate,
        status: "",
        status_note: "",
        is_retired: false,
        radius: radiusForCapacity(r.capacity_mw),
        color: fuelColorOf(r.fuel_type),
      },
    })),
  };
}

/**
 * Layer 4：機組即時出力 3D beam，跟隨 timeline 時間軸。
 * - 一次拉 24h × ~23 廠（14 台電 + 6 離岸 + 3 離島；SSOT RPC 238），scrub 走 client binary search
 * - 每 10min 自動 invalidate + refetch（拿新一輪 cron 結果）
 * - 歷史超過 24h 範圍時走 beam 高度歸 0
 */
export function usePowerGenerationBeamLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  heightScale: number,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef, visible);

  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const heightScaleRef = useRef(heightScale);
  heightScaleRef.current = heightScale;
  const plantsRef = useRef<PowerGenerationRow[] | null>(null);

  // Mount layer — toggle ON 時保證 effect 重跑（mapRef.current 初始可能 null）
  //
  // ⚠️ 這裡是 .claude/pitfalls/2026-04-22-mapbox-load-once-fired.md 的踩坑點 #2
  // 寫獨立 3D / CustomLayer hook 前先讀那個檔，禁用 `if (isStyleLoaded()) ... else map.on("style.load", ...)`
  // 因為 isStyleLoaded() 在 toggle 瞬間 racily 回 false，style 已 load 過不會再 fire
  // → CustomLayer 永遠沒 addLayer，14 廠 fetch 成功但畫面沒柱。修法走 try/catch + idle retry
  useEffect(() => {
    console.log("[PowerBeam] mount effect run; visible=", visible, "mapReady=", !!mapRef.current);
    const map = mapRef.current;
    if (!map) {
      console.log("[PowerBeam] mount: mapRef.current=null，等下次 deps 改變");
      return;
    }

    const tryMount = () => {
      if (map.getLayer(POWER_GENERATION_BEAM_LAYER_ID)) return;
      try {
        const layer = createPowerGenerationBeamLayer({
          getIsVisible: () => visibleRef.current,
          getOpacity: () => opacityRef.current,
          getHeightScale: () => heightScaleRef.current,
          getPlants: () => plantsRef.current,
        });
        map.addLayer(layer);
        console.log("[PowerBeam] CustomLayer mounted ✓");
      } catch (e) {
        console.log("[PowerBeam] addLayer 失敗（style 還在 load）→ idle 後重試", e);
        map.once("idle", tryMount);
      }
    };

    tryMount();
    // 未來 setStyle (Dark/Light 切換) 後也要重新掛
    map.on("style.load", tryMount);
    return () => {
      map.off("style.load", tryMount);
    };
  }, [mapRef, visible, mapTick]);

  // 24h preload + 跟隨 timeStore（client binary search 解析）
  useEffect(() => {
    console.log("[PowerBeam] fetch effect run; visible=", visible);
    if (!visible) return;
    let cancelled = false;
    let dayRef: PowerGenerationDay | null = null;

    const applyTime = (tsSec: number) => {
      if (!dayRef) return;
      const rows = resolvePowerGenerationAt(dayRef, tsSec);
      if (rows.length === 0 && dayRef.plants.length > 0) {
        console.log(
          `[PowerBeam] ts ${tsSec} 在資料窗外 (data ${dayRef.ts_range.lo}~${dayRef.ts_range.hi}) → 14 柱歸 0`,
        );
      }
      plantsRef.current = rows;
      const map = mapRef.current;
      if (map) {
        const src = map.getSource(HIT_SOURCE_ID) as GeoJSONSource | undefined;
        if (src) src.setData(plantsToHitFC(rows));
        map.triggerRepaint();
      }
    };

    const load = () => {
      console.log("[PowerBeam] load() 開始 fetch 24h...");
      fetchPowerGeneration24h()
        .then((day) => {
          if (cancelled) { console.log("[PowerBeam] load cancelled"); return; }
          dayRef = day;
          console.log(`[PowerBeam] fetch 成功：${day.plants.length} 廠 × ${day.plants[0]?.points.length ?? 0} ts`);
          applyTime(timeStore.getTime());
        })
        .catch((err) => console.warn("[PowerBeam] load failed:", err));
    };

    load();
    // 每 10 min 拉一輪新 cron 資料
    const poll = window.setInterval(() => {
      invalidatePowerGeneration24h();
      load();
    }, 10 * 60_000);
    // scrub 走 client lookup，300ms throttle 已足夠流暢
    const unsub = timeStore.subscribeThrottled(300, applyTime);
    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(poll);
    };
  }, [visible, mapRef, mapTick]);
}
