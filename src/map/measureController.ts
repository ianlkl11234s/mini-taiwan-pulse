/**
 * 量測工具（design-system spec §5.44，C1）：距離／面積。
 *
 * - 地圖外的 external store：App 只建立一次（同 CameraHud store），工具列、尺規鈕、右鍵選單各自訂閱，
 *   加點不會讓 App 重繪。
 * - 繪製：一個 GeoJSON source＋4 支 layer（面、線、預覽虛線、頂點），切底圖（style.load）後重掛，
 *   每次加點把 layer 移到最上層。標籤用 DOM Marker（切底圖不會消失）。
 * - 繪製中攔截地圖容器的 click／dblclick（capture 階段，在 mapbox 之前），所以所有圖層 popup
 *   點擊都不會觸發；同時停用雙擊縮放，離開時還原。拖曳、滾輪縮放照常。
 * - 量測不進分享網址、不存 localStorage。
 */
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap, type MapMouseEvent } from "mapbox-gl";
import { COLORS, LIGHT } from "../styles/designTokens";
import { measureArea, measureDistance, polygonLabelPoint, type LngLat } from "./measureMath";

export type MeasureMode = "distance" | "area";

export interface MeasureState {
  /** 有量測（繪製中或已完成、結果還在） */
  active: boolean;
  /** 繪製中（點地圖會加點） */
  drawing: boolean;
  mode: MeasureMode;
  points: LngLat[];
  /** 距離總長（m）；面積模式為周長 */
  length: number;
  /** 面積（m²），距離模式為 0 */
  area: number;
  /** 各段長度（m），距離模式用 */
  segments: number[];
}

export interface MeasureLabels {
  hint: string;
  perimeter: string;
  formatDistance: (meters: number) => string;
  formatArea: (squareMeters: number) => string;
}

const SOURCE_ID = "measure-tool";
const LAYER_IDS = ["measure-tool-fill", "measure-tool-line", "measure-tool-preview", "measure-tool-vertex"] as const;
/** 同一點判斷（px）：雙擊的第二下、拖曳判斷 */
const SAME_POINT_PX = 4;

const IDLE: MeasureState = { active: false, drawing: false, mode: "distance", points: [], length: 0, area: 0, segments: [] };

function compute(mode: MeasureMode, points: LngLat[], active: boolean, drawing: boolean): MeasureState {
  if (mode === "distance") {
    const { segments, total } = measureDistance(points);
    return { active, drawing, mode, points, length: total, area: 0, segments };
  }
  const { area, perimeter } = measureArea(points);
  return { active, drawing, mode, points, length: perimeter, area, segments: [] };
}

