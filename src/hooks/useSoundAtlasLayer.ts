/**
 * City Sound Atlas 聲景（實驗）圖層 hook：七個來源家族（飛機／雨／雷／垃圾車／鐵道／道路類型 proxy／施工許可）共用一支。
 *
 * - 資料：只載入開著的家族；日期跟 timeStore.subscribeDate，場景快照有區塊就用快照（src/sound/scenes.ts）。
 * - 「當下」：timeStore.subscribeThrottled(250) → queryReceiver → 寫 soundAtlasStore（面板訂閱）＋ setData 標記與連線。
 * - 24h 構成：只在接收點／日期／資料變動時重算（不跟時間跑）。
 * - 雷聲波前：timeStore.subscribeThrottled(50) 以 timeStore 時間推算半徑（343 m/s，示意），同時波前有上限。
 * - 不把 currentTime 放進任何 deps；React 端不每幀 re-render（development-rules §8）。
 * - 全部家族關掉：移除 source／layer／marker、清 store（T15：不影響既有航班、垃圾車、噪音圖層）。
 */
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection } from "geojson";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";
import { dayProfile, queryReceiver, SOUND_FAMILIES_ALL as SOUND_FAMILIES } from "../sound/engines/receiverQuery";
import { activeWavefronts, geodesicRing, WAVEFRONT_DEFAULT_CAP } from "../sound/engines/wavefronts";
import {
  contributionPlace, familyLoadKey, indexRecords, loadSoundFamily, nearestPointOnGeometry, nearestPointOnLine, prefilterSetsForReceiver, type LoadedFamily,
} from "../sound/soundAtlasData";
import { makeReceiver, setSoundAtlasMap, soundAtlasStore, type SoundAtlasState } from "../sound/soundAtlasStore";
import { addRoutePoint, clearRoute } from "../sound/soundAtlasActions";
import { SOUND_FAMILY_COLORS, SOUND_UNKNOWN_COLOR } from "../sound/soundAtlasColors";
import {
  createReceiverElements, ensureAnimLayers, removeAnimLayers, setSoundAtlasAnimator, SoundAtlasAnimator, type ReceiverElements,
} from "../sound/soundAtlasAnimator";
import { AVIATION } from "../sound/model/soundProfiles";
import type { ThunderPayload } from "../sound/sourceAdapters/thunderAdapter";
import { roadContributionLine } from "../sound/sourceAdapters/roadTrafficAdapter";
import type { RoadworkPayload } from "../sound/sourceAdapters/roadworkAdapter";
import type { SoundSourceFamily, SoundSourceRecord, SoundSourceSet } from "../sound/types";

export type SoundFamilyFlags = Record<SoundSourceFamily, boolean>;

const SRC_POINTS = "sound-atlas-sources";
const SRC_LINKS = "sound-atlas-links";
const SRC_WAVES = "sound-atlas-wavefronts";
const WAVE_LAYER = "sound-atlas-wavefront-line";
/** 道路類型 proxy：附近國道路段淡光暈（不是車流量） */
const SRC_ROADS = "sound-atlas-road-glow";
const ROAD_GLOW_LAYER = "sound-atlas-road-glow-line";
/** 臺北市 VD 典型車流：VD 點下方的淡光暈（典型值活躍時；不是當日流量） */
const VD_GLOW_LAYER = "sound-atlas-road-vd-glow";
const VD_GLOW_FILTER: mapboxgl.FilterSpecification = ["all", ["==", ["get", "family"], "road_traffic"], ["==", ["get", "status"], "active"], ["==", ["get", "proxyKind"], "typical_weekday_volume"]];
const vdGlowOpacity = (o: number): mapboxgl.ExpressionSpecification => ["*", o, ["+", 0.18, ["*", 0.5, ["coalesce", ["get", "potential"], 0]]]];
/** 施工許可：小三角錐圖示（活躍許可；未涵蓋／不明仍是點圖層灰圈） */
const ROADWORK_ICON_LAYER = "sound-atlas-roadwork-icon";
const CONE_IMAGE = "sound-atlas-cone";

