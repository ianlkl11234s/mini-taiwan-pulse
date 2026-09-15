import { createPortal } from "react-dom";
import { ResearchActivity } from "./ResearchActivityCard";
import { activityForOperation, type Activity } from "./researchActivity";
import { researchFocusLayerIds, FOCUS_SOURCE, cancelResearchMotion, clearResearchFocus, moveResearchCamera, showResearchFocus } from "./researchMotion";
import { researchPlaces, type ResearchPlace } from "./researchPlaces";
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
import { exploreData, datasetIdsForLayer } from "./dataExploration";
import { describeDataset, ensureDataset, searchDatasets } from "./researchDatasets";
import { ResearchAnalysisSession, type AnalysisQueryOperation } from "./researchAnalysisSession";
import { analysisResultSourceIds, analysisResultLayerIds, setAnalysisOpacity, installAnalysisResults, removeAnalysisResults } from "./analysisResultOverlay";
import "./mainMapConnection.css";

type Props = { bridge: MapBridge; map: MapboxMap | null; labels: Record<string, string>; locked: ReadonlySet<string>; selection?: [number, number] | null; embedded?: boolean };
type PresentedAnalysisSummary = { resultId: string; datasetId: string; pointCount: number; presentation?: import("./analysisOperations").StoredDataResult["presentation"] };
const ANALYSIS_QUERY_OPERATIONS = new Set<BrowserQuery["operation"]>(["compare_neighborhoods", "spatial_query", "aggregate_records", "join_records", "calculate_metric", "read_series", "compare_series", "get_data_quality", "get_record_evidence", "get_analysis_result", "get_result_bounds", "list_results", "remove_result"]);
function isAnalysisQueryOperation(operation: BrowserQuery["operation"]): operation is AnalysisQueryOperation { return ANALYSIS_QUERY_OPERATIONS.has(operation); }
/** Thin adapter: the original map handlers remain the only visibility writer. */
export function MainMapConnection(props: Props) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  const [places, setPlaces] = useState<ResearchPlace[]>([]);
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
  const analysisSession = useRef(new ResearchAnalysisSession(() => latest.current.locked));
  const presented = useRef<NearbyResult | null>(null);
  const opacityRef = useRef(opacity); opacityRef.current = opacity;
  const popup = useRef<mapboxgl.Popup | null>(null);
  const connectionEpoch = useRef(0);
  const applying = useRef(false);
  const previous = useRef<Scene | null>(null);
  const generation = useRef(0);
  const capture = (): Scene => {
    const camera = latest.current.bridge.getCamera();
    return { camera: { center: [((camera.lng + 180) % 360 + 360) % 360 - 180, Math.max(-85, Math.min(85, camera.lat))], zoom: Math.max(0, Math.min(18, camera.zoom)) }, resultMode: "empty", layers: captureLayerOverrides(previous.current?.layers, latest.current.bridge.getVisibleLayerKeys()), nearby: previous.current?.nearby ?? null, results: previous.current?.results ?? null, focus: previous.current?.focus ?? null };
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
    const focusChanged = JSON.stringify(scene.focus ?? null) !== JSON.stringify(previous.current?.focus ?? null);
    const cameraChanged = JSON.stringify(scene.camera) !== JSON.stringify(previous.current?.camera);
    const focus = scene.focus ? researchPlaces(analysisResults, Number.MAX_SAFE_INTEGER).find(place => place.resultId === scene.focus!.resultId && place.recordId === scene.focus!.recordId) : undefined;
    if (scene.focus && !focus) throw new Error("FOCUS_RECORD_UNAVAILABLE");
    const run = ++generation.current;
    let movement: Promise<boolean> = Promise.resolve(true);
    setActivity({ phase: "presenting", title: focus ? `帶你看${focus.label}` : "正在把結果放到地圖上", detail: focus?.detail });
    applying.current = true;
    try {
      applyMainMapLayers(scene.layers ?? {}, new Set(Object.keys(labels)), locked, bridge);
      if ((cameraChanged || (focusChanged && focus)) && followingRef.current) {
        movement = moveResearchCamera(map, focusChanged && focus ? { center: focus.center, zoom: Math.max(13.5, Math.min(15, map.getZoom())) } : scene.camera);
      } else if (cameraChanged || (focusChanged && focus)) movement = Promise.resolve(false);
      if (focusChanged || (focus && !map.getSource(FOCUS_SOURCE))) { if (focus) { if (!showResearchFocus(map, focus.center, focus.radiusM)) throw new Error("FOCUS_NOT_READY"); } else clearResearchFocus(map); }
      if (nextResult?.queryId !== presented.current?.queryId) popup.current?.remove();
      if (nextResult) installNearbyOverlay(map, nextResult, opacityRef.current);
      else removeNearbyOverlay(map);
      if (analysisResults.length) installAnalysisResults(map, analysisResults, analysisOpacityRef.current);
      else removeAnalysisResults(map);
      presented.current = nextResult ?? null; setNearby(nextResult ?? null);
      setPlaces(researchPlaces(analysisResults));
      setPresentedAnalysis(analysisResults.map(result => ({ resultId: result.resultId, datasetId: result.datasetId, pointCount: result.rows.length, presentation: result.presentation })));
      if (nextResult || analysisResults.length) setOpen(true);
      previous.current = scene;
    } finally { applying.current = false; }
    const cameraReady = await movement;
    // This receipt confirms switch state only. Loading/coverage remains the map's own UI.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (run !== generation.current) return "error";
    const visible = new Set(bridge.getVisibleLayerKeys());
    let matches = cameraReady && Object.entries(scene.layers ?? {}).every(([key, on]) => visible.has(key) === on);
    if (nextResult) {
      const started = Date.now();
      while (run === generation.current && !map.isSourceLoaded(NEARBY_SOURCE) && Date.now() - started < 8_000) await new Promise(resolve => setTimeout(resolve, 50));
      matches = matches && run === generation.current && map.isSourceLoaded(NEARBY_SOURCE);
    }
    for (const sourceId of [...analysisResultSourceIds(analysisResults.length), ...(scene.focus ? [FOCUS_SOURCE] : [])]) {
      const started = Date.now();
      while (run === generation.current && !map.isSourceLoaded(sourceId) && Date.now() - started < 8_000) await new Promise(resolve => setTimeout(resolve, 50));
      matches = matches && run === generation.current && map.isSourceLoaded(sourceId);
    }
    matches = matches && analysisResultLayerIds(analysisResults.length).every(id => Boolean(map.getLayer(id)));
    if (scene.focus) matches = matches && researchFocusLayerIds.every(id => Boolean(map.getLayer(id)));
    const analysisMessage = analysisResults.length ? `${analysisResults.length} 組分析結果／${analysisResults.reduce((sum, result) => sum + result.rows.length, 0)} 筆空間紀錄已呈現。` : null;
    setMessage(matches ? nextResult ? `r${revision} 附近查詢結果已呈現。${analysisMessage ? `另有 ${analysisMessage}` : ""}` : analysisMessage ? `r${revision} ${analysisMessage}` : `r${revision} 圖層開關已同步；資料載入狀態請看原本地圖提示。` : "圖層狀態有衝突，請重新確認。");
    setActivity({ phase: matches ? "ready" : "error", title: matches ? focus ? focus.label : analysisResults.length || nextResult ? "結果已準備好，可以在地圖上查看" : "地圖已更新" : !cameraReady && !followingRef.current ? "已保留你的視角" : "呈現尚未完成", detail: !cameraReady && !followingRef.current ? "自動帶鏡頭已暫停；開啟「跟隨 Agent」可恢復後續動作。" : focus?.detail ?? (analysisResults.length ? `${analysisResults.reduce((sum, result) => sum + result.rows.length, 0)} 個候選位置；點選下方地點查看周邊。` : undefined) });
    return matches ? "ready" : "error";
  }, []);
  const connect = useCallback((context: BridgeConnectionContext | null) => {
    controller.current?.stop(); responder.current?.stop(); ++generation.current; ++connectionEpoch.current; previous.current = null; resultCache.current.clear();
    // In-flight queries retain this old instance; rotating prevents their late store writes from entering the new session.
    analysisSession.current = new ResearchAnalysisSession(() => latest.current.locked);
    popup.current?.remove(); presented.current = null; setNearby(null); setPresentedAnalysis([]); setPlaces([]); setActivity(null);
    if (latest.current.map) { cancelResearchMotion(latest.current.map); clearResearchFocus(latest.current.map); }
    if (latest.current.map) { removeNearbyOverlay(latest.current.map); removeAnalysisResults(latest.current.map); }
    controller.current = context ? new StudyController(context, render, () => { setMessage("操作未完成，請確認圖層權限或連線狀態。"); setActivity({ phase: "error", title: "地圖動作未完成", detail: "目前視角會保留，請確認連線或重新選擇地點。" }); }) : null;
    responder.current = context ? new QueryResponder(context, async (request: BrowserQuery) => {
      const epoch = connectionEpoch.current;
      const current = latest.current;
      const visible = current.bridge.getVisibleLayerKeys();
      if (request.operation === "map_context") {
        if (!current.map?.isStyleLoaded()) throw new Error("MAP_NOT_READY");
        return { observedAt: new Date().toISOString(), camera: current.bridge.getCamera(), selection: picked.current ?? current.selection ?? null, selectionSource: picked.current ? "user_point" : current.selection ? "feature" : null, visibleLayerKeys: visible.slice(0,100), totalVisible: visible.length, truncated: visible.length > 100, loading: loadingRegistry.snapshot().slice(0,20).map(task => task.label), totalLoading: loadingRegistry.snapshot().length, loadingTruncated: loadingRegistry.snapshot().length > 20, dataReadiness: "not_inferred_from_visibility" };
      }
      if (request.operation === "explore_data") return exploreData(request.args as { query: string; offset?: number; limit?: number; probe?: boolean }, { locked: current.locked, visible: new Set(visible) }, datasetId => analysisSession.current.queryRecords({ datasetId, limit: 2 }));
      if (request.operation === "read_layer" && request.args.layerKey !== "schools") {
        const layerKey = String(request.args.layerKey);
        if (current.locked.has(layerKey)) throw new Error("LAYER_DENIED");
        const datasetId = datasetIdsForLayer(layerKey)[0];
        if (!datasetId) throw new Error("LAYER_READ_UNSUPPORTED");
        await ensureDataset(datasetId, current.locked);
        const descriptor = describeDataset(datasetId);
        const nameField = descriptor.fields.find(field => ["name", "school_name", "facility_name"].includes(field.name))?.name;
        return analysisSession.current.queryRecords({ datasetId, offset: Number(request.args.offset ?? 0), limit: Number(request.args.limit ?? 20), ...(typeof request.args.nameContains === "string" && nameField ? { filters: [{ field: nameField, op: "contains", value: request.args.nameContains }] } : {}) });
      }
      if (request.operation === "search_datasets") return searchDatasets(String(request.args.query ?? ""), Number(request.args.offset ?? 0), Number(request.args.limit ?? 20));
      if (request.operation === "describe_dataset") { const datasetId = String(request.args.datasetId ?? ""); await ensureDataset(datasetId, current.locked); return describeDataset(datasetId) as unknown as Record<string, unknown>; }
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
    }, () => { setMessage("讀取服務暫時無法同步，請檢查連線。"); setActivity({ phase: "error", title: "連線暫時中斷", detail: "已取得的結果會保留，請確認連線後繼續。" }); }, event => {
      const next = activityForOperation(event.request.operation, event.request.args);
      if (!next) return;
      if (event.phase === "started") { setActivity(next); return; }
      if (!event.result?.ok) { setActivity({ phase: "error", title: "這一步沒有完成", detail: "資料可能暫時無法讀取；這不代表沒有符合的結果。" }); return; }
      const data = event.result.data;
      const count = typeof data.totalRows === "number" ? data.totalRows : typeof data.totalMatched === "number" ? data.totalMatched : null;
      setActivity({ phase: "complete", title: "這一步已完成", detail: count === null ? "資料已回傳給 Agent，可接著整理與比較。" : `取得 ${count} 筆紀錄，等待 Agent 選擇下一步。` });
    }) : null;
    responder.current?.start();
  }, [render]);
  const disconnect = useCallback(() => connect(null), [connect]);
  const receive = useCallback((state: StudyState) => { if (state.paused) setActivity({ phase: "complete", title: "研究已暫停", detail: "目前的地圖與結果會保留。" }); controller.current?.receive(state); }, []);
  const changeFollowing = (value: boolean) => {
    followingRef.current = value; setFollowing(value);
    if (!value && latest.current.map) {
      ++generation.current; cancelResearchMotion(latest.current.map);
      const scene = capture(); previous.current = scene; controller.current?.manual(scene);
    }
  };
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
    const started = (event: { originalEvent?: unknown }) => {
      if (!event.originalEvent) return;
      followingRef.current = false; setFollowing(false); ++generation.current;
      controller.current?.beginManual();
      if (map) { cancelResearchMotion(map); clearResearchFocus(map); }
      if (previous.current) previous.current = { ...previous.current, focus: null };
      setActivity(current => current ? { ...current, phase: current.phase === "presenting" ? "complete" : current.phase, detail: "你正在查看地圖，Agent 已暫停自動帶鏡頭。" } : null);
    };
    const moved = (event: { originalEvent?: unknown }) => { if (event.originalEvent) manual(); };
    map?.on("movestart", started); map?.on("moveend", moved);
    return () => { unsubscribe(); map?.off("movestart", started); map?.off("moveend", moved); if (map) { cancelResearchMotion(map); clearResearchFocus(map); } };
  }, [props.map]);
  useEffect(() => () => { controller.current?.stop(); responder.current?.stop(); popup.current?.remove(); ++generation.current; ++connectionEpoch.current; }, []);
  const remember = (result: NearbyResult) => {
    resultCache.current.set(result.queryId, result);
    if (resultCache.current.size > 4) resultCache.current.delete(resultCache.current.keys().next().value!);
  };
  const selectRow = async (row: NearbyRow) => {
    const map = latest.current.map; if (!map) return;
    changeFollowing(false);
    const run = ++generation.current;
    const arrived = await moveResearchCamera(map, { center: row.coordinates, zoom: Math.max(14, map.getZoom()) });
    if (!arrived || run !== generation.current) return;
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
      try {
        const results = resultIds?.length && resultIds.every(id => analysisSession.current.hasResult(id)) ? analysisSession.current.presentable(resultIds) : [];
        if (results.length) installAnalysisResults(map, results, analysisOpacityRef.current);
        else removeAnalysisResults(map);
        const focus = previous.current?.focus;
        const place = focus ? researchPlaces(results, Number.MAX_SAFE_INTEGER).find(item => item.resultId === focus.resultId && item.recordId === focus.recordId) : undefined;
        if (place) { if (!showResearchFocus(map, place.center, place.radiusM)) throw new Error("FOCUS_NOT_READY"); }
        else {
          clearResearchFocus(map);
          if (focus && previous.current) { const scene = { ...capture(), focus: null }; previous.current = scene; controller.current?.manual(scene); }
        }
      } catch {
        removeAnalysisResults(map); clearResearchFocus(map); setPlaces([]); setPresentedAnalysis([]);
        const scene = { ...capture(), results: null, focus: null }; previous.current = scene; controller.current?.manual(scene);
        setActivity({ phase: "error", title: "結果需要重新取得", detail: "資料已過期、權限改變，或地圖尚未準備完成。" });
      }
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
        const resultId = feature.properties?.resultId;
        if (typeof resultId !== "string" || !analysisSession.current.hasResult(resultId)) return;
        const presentation = analysisSession.current.presentable([resultId])[0]?.presentation;
        const labels: Record<string, string> = { school_name: "名稱", name: "名稱", ...Object.fromEntries(presentation?.sourceLabels.map(source => [source.field, `${source.label}紀錄數`]) ?? []) };
        content.textContent = Object.entries(feature.properties ?? {}).filter(([key]) => ["grid_id", "source_place_record_count", "metric_status", "source_version", "school_name", "name", "source_0_count", "source_1_count", "source_2_count", "source_3_count"].includes(key)).map(([key, value]) => `${labels[key] ?? key}: ${value}`).join(" · ");
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
    setQuerying(true); setMessage("正在查詢附近學校…"); setActivity({ phase: "working", title: "正在查看附近的學校", detail: `以直線 ${radius} 公尺為範圍。` });
    const camera = props.bridge.getCamera(); const point = useSelection ? picked.current ?? props.selection : [camera.lng, camera.lat];
    if (!point) { queryBusy.current = false; setQuerying(false); setMessage("請先在原地圖點選一個位置。"); setActivity(null); return; }
    try {
      const result = await queryNearby("schools", { lng: point[0]!, lat: point[1]! }, radius, 50, { locked: props.locked, visible: new Set(props.bridge.getVisibleLayerKeys()) });
      if (queryGeneration !== generation.current) return;
      remember(result); presented.current = result; setNearby(result); popup.current?.remove();
      installNearbyOverlay(props.map, result, opacityRef.current);
      const scene = { ...capture(), nearby: { queryId: result.queryId } }; previous.current = scene; controller.current?.manual(scene);
      setMessage(`查詢完成：${result.totalMatched} 筆符合，顯示 ${result.returned} 筆。`); setActivity({ phase: "ready", title: "附近資料已準備好", detail: `找到 ${result.totalMatched} 筆學校紀錄；範圍圈採直線距離。` });
    } catch { if (queryGeneration === generation.current) { setMessage("查詢未完成：請確認學校資料可讀取、半徑與圖層權限。此狀態不是零筆結果。"); setActivity({ phase: "error", title: "附近資料暫時無法讀取", detail: "請確認來源與範圍後再試；這不代表零筆。" }); } }
    finally { queryBusy.current = false; setQuerying(false); if (queryGeneration !== generation.current) setActivity(current => current?.title === "正在查看附近的學校" ? { phase: "complete", title: "已保留你目前的視角", detail: "這次查詢沒有更新地圖，可從目前位置重新查看。" } : current); }
  };
  const clear = () => {
    ++generation.current; presented.current = null; setNearby(null); popup.current?.remove();
    if (props.map) { cancelResearchMotion(props.map); removeNearbyOverlay(props.map); }
    setActivity(null); setMessage("已清除附近結果，可以從目前位置重新查詢。");
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
    if (props.map) { cancelResearchMotion(props.map); removeAnalysisResults(props.map); }
    setPresentedAnalysis([]); setPlaces([]); setActivity(null); setMessage("已清除分析呈現，資料可重新查詢。");
    if (props.map) clearResearchFocus(props.map);
    const scene = { ...capture(), results: null, focus: null }; previous.current = scene; controller.current?.manual(scene);
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

  const selectPlace = async (place: ResearchPlace) => {
    const map = latest.current.map; if (!map) return;
    // A user choice is always allowed, even while automatic following is off.
    changeFollowing(false);
    const run = ++generation.current;
    try {
      const current = researchPlaces(analysisSession.current.presentable([place.resultId]), Number.MAX_SAFE_INTEGER).find(item => item.recordId === place.recordId);
      if (!current) return;
      showResearchFocus(map, current.center, current.radiusM);
      setActivity({ phase: "presenting", title: `帶你看${current.label}`, detail: current.detail });
      const arrived = await moveResearchCamera(map, { center: current.center, zoom: Math.max(13.5, Math.min(15, map.getZoom())) });
      if (run !== generation.current) return;
      const scene = { ...capture(), focus: { resultId: place.resultId, recordId: place.recordId } }; previous.current = scene; controller.current?.manual(scene);
      setActivity({ phase: arrived ? "ready" : "complete", title: current.label, detail: current.detail });
    } catch { setActivity({ phase: "error", title: "這筆結果已無法查看", detail: "請重新取得資料後再選擇。" }); }
  };
  const panelOpen = props.embedded || open;
  return <div className={`main-map-agent${props.embedded ? " main-map-agent--embedded" : ""}`}>
    {props.map && createPortal(<div className="research-activity-position"><ResearchActivity activity={activity} following={following} onFollowingChange={changeFollowing} places={places.map(place => ({ id: `${place.resultId}:${place.recordId}`, label: place.label, detail: place.detail, onSelect: () => void selectPlace(place) }))} /></div>, props.map.getContainer())}
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
        {presentedAnalysis.filter(result => result.presentation).map(result => <p key={`legend-${result.resultId}`}>半徑 {result.presentation!.radiusM} 公尺內的{result.presentation!.label}來源紀錄：淺色 0–4／藍色 5–9／深藍 ≥10。直線距離，含候選本身；只比較已選候選點，不代表全市任意位置排名。</p>)}
        {presentedAnalysis.some(result => result.datasetId === "tw-schools-grid-150m") && <p>格網紀錄數：淺藍 1 ／藍 2–3 ／深藍 ≥4。點選格網看來源與數值。</p>}
        <button onClick={clearAnalysis}>清除分析呈現</button>
        <ul>{presentedAnalysis.map(result => <li key={result.resultId}><code>{result.resultId}</code>／<code>{result.datasetId}</code>／{result.pointCount} 筆空間紀錄</li>)}</ul>
      </section>}
    </div>
  </div>;
}
