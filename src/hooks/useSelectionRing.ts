/**
 * 點擊處選取圈（R2 呼吸脈衝），全站圖層共用。
 *
 * - 停靠 FeatureInfoPanel 開著（featureInfo != null）才畫；null → 立刻移除
 * - 換成別的 feature → 移位（同一顆 Marker）
 * - 用 mapboxgl.Marker + DOM/CSS 動畫，不是 Mapbox 圖層：不進 style、不需 manifest，
 *   換底圖（style.load）也不會被清掉
 * - 顏色走地圖容器上的 CSS 變數 --selection-ring-accent（App 依主題設定）
 */
import { useEffect, useRef } from "react";
import mapboxgl, { type Map as MapboxMap } from "mapbox-gl";
import type { FeatureInfo } from "../types";
import { lastSelectionClick, selectionRingPosition } from "../map/selectionRing";
import "../map/selectionRing.css";

function createRingElement(): HTMLElement {
  const root = document.createElement("div");
  root.className = "selection-ring";
  root.setAttribute("aria-hidden", "true");
  const core = document.createElement("i");
  const pulse = document.createElement("i");
  pulse.className = "selection-ring__pulse";
  root.append(core, pulse);
  return root;
}

export function useSelectionRing(
  mapRef: React.RefObject<MapboxMap | null>,
  featureInfo: FeatureInfo | null,
) {
  const markerRef = useRef<{ marker: mapboxgl.Marker; map: MapboxMap } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    const position = selectionRingPosition(featureInfo, lastSelectionClick());
    if (!map || !position) {
      markerRef.current?.marker.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current && markerRef.current.map !== map) {
      markerRef.current.marker.remove();
      markerRef.current = null;
    }
    if (markerRef.current) {
      markerRef.current.marker.setLngLat(position);
      return;
    }
    const marker = new mapboxgl.Marker({ element: createRingElement(), anchor: "center" }).setLngLat(position).addTo(map);
    markerRef.current = { marker, map };
  }, [mapRef, featureInfo]);

  useEffect(() => () => {
    markerRef.current?.marker.remove();
    markerRef.current = null;
  }, []);
}
