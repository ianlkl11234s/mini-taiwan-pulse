import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Check, Copy, Crosshair, Eye, EyeOff, Hand, RotateCcw } from "lucide-react";
import {
  bboxDimensionsKm,
  bboxFromCorners,
  bboxToFeature,
  formatBbox,
  formatCoordinate,
  type Bbox,
} from "./bboxSelection";
import {
  parseGfwTrackCollection,
  type GfwTrackMetadata,
  type GfwTrackProperties,
} from "./gfwTrackContract";
import "./bboxSelector.css";

const SELECTION_SOURCE = "bbox-selector-source";
const SELECTION_FILL = "bbox-selector-fill";
const SELECTION_LINE = "bbox-selector-line";
const GFW_TRACK_URL = "/gfw_hourly_tracks_poc.geojson";
const GFW_TRACK_SOURCE = "gfw-hourly-tracks-poc";
const GFW_TRACK_LINE = "gfw-hourly-tracks-poc-line";
const GFW_ENDPOINT_SOURCE = "gfw-hourly-tracks-poc-endpoints";
const GFW_ENDPOINTS = "gfw-hourly-tracks-poc-endpoints-circle";

type TrackLoadState = "loading" | "ready" | "missing" | "error";

interface ScreenPoint {
  x: number;
  y: number;
}

interface DraftRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function formatTimestamp(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "UTC",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function popupContent(properties: Partial<GfwTrackProperties> & { endpoint?: string }): HTMLElement {
  const content = document.createElement("article");
  content.className = "bbox-track-popup";
  const title = document.createElement("strong");
  title.textContent = properties.ship_name || properties.mmsi || properties.vessel_id || "GFW vessel";
  content.append(title);

  const rows: Array<[string, string]> = [
    ["身分", properties.mmsi ? `MMSI ${properties.mmsi}` : properties.vessel_id || "未公開"],
    ["期間（UTC）", `${formatTimestamp(properties.start_at)} – ${formatTimestamp(properties.end_at)}`],
    ["觀測點", `${properties.point_count ?? "—"} 個每小時近似位置`],
    ["線段", `#${properties.segment_index ?? "—"}${properties.endpoint ? ` · ${properties.endpoint === "start" ? "起點" : "終點"}` : ""}`],
  ];
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    const key = document.createElement("span");
    const detail = document.createElement("b");
    key.textContent = label;
    detail.textContent = value;
    row.append(key, detail);
    content.append(row);
  }
  const note = document.createElement("p");
  note.textContent = "GFW 每小時網格中心近似航跡，非原始 AIS 精確船位。";
  content.append(note);
  return content;
}

function localPoint(event: MouseEvent, container: HTMLElement): ScreenPoint {
  const rect = container.getBoundingClientRect();
  return {
    x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
    y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
  };
}

function rectFromPoints(a: ScreenPoint, b: ScreenPoint): DraftRect {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function CoordinateCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="bbox-coordinate-cell">
      <span>{label}</span>
      <strong>{formatCoordinate(value)}</strong>
    </div>
  );
}