/** 每個家族一個點圖層（popup 由 gisClickRegistry 登記，型別 soundSource） */
export const SOUND_ATLAS_POINT_LAYERS: Record<SoundSourceFamily, string> = {
  aviation: "sound-atlas-src-aviation",
  rain: "sound-atlas-src-rain",
  thunder: "sound-atlas-src-thunder",
  waste_collection: "sound-atlas-src-waste",
  rail: "sound-atlas-src-rail",
  road_traffic: "sound-atlas-src-road",
  roadwork: "sound-atlas-src-roadwork",
  wind_vegetation: "sound-atlas-src-wind",
  coastal_wave: "sound-atlas-src-wave",
  river_water: "sound-atlas-src-river",
};
const LINK_LAYERS: Record<SoundSourceFamily, string> = {
  aviation: "sound-atlas-link-aviation",
  rain: "sound-atlas-link-rain",
  thunder: "sound-atlas-link-thunder",
  waste_collection: "sound-atlas-link-waste",
  rail: "sound-atlas-link-rail",
  road_traffic: "sound-atlas-link-road",
  roadwork: "sound-atlas-link-roadwork",
  wind_vegetation: "sound-atlas-link-wind",
  coastal_wave: "sound-atlas-link-wave",
  river_water: "sound-atlas-link-river",
};

/** 動畫器自己畫連線或示意的家族：hook 不畫接收點→來源的直線（飛機、列車點圖層另見 pointOpacityExpr）。
 *  自然三族的點＝測站原座標（浮標可能遠在外海），直線會誤導，改由動畫器畫葉子／浪弧／河道光點 */
const ANIMATED_FAMILIES = new Set<SoundSourceFamily>(["aviation", "rail", "wind_vegetation", "coastal_wave", "river_water"]);

function makeConeImage(): ImageData | null {
  const size = 32;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = SOUND_FAMILY_COLORS.roadwork;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 3);
  ctx.lineTo(28, 27);
  ctx.lineTo(4, 27);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(10, 17, 12, 3);
  return ctx.getImageData(0, 0, size, size);
}

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/** 路線剖面：路線線段＋樣本點（依該點最高的活躍聲源上色；沒有活躍聲源＝灰） */
const SRC_ROUTE = "sound-atlas-route";
const ROUTE_LINE_LAYER = "sound-atlas-route-line";
const ROUTE_POINT_LAYER = "sound-atlas-route-point";

/** 「當下」重算節流（UI 4 Hz）與波前節流（20 fps） */
const CURRENT_THROTTLE_MS = 250;
const WAVE_THROTTLE_MS = 50;
/** 24h 構成重算延遲（拖曳／切換後穩定才算） */
const PROFILE_DEBOUNCE_MS = 250;

const loadCache = new Map<string, Promise<LoadedFamily | null>>();
function cachedLoad(key: string, run: () => Promise<LoadedFamily | null>): Promise<LoadedFamily | null> {
  let p = loadCache.get(key);
  if (!p) {
    p = run();
    loadCache.set(key, p);
    while (loadCache.size > 16) loadCache.delete(loadCache.keys().next().value!);
  }
  return p;
}

function useStoreSlice<T>(select: (s: SoundAtlasState) => T): T {
  return useSyncExternalStore(soundAtlasStore.subscribe, () => select(soundAtlasStore.get()));
}

function setSourceData(map: MapboxMap, id: string, fc: FeatureCollection): void {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  src?.setData(fc);
}

