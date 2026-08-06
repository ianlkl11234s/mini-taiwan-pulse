import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  createClimateParticleLineLayer,
  type ClimateParticleLineLayer,
  type ClimateParticleLineLayerOptions,
} from "../map/climateParticleLineLayer";
import { timeStore } from "../state/timeStore";
import { climateFrameStore, type ClimateFrameStatusKey } from "../state/climateFrameStore";
import { useMapReadyTick } from "./useMapReadyTick";
import {
  loadClimateManifest,
  fetchClimateBaseMeta,
  pickNearestFrame,
  FrameRasterCache,
  type ClimateFrame,
} from "../data/climateFrames";

// 換幀選擇節流：selectForTime 很輕（掃 ~19 幀 + 只在 key 變才載），400ms 已足夠平滑。
const FRAME_THROTTLE_MS = 400;

interface HookOptions {
  layerId: string;
  pngUrl: string;
  metaUrl: string;
  visible: boolean;
  opacity: number;
  animationSpeed: number;
  particleCount: number;
  lineWidth: number;
  timeScaleSeconds: number;
  trailPoints: number;
  speedMax: number;
  maskErodePx?: number;
  particleAlpha?: number;
  rampColors?: ClimateParticleLineLayerOptions["rampColors"];
  beforeId?: string;
  /**
   * manifest.datasets 的 key（"wind10m" | "currents"）。給定才啟用 time-aware 換幀；
   * 未給或 manifest 404 → 維持 *_latest.png 一次性行為（graceful fallback）。
   */
  frameDataset?: string;
  /** 寫入 climateFrameStore 供 legend 顯示當前幀有效時間 / 種類。 */
  statusKey?: ClimateFrameStatusKey;
}

