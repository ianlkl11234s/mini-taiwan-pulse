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
import { electionTier, spreadDotRadius, spreadOffsetOf } from "../map/electionSpread";
import { encodeParamsToOverlay, layerParamsStore } from "../state/layerParamsStore";

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
    // 選舉活動確切地點多場展開後，各場畫在錨點外的固定 px 位移：外框跟著被點的那場（大小滑桿同 icon-size 等比）
    const election = featureInfo?.layerType === "electionEvents2026" ? featureInfo.properties : null;
    const off = election ? spreadOffsetOf(election) : null;
    const scale = election ? Number(encodeParamsToOverlay(layerParamsStore.getAll()).electionEvents2026Scale ?? 1) || 1 : 1;
    const offset: [number, number] = off ? [off[0] * scale, off[1] * scale] : [0, 0];
    // 選舉活動單場（單點與展開點）：外框至少比點大一圈（L 級拉近時直徑約 25px，超過預設 24px）；多場數字圖示維持預設
    const dotR = election && election._grp !== 1 ? spreadDotRadius(electionTier(election.scale_tier), election._past === 1) * scale : 0;
    const ringSize = dotR > 0 ? `${Math.max(24, Math.ceil(2 * dotR) + 8)}px` : "";
    if (markerRef.current) {
      markerRef.current.marker.setLngLat(position).setOffset(offset);
      markerRef.current.marker.getElement().style.setProperty("--selection-ring-size", ringSize);
      return;
    }
    const el = createRingElement();
    el.style.setProperty("--selection-ring-size", ringSize);
    const marker = new mapboxgl.Marker({ element: el, anchor: "center", offset }).setLngLat(position).addTo(map);
    markerRef.current = { marker, map };
  }, [mapRef, featureInfo]);

  useEffect(() => () => {
    markerRef.current?.marker.remove();
    markerRef.current = null;
  }, []);
}