function ensureLayers(map: MapboxMap): void {
  for (const id of [SRC_POINTS, SRC_LINKS, SRC_WAVES, SRC_ROADS, SRC_ROUTE]) {
    if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: EMPTY });
  }
  if (!map.getLayer(ROUTE_LINE_LAYER)) {
    map.addLayer({
      id: ROUTE_LINE_LAYER, type: "line", source: SRC_ROUTE, filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 2.5, "line-opacity": 0.85, "line-dasharray": [2, 1.5] },
    });
  }
  if (!map.getLayer(ROUTE_POINT_LAYER)) {
    map.addLayer({
      id: ROUTE_POINT_LAYER, type: "circle", source: SRC_ROUTE, filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["case", ["==", ["get", "kind"], "vertex"], 5, 3.5],
        "circle-color": ["coalesce", ["get", "color"], "#ffffff"],
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 1,
      },
    });
  }
  if (!map.getLayer(ROAD_GLOW_LAYER)) {
    map.addLayer({
      id: ROAD_GLOW_LAYER, type: "line", source: SRC_ROADS,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": SOUND_FAMILY_COLORS.road_traffic,
        "line-width": ["+", 5, ["*", 8, ["coalesce", ["get", "potential"], 0]]],
        "line-blur": 5,
        "line-opacity": ["+", 0.15, ["*", 0.4, ["coalesce", ["get", "potential"], 0]]],
      },
    });
  }
  if (!map.getLayer(WAVE_LAYER)) {
    map.addLayer({
      id: WAVE_LAYER, type: "line", source: SRC_WAVES,
      paint: { "line-color": SOUND_FAMILY_COLORS.thunder, "line-width": 2.5, "line-blur": 1, "line-opacity": ["*", ["get", "fade"], 0.9] },
    });
  }
  for (const fam of SOUND_FAMILIES) {
    if (!map.getLayer(LINK_LAYERS[fam])) {
      map.addLayer({
        id: LINK_LAYERS[fam], type: "line", source: SRC_LINKS,
        filter: ["==", ["get", "family"], fam],
        paint: {
          "line-color": SOUND_FAMILY_COLORS[fam],
          // 飛機是地面投影連線（虛線），其他是接收點到來源點
          "line-dasharray": fam === "aviation" ? [2, 2] : [1, 0],
          "line-opacity": 0.8,
          "line-width": ["+", 1, ["*", 2.5, ["coalesce", ["get", "potential"], 0]]],
        },
      });
    }
  }
  for (const fam of SOUND_FAMILIES) {
    if (!map.getLayer(SOUND_ATLAS_POINT_LAYERS[fam])) {
      map.addLayer({
        id: SOUND_ATLAS_POINT_LAYERS[fam], type: "circle", source: SRC_POINTS,
        filter: ["==", ["get", "family"], fam],
        paint: {
          // 活躍：家族色實心、半徑依相對潛勢；無法判斷：灰色空心
          "circle-radius": ["case", ["==", ["get", "status"], "active"], ["+", 5, ["*", 6, ["coalesce", ["get", "potential"], 0]]], 6],
          "circle-color": ["case", ["==", ["get", "status"], "active"], SOUND_FAMILY_COLORS[fam], "rgba(0,0,0,0)"],
          "circle-stroke-color": ["case", ["==", ["get", "status"], "active"], "#ffffff", SOUND_UNKNOWN_COLOR],
          "circle-stroke-width": 1.5,
        },
      });
    }
  }
  if (!map.getLayer(VD_GLOW_LAYER)) {
    map.addLayer({
      id: VD_GLOW_LAYER, type: "circle", source: SRC_POINTS, filter: VD_GLOW_FILTER,
      paint: {
        "circle-radius": ["+", 12, ["*", 22, ["coalesce", ["get", "potential"], 0]]],
        "circle-color": SOUND_FAMILY_COLORS.road_traffic,
        "circle-blur": 1,
        "circle-opacity": vdGlowOpacity(1),
        "circle-pitch-alignment": "map",
      },
    }, SOUND_ATLAS_POINT_LAYERS.aviation);
  }
  if (!map.hasImage(CONE_IMAGE)) {
    const img = makeConeImage();
    if (img) map.addImage(CONE_IMAGE, img, { pixelRatio: 2 });
  }
  if (!map.getLayer(ROADWORK_ICON_LAYER)) {
    map.addLayer({
      id: ROADWORK_ICON_LAYER, type: "symbol", source: SRC_POINTS,
      filter: ["all", ["==", ["get", "family"], "roadwork"], ["==", ["get", "status"], "active"]],
      layout: { "icon-image": CONE_IMAGE, "icon-size": ["+", 0.75, ["*", 0.5, ["coalesce", ["get", "potential"], 0]]], "icon-allow-overlap": true, "icon-ignore-placement": true },
    });
  }
  ensureAnimLayers(map);
}

