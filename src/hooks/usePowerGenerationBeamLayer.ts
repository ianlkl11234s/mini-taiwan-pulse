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
        source_table: "power_plants",
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
 * - 一次拉 24h × 14 廠 (~45KB)，scrub 走 client binary search → 零 round-trip
 * - 每 10min 自動 invalidate + refetch（拿新一輪 cron 結果）
 * - 歷史超過 24h 範圍時走 beam 高度歸 0
 */
export function usePowerGenerationBeamLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  heightScale: number,
) {
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const heightScaleRef = useRef(heightScale);
  heightScaleRef.current = heightScale;
  const plantsRef = useRef<PowerGenerationRow[] | null>(null);

  // Mount layer — visible 加進 deps，toggle ON 時保證 effect 重跑（修：mapRef.current
  // 在初始 render 可能為 null，原本 [mapRef] 不會 re-run）
  useEffect(() => {
    console.log("[PowerBeam] mount effect run; visible=", visible, "mapReady=", !!mapRef.current);
    const map = mapRef.current;
    if (!map) {
      console.log("[PowerBeam] mount: mapRef.current=null，等下次 deps 改變");
      return;
    }

    const mount = () => {
      if (map.getLayer(POWER_GENERATION_BEAM_LAYER_ID)) {
        console.log("[PowerBeam] mount(): layer 已存在，略過");
        return;
      }
      const layer = createPowerGenerationBeamLayer({
        getIsVisible: () => visibleRef.current,
        getOpacity: () => opacityRef.current,
        getHeightScale: () => heightScaleRef.current,
        getPlants: () => plantsRef.current,
      });
      map.addLayer(layer);
      console.log("[PowerBeam] CustomLayer mounted ✓");
    };

    if (map.isStyleLoaded()) {
      mount();
    } else {
      console.log("[PowerBeam] style 還沒 load，等 style.load 觸發");
    }
    map.on("style.load", mount);
    return () => {
      map.off("style.load", mount);
    };
  }, [mapRef, visible]);

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
  }, [visible, mapRef]);
}
