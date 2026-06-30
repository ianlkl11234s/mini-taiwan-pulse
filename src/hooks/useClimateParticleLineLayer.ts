import { useEffect, useRef } from "react";
import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { createClimateParticleLineLayer, type ClimateParticleLineLayerOptions } from "../map/climateParticleLineLayer";

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
}

export function useClimateParticleLineLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  o: HookOptions,
) {
  const visibleRef = useRef(o.visible);
  const opacityRef = useRef(o.opacity);
  const speedRef = useRef(o.animationSpeed);
  const countRef = useRef(o.particleCount);
  const lineWidthRef = useRef(o.lineWidth);
  const layerRef = useRef<CustomLayerInterface | null>(null);

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
  }, [mapRef, o.layerId, o.pngUrl, o.metaUrl, o.visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.triggerRepaint();
  }, [mapRef, o.visible, o.opacity, o.animationSpeed, o.particleCount, o.lineWidth]);
}
