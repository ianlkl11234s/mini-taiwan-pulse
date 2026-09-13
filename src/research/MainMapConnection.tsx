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
import { describeDataset, searchDatasets } from "./researchDatasets";
import { ResearchAnalysisSession, type AnalysisQueryOperation } from "./researchAnalysisSession";
import { analysisResultSourceIds, analysisResultLayerIds, setAnalysisOpacity, installAnalysisResults, removeAnalysisResults } from "./analysisResultOverlay";
import "./mainMapConnection.css";

type Props = { bridge: MapBridge; map: MapboxMap | null; labels: Record<string, string>; locked: ReadonlySet<string>; selection?: [number, number] | null; embedded?: boolean };
type PresentedAnalysisSummary = { resultId: string; datasetId: string; pointCount: number };
const ANALYSIS_QUERY_OPERATIONS = new Set<BrowserQuery["operation"]>(["spatial_query", "aggregate_records", "join_records", "calculate_metric", "read_series", "compare_series", "get_data_quality", "get_record_evidence", "get_analysis_result", "get_result_bounds", "list_results", "remove_result"]);
function isAnalysisQueryOperation(operation: BrowserQuery["operation"]): operation is AnalysisQueryOperation { return ANALYSIS_QUERY_OPERATIONS.has(operation); }
/** Thin adapter: the original map handlers remain the only visibility writer. */
export function MainMapConnection(props: Props) {
  const [open, setOpen] = useState(false);
  const [nearby, setNearby] = useState<NearbyResult | null>(null);
  const [radius, setRadius] = useState(1000);
  const [opacity, setOpacity] = useState(0.9);
  const [analysisOpacity, setAnalysisOpacityValue] = useState(0.55);
  const analysisOpacityRef = useRef(analysisOpacity); analysisOpacityRef.current = analysisOpacity;
  const queryBusy = useRef(false);
  const [querying, setQuerying] = useState(false);
  const [selectionPoint, setSelectionPoint] = useState<[number, number] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [presentedAnalysis, setPresentedAnalysis] = useState<PresentedAnalysisSummary[]>([]);
  const picked = useRef<[number, number] | null>(null);
  const picking = useRef(false); picking.current = selecting;
  const [message, setMessage] = useState("先配對，再讓 Agent 分析資料，並把結果呈現在這張地圖。");
  const latest = useRef(props); latest.current = props;
  const controller = useRef<StudyController | null>(null);
  const responder = useRef<QueryResponder | null>(null);
  const resultCache = useRef(new Map<string, NearbyResult>());
  const analysisSession = useRef(new ResearchAnalysisSession());
  const presented = useRef<NearbyResult | null>(null);
  const opacityRef = useRef(opacity); opacityRef.current = opacity;
  const popup = useRef<mapboxgl.Popup | null>(null);
  const connectionEpoch = useRef(0);
  const applying = useRef(false);
  const previous = useRef<Scene | null>(null);
  const generation = useRef(0);
  const capture = (): Scene => {
    const camera = latest.current.bridge.getCamera();
    return { camera: { center: [((camera.lng + 180) % 360 + 360) % 360 - 180, Math.max(-85, Math.min(85, camera.lat))], zoom: Math.max(0, Math.min(18, camera.zoom)) }, resultMode: "empty", layers: captureLayerOverrides(previous.current?.layers, latest.current.bridge.getVisibleLayerKeys()), nearby: previous.current?.nearby ?? null, results: previous.current?.results ?? null };
  };
  const render = useCallback(async (scene: Scene, revision: number): Promise<"ready" | "error"> => {
    const { bridge, map, labels, locked } = latest.current;
    if (!map || !map.isStyleLoaded()) throw new Error("MAP_NOT_READY");
    if (scene.resultMode !== "empty") throw new Error("MAIN_MAP_LAYERS_ONLY");
    // Pairing must never reset the user's camera or visible layers.
    if (revision === 0) { previous.current = scene; return "ready"; }
    const nextResult = scene.nearby ? resultCache.current.get(scene.nearby.queryId) : null;
    if (scene.nearby && !nextResult) throw new Error("QUERY_RESULT_UNAVAILABLE");
    const analysisResults = scene.results ? analysisSession.current.presentable(scene.results.resultIds) : [];
    if (nextResult && locked.has(nextResult.layerKey)) throw new Error("LAYER_DENIED");
    const run = ++generation.current;
    applying.current = true;
    try {
      applyMainMapLayers(scene.layers ?? {}, new Set(Object.keys(labels)), locked, bridge);
      if (JSON.stringify(scene.camera) !== JSON.stringify(previous.current?.camera)) map.jumpTo({ center: scene.camera.center, zoom: scene.camera.zoom });
      if (nextResult?.queryId !== presented.current?.queryId) popup.current?.remove();
      if (nextResult) installNearbyOverlay(map, nextResult, opacityRef.current);
      else removeNearbyOverlay(map);
      if (analysisResults.length) installAnalysisResults(map, analysisResults, analysisOpacityRef.current);
      else removeAnalysisResults(map);
      presented.current = nextResult ?? null; setNearby(nextResult ?? null);
      setPresentedAnalysis(analysisResults.map(result => ({ resultId: result.resultId, datasetId: result.datasetId, pointCount: result.rows.length })));
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
    for (const sourceId of analysisResultSourceIds(analysisResults.length)) {
      const started = Date.now();
      while (run === generation.current && !map.isSourceLoaded(sourceId) && Date.now() - started < 8_000) await new Promise(resolve => setTimeout(resolve, 50));
      matches = matches && run === generation.current && map.isSourceLoaded(sourceId);
    }
    const analysisMessage = analysisResults.length ? `${analysisResults.length} 組分析結果／${analysisResults.reduce((sum, result) => sum + result.rows.length, 0)} 筆空間紀錄已呈現。` : null;
    setMessage(matches ? nextResult ? `r${revision} 附近查詢結果已呈現。${analysisMessage ? `另有 ${analysisMessage}` : ""}` : analysisMessage ? `r${revision} ${analysisMessage}` : `r${revision} 圖層開關已同步；資料載入狀態請看原本地圖提示。` : "圖層狀態有衝突，請重新確認。");
    return matches ? "ready" : "error";
  }, []);
  const connect = useCallback((context: BridgeConnectionContext | null) => {
    controller.current?.stop(); responder.current?.stop(); ++generation.current; ++connectionEpoch.current; previous.current = null; resultCache.current.clear();
    // In-flight queries retain this old instance; rotating prevents their late store writes from entering the new session.
    analysisSession.current = new ResearchAnalysisSession();
    popup.current?.remove(); presented.current = null; setNearby(null); setPresentedAnalysis([]);
    if (latest.current.map) { removeNearbyOverlay(latest.current.map); removeAnalysisResults(latest.current.map); }
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
        const result = await analysisSession.current.queryRecords(request.args as unknown as Parameters<ResearchAnalysisSession["queryRecords"]>[0]);
        if (epoch !== connectionEpoch.current) throw new Error("SESSION_REVOKED");
        return result;
      }
      if (request.operation === "plan_data_access") return analysisSession.current.planDataAccess(request.args.query as Parameters<ResearchAnalysisSession["planDataAccess"]>[0]);
      if (request.operation === "materialize_data") {
        const result = await analysisSession.current.materializeData(request.args.planId);
        if (epoch !== connectionEpoch.current) throw new Error("SESSION_REVOKED");
        return result;
      }
      if (isAnalysisQueryOperation(request.operation)) {
        return analysisSession.current.execute(request.operation, request.args);
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
    const draw = () => {
      if (!map.isStyleLoaded()) return;
      if (nearby) installNearbyOverlay(map, nearby, opacityRef.current);
      const resultIds = previous.current?.results?.resultIds;
      if (resultIds?.length && resultIds.every(id => analysisSession.current.hasResult(id))) installAnalysisResults(map, analysisSession.current.presentable(resultIds), analysisOpacityRef.current);
      else removeAnalysisResults(map);
    };
    const click = (event: mapboxgl.MapMouseEvent) => {
      if (picking.current) {
        const point: [number, number] = [event.lngLat.lng, event.lngLat.lat];
        picked.current = point; setSelectionPoint(point); setSelecting(false); map.getCanvas().style.cursor = "";
        return;
      }
      const layers = analysisResultLayerIds(4).filter(id => map.getLayer(id));
      const feature = layers.length ? map.queryRenderedFeatures(event.point, { layers })[0] : undefined;
      if (feature) {
        popup.current?.remove();
        const content = document.createElement("div"); content.style.color = "#172421";
        content.textContent = Object.entries(feature.properties ?? {}).filter(([key]) => ["grid_id", "source_place_record_count", "metric_status", "source_version", "school_name", "resultId"].includes(key)).map(([key, value]) => `${key}: ${value}`).join(" · ");
        popup.current = new mapboxgl.Popup().setLngLat(event.lngLat).setDOMContent(content).addTo(map);
      }
    };
    draw(); map.on("style.load", draw); map.on("click", click);
    return () => { map.off("style.load", draw); map.off("click", click); removeNearbyOverlay(map); removeAnalysisResults(map); };
  }, [props.map, nearby]);
  const localNearby = async (useSelection: boolean) => {
    if (queryBusy.current || !props.map?.isStyleLoaded()) return;
    queryBusy.current = true;
    const queryGeneration = ++generation.current;
    setQuerying(true); setMessage("正在查詢附近學校…");
    const camera = props.bridge.getCamera(); const point = useSelection ? picked.current ?? props.selection : [camera.lng, camera.lat];
    if (!point) { queryBusy.current = false; setQuerying(false); setMessage("請先在原地圖點選一個位置。"); return; }
    try {
      const result = await queryNearby("schools", { lng: point[0]!, lat: point[1]! }, radius, 50, { locked: props.locked, visible: new Set(props.bridge.getVisibleLayerKeys()) });
      if (queryGeneration !== generation.current) return;
      remember(result); presented.current = result; setNearby(result); popup.current?.remove();
      installNearbyOverlay(props.map, result, opacityRef.current);
      const scene = { ...capture(), nearby: { queryId: result.queryId } }; previous.current = scene; controller.current?.manual(scene);
      setMessage(`查詢完成：${result.totalMatched} 筆符合，顯示 ${result.returned} 筆。`);
    } catch { if (queryGeneration === generation.current) setMessage("查詢未完成：請確認學校資料可讀取、半徑與圖層權限。此狀態不是零筆結果。"); }
    finally { queryBusy.current = false; setQuerying(false); }
  };
  const clear = () => {
    ++generation.current; presented.current = null; setNearby(null); popup.current?.remove();
    if (props.map) removeNearbyOverlay(props.map);
    const scene = { ...capture(), nearby: null }; previous.current = scene; controller.current?.manual(scene);
  };

  const showGrid = async () => {
    const map = props.map;
    if (queryBusy.current || !map?.isStyleLoaded()) return;
    queryBusy.current = true;
    const run = ++generation.current;
    const epoch = connectionEpoch.current;
    setQuerying(true); setMessage("正在讀取已驗證的學校格網…");
    try {
      const result = await analysisSession.current.queryRecords({ datasetId: "tw-schools-grid-150m", limit: 1 });
      if (run !== generation.current || epoch !== connectionEpoch.current) return;
      const resultId = String(result.resultId);
      const results = analysisSession.current.presentable([resultId]);
      installAnalysisResults(map, results, analysisOpacityRef.current);
      setPresentedAnalysis(results.map(item => ({ resultId: item.resultId, datasetId: item.datasetId, pointCount: item.rows.length })));
      const scene = { ...capture(), results: { resultIds: [resultId] } };
      previous.current = scene; controller.current?.manual(scene);
      setMessage(`${results[0]!.rows.length} 個有學校來源紀錄的 150m 格網；未列出的格網不是零。來源授權與時間仍 unknown。`);
    } catch { if (run === generation.current) setMessage("格網未完成：本地資產不存在、過期或驗證失敗；不代表零筆。"); }
    finally { queryBusy.current = false; setQuerying(false); }
  };
  const clearAnalysis = () => {
    ++generation.current; popup.current?.remove();
    if (props.map) removeAnalysisResults(props.map);
    setPresentedAnalysis([]);
    const scene = { ...capture(), results: null }; previous.current = scene; controller.current?.manual(scene);
  };

  useEffect(() => {
    if (!presentedAnalysis.length) return;
    const timer = setInterval(() => {
      if (presentedAnalysis.some(result => !analysisSession.current.hasResult(result.resultId))) {
        clearAnalysis(); setMessage("研究結果已過期或移除，請重新查詢；舊圖形已清除。");
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [presentedAnalysis, props.map]);

  const panelOpen = props.embedded || open;
  return <div className={`main-map-agent${props.embedded ? " main-map-agent--embedded" : ""}`}>
    {!props.embedded && <button className="main-map-agent-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>本地 Agent</button>}
    <div className="main-map-agent-panel" hidden={!panelOpen}>
      {!props.embedded && <h2>連接這張地圖</h2>}
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
      <section aria-label="學校格網研究">
        <button disabled={querying} onClick={() => void showGrid()}>呈現學校 150m 格網</button>
        <small>本地研究資產；計算來源校址紀錄數，並非學區、教育品質或服務覆蓋。</small>
      </section>
      {nearby && <NearbyResults result={nearby} opacity={opacity} onOpacity={value => { setOpacity(value); if (props.map) setNearbyOpacity(props.map, value); }} onSelect={selectRow} onClear={clear} />}
      {presentedAnalysis.length > 0 && <section aria-label="分析結果摘要">
        <h3>已呈現的分析結果</h3>
        <label>分析透明度<input type="range" min="0" max="1" step="0.05" value={analysisOpacity} onChange={event => { const value = Number(event.target.value); setAnalysisOpacityValue(value); if (props.map) setAnalysisOpacity(props.map, presentedAnalysis.length, value); }} /></label>
        {presentedAnalysis.some(result => result.datasetId === "tw-schools-grid-150m") && <p>格網紀錄數：淺藍 1 ／藍 2–3 ／深藍 ≥4。點選格網看來源與數值。</p>}
        <button onClick={clearAnalysis}>清除分析呈現</button>
        <ul>{presentedAnalysis.map(result => <li key={result.resultId}><code>{result.resultId}</code>／<code>{result.datasetId}</code>／{result.pointCount} 筆空間紀錄</li>)}</ul>
      </section>}
    </div>
  </div>;
}