function removeLayers(map: MapboxMap): void {
  removeAnimLayers(map);
  const layers = [ROUTE_POINT_LAYER, ROUTE_LINE_LAYER, ROADWORK_ICON_LAYER, VD_GLOW_LAYER, ...Object.values(SOUND_ATLAS_POINT_LAYERS), ...Object.values(LINK_LAYERS), WAVE_LAYER, ROAD_GLOW_LAYER];
  for (const id of layers) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [SRC_POINTS, SRC_LINKS, SRC_WAVES, SRC_ROADS, SRC_ROUTE]) if (map.getSource(id)) map.removeSource(id);
  if (map.hasImage(CONE_IMAGE)) map.removeImage(CONE_IMAGE);
}

/**
 * 點圖層逐點透明度：活躍且達顯示門檻的航機、活躍列車由動畫器畫，活躍施工許可由圖示畫
 * （這裡幾乎透明但仍可點選開 popup）；低於門檻的遠方航機只畫淡點；其他照常（不明＝灰色空心）。
 */
function pointOpacityExpr(fam: SoundSourceFamily, o: number): mapboxgl.ExpressionSpecification | number {
  if (fam === "rail" || fam === "roadwork") return ["case", ["==", ["get", "status"], "active"], 0.01, o];
  if (fam !== "aviation") return o;
  const thr = AVIATION.displayMinPotential.value;
  return [
    "case",
    ["all", ["==", ["get", "status"], "active"], [">=", ["coalesce", ["get", "potential"], 0], thr]], 0.01,
    ["==", ["get", "status"], "active"], 0.35 * o,
    o,
  ];
}

/** 連線透明度隨潛勢（越近越亮）；航機連線由動畫器畫 */
function linkOpacityExpr(o: number): mapboxgl.ExpressionSpecification {
  return ["*", o, ["+", 0.25, ["*", 0.75, ["coalesce", ["get", "potential"], 0]]]];
}

function applyVisibility(map: MapboxMap, flags: SoundFamilyFlags, opacity: Record<SoundSourceFamily, number>): void {
  for (const fam of SOUND_FAMILIES) {
    const vis = flags[fam] ? "visible" : "none";
    const o = Math.max(0, Math.min(1, opacity[fam]));
    if (map.getLayer(SOUND_ATLAS_POINT_LAYERS[fam])) {
      map.setLayoutProperty(SOUND_ATLAS_POINT_LAYERS[fam], "visibility", vis);
      map.setPaintProperty(SOUND_ATLAS_POINT_LAYERS[fam], "circle-opacity", pointOpacityExpr(fam, o));
      map.setPaintProperty(SOUND_ATLAS_POINT_LAYERS[fam], "circle-stroke-opacity", pointOpacityExpr(fam, o));
    }
    if (map.getLayer(LINK_LAYERS[fam])) {
      map.setLayoutProperty(LINK_LAYERS[fam], "visibility", vis);
      map.setPaintProperty(LINK_LAYERS[fam], "line-opacity", linkOpacityExpr(o));
    }
  }
  if (map.getLayer(ROAD_GLOW_LAYER)) {
    map.setLayoutProperty(ROAD_GLOW_LAYER, "visibility", flags.road_traffic ? "visible" : "none");
    map.setPaintProperty(ROAD_GLOW_LAYER, "line-opacity", ["*", Math.max(0, Math.min(1, opacity.road_traffic)), ["+", 0.15, ["*", 0.4, ["coalesce", ["get", "potential"], 0]]]]);
  }
  if (map.getLayer(VD_GLOW_LAYER)) {
    map.setLayoutProperty(VD_GLOW_LAYER, "visibility", flags.road_traffic ? "visible" : "none");
    map.setPaintProperty(VD_GLOW_LAYER, "circle-opacity", vdGlowOpacity(Math.max(0, Math.min(1, opacity.road_traffic))));
  }
  if (map.getLayer(ROADWORK_ICON_LAYER)) {
    map.setLayoutProperty(ROADWORK_ICON_LAYER, "visibility", flags.roadwork ? "visible" : "none");
    map.setPaintProperty(ROADWORK_ICON_LAYER, "icon-opacity", Math.max(0, Math.min(1, opacity.roadwork)));
  }
  if (map.getLayer(WAVE_LAYER)) {
    map.setLayoutProperty(WAVE_LAYER, "visibility", flags.thunder ? "visible" : "none");
    map.setPaintProperty(WAVE_LAYER, "line-opacity", ["*", ["get", "fade"], 0.9 * Math.max(0, Math.min(1, opacity.thunder))]);
  }
}