export function BboxSelectorApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawModeRef = useRef(true);
  const dragStartRef = useRef<ScreenPoint | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [drawMode, setDrawMode] = useState(true);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackLoadState, setTrackLoadState] = useState<TrackLoadState>("loading");
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackMetadata, setTrackMetadata] = useState<GfwTrackMetadata>({});
  const [tracksVisible, setTracksVisible] = useState(true);
  const [trackOpacity, setTrackOpacity] = useState(0.8);

  drawModeRef.current = drawMode;

  const beginDraw = useCallback(() => {
    setError(null);
    setDrawMode(true);
  }, []);

  const clearSelection = useCallback(() => {
    setBbox(null);
    setDraftRect(null);
    setError(null);
    setDrawMode(true);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    if (!token) {
      setError("找不到 VITE_MAPBOX_TOKEN，請先設定 Mapbox token。");
      return;
    }

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: [126.2, 25.5],
      zoom: 5.4,
      pitch: 0,
      bearing: 0,
      attributionControl: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const abortController = new AbortController();

    const onLoad = async () => {
      map.addSource(GFW_TRACK_SOURCE, {
        type: "geojson",
        data: EMPTY_COLLECTION,
        attribution: '<a href="https://globalfishingwatch.org/" target="_blank" rel="noopener">Powered by Global Fishing Watch</a>',
      });
      map.addLayer({
        id: GFW_TRACK_LINE,
        type: "line",
        source: GFW_TRACK_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#5fe0d0",
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 7, 1.8, 11, 3.2],
          "line-opacity": trackOpacity,
        },
      });
      map.addSource(GFW_ENDPOINT_SOURCE, { type: "geojson", data: EMPTY_COLLECTION });
      map.addLayer({
        id: GFW_ENDPOINTS,
        type: "circle",
        source: GFW_ENDPOINT_SOURCE,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.4, 8, 3.2, 11, 5],
          "circle-color": ["match", ["get", "endpoint"], "end", "#f4c95d", "#5fe0d0"],
          "circle-stroke-color": "#07100f",
          "circle-stroke-width": 1,
          "circle-opacity": trackOpacity,
          "circle-stroke-opacity": trackOpacity,
        },
      });
      map.addSource(SELECTION_SOURCE, { type: "geojson", data: EMPTY_COLLECTION });
      map.addLayer({
        id: SELECTION_FILL,
        type: "fill",
        source: SELECTION_SOURCE,
        paint: { "fill-color": "#f4c95d", "fill-opacity": 0.16 },
      });
      map.addLayer({
        id: SELECTION_LINE,
        type: "line",
        source: SELECTION_SOURCE,
        paint: {
          "line-color": "#ffe08a",
          "line-width": 2,
          "line-dasharray": [2, 1.4],
        },
      });
      map.dragPan.disable();
      setMapReady(true);

      try {
        setTrackLoadState("loading");
        const response = await fetch(GFW_TRACK_URL, { cache: "no-store", signal: abortController.signal });
        if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) {
          setTrackLoadState("missing");
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = parseGfwTrackCollection(await response.json());
        if (abortController.signal.aborted) return;
        (map.getSource(GFW_TRACK_SOURCE) as mapboxgl.GeoJSONSource).setData(parsed.collection);
        (map.getSource(GFW_ENDPOINT_SOURCE) as mapboxgl.GeoJSONSource).setData(parsed.endpoints);
        setTrackMetadata(parsed.metadata);
        setTrackLoadState("ready");
        setTrackError(null);
        if (parsed.metadata.bbox) {
          const [west, south, east, north] = parsed.metadata.bbox;
          map.fitBounds([[west, south], [east, north]], {
            padding: window.innerWidth > 900
              ? { top: 70, right: 330, bottom: 70, left: 430 }
              : 36,
            duration: 900,
          });
        }
      } catch (loadError) {
        if (abortController.signal.aborted) return;
        setTrackLoadState("error");
        setTrackError(loadError instanceof Error ? loadError.message : "未知錯誤");
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!drawModeRef.current || event.button !== 0) return;
      const point = localPoint(event, container);
      const interactiveLayers = [GFW_TRACK_LINE, GFW_ENDPOINTS].filter((layerId) => map.getLayer(layerId));
      if (interactiveLayers.length > 0
        && map.queryRenderedFeatures([point.x, point.y], { layers: interactiveLayers }).length > 0) return;
      event.preventDefault();
      dragStartRef.current = point;
      setDraftRect({ left: dragStartRef.current.x, top: dragStartRef.current.y, width: 0, height: 0 });
    };

    const onMouseMove = (event: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start || !drawModeRef.current) return;
      setDraftRect(rectFromPoints(start, localPoint(event, container)));
    };

    const finishDrag = (event: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;
      dragStartRef.current = null;
      const end = localPoint(event, container);
      const rect = rectFromPoints(start, end);
      setDraftRect(null);

      if (rect.width < 6 || rect.height < 6) {
        setError("範圍太小，請拖曳一個較大的矩形。");
        return;
      }

      const first = map.unproject([start.x, start.y]);
      const second = map.unproject([end.x, end.y]);
      const next = bboxFromCorners(first, second);
      if (!next || next.east - next.west > 180) {
        setError("這個範圍無法使用；目前不支援跨越反子午線的框選。");
        return;
      }

      setError(null);
      setBbox(next);
      setDrawMode(false);
    };

    const cancelDrag = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dragStartRef.current = null;
      setDraftRect(null);
    };

    const onTrackClick = (event: mapboxgl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      new mapboxgl.Popup({ closeButton: true, maxWidth: "310px", offset: 10 })
        .setLngLat(event.lngLat)
        .setDOMContent(popupContent(feature.properties ?? {}))
        .addTo(map);
    };

    const showTrackPointer = () => { map.getCanvas().style.cursor = "pointer"; };
    const restoreMapCursor = () => {
      map.getCanvas().style.cursor = drawModeRef.current ? "crosshair" : "grab";
    };

    map.on("load", onLoad);
    map.on("click", GFW_TRACK_LINE, onTrackClick);
    map.on("click", GFW_ENDPOINTS, onTrackClick);
    map.on("mouseenter", GFW_TRACK_LINE, showTrackPointer);
    map.on("mouseenter", GFW_ENDPOINTS, showTrackPointer);
    map.on("mouseleave", GFW_TRACK_LINE, restoreMapCursor);
    map.on("mouseleave", GFW_ENDPOINTS, restoreMapCursor);
    map.getCanvas().addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", finishDrag);
    window.addEventListener("keydown", cancelDrag);

    return () => {
      abortController.abort();
      map.getCanvas().removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", finishDrag);
      window.removeEventListener("keydown", cancelDrag);
      map.off("click", GFW_TRACK_LINE, onTrackClick);
      map.off("click", GFW_ENDPOINTS, onTrackClick);
      map.off("mouseenter", GFW_TRACK_LINE, showTrackPointer);
      map.off("mouseenter", GFW_ENDPOINTS, showTrackPointer);
      map.off("mouseleave", GFW_TRACK_LINE, restoreMapCursor);
      map.off("mouseleave", GFW_ENDPOINTS, restoreMapCursor);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (drawMode) {
      map.dragPan.disable();
      map.getCanvas().style.cursor = "crosshair";
    } else {
      map.dragPan.enable();
      map.getCanvas().style.cursor = "grab";
    }
  }, [drawMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const source = map.getSource(SELECTION_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(bbox ? bboxToFeature(bbox) : EMPTY_COLLECTION);
  }, [bbox, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const visibility = tracksVisible ? "visible" : "none";
    map.setLayoutProperty(GFW_TRACK_LINE, "visibility", visibility);
    map.setLayoutProperty(GFW_ENDPOINTS, "visibility", visibility);
  }, [mapReady, tracksVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setPaintProperty(GFW_TRACK_LINE, "line-opacity", trackOpacity);
    map.setPaintProperty(GFW_ENDPOINTS, "circle-opacity", trackOpacity);
    map.setPaintProperty(GFW_ENDPOINTS, "circle-stroke-opacity", trackOpacity);
  }, [mapReady, trackOpacity]);

  const copyBbox = async () => {
    if (!bbox) return;
    try {
      await navigator.clipboard.writeText(formatBbox(bbox));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("瀏覽器拒絕剪貼簿權限，請手動選取座標。");
    }
  };

  const dimensions = bbox ? bboxDimensionsKm(bbox) : null;

  return (
    <main className="bbox-app">
      <div ref={containerRef} className="bbox-map" aria-label="範圍框選地圖" />
      <div className="bbox-map-vignette" aria-hidden="true" />

      {draftRect && (
        <div
          className="bbox-draft-rect"
          style={{ left: draftRect.left, top: draftRect.top, width: draftRect.width, height: draftRect.height }}
          aria-hidden="true"
        />
      )}

      <section className="bbox-panel" aria-label="框選工具">
        <header className="bbox-heading">
          <div className="bbox-eyebrow">GFW / AIS QUERY BOUNDARY</div>
          <h1>航跡範圍框選器</h1>
          <p>在海域上拖曳矩形，取得可直接交給 collector 的 bbox。</p>
        </header>

        <div className={`bbox-status ${drawMode ? "is-drawing" : ""}`}>
          {drawMode ? <Crosshair size={15} /> : <Hand size={15} />}
          <span>{drawMode ? "框選模式：直接在地圖上拖曳" : "瀏覽模式：可拖曳地圖與縮放"}</span>
        </div>

        {!mapReady && !error && <div className="bbox-loading">正在載入航海底圖…</div>}

        {bbox ? (
          <div className="bbox-result">
            <div className="bbox-coordinate-grid">
              <CoordinateCell label="WEST" value={bbox.west} />
              <CoordinateCell label="SOUTH" value={bbox.south} />
              <CoordinateCell label="EAST" value={bbox.east} />
              <CoordinateCell label="NORTH" value={bbox.north} />
            </div>

            <label className="bbox-output-label" htmlFor="bbox-output">BBOX · west, south, east, north</label>
            <input
              id="bbox-output"
              className="bbox-output"
              readOnly
              value={formatBbox(bbox)}
              onFocus={(event) => event.currentTarget.select()}
            />

            {dimensions && (
              <div className="bbox-dimensions">
                約 {dimensions.width.toFixed(0)} × {dimensions.height.toFixed(0)} 公里
              </div>
            )}

            <div className="bbox-actions">
              <button className="bbox-button primary" type="button" onClick={copyBbox}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "已複製" : "複製 bbox"}
              </button>
              <button className="bbox-button" type="button" onClick={beginDraw}>
                <Crosshair size={16} />重新框選
              </button>
              <button className="bbox-icon-button" type="button" onClick={clearSelection} aria-label="清除範圍" title="清除範圍">
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="bbox-empty">
            <span>01</span>
            <p>縮放至想看的海域</p>
            <span>02</span>
            <p>按住滑鼠左鍵拖曳一個矩形</p>
          </div>
        )}

        {error && <div className="bbox-error" role="alert">{error}</div>}

        <footer className="bbox-footer">
          滾輪縮放 · 完成框選後自動恢復地圖拖曳
        </footer>
      </section>

      <aside className="bbox-track-panel" aria-label="GFW 歷史近似航跡">
        <div className="bbox-track-heading">
          <div>
            <span>GFW HOURLY TRACKS · POC</span>
            <h2>歷史近似航跡</h2>
          </div>
          <button
            type="button"
            className={`bbox-track-toggle ${tracksVisible ? "is-active" : ""}`}
            onClick={() => setTracksVisible((visible) => !visible)}
            aria-pressed={tracksVisible}
            aria-label={tracksVisible ? "隱藏 GFW 航跡" : "顯示 GFW 航跡"}
          >
            {tracksVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>

        {trackLoadState === "loading" && (
          <div className="bbox-track-state is-loading"><i />正在載入 GFW POC 航跡…</div>
        )}
        {trackLoadState === "missing" && (
          <div className="bbox-track-state is-missing">
            尚未找到 <code>gfw_hourly_tracks_poc.geojson</code>，collector 產生後重新整理即可顯示。
          </div>
        )}
        {trackLoadState === "error" && (
          <div className="bbox-track-state is-error" role="alert">載入失敗：{trackError}</div>
        )}
        {trackLoadState === "ready" && (
          <>
            <div className="bbox-track-stats">
              <div><strong>{trackMetadata.vessel_count?.toLocaleString() ?? "—"}</strong><span>候選船</span></div>
              <div><strong>{(trackMetadata.displayed_segment_count ?? trackMetadata.segment_count)?.toLocaleString() ?? "—"}</strong><span>線段</span></div>
              <div><strong>{trackMetadata.row_count?.toLocaleString() ?? "—"}</strong><span>觀測</span></div>
            </div>
            <div className="bbox-track-range">
              {trackMetadata.date_start ?? "未知日期"} — {trackMetadata.date_end ?? "未知日期"}
            </div>
          </>
        )}

        <div className="bbox-track-legend">
          <div><i className="track-line" /><span>GFW 每小時網格中心連線</span></div>
          <div><i className="track-start" /><span>線段起點</span><i className="track-end" /><span>線段終點</span></div>
        </div>

        <label className="bbox-track-opacity">
          <span>不透明度</span>
          <input
            type="range"
            min="0.15"
            max="1"
            step="0.05"
            value={trackOpacity}
            onChange={(event) => setTrackOpacity(Number(event.currentTarget.value))}
            disabled={!tracksVisible}
          />
          <output>{Math.round(trackOpacity * 100)}%</output>
        </label>

        <p className="bbox-track-note">
          每小時網格中心近似位置，不是原始 AIS 精確船位；畫面受 150,000 點效能上限限制，未顯示全部候選船。
        </p>
        <a className="bbox-gfw-attribution" href="https://globalfishingwatch.org/" target="_blank" rel="noreferrer">
          Powered by Global Fishing Watch
        </a>
      </aside>
    </main>
  );
}
