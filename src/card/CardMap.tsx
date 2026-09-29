/**
 * 卡片上半部的 MapLibre 地圖（暗色 Protomaps 底圖，做法同 `src/embed/`）。
 *
 * - 面：抓 payload.map.geometry.resource_url（驗 sha256）→ 只留 areas 列到的區域 → 依 class_index
 *   上色（vizSpec 暗色組），缺值畫斜線；只標前 5 名名稱。
 * - 點：畫 payload.points（已是前 N 點），前 5 點標名稱。
 * - query_scope：中心點＋虛線半徑圈。
 * - 界線載入失敗（檔案被清掉、雜湊不符、網路）→ 地圖區顯示「地圖邊界暫時無法載入」，卡片其餘照常。
 *
 * 地圖不可互動（DECISIONS §6.1：看卡片的人不能點開完整地圖）。
 * 本檔是卡片頁唯一 import maplibre-gl 的地方；測試不 import 本檔。
 */
import { useEffect, useRef, useState } from "react";
import maplibregl, { type LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildBasemapStyle } from "../embed/basemapStyle";
import { registerPmtilesProtocolOnce } from "../embed/maplibreAdapters";
import { ensureNullHatchImage } from "../research/vizNullPattern";
import type { CardPayloadV1 } from "./cardPayload";
import { CardMapFallback } from "./AnalysisCard";
import { buildCardAreaFeatures, CARD_THEME, cardNullStroke, cardOtherColor, cardRing, classColors, colorForClass, geodesicCircle, loadCardGeometry, pointBounds } from "./cardStyle";

const TAIWAN_BOUNDS: LngLatBoundsLike = [[119.3, 21.8], [122.1, 25.4]];
const LABEL_FONT = ["Noto Sans Medium"];
const GEOMETRY_FAILED = "地圖邊界暫時無法載入";

function extendBounds(bounds: [number, number, number, number] | null, coordinates: unknown): [number, number, number, number] | null {
  if (Array.isArray(coordinates) && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    const [lng, lat] = coordinates as [number, number];
    return bounds ? [Math.min(bounds[0], lng), Math.min(bounds[1], lat), Math.max(bounds[2], lng), Math.max(bounds[3], lat)] : [lng, lat, lng, lat];
  }
  if (Array.isArray(coordinates)) for (const child of coordinates) bounds = extendBounds(bounds, child);
  return bounds;
}

function addScopeLayers(map: maplibregl.Map, payload: CardPayloadV1): void {
  const scope = payload.query_scope;
  if (!scope) return;
  const features: GeoJSON.Feature[] = [{ type: "Feature", geometry: { type: "Point", coordinates: scope.center }, properties: {} }];
  if (scope.radius_m) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: geodesicCircle(scope.center, scope.radius_m) }, properties: {} });
  map.addSource("card-scope", { type: "geojson", data: { type: "FeatureCollection", features } });
  map.addLayer({ id: "card-scope-ring", type: "line", source: "card-scope", filter: ["==", ["geometry-type"], "LineString"], paint: { "line-color": "rgba(255,255,255,0.8)", "line-width": 1.5, "line-dasharray": [3, 2] } });
  map.addLayer({ id: "card-scope-center", type: "circle", source: "card-scope", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 4, "circle-color": "rgba(255,255,255,0.95)", "circle-stroke-color": cardRing(), "circle-stroke-width": 1.5 } });
}