export function createMeasureController() {
  let map: MapboxMap | null = null;
  let state: MeasureState = IDLE;
  let dark = true;
  let touchUi = false;
  let suspended = false;
  let labels: MeasureLabels | null = null;
  let cursor: LngLat | null = null;
  let cursorFrame = 0;
  let downAt: { x: number; y: number } | null = null;
  let doubleClickZoomWasOn = false;
  let interceptOn = false;
  let markers: mapboxgl.Marker[] = [];
  let hintMarker: mapboxgl.Marker | null = null;
  const listeners = new Set<() => void>();

  const accent = () => (dark ? COLORS.accent : LIGHT.accent);

  // ── store ──
  const setState = (next: MeasureState) => {
    state = next;
    syncIntercept();
    render();
    listeners.forEach((listener) => listener());
  };

  // ── 繪製 ──
  const featureCollection = (): GeoJSON.FeatureCollection => {
    const { points, mode, drawing } = state;
    const features: GeoJSON.Feature[] = [];
    if (mode === "area" && points.length >= 3) {
      features.push({ type: "Feature", properties: { kind: "fill" }, geometry: { type: "Polygon", coordinates: [[...points, points[0]!]] } });
    }
    if (points.length >= 2) {
      const line = mode === "area" && (points.length >= 3 && !drawing) ? [...points, points[0]!] : points;
      features.push({ type: "Feature", properties: { kind: "line" }, geometry: { type: "LineString", coordinates: line } });
    }
    if (drawing && cursor && points.length > 0) {
      const last = points[points.length - 1]!;
      const preview: LngLat[] = mode === "area" && points.length >= 2 ? [last, cursor, points[0]!] : [last, cursor];
      features.push({ type: "Feature", properties: { kind: "preview" }, geometry: { type: "LineString", coordinates: preview } });
    }
    for (const p of points) {
      features.push({ type: "Feature", properties: { kind: "vertex" }, geometry: { type: "Point", coordinates: p } });
    }
    return { type: "FeatureCollection", features };
  };

  const ensureLayers = (m: MapboxMap): boolean => {
    try {
      addLayers(m);
      return true;
    } catch {
      return false; // style 還在載入：style.load 會再呼叫 render
    }
  };

  const addLayers = (m: MapboxMap) => {
    if (!m.getSource(SOURCE_ID)) {
      m.addSource(SOURCE_ID, { type: "geojson", data: featureCollection() });
    }
    const color = accent();
    if (!m.getLayer(LAYER_IDS[0])) {
      m.addLayer({ id: LAYER_IDS[0], type: "fill", source: SOURCE_ID, filter: ["==", ["get", "kind"], "fill"], paint: { "fill-color": color, "fill-opacity": 0.12 } });
    }
    if (!m.getLayer(LAYER_IDS[1])) {
      m.addLayer({ id: LAYER_IDS[1], type: "line", source: SOURCE_ID, filter: ["==", ["get", "kind"], "line"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": 2 } });
    }
    if (!m.getLayer(LAYER_IDS[2])) {
      m.addLayer({ id: LAYER_IDS[2], type: "line", source: SOURCE_ID, filter: ["==", ["get", "kind"], "preview"], paint: { "line-color": color, "line-width": 1.5, "line-dasharray": [5 / 1.5, 4 / 1.5] } });
    }
    if (!m.getLayer(LAYER_IDS[3])) {
      m.addLayer({ id: LAYER_IDS[3], type: "circle", source: SOURCE_ID, filter: ["==", ["get", "kind"], "vertex"], paint: { "circle-radius": 5, "circle-color": LIGHT.surfaceSolid, "circle-stroke-color": color, "circle-stroke-width": 2 } });
    }
  };

  const removeLayers = (m: MapboxMap) => {
    for (const id of [...LAYER_IDS].reverse()) if (m.getLayer(id)) m.removeLayer(id);
    if (m.getSource(SOURCE_ID)) m.removeSource(SOURCE_ID);
  };

  const moveToTop = (m: MapboxMap) => {
    for (const id of LAYER_IDS) if (m.getLayer(id)) m.moveLayer(id);
  };

  const updateSource = () => {
    const source = map?.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(featureCollection());
  };

  const clearMarkers = () => {
    markers.forEach((marker) => marker.remove());
    markers = [];
  };

  const labelEl = (text: string, total: boolean, sub?: { label: string; value: string }) => {
    const el = document.createElement("div");
    el.className = `measure-label${total ? " measure-label--total" : ""}${dark ? "" : " measure-label--light"}`;
    const value = document.createElement("span");
    value.className = "measure-label__value";
    value.textContent = text;
    el.append(value);
    if (sub) {
      const row = document.createElement("span");
      row.className = "measure-label__sub";
      const name = document.createElement("span");
      name.className = "measure-label__sub-name";
      name.textContent = sub.label;
      row.append(name, ` ${sub.value}`);
      el.append(row);
    }
    return el;
  };

  const renderLabels = (m: MapboxMap) => {
    clearMarkers();
    if (!labels || !state.active) return;
    const { points, mode } = state;
    const add = (el: HTMLElement, at: LngLat, offset: [number, number], anchor: "bottom" | "center") => {
      markers.push(new mapboxgl.Marker({ element: el, offset, anchor }).setLngLat(at).addTo(m));
    };
    if (mode === "distance") {
      state.segments.forEach((d, i) => {
        const a = points[i]!;
        const b = points[i + 1]!;
        add(labelEl(labels!.formatDistance(d), false), [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [0, -14 + 8], "bottom");
      });
      if (points.length >= 2) add(labelEl(labels.formatDistance(state.length), true), points[points.length - 1]!, [0, -24 + 10], "bottom");
    } else if (points.length >= 3) {
      add(
        labelEl(labels.formatArea(state.area), true, { label: labels.perimeter, value: labels.formatDistance(state.length) }),
        polygonLabelPoint(points),
        [0, 0],
        "center",
      );
    }
  };

  const renderHint = (m: MapboxMap) => {
    const show = state.drawing && !touchUi && !suspended && cursor && labels;
    if (!show) {
      hintMarker?.remove();
      hintMarker = null;
      return;
    }
    if (!hintMarker) {
      const el = document.createElement("div");
      el.className = "measure-hint";
      hintMarker = new mapboxgl.Marker({ element: el, anchor: "top-left", offset: [14, 12] });
    }
    const el = hintMarker.getElement();
    el.classList.toggle("measure-hint--light", !dark);
    el.textContent = labels!.hint;
    hintMarker.setLngLat(cursor!).addTo(m);
  };

  const render = () => {
    const m = map;
    if (!m) return;
    m.getContainer().classList.toggle("measure-drawing", state.drawing && !suspended);
    if (!state.active) {
      clearMarkers();
      renderHint(m);
      if (m.getSource(SOURCE_ID)) updateSource();
      return;
    }
    if (ensureLayers(m)) {
      updateSource();
      moveToTop(m);
    }
    renderLabels(m);
    renderHint(m);
  };

  // ── 繪製中攔截 ──
  const eventPoint = (m: MapboxMap, e: MouseEvent) => {
    const rect = m.getCanvasContainer().getBoundingClientRect();
    return new mapboxgl.Point(e.clientX - rect.left, e.clientY - rect.top);
  };
  const inCanvas = (m: MapboxMap, target: EventTarget | null) => target instanceof Node && m.getCanvasContainer().contains(target);

  const onPointerDown = (e: PointerEvent) => {
    downAt = { x: e.clientX, y: e.clientY };
  };
  const onClickCapture = (e: MouseEvent) => {
    const m = map;
    if (!m || !state.drawing || suspended || !inCanvas(m, e.target)) return;
    // 在 mapbox 之前吃掉：任何圖層 popup、點擊登記簿都不會收到
    e.stopPropagation();
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > SAME_POINT_PX) return; // 拖曳
    const pt = eventPoint(m, e);
    const last = state.points[state.points.length - 1];
    if (last) {
      const lastPx = m.project(last);
      if (Math.hypot(lastPx.x - pt.x, lastPx.y - pt.y) <= SAME_POINT_PX) return; // 雙擊的第二下
    }
    const ll = m.unproject(pt);
    addPoint([ll.lng, ll.lat]);
  };
  const onDblClickCapture = (e: MouseEvent) => {
    const m = map;
    if (!m || !state.drawing || suspended || !inCanvas(m, e.target)) return;
    e.stopPropagation();
    e.preventDefault();
    finish();
  };
  const onMouseMove = (e: MapMouseEvent) => {
    if (!state.drawing) return;
    cursor = [e.lngLat.lng, e.lngLat.lat];
    if (!cursorFrame) {
      cursorFrame = requestAnimationFrame(() => {
        cursorFrame = 0;
        updateSource();
        if (map) renderHint(map);
      });
    }
  };
  const onMouseOut = () => {
    cursor = null;
    updateSource();
    if (map) renderHint(map);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    // 只在繪製中處理：完成後的結果靠「清除」／尺規鈕收掉，避免關分享視窗等的 Esc 把結果一起清掉
    if (!state.drawing || suspended || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.closest("[role=dialog]"))) return;
    if (e.key === "Escape") {
      e.preventDefault();
      clear();
    } else if (e.key === "Enter") {
      e.preventDefault();
      finish();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      undo();
    }
  };

  const syncIntercept = () => {
    const m = map;
    const want = !!m && state.drawing;
    if (want === interceptOn) return;
    if (m) {
      const el = m.getContainer();
      if (want) {
        el.addEventListener("pointerdown", onPointerDown, true);
        el.addEventListener("click", onClickCapture, true);
        el.addEventListener("dblclick", onDblClickCapture, true);
        m.on("mousemove", onMouseMove);
        m.on("mouseout", onMouseOut);
        doubleClickZoomWasOn = m.doubleClickZoom.isEnabled();
        m.doubleClickZoom.disable();
      } else {
        el.removeEventListener("pointerdown", onPointerDown, true);
        el.removeEventListener("click", onClickCapture, true);
        el.removeEventListener("dblclick", onDblClickCapture, true);
        m.off("mousemove", onMouseMove);
        m.off("mouseout", onMouseOut);
        if (doubleClickZoomWasOn) m.doubleClickZoom.enable();
        cursor = null;
      }
    }
    interceptOn = want;
  };

  const onStyleLoad = () => {
    if (map && state.active) render();
  };

  // ── 動作 ──
  function addPoint(p: LngLat) {
    setState(compute(state.mode, [...state.points, p], true, true));
  }
  function finish() {
    if (!state.drawing) return;
    const enough = state.mode === "distance" ? state.points.length >= 2 : state.points.length >= 3;
    if (!enough) {
      clear();
      return;
    }
    setState(compute(state.mode, state.points, true, false));
  }
  function undo() {
    if (!state.active || state.points.length === 0) return;
    setState(compute(state.mode, state.points.slice(0, -1), true, true));
  }
  function clear() {
    if (!state.active) return;
    setState({ ...IDLE, mode: state.mode });
  }

  return {
    bind(next: MapboxMap) {
      if (map === next) return;
      if (map) {
        const old = map;
        clear();
        old.off("style.load", onStyleLoad);
        old.off("remove", unbindMap);
        window.removeEventListener("keydown", onKeyDown);
      }
      map = next;
      map.on("style.load", onStyleLoad);
      map.on("remove", unbindMap);
      window.addEventListener("keydown", onKeyDown);
    },
    /** 主題（淡色底圖用 LIGHT.accent）、觸控介面（不顯示游標提示） */
    configure(next: { dark: boolean; touch: boolean; labels: MeasureLabels }) {
      const themeChanged = next.dark !== dark;
      dark = next.dark;
      touchUi = next.touch;
      labels = next.labels;
      if (map && themeChanged) {
        for (const id of LAYER_IDS) {
          if (!map.getLayer(id)) continue;
          if (id === "measure-tool-fill") map.setPaintProperty(id, "fill-color", accent());
          else if (id === "measure-tool-vertex") map.setPaintProperty(id, "circle-stroke-color", accent());
          else map.setPaintProperty(id, "line-color", accent());
        }
      }
      render();
    },
    /** 拍攝模式：隱藏工具列（App 決定），量測線保留但暫停加點與快捷鍵 */
    setSuspended(value: boolean) {
      if (suspended === value) return;
      suspended = value;
      render();
    },
    start(mode: MeasureMode, first?: LngLat) {
      setState(compute(mode, first ? [first] : [], true, true));
    },
    /** 尺規鈕：沒在量就開始距離量測，否則結束並清除 */
    toggle() {
      if (state.active) clear();
      else setState(compute("distance", [], true, true));
    },
    /** 切換距離／面積：清除已畫的點，重新開始繪製 */
    setMode(mode: MeasureMode) {
      if (state.active && state.mode === mode) return;
      setState(compute(mode, [], true, true));
    },
    undo,
    finish,
    clear,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,
    dispose() {
      unbindMap();
      listeners.clear();
    },
  };

  function unbindMap() {
    const m = map;
    if (!m) return;
    state = IDLE;
    syncIntercept();
    clearMarkers();
    hintMarker?.remove();
    hintMarker = null;
    if (cursorFrame) cancelAnimationFrame(cursorFrame);
    cursorFrame = 0;
    m.getContainer().classList.remove("measure-drawing");
    try { removeLayers(m); } catch { /* map 已移除 */ }
    m.off("style.load", onStyleLoad);
    m.off("remove", unbindMap);
    window.removeEventListener("keydown", onKeyDown);
    map = null;
    listeners.forEach((listener) => listener());
  }
}

export type MeasureController = ReturnType<typeof createMeasureController>;