export function useClimateParticleLineLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  o: HookOptions,
) {
  /** map 就緒通知：mapRef 是 ref，.current 變動不觸發 re-render（見 useMapReadyTick） */
  const mapTick = useMapReadyTick(mapRef);

  const visibleRef = useRef(o.visible);
  const opacityRef = useRef(o.opacity);
  const speedRef = useRef(o.animationSpeed);
  const countRef = useRef(o.particleCount);
  const lineWidthRef = useRef(o.lineWidth);
  const layerRef = useRef<ClimateParticleLineLayer | null>(null);

  visibleRef.current = o.visible;
  opacityRef.current = o.opacity;
  speedRef.current = o.animationSpeed;
  countRef.current = o.particleCount;
  lineWidthRef.current = o.lineWidth;

  useEffect(() => {
    if (!o.visible) return;

    let cancelled = false;
    let intervalId: number | null = null;
    let attachedMap: MapboxMap | null = null;
    let styleBoundMap: MapboxMap | null = null;

    const addLayer = (): boolean => {
      const map = mapRef.current;
      if (cancelled || !map || !map.isStyleLoaded()) return false;
      attachedMap = map;
      if (map.getLayer(o.layerId)) return true;

      const layer = createClimateParticleLineLayer({
        id: o.layerId,
        pngUrl: o.pngUrl,
        metaUrl: o.metaUrl,
        speedMax: o.speedMax,
        timeScaleSeconds: o.timeScaleSeconds,
        trailPoints: o.trailPoints,
        maskErodePx: o.maskErodePx,
        particleAlpha: o.particleAlpha,
        rampColors: o.rampColors,
        getIsVisible: () => visibleRef.current,
        getOpacity: () => opacityRef.current,
        getAnimationSpeed: () => speedRef.current,
        getParticleCount: () => countRef.current,
        getLineWidth: () => lineWidthRef.current,
      });
      layerRef.current = layer;
      try {
        map.addLayer(layer, o.beforeId && map.getLayer(o.beforeId) ? o.beforeId : undefined);
        console.log(`[ClimateParticleLine ${o.layerId}] layer added`);
        map.triggerRepaint();
        return true;
      } catch (e) {
        console.warn(`[ClimateParticleLine ${o.layerId}] addLayer failed`, e);
        layerRef.current = null;
        return false;
      }
    };

    const retryAddLayer = () => {
      if (addLayer() && intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    retryAddLayer();
    if (!layerRef.current) {
      intervalId = window.setInterval(retryAddLayer, 100);
    }

    const onStyleLoad = () => {
      layerRef.current = null;
      retryAddLayer();
    };

    // mapRef 第一輪可能是 null；輪詢成功後也補 style.load 重掛。
    const bindStyleLoadInterval = window.setInterval(() => {
      const map = mapRef.current;
      if (!map || styleBoundMap === map) return;
      styleBoundMap?.off("style.load", onStyleLoad);
      styleBoundMap = map;
      map.on("style.load", onStyleLoad);
      retryAddLayer();
    }, 100);

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      window.clearInterval(bindStyleLoadInterval);
      styleBoundMap?.off("style.load", onStyleLoad);
      const map = attachedMap ?? mapRef.current;
      try {
        if (map?.getLayer(o.layerId)) map.removeLayer(o.layerId);
      } catch {
        // style reload 時 layer 可能已被清掉
      }
      layerRef.current = null;
    };
    // rampColors 只在建立時消費；visible 放 deps 讓 toggle ON 時重試 mapRef.current。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, o.layerId, o.pngUrl, o.metaUrl, o.visible, mapTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.triggerRepaint();
  }, [mapRef, o.visible, o.opacity, o.animationSpeed, o.particleCount, o.lineWidth, mapTick]);

  // ── Time-aware 換幀（timeStore 訂閱；遵守鐵則：currentTime 不進 React deps）──
  // 依 timeline 當前時間選最近幀，換 UV 場保留粒子。manifest 404 / 解析失敗 → 不動作，
  // layer 自身已載 *_latest.png 當 fallback。
  const statusKey = o.statusKey;
  useEffect(() => {
    if (!o.visible || !o.frameDataset) return;

    let cancelled = false;
    let cache: FrameRasterCache | null = null;
    let frames: ClimateFrame[] = [];
    let currentKey: string | null = null;
    let applyTimer: number | null = null;
    let unsubDate: (() => void) | null = null;
    let unsubThrottled: (() => void) | null = null;

    // layer 可能尚未掛上（style 未載）；有幀就緒但 layer 未備 → 稍後有界重試。
    const applyRaster = (raster: Parameters<ClimateParticleLineLayer["setField"]>[0], frame: ClimateFrame) => {
      if (cancelled) return;
      const layer = layerRef.current;
      if (!layer) {
        if (applyTimer === null) {
          applyTimer = window.setTimeout(() => {
            applyTimer = null;
            applyRaster(raster, frame);
          }, 150);
        }
        return;
      }
      layer.setField(raster);
      if (statusKey) climateFrameStore.set(statusKey, { validAt: frame.t, kind: frame.kind });
    };

    const selectForTime = (tSec: number) => {
      if (cancelled || !cache || frames.length === 0) return;
      const frame = pickNearestFrame(frames, tSec * 1000);
      if (!frame || frame.png === currentKey) return;
      currentKey = frame.png;
      cache
        .get(frame)
        .then((raster) => {
          // 期間可能又換了幀；只套用仍是當前選擇的那張
          if (!cancelled && currentKey === frame.png) applyRaster(raster, frame);
        })
        .catch(() => {});
      // 預載相鄰 ±1 幀（不套用，只暖 cache）
      const idx = frames.indexOf(frame);
      for (const j of [idx - 1, idx + 1]) {
        if (j >= 0 && j < frames.length) cache.get(frames[j]!).catch(() => {});
      }
    };

    void (async () => {
      const manifest = await loadClimateManifest();
      if (cancelled || !manifest) return; // 無 manifest → fallback（latest 已顯示）
      const ds = manifest.datasets[o.frameDataset!];
      if (!ds || ds.frames.length === 0) return;
      const baseMeta = await fetchClimateBaseMeta(o.metaUrl);
      if (cancelled || !baseMeta) return;
      frames = ds.frames;
      cache = new FrameRasterCache(baseMeta);
      selectForTime(timeStore.getTime()); // 初始套用
      // 跨日 + 同日 6h 幀：兩種訂閱都掛（selectForTime idempotent，key 沒變不動作）
      unsubDate = timeStore.subscribeDate(() => selectForTime(timeStore.getTime()));
      unsubThrottled = timeStore.subscribeThrottled(FRAME_THROTTLE_MS, (t) => selectForTime(t));
    })();

    return () => {
      cancelled = true;
      if (applyTimer !== null) window.clearTimeout(applyTimer);
      unsubDate?.();
      unsubThrottled?.();
      if (statusKey) climateFrameStore.clear(statusKey);
    };
  }, [mapRef, o.visible, o.frameDataset, o.metaUrl, statusKey, mapTick]);
}