function addPointLayers(map: maplibregl.Map, payload: CardPayloadV1): void {
  const points = payload.points;
  if (!points) return;
  const colors = classColors(points.ramp, points.breaks);
  const topNames = new Set(payload.top.slice(0, 5).map(item => item.name));
  let labelled = 0;
  const features: GeoJSON.Feature[] = points.items.map(item => {
    const label = item.name && (topNames.size ? topNames.has(item.name) : labelled < 5) ? item.name : null;
    if (label) labelled += 1;
    return { type: "Feature", geometry: { type: "Point", coordinates: item.lnglat }, properties: { fill: (points.ramp ? colorForClass(colors, item.class_index) : null) ?? colors[colors.length - 1] ?? cardOtherColor(), label } };
  });
  map.addSource("card-points", { type: "geojson", data: { type: "FeatureCollection", features } });
  map.addLayer({ id: "card-points", type: "circle", source: "card-points", paint: { "circle-radius": 5, "circle-color": ["get", "fill"], "circle-stroke-color": cardRing(), "circle-stroke-width": 1 } });
  map.addLayer({ id: "card-point-labels", type: "symbol", source: "card-points", filter: ["!=", ["get", "label"], null], layout: { "text-field": ["get", "label"], "text-font": LABEL_FONT, "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-max-width": 8 }, paint: { "text-color": "rgba(255,255,255,0.92)", "text-halo-color": cardRing(), "text-halo-width": 1.2 } });
}

export default function CardMap({ payload }: { payload: CardPayloadV1 }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const abort = new AbortController();
    setFailure(null);
    registerPmtilesProtocolOnce();
    const map = new maplibregl.Map({ container, style: buildBasemapStyle(CARD_THEME === "dark"), bounds: TAIWAN_BOUNDS, interactive: false, attributionControl: { compact: true } });
    const fit = (bounds: [number, number, number, number] | null) => {
      if (!bounds) return;
      const [west, south, east, north] = bounds;
      const pad = west === east && south === north ? 0.01 : 0;
      map.fitBounds([[west - pad, south - pad], [east + pad, north + pad]], { padding: 28, animate: false, maxZoom: 15 });
    };
    map.on("load", () => {
      if (abort.signal.aborted) return;
      if (payload.kind === "points") {
        addPointLayers(map, payload);
        addScopeLayers(map, payload);
        fit(pointBounds(payload));
        return;
      }
      const areaMap = payload.map;
      if (!areaMap) { setFailure(GEOMETRY_FAILED); return; }
      void loadCardGeometry(areaMap, fetch, abort.signal).then(geojson => {
        if (abort.signal.aborted) return;
        const features = buildCardAreaFeatures(geojson, areaMap, payload.top);
        if (!features.length) throw new Error("CARD_GEOMETRY_EMPTY");
        const hatch = ensureNullHatchImage(map, CARD_THEME);
        map.addSource("card-areas", { type: "geojson", data: { type: "FeatureCollection", features: features as GeoJSON.Feature[] } });
        map.addLayer({ id: "card-area-fill", type: "fill", source: "card-areas", filter: ["!=", ["get", "fill"], null], paint: { "fill-color": ["get", "fill"], "fill-opacity": 0.88 } });
        map.addLayer({ id: "card-area-missing", type: "fill", source: "card-areas", filter: ["==", ["get", "fill"], null], paint: { "fill-pattern": hatch } });
        map.addLayer({ id: "card-area-line", type: "line", source: "card-areas", paint: { "line-color": ["case", ["==", ["get", "fill"], null], cardNullStroke(), cardRing()], "line-width": 0.6 } });
        map.addLayer({ id: "card-area-labels", type: "symbol", source: "card-areas", filter: ["!=", ["get", "label"], null], layout: { "text-field": ["get", "label"], "text-font": LABEL_FONT, "text-size": 12, "text-max-width": 8, "text-allow-overlap": false }, paint: { "text-color": "rgba(255,255,255,0.95)", "text-halo-color": cardRing(), "text-halo-width": 1.4 } });
        addScopeLayers(map, payload);
        fit(features.reduce<[number, number, number, number] | null>((bounds, feature) => extendBounds(bounds, (feature.geometry as { coordinates?: unknown } | null)?.coordinates), null));
      }).catch(() => { if (!abort.signal.aborted) setFailure(GEOMETRY_FAILED); });
    });
    return () => { abort.abort(); map.remove(); };
  }, [payload]);

  return <>
    <div ref={containerRef} className="analysis-card__map-canvas" aria-label="卡片地圖" role="img" />
    {failure && <CardMapFallback message={failure} />}
  </>;
}