export function useSoundAtlasLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  flags: SoundFamilyFlags,
  opacity: Record<SoundSourceFamily, number>,
  /** W6-1 動畫開關（沒給的家族照舊畫）；雨預設關 */
  animate: Partial<Record<SoundSourceFamily, boolean>> = {},
): void {
  const anyOn = SOUND_FAMILIES.some((f) => flags[f]);
  const enabledKey = SOUND_FAMILIES.filter((f) => flags[f]).join(",");
  const enabled = useMemo(() => (enabledKey ? (enabledKey.split(",") as SoundSourceFamily[]) : []), [enabledKey]);
  const mapTick = useMapReadyTick(mapRef, anyOn);

  const receiver = useStoreSlice((s) => s.receiver);
  const snapshot = useStoreSlice((s) => s.snapshot);
  const sets = useStoreSlice((s) => s.sets);
  const dateKey = useStoreSlice((s) => s.dateKey);
  const placing = useStoreSlice((s) => s.placing);
  const route = useStoreSlice((s) => s.route);

  // ── 掛載／卸載 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!anyOn) {
      removeLayers(map);
      setSoundAtlasMap(null);
      soundAtlasStore.reset();
      return;
    }
    setSoundAtlasMap(map);
    const mount = () => ensureLayers(map);
    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [mapRef, anyOn, mapTick]);

  // ── 動畫器（rAF，不經 React）：圖層全關時停止並釋放 ──
  const animatorRef = useRef<SoundAtlasAnimator | null>(null);
  const receiverElsRef = useRef<ReceiverElements | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyOn) return;
    const anim = new SoundAtlasAnimator(map, () => receiverElsRef.current, {
      receiver: null, result: null, records: new Map(), thunderStrikes: [],
      flags: { aviation: false, rain: false, thunder: false, waste_collection: false, rail: false, road_traffic: false, roadwork: false, wind_vegetation: false, coastal_wave: false, river_water: false },
      opacity: { aviation: 1, rain: 1, thunder: 1, waste_collection: 1, rail: 1, road_traffic: 1, roadwork: 1, wind_vegetation: 1, coastal_wave: 1, river_water: 1 },
    });
    animatorRef.current = anim;
    setSoundAtlasAnimator(anim);
    return () => {
      anim.dispose();
      animatorRef.current = null;
      setSoundAtlasAnimator(null);
    };
  }, [mapRef, anyOn, mapTick]);

  // flags／opacity 以純量比較，避免物件身分每次 render 都變
  const { aviation: fA, rain: fR, thunder: fT, waste_collection: fW, rail: fL, road_traffic: fD, roadwork: fK, wind_vegetation: fV, coastal_wave: fC, river_water: fI } = flags;
  const animRain = animate.rain;
  useEffect(() => { animatorRef.current?.update({ animate: { rain: animRain } }); }, [animRain, anyOn, mapTick]);
  const { aviation: oA, rain: oR, thunder: oT, waste_collection: oW, rail: oL, road_traffic: oD, roadwork: oK, wind_vegetation: oV, coastal_wave: oC, river_water: oI } = opacity;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyOn) return;
    const f = { aviation: fA, rain: fR, thunder: fT, waste_collection: fW, rail: fL, road_traffic: fD, roadwork: fK, wind_vegetation: fV, coastal_wave: fC, river_water: fI };
    const o = { aviation: oA, rain: oR, thunder: oT, waste_collection: oW, rail: oL, road_traffic: oD, roadwork: oK, wind_vegetation: oV, coastal_wave: oC, river_water: oI };
    animatorRef.current?.update({ flags: f, opacity: o });
    const apply = () => applyVisibility(map, f, o);
    apply();
    map.on("style.load", apply);
    return () => { map.off("style.load", apply); };
  }, [mapRef, anyOn, mapTick, fA, fR, fT, fW, fL, fD, fK, fV, fC, fI, oA, oR, oT, oW, oL, oD, oK, oV, oC, oI]);

  // ── 接收點標記（可拖曳）──
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyOn || !receiver) {
      markerRef.current?.remove();
      markerRef.current = null;
      receiverElsRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const els = createReceiverElements();
      receiverElsRef.current = els;
      const marker = new mapboxgl.Marker({ element: els.root, draggable: true });
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        const prev = soundAtlasStore.get().receiver;
        soundAtlasStore.set({ receiver: makeReceiver(lng, lat, prev?.heightM) });
      });
      markerRef.current = marker;
    }
    markerRef.current.setLngLat([receiver.longitude, receiver.latitude]).addTo(map);
  }, [mapRef, anyOn, receiver, mapTick]);
  useEffect(() => () => { markerRef.current?.remove(); markerRef.current = null; receiverElsRef.current = null; }, []);

  // ── 放置模式：下一次點地圖放接收點；Esc 取消 ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyOn || !placing) return;
    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = "crosshair";
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const prev = soundAtlasStore.get().receiver;
      soundAtlasStore.set({ receiver: makeReceiver(e.lngLat.lng, e.lngLat.lat, prev?.heightM), placing: false });
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") soundAtlasStore.set({ placing: false }); };
    map.once("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      map.off("click", onClick);
      window.removeEventListener("keydown", onKey);
      canvas.style.cursor = prevCursor;
    };
  }, [mapRef, anyOn, placing, mapTick]);

  // ── 畫路線模式：每次點地圖加一個節點；Esc 取消（清掉節點）；畫線期間停用雙擊縮放（否則一次雙擊加兩點又縮放）──
  const drawingRoute = route.drawing;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyOn || !drawingRoute) return;
    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = "crosshair";
    const onClick = (e: mapboxgl.MapMouseEvent) => addRoutePoint(e.lngLat.lng, e.lngLat.lat);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") clearRoute(); };
    const dbl = map.doubleClickZoom.isEnabled();
    if (dbl) map.doubleClickZoom.disable();
    map.on("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      if (dbl) map.doubleClickZoom.enable();
      map.off("click", onClick);
      window.removeEventListener("keydown", onKey);
      canvas.style.cursor = prevCursor;
    };
  }, [mapRef, anyOn, drawingRoute, mapTick]);

  // ── 路線與樣本點（依主要聲源上色）──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyOn) return;
    const fc: FeatureCollection = { type: "FeatureCollection", features: [] };
    if (route.points.length >= 2) fc.features.push({ type: "Feature", geometry: { type: "LineString", coordinates: route.points }, properties: {} });
    if (route.result) {
      for (const s of route.result.samples) {
        const color = s.dominant ? SOUND_FAMILY_COLORS[s.dominant.family] : SOUND_UNKNOWN_COLOR;
        fc.features.push({ type: "Feature", geometry: { type: "Point", coordinates: [s.lon, s.lat] }, properties: { kind: "sample", color } });
      }
    }
    for (const p of route.points) fc.features.push({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: { kind: "vertex", color: "#ffffff" } });
    setSourceData(map, SRC_ROUTE, fc);
  }, [mapRef, anyOn, route, mapTick]);

  // ── 載入資料（跟日期；只載開著的家族）──
  useEffect(() => {
    if (!anyOn) return;
    let cancelled = false;
    // 只採用最後一次要求的日期：快速跳日時，較慢的前一天（例如即時 RPC）晚回來不可蓋掉新一天（W6-1 實測）
    let latestReq = 0;
    const load = (date: string) => {
      if (!date) return;
      const req = ++latestReq;
      const keyed = enabled
        .map((f) => ({ f, key: familyLoadKey(f, date, receiver, snapshot) }))
        .filter((x): x is { f: SoundSourceFamily; key: string } => x.key != null);
      soundAtlasStore.set({ loading: keyed.map((x) => x.f) });
      Promise.all(keyed.map(({ f, key }) => cachedLoad(key, () => loadSoundFamily(f, date, receiver, snapshot)).then((r) => [f, r] as const)))
        .then((results) => {
          if (cancelled || req !== latestReq) return;
          const nextSets: Partial<Record<SoundSourceFamily, SoundSourceSet>> = {};
          const origins: SoundAtlasState["origins"] = {};
          for (const [f, r] of results) if (r) { nextSets[f] = r.set; origins[f] = r.origin; }
          soundAtlasStore.set({ sets: nextSets, origins, dateKey: date, loading: [] });
        })
        .catch((e) => {
          console.error("[SoundAtlas] load failed", e);
          if (!cancelled && req === latestReq) soundAtlasStore.set({ loading: [] });
        });
    };
    load(timeStore.getDateKey());
    const unsub = timeStore.subscribeDate(load);
    return () => { cancelled = true; unsub(); };
  }, [anyOn, enabled, receiver, snapshot]);

  // ── 接收點預篩後的 sets（接收點或資料變才重算）──
  const filtered = useMemo(() => {
    if (!receiver) return [] as SoundSourceSet[];
    const list = enabled.map((f) => sets[f]).filter((s): s is SoundSourceSet => !!s);
    return prefilterSetsForReceiver(list, receiver);
  }, [receiver, sets, enabled]);

  // ── 24h 構成（不跟時間跑）──
  useEffect(() => {
    if (!anyOn || !receiver || !dateKey || filtered.length === 0) {
      if (soundAtlasStore.get().profile) soundAtlasStore.set({ profile: null });
      return;
    }
    // 颱風場景約 270 ms（970 架航班）：延後到接收點／資料穩定後再算，
    // 讓拖曳放開、選場景、播放起步的那一幀不被整日構成卡住；期間又變動就取消重排。
    const timer = window.setTimeout(() => {
      const t0 = performance.now();
      const profile = dayProfile(receiver, dateKey, undefined, filtered, enabled);
      const ms = performance.now() - t0;
      soundAtlasStore.set({ profile, perf: { ...soundAtlasStore.get().perf, lastProfileMs: ms } });
    }, PROFILE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [anyOn, receiver, dateKey, filtered, enabled]);

  // ── 當下：接收點查詢＋地圖標記／連線（節流）──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyOn) return;
    if (!receiver) {
      setSourceData(map, SRC_POINTS, EMPTY);
      setSourceData(map, SRC_LINKS, EMPTY);
      setSourceData(map, SRC_ROADS, EMPTY);
      animatorRef.current?.update({ receiver: null, result: null });
      if (soundAtlasStore.get().current) soundAtlasStore.set({ current: null });
      return;
    }
    const index = indexRecords(filtered);
    const origins = soundAtlasStore.get().origins;
    const apply = (t: number) => {
      const t0 = performance.now();
      const result = queryReceiver(receiver, t, filtered, enabled);
      const ms = performance.now() - t0;
      const points: FeatureCollection = { type: "FeatureCollection", features: [] };
      const links: FeatureCollection = { type: "FeatureCollection", features: [] };
      const roads: FeatureCollection = { type: "FeatureCollection", features: [] };
      for (const c of result.contributions) {
        const rec = index.get(c.sourceId);
        let place = contributionPlace(rec, t);
        if (c.family === "road_traffic") {
          // W6-2 路網：連線接到該路段離接收點最近處；有潛勢的路段畫淡光暈（網格是主要呈現）
          const line = roadContributionLine((filtered.find((s) => s.family === "road_traffic")?.records ?? []) as SoundSourceRecord<unknown, "road_traffic">[], c.sourceId);
          if (!line) continue;
          const near = nearestPointOnLine(line.coords, receiver.longitude, receiver.latitude);
          if (!near) continue;
          place = { lon: near[0], lat: near[1], altitudeM: null, label: line.label };
          if (c.status === "active") {
            roads.features.push({ type: "Feature", geometry: { type: "LineString", coordinates: line.coords }, properties: { potential: c.relativePotential } });
          }
        }
        if (!place) continue;
        if (c.family === "roadwork" && rec) {
          // 施工許可：圖示與連線放在許可幾何上離接收點最近處（與引擎距離一致）
          const rp = rec.payload as RoadworkPayload;
          const near = rp.kind === "permit" ? nearestPointOnGeometry(rp.event.geometry, receiver.longitude, receiver.latitude) : null;
          if (near) place = { ...place, lon: near[0], lat: near[1] };
        }
        const props = {
          family: c.family, status: c.status, potential: c.relativePotential, distanceM: c.spatialDistanceM,
          evidence: c.evidence, spatialPrecision: c.spatialPrecision, temporalPrecision: c.temporalPrecision,
          sourceTime: c.sourceTime, label: place.label, altitudeM: place.altitudeM,
          unknownReason: c.unknownReason ?? null, delayS: c.thunderTiming?.delayS ?? null,
          origin: origins[c.family] ?? "live", railStructure: c.railStructure ?? null,
          proxyKind: c.proxyKind ?? null, flowDays: c.notes.find((n) => n.startsWith("flow_days:"))?.slice(10) ?? null,
        };
        points.features.push({ type: "Feature", geometry: { type: "Point", coordinates: [place.lon, place.lat] }, properties: props });
        if (c.status === "active" && !ANIMATED_FAMILIES.has(c.family)) {
          links.features.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: [[receiver.longitude, receiver.latitude], [place.lon, place.lat]] },
            properties: { family: c.family, potential: c.relativePotential },
          });
        }
      }
      setSourceData(map, SRC_POINTS, points);
      setSourceData(map, SRC_LINKS, links);
      setSourceData(map, SRC_ROADS, roads);
      animatorRef.current?.update({ receiver, result, records: index });
      soundAtlasStore.set({ current: result, perf: { ...soundAtlasStore.get().perf, lastQueryMs: ms } });
    };
    apply(timeStore.getTime());
    return timeStore.subscribeThrottled(CURRENT_THROTTLE_MS, apply);
  }, [mapRef, anyOn, receiver, filtered, enabled, mapTick]);

  // ── 雷聲波前（示意；有上限）──
  const thunderSet = fT ? sets.thunder : undefined;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !anyOn) return;
    if (!thunderSet || thunderSet.records.length === 0) {
      setSourceData(map, SRC_WAVES, EMPTY);
      animatorRef.current?.update({ thunderStrikes: [] });
      return;
    }
    const strikes = thunderSet.records.map((r) => {
      const p = r.payload as ThunderPayload;
      return { id: r.id, lon: p.lon, lat: p.lat, flashTime: p.flashTime };
    });
    animatorRef.current?.update({ thunderStrikes: strikes });
    let lastCount = -1;
    const tick = (t: number) => {
      const c = receiver ? { lon: receiver.longitude, lat: receiver.latitude } : (() => { const m = map.getCenter(); return { lon: m.lng, lat: m.lat }; })();
      const { fronts, activeCount } = activeWavefronts(strikes, t, c, WAVEFRONT_DEFAULT_CAP);
      if (fronts.length === 0 && lastCount === 0) return;
      lastCount = fronts.length;
      setSourceData(map, SRC_WAVES, {
        type: "FeatureCollection",
        features: fronts.map((w) => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: geodesicRing(w.lon, w.lat, Math.max(1, w.radiusM)) },
          properties: { fade: w.fade },
        })),
      });
      const perf = soundAtlasStore.get().perf;
      if (activeCount > perf.wavefrontActivePeak || fronts.length > perf.wavefrontDrawnPeak) {
        soundAtlasStore.set({
          perf: { ...perf, wavefrontActivePeak: Math.max(perf.wavefrontActivePeak, activeCount), wavefrontDrawnPeak: Math.max(perf.wavefrontDrawnPeak, fronts.length) },
        });
      }
    };
    tick(timeStore.getTime());
    return timeStore.subscribeThrottled(WAVE_THROTTLE_MS, tick);
  }, [mapRef, anyOn, thunderSet, receiver, mapTick]);
}
