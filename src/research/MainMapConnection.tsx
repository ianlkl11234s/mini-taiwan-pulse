import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl, { type Map as MapboxMap } from "mapbox-gl";
import type { MapBridge } from "../chat/types";
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { ResearchConnection } from "./ResearchConnection";
import { StudyController } from "./StudyController";
import type { BridgeConnectionContext, Scene, StudyState, BrowserQuery } from "./bridgeClient";
import { applyMainMapLayers, captureLayerOverrides } from "./mainMapLayers";
import { QueryResponder } from "./QueryResponder";
import { executeDiscovery, queryNearby, type DiscoveryOperation, type NearbyResult, type NearbyRow } from "./nearbyData";
import { installNearbyOverlay, removeNearbyOverlay, setNearbyOpacity, NEARBY_SOURCE } from "./nearbyOverlay";
import { NearbyResults } from "./NearbyResults";
import { loadingRegistry } from "../lib/loadingRegistry";
import { describeDataset, queryRecords, searchDatasets } from "./researchDatasets";
import "./mainMapConnection.css";

type Props = { bridge: MapBridge; map: MapboxMap | null; labels: Record<string, string>; locked: ReadonlySet<string>; selection?: [number, number] | null };
/** Thin adapter: the original map handlers remain the only visibility writer. */
export function MainMapConnection(props: Props) {
  const [open, setOpen] = useState(false);
  const [nearby, setNearby] = useState<NearbyResult | null>(null);
  const [radius, setRadius] = useState(1000);
  const [opacity, setOpacity] = useState(0.9);
  const [querying, setQuerying] = useState(false);
  const [selectionPoint, setSelectionPoint] = useState<[number, number] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const picked = useRef<[number, number] | null>(null);
  const picking = useRef(false); picking.current = selecting;
  const [message, setMessage] = useState("先配對，再讓 Agent 開關這張地圖的圖層。");
  const latest = useRef(props); latest.current = props;
  const controller = useRef<StudyController | null>(null);
  const responder = useRef<QueryResponder | null>(null);
  const resultCache = useRef(new Map<string, NearbyResult>());
  const presented = useRef<NearbyResult | null>(null);
  const opacityRef = useRef(opacity); opacityRef.current = opacity;
  const popup = useRef<mapboxgl.Popup | null>(null);
  const connectionEpoch = useRef(0);
  const applying = useRef(false);
  const previous = useRef<Scene | null>(null);
  const generation = useRef(0);
  const capture = (): Scene => {
    const camera = latest.current.bridge.getCamera();
    return { camera: { center: [((camera.lng + 180) % 360 + 360) % 360 - 180, Math.max(-85, Math.min(85, camera.lat))], zoom: Math.max(0, Math.min(18, camera.zoom)) }, resultMode: "empty", layers: captureLayerOverrides(previous.current?.layers, latest.current.bridge.getVisibleLayerKeys()), nearby: previous.current?.nearby ?? null };
  };
  const render = useCallback(async (scene: Scene, revision: number): Promise<"ready" | "error"> => {
    const { bridge, map, labels, locked } = latest.current;
    if (!map || !map.isStyleLoaded()) throw new Error("MAP_NOT_READY");
    if (scene.resultMode !== "empty") throw new Error("MAIN_MAP_LAYERS_ONLY");
    // Pairing must never reset the user's camera or visible layers.
    if (revision === 0) { previous.current = scene; return "ready"; }
    const nextResult = scene.nearby ? resultCache.current.get(scene.nearby.queryId) : null;
    if (scene.nearby && !nextResult) throw new Error("QUERY_RESULT_UNAVAILABLE");
    if (nextResult && locked.has(nextResult.layerKey)) throw new Error("LAYER_DENIED");
    const run = ++generation.current;
    applying.current = true;
    try {
      applyMainMapLayers(scene.layers ?? {}, new Set(Object.keys(labels)), locked, bridge);
      if (JSON.stringify(scene.camera) !== JSON.stringify(previous.current?.camera)) map.jumpTo({ center: scene.camera.center, zoom: scene.camera.zoom });
      if (nextResult?.queryId !== presented.current?.queryId) popup.current?.remove();
      if (nextResult) installNearbyOverlay(map, nextResult, opacityRef.current);
      else removeNearbyOverlay(map);
      presented.current = nextResult ?? null; setNearby(nextResult ?? null);
      if (nextResult) setOpen(true);
      previous.current = scene;
    } finally { applying.current = false; }
    // This receipt confirms switch state only. Loading/coverage remains the map's own UI.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (run !== generation.current) return "error";
    const visible = new Set(bridge.getVisibleLayerKeys());
    let matches = Object.entries(scene.layers ?? {}).every(([key, on]) => visible.has(key) === on);
    if (nextResult) {
      const started = Date.now();
      while (run === generation.current && !map.isSourceLoaded(NEARBY_SOURCE) && Date.now() - started < 8_000) await new Promise(resolve => setTimeout(resolve, 50));
      matches = matches && run === generation.current && map.isSourceLoaded(NEARBY_SOURCE);
    }
    setMessage(matches ? nextResult ? `r${revision} 附近查詢結果已呈現。` : `r${revision} 圖層開關已同步；資料載入狀態請看原本地圖提示。` : "圖層狀態有衝突，請重新確認。");
    return matches ? "ready" : "error";
  }, []);
  const connect = useCallback((context: BridgeConnectionContext | null) => {
    controller.current?.stop(); responder.current?.stop(); ++generation.current; ++connectionEpoch.current; previous.current = null; resultCache.current.clear();
    controller.current = context ? new StudyController(context, render, () => setMessage("操作未完成，連線已暫停。請確認圖層權限或重新配對。")) : null;
    responder.current = context ? new QueryResponder(context, async (request: BrowserQuery) => {
      const epoch = connectionEpoch.current;
      const current = latest.current;
      const visible = current.bridge.getVisibleLayerKeys();
      if (request.operation === "map_context") {
        if (!current.map?.isStyleLoaded()) throw new Error("MAP_NOT_READY");
        return { observedAt: new Date().toISOString(), camera: current.bridge.getCamera(), selection: picked.current ?? current.selection ?? null, selectionSource: picked.current ? "user_point" : current.selection ? "feature" : null, visibleLayerKeys: visible.slice(0,100), totalVisible: visible.length, truncated: visible.length > 100, loading: loadingRegistry.snapshot().slice(0,20).map(task => task.label), totalLoading: loadingRegistry.snapshot().length, loadingTruncated: loadingRegistry.snapshot().length > 20, dataReadiness: "not_inferred_from_visibility" };
      }
      if (request.operation === "search_datasets") return searchDatasets(String(request.args.query ?? ""), Number(request.args.offset ?? 0), Number(request.args.limit ?? 20));
      if (request.operation === "describe_dataset") return describeDataset(String(request.args.datasetId ?? "")) as unknown as Record<string, unknown>;
      if (request.operation === "query_records") {
        const result = await queryRecords(request.args as unknown as Parameters<typeof queryRecords>[0]);
        if (epoch !== connectionEpoch.current) throw new Error("SESSION_REVOKED");
        return result;
      }
      const operations: Record<"search_layers" | "describe_layer" | "find_places" | "read_layer" | "nearby", DiscoveryOperation> = { search_layers: "discoverLayers", describe_layer: "describeLayer", find_places: "findPlaces", read_layer: "readLayer", nearby: "queryNearby" };
      const args = { ...request.args };
      if (request.operation === "nearby") { const center = args.center as [number,number]; args.center = { lng: center[0], lat: center[1] }; }
      const result = await executeDiscovery(operations[request.operation], args, { locked: current.locked, visible: new Set(visible) });
      if (epoch !== connectionEpoch.current) throw new Error("SESSION_REVOKED");
      if (request.operation === "nearby") { result.queryId = request.requestId; remember(result as unknown as NearbyResult); }
      return result;
    }, () => setMessage("讀取服務暫時無法同步，請檢查連線。")) : null;
    responder.current?.start();
  }, [render]);
  const disconnect = useCallback(() => connect(null), [connect]);
  const receive = useCallback((state: StudyState) => controller.current?.receive(state), []);
  useEffect(() => {
    const manual = () => {
      if (applying.current) return;
      ++generation.current;
      if (!controller.current) return;
      const scene = capture(); previous.current = scene;
      controller.current.manual(scene);
    };
    const unsubscribe = layerVisibilityStore.subscribe(manual);
    const map = props.map;
    const moved = (event: { originalEvent?: unknown }) => { if (event.originalEvent) manual(); };
    map?.on("moveend", moved);
    return () => { unsubscribe(); map?.off("moveend", moved); };
  }, [props.map]);
  useEffect(() => () => { controller.current?.stop(); responder.current?.stop(); popup.current?.remove(); ++generation.current; ++connectionEpoch.current; }, []);
  const remember = (result: NearbyResult) => {
    resultCache.current.set(result.queryId, result);
    if (resultCache.current.size > 4) resultCache.current.delete(resultCache.current.keys().next().value!);
  };
  const selectRow = (row: NearbyRow) => {
    const map = latest.current.map; if (!map) return;
    map.jumpTo({ center: row.coordinates, zoom: Math.max(14, map.getZoom()) });
    ++generation.current;
    const scene = capture(); previous.current = scene; controller.current?.manual(scene);
    popup.current?.remove();
    const content = document.createElement("div"); content.style.color = "#172421";
    const title = document.createElement("strong"); title.textContent = row.name || "未提供名稱";
    const distance = document.createElement("p"); distance.textContent = `距查詢中心 ${row.distanceM.toFixed(0)} 公尺（直線）`;
    content.append(title, distance);
    popup.current = new mapboxgl.Popup().setLngLat(row.coordinates).setDOMContent(content).addTo(map);
  };
  useEffect(() => {
    const map = props.map; if (!map) return;
    const draw = () => { if (nearby && map.isStyleLoaded()) installNearbyOverlay(map, nearby, opacityRef.current); };
    const click = (event: mapboxgl.MapMouseEvent) => {
      if (picking.current) {
        const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
        picked.current = point; setSelectionPoint(point); setSelecting(false); map.getCanvas().style.cursor = "";
        return;
      }

    };
    draw(); map.on("style.load", draw); map.on("click", click);
    return () => { map.off("style.load", draw); map.off("click", click); removeNearbyOverlay(map); };
  }, [props.map, nearby]);
  const localNearby = async (useSelection: boolean) => {
    if (querying || !props.map?.isStyleLoaded()) return;
    const queryGeneration = ++generation.current;
    setQuerying(true); setMessage("正在查詢附近學校…");
    const camera = props.bridge.getCamera(); const point = useSelection ? picked.current ?? props.selection : [camera.lng, camera.lat];
    if (!point) { setQuerying(false); setMessage("請先在原地圖點選一個位置。"); return; }
    try {
      const result = await queryNearby("schools", { lng: point[0]!, lat: point[1]! }, radius, 50, { locked: props.locked, visible: new Set(props.bridge.getVisibleLayerKeys()) });
      if (queryGeneration !== generation.current) return;
      remember(result); presented.current = result; setNearby(result); popup.current?.remove();
      installNearbyOverlay(props.map, result, opacityRef.current);
      const scene = { ...capture(), nearby: { queryId: result.queryId } }; previous.current = scene; controller.current?.manual(scene);
      setMessage(`查詢完成：${result.totalMatched} 筆符合，顯示 ${result.returned} 筆。`);
    } catch { if (queryGeneration === generation.current) setMessage("查詢未完成：請確認學校資料可讀取、半徑與圖層權限。此狀態不是零筆結果。"); }
    finally { setQuerying(false); }
  };
  const clear = () => {
    ++generation.current; presented.current = null; setNearby(null); popup.current?.remove();
    if (props.map) removeNearbyOverlay(props.map);
    const scene = { ...capture(), nearby: null }; previous.current = scene; controller.current?.manual(scene);
  };

  return <div className="main-map-agent">
    <button className="main-map-agent-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>本地 Agent</button>
    <div className="main-map-agent-panel" hidden={!open}>
      <h2>連接這張地圖</h2>
      <ResearchConnection surface="map" onConnection={connect} onDisconnect={disconnect} onState={receive} />
      <p role="status">{message}</p>
      <section aria-label="附近查詢">
        <h3>附近有哪些學校？</h3>
        <label>查詢半徑（公尺）<input aria-label="查詢半徑（公尺）" type="number" min="1" max="10000" step="100" value={radius} onChange={event => setRadius(Number(event.target.value))} /></label>
        <button disabled={querying} onClick={() => void localNearby(false)}>查地圖中心附近</button>{" "}
        <button disabled={querying || !(selectionPoint ?? props.selection)} onClick={() => void localNearby(true)}>查點選位置附近</button>
        <p><button aria-pressed={selecting} onClick={() => { setSelecting(!selecting); if (props.map) props.map.getCanvas().style.cursor = selecting ? "" : "crosshair"; }}>{selecting ? "取消選取位置" : "在地圖選位置"}</button></p>
        {selectionPoint && <small>選取位置：{selectionPoint[1].toFixed(5)}, {selectionPoint[0].toFixed(5)}</small>}
        <small>首批支援學校；使用已取得的站台資料，最多讀取 5 MiB，重複查詢重用本頁快取。距離採直線，不代表步行可達。</small>
      </section>
      {nearby && <NearbyResults result={nearby} opacity={opacity} onOpacity={value => { setOpacity(value); if (props.map) setNearbyOpacity(props.map, value); }} onSelect={selectRow} onClear={clear} />}
    </div>
  </div>;
}
