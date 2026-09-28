import { LayerToggleSwitch } from "../components/sidebar/LayerToggleSwitch";
import { Slider } from "../components/controls/Slider";
import { PanelHeader } from "../components/sidebar/PanelHeader";
import { researchEvidence, analysisErrorMessage, type ResearchEvidence } from "./researchEvidence";
import { ResearchEvidencePanel } from "./ResearchEvidencePanel";
import { describeLayerStatistics, searchLayerRecords, summarizeLayer, type LayerRecordSearchInput, type LayerSummaryInput } from "./layerStatistics";
import { listLayerCapabilities } from "./layerCapabilities";
import { framingFitsViewport, refineViewportCamera, resolveViewportCamera, resolveViewportContext } from "./viewportFit";
import type { TimelineAdapter } from "./timelineControl";
import { explorationLayerKeys, requestLayerExploration } from "./explorationNavigation";
import { createPortal } from "react-dom";
import { ResearchActivity } from "./ResearchActivityCard";
import { activityForOperation, appendActivity, type Activity } from "./researchActivity";
import { cancelResearchMotion, moveResearchCamera } from "./researchMotion";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import type { MapBridge } from "../chat/types";
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { layerParamsStore } from "../state/layerParamsStore";
import { ResearchConnection } from "./ResearchConnection";
import { StudyController } from "./StudyController";
import { visibleResultIds, type BridgeConnectionContext, type ResultCollection, type Scene, type StudyState, type BrowserQuery } from "./bridgeClient";
import { applyMainMapLayers, captureLayerOverrides } from "./mainMapLayers";
import { QueryResponder } from "./QueryResponder";
import { loadingRegistry } from "../lib/loadingRegistry";
import { describeLayers } from "./layerExploration";
import { describeLayer, discoverLayers, findPlaces } from "./discovery";
import { applyLayerControl, describeLayerControls, validateLayerControl } from "./layerControls";
import { resolveOfflineLocation } from "./addressLookup";
import { describeDataset, ensureDataset, searchDatasets } from "./researchDatasets";
import { describeDatasetLayerStatistics, summarizeDatasetLayer } from "./datasetLayerStatistics";
import { ResearchAnalysisSession, type AnalysisQueryOperation } from "./researchAnalysisSession";
import type { QueryRecordsInput } from "./queryExecutor";
import { waitForLayoutFrame, waitForMapStyle, waitForSceneRender } from "./sceneReadiness";
import { analysisFeatureTarget, analysisResultHoverLayerIds, analysisResultInteractiveLayerIds, analysisResultStackKind, analysisSelectionOf, clearAnalysisHover, describeAnalysisResults, setAnalysisHover, setAnalysisSelection, type AnalysisSelection, installAnalysisResults, readAnalysisResultPresentation, removeAnalysisResults, setAnalysisOpacity, type AnalysisResultOpacity, type AnalysisResultPresentation } from "./analysisResultOverlay";
import { ValhallaNetworkProvider } from "./networkProvider";
import { researchResultDatasetLabel, researchResultPanelProperties, researchResultPopupOverlaps, UNNAMED_DATASET_LABEL, type AnalysisResultPanelProperties } from "./researchResultPopup";
import { analysisHoverLabel, createAnalysisHoverTip, supportsAnalysisHover } from "./analysisResultHover";
import { nextAnalysisActivations, planAnalysisStack } from "./analysisResultStack";
import { analysisLegendEntries, publishAnalysisLegend } from "./analysisLegendStore";
import type { PresentableResult } from "./researchAnalysisSession";
import { WarehouseCompareTableView } from "./WarehouseCompareTable";
import { vizThemeForBasemap } from "./vizSpec";
import "./mainMapConnection.css";

type Props = { timeline?: TimelineAdapter; bridge: MapBridge; map: MapboxMap | null; labels: Record<string, string>; locked: ReadonlySet<string>; selection?: [number, number] | null; embedded?: boolean; isDarkTheme?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; showToggle?: boolean; uiHidden?: boolean;
  /** Opens (properties) or closes (null) the App-level docked FeatureInfoPanel for a clicked analysis result. Null must only close an analysis-result panel, never another layer's. */
  onAnalysisResultFeature?: (properties: AnalysisResultPanelProperties | null) => void;
  /** True while the docked FeatureInfoPanel shows an analysis result (App: featureInfo.layerType === "analysisResult").
   *  Drives I2 selection dimming and the G2 compact legend; kept apart from `selection` coords, which are reported to the Agent. */
  analysisResultSelected?: boolean };
const ANALYSIS_OPERATIONS = new Set<AnalysisQueryOperation>(["compare_neighborhoods", "create_analysis_scope", "spatial_query", "aggregate_by_area", "aggregate_records", "join_records", "calculate_metric", "read_series", "compare_series", "compare_regions", "get_data_quality", "get_record_evidence", "get_analysis_result", "get_result_bounds", "list_results", "remove_result"]);
export const EXPLORATION_OPERATIONS = new Set<BrowserQuery["operation"]>(["describe_layer_statistics", "summarize_layer", "list_layer_capabilities", "search_layer_records", "search_layers", "describe_layer", "layer_details", "layer_controls", "map_context", "find_places", "geocode_address", "route_distance", "walking_isochrone", "time_context", "search_datasets", "describe_dataset", "query_records", "plan_data_access", "materialize_data", "import_warehouse_result", ...ANALYSIS_OPERATIONS]);

export function completedActivityForOperation(operation: string, data: Record<string, unknown>): Activity {
  const totalMatched = typeof data.totalMatched === "number" ? data.totalMatched : null;
  const returned = typeof data.returned === "number" ? data.returned : null;
  if (operation === "search_layers") {
    if (totalMatched === 0) return { phase: "complete", title: "這次搜尋沒有找到圖層", detail: "可換關鍵字或查看其他主題。" };
    return { phase: "complete", title: "已找到相關圖層", detail: totalMatched === null ? "資料已回傳給 Agent，可繼續探索。" : `共找到 ${totalMatched} 個候選圖層；本次回傳 ${returned ?? totalMatched} 個。` };
  }
  if (operation === "search_datasets") {
    if (totalMatched === 0) return { phase: "complete", title: "這次搜尋沒有找到資料集", detail: "可換關鍵字或查看其他主題。" };
    return { phase: "complete", title: "已找到相關資料集", detail: totalMatched === null ? "資料已回傳給 Agent，可繼續探索。" : `共找到 ${totalMatched} 個候選資料集；本次回傳 ${returned ?? totalMatched} 個。` };
  }
  if (operation === "query_records") {
    return { phase: "complete", title: "資料紀錄已回傳", detail: totalMatched === null ? "資料已回傳給 Agent，可繼續探索。" : `完整符合 ${totalMatched} 筆資料紀錄；本次回傳 ${returned ?? totalMatched} 筆。` };
  }
  if (operation === "layer_details" || operation === "describe_layer") return { phase: "complete", title: "圖層說明已備妥", detail: "資料已回傳給 Agent，可繼續探索。" };
  if (operation === "summarize_layer" && totalMatched !== null) return { phase: "complete", title: "這一步已完成", detail: `符合 ${totalMatched} 筆來源紀錄；範圍、粒度與缺值已一併回傳。` };
  return { phase: "complete", title: "這一步已完成", detail: totalMatched === null ? "資料已回傳給 Agent，可繼續探索。" : `符合 ${totalMatched} 筆結果，Agent 正在整理下一步。` };
}

type StyleRestoreMap = {
  once(event: "idle", listener: () => void): unknown;
  off(event: "idle", listener: () => void): unknown;
  isStyleLoaded(): boolean;
};

/** One style-cycle fallback: it restores only a result overlay that remains absent after Mapbox settles. */
export function scheduleAnalysisResultStyleRestore(
  map: StyleRestoreMap,
  redraw: () => void,
  isReady: () => boolean,
): () => void {
  let active = true;
  const afterIdle = () => {
    if (!active || !map.isStyleLoaded() || isReady()) return;
    redraw();
  };
  map.once("idle", afterIdle);
  return () => { active = false; map.off("idle", afterIdle); };
}

/** Paired adapter: map exploration plus bounded, session-local analysis over authorized dataset results. */
export function MainMapConnection(props: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = props.open ?? uncontrolledOpen;
  const setOpen = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    const resolved = typeof next === "function" ? next(open) : next;
    if (props.open === undefined) setUncontrolledOpen(resolved);
    props.onOpenChange?.(resolved);
  }, [open, props.onOpenChange, props.open]);
  const [evidence, setEvidence] = useState<ResearchEvidence[]>([]);
  const [activityHistory, setActivityHistory] = useState<Activity[]>([]);
  const activity = activityHistory[0] ?? null;
  const setActivity = useCallback((next: Activity | null | ((current: Activity | null) => Activity | null)) => {
    setActivityHistory(history => appendActivity(history, typeof next === "function" ? next(history[0] ?? null) : next));
  }, []);
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  const [analysisOpacity, setAnalysisOpacityValue] = useState<AnalysisResultOpacity>({ defaultOpacity: 0.85, byResult: {} });
  const analysisOpacityRef = useRef(analysisOpacity); analysisOpacityRef.current = analysisOpacity;
  const [presentedAnalysis, setPresentedAnalysis] = useState<AnalysisResultPresentation[]>([]);
  const presentedAnalysisRef = useRef<AnalysisResultPresentation[]>([]);
  /** I2: rows behind the open docked panel; re-applied after every install (feature-state is per source). */
  const analysisSelectionRef = useRef<AnalysisSelection[]>([]);
  /** S1: when each result last became visible (LRU for the 3-result cap) and which area results lost the fill slot. */
  const analysisActivationsRef = useRef<Map<string, number>>(new Map());
  const analysisOutlineOnlyRef = useRef<string[]>([]);
  const installedOutlineKeyRef = useRef("");
  /** Last collection as the server holds it. An Agent-side cap is not pushed back (a manual push
   *  mid-command would cancel that command's report), so the server keeps re-sending the uncapped
   *  collection; activations must diff against that, or the hidden slot rotates on every command. */
  const requestedResultsRef = useRef<ResultCollection | null>(null);
  const planAnalysisResults = useCallback((previousResults: ResultCollection | null, results: ResultCollection | null | undefined, presentable: readonly PresentableResult[]): ResultCollection | null => {
    analysisActivationsRef.current = nextAnalysisActivations(previousResults, results, analysisActivationsRef.current);
    const kinds = new globalThis.Map(presentable.map(result => [result.resultId, analysisResultStackKind(result)]));
    const plan = planAnalysisStack(results, analysisActivationsRef.current, resultId => kinds.get(resultId) ?? "other");
    analysisOutlineOnlyRef.current = plan.outlineOnly;
    return plan.collection;
  }, []);
  const applyAnalysisSelection = useCallback(() => {
    const map = latest.current.map;
    if (map) setAnalysisSelection(map, presentedAnalysisRef.current, analysisSelectionRef.current, analysisOpacityRef.current);
  }, []);
  const [availableAnalysis, setAvailableAnalysis] = useState<AnalysisResultPresentation[]>([]);
  const [resultCollection, setResultCollection] = useState<ResultCollection | null>(null);
  const resultCollectionRef = useRef<ResultCollection | null>(null);
  const [message, setMessage] = useState("先配對，再到 Codex 說出想探索的主題。");
  const latest = useRef(props); latest.current = props;
  const controller = useRef<StudyController | null>(null);
  const responder = useRef<QueryResponder | null>(null);
  const analysis = useRef<ResearchAnalysisSession | null>(null);
  const networkProvider = useRef<ValhallaNetworkProvider | null>(null);
  const locationLookup = useRef<AbortController | null>(null);
  const connectionEpoch = useRef(0);
  const applying = useRef(false);
  const previous = useRef<Scene | null>(null);
  const generation = useRef(0);
  const capture = useCallback((): Scene => {
    // Result switches must preserve the rendered camera, including Agent fitBounds
    // movements that have not propagated into the application's bridge snapshot.
    const map = latest.current.map;
    const center = map?.getCenter();
    const camera = center && map ? { lng: center.lng, lat: center.lat, zoom: map.getZoom() } : latest.current.bridge.getCamera();
    return { camera: { center: [((camera.lng + 180) % 360 + 360) % 360 - 180, Math.max(-85, Math.min(85, camera.lat))], zoom: Math.max(0, Math.min(18, camera.zoom)) }, resultMode: "empty", layers: captureLayerOverrides(previous.current?.layers, latest.current.bridge.getVisibleLayerKeys()), layerControl: null, framing: null, timeline: null, results: previous.current?.results ?? null };
  }, []);
  const clearAnalysisPresentation = useCallback((syncScene: boolean) => {
    ++generation.current;
    latest.current.onAnalysisResultFeature?.(null);
    if (latest.current.map) removeAnalysisResults(latest.current.map);
    presentedAnalysisRef.current = []; setPresentedAnalysis([]); setAvailableAnalysis([]); setAnalysisOpacityValue({ defaultOpacity: 0.85, byResult: {} });
    resultCollectionRef.current = null; setResultCollection(null);
    requestedResultsRef.current = null; analysisActivationsRef.current = new globalThis.Map(); analysisOutlineOnlyRef.current = []; installedOutlineKeyRef.current = "";
    analysis.current?.setActiveResultCollection([]);
    if (syncScene && controller.current) {
      const scene = { ...capture(), results: null };
      previous.current = scene; controller.current.manual(scene);
    }
  }, [capture]);
  const updateResultCollection = useCallback((update: (collection: ResultCollection) => ResultCollection) => {
    const current = resultCollectionRef.current;
    if (!current || !controller.current) return;
    // Re-enabling a hidden result makes it the newest; the S1 cap then hides the least recent one.
    let presentable: PresentableResult[] = [];
    try { presentable = analysis.current?.presentable(current.items.map(item => item.resultId)) ?? []; } catch { presentable = []; }
    // The user toggle diffs against what is on screen (capped) and is pushed, so the server follows.
    const results = planAnalysisResults(current, update(current), presentable) ?? current;
    requestedResultsRef.current = results;
    resultCollectionRef.current = results; setResultCollection(results);
    const scene = { ...capture(), results };
    previous.current = scene;
    controller.current.manual(scene);
  }, [capture, planAnalysisResults]);
  const render = useCallback(async (requestedScene: Scene, revision: number, patch?: Partial<Scene>): Promise<"ready" | "error"> => {
    let scene = requestedScene;
    const { bridge, map, labels, locked } = latest.current;
    if (!map) throw new Error("MAP_NOT_READY");
    const run = ++generation.current;
    if (!await waitForMapStyle(map, () => run === generation.current && latest.current.map === map)) {
      if (run !== generation.current) return "error";
      throw new Error("MAP_NOT_READY");
    }
    if (scene.resultMode !== "empty" || scene.nearby != null || scene.focus != null) throw new Error("MAP_EXPLORATION_ONLY");
    // Pairing must never reset the user's camera or visible layers.
    if (revision === 0) {
      if (scene.results != null) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
      previous.current = scene; return "ready";
    }
    if (scene.results && !analysis.current) throw new Error("ANALYSIS_SESSION_UNAVAILABLE");
    // Validate every declared ID, including hidden collection entries, before
    // acknowledging the scene. Hidden must not become a way to retain an
    // expired or unauthorized result beyond the normal session boundary.
    const allAnalysisResults = scene.results ? analysis.current!.presentable(scene.results.items.map(item => item.resultId)) : [];
    // S1 (O1): cap at 3 visible results / one heatmap by switching the least recently shown ones
    // off (not removed; the list toggle brings them back). The capped collection is what readback
    // reports, so the Agent sees which results were auto-hidden.
    const cappedResults = planAnalysisResults(requestedResultsRef.current, scene.results, allAnalysisResults);
    requestedResultsRef.current = scene.results ?? null;
    if (cappedResults !== (scene.results ?? null)) scene = { ...scene, results: cappedResults };
    const outlineKey = analysisOutlineOnlyRef.current.join("\n");
    const visibleAnalysisIds = new Set(visibleResultIds(scene.results));
    const analysisResults = allAnalysisResults.filter(result => visibleAnalysisIds.has(result.resultId));
    // Read fresh at render time (not captured in this callback's closure) so a basemap switch that
    // just landed is honoured immediately, not one render behind.
    const theme = vizThemeForBasemap(latest.current.isDarkTheme);
    const availableResults = describeAnalysisResults(allAnalysisResults, theme);
    const framingChanged = !!scene.framing && (!!patch?.framing || JSON.stringify(scene.framing) !== JSON.stringify(previous.current?.framing ?? null));
    const cameraChanged = framingChanged || !!patch?.camera || JSON.stringify(scene.camera) !== JSON.stringify(previous.current?.camera);
    let movement: Promise<boolean> = Promise.resolve(true);
    setActivity({ phase: "presenting", title: "正在同步地圖" });
    applying.current = true;
    try {
      if (scene.layerControl && JSON.stringify(scene.layerControl) !== JSON.stringify(previous.current?.layerControl ?? null)) validateLayerControl(scene.layerControl, locked);
      // Only an explicit `pulse_set_layers`-style command (this render's own patch carrying
      // `layers`) may pop the Layers rail open. Presenting analysis results (patch.results,
      // patch.framing/camera) or a resync/report replay (no patch at all) must never surface it.
      const newlyEnabled = explorationLayerKeys(scene.layers, previous.current?.layers, patch?.layers);
      applyMainMapLayers(scene.layers ?? {}, new Set(Object.keys(labels)), locked, bridge);
      if (newlyEnabled.length) requestLayerExploration(newlyEnabled);
      if (scene.layerControl && JSON.stringify(scene.layerControl) !== JSON.stringify(previous.current?.layerControl ?? null)) applyLayerControl(scene.layerControl, locked);
      if (scene.timeline && patch?.timeline) {
        if (!latest.current.timeline) throw new Error("TIMELINE_UNAVAILABLE");
        await latest.current.timeline.apply(scene.timeline);
      }
      const previousResultIds = presentedAnalysisRef.current.map(result => result.resultId);
      const nextResultIds = analysisResults.map(result => result.resultId);
      if (JSON.stringify(previousResultIds) !== JSON.stringify(nextResultIds)) {
        latest.current.onAnalysisResultFeature?.(null);
        analysisSelectionRef.current = [];
      }
      // Camera-only commands keep the same immutable result rows. Calling
      // GeoJSONSource#setData for those commands needlessly reloads sources.
      const presentationChanged = JSON.stringify(previousResultIds) !== JSON.stringify(nextResultIds) || outlineKey !== installedOutlineKeyRef.current;
      if (presentationChanged) installedOutlineKeyRef.current = outlineKey;
      const installed = analysisResults.length
        ? presentationChanged ? installAnalysisResults(map, analysisResults, analysisOpacityRef.current, theme, { outlineOnly: analysisOutlineOnlyRef.current }) : presentedAnalysisRef.current
        : (removeAnalysisResults(map), []);
      presentedAnalysisRef.current = installed; setPresentedAnalysis(installed);
      setAvailableAnalysis(availableResults);
      resultCollectionRef.current = scene.results ?? null; setResultCollection(scene.results ?? null);
      analysis.current?.setActiveResultCollection(scene.results?.items.map(item => item.resultId) ?? []);
      if (cameraChanged && followingRef.current) {
        // Measure after panel selection and activity card have committed to layout.
        await waitForLayoutFrame();
        if (run !== generation.current || !followingRef.current) return "error";
        movement = moveResearchCamera(map, framingChanged && scene.framing ? resolveViewportCamera(map, scene.framing) : scene.camera);
      }
      else if (cameraChanged) movement = Promise.resolve(false);
      previous.current = scene;
    } finally { applying.current = false; }
    let cameraMoved = await movement;
    // Correct against Mapbox's actual projection after layout settles. Keep this
    // bounded and never resume a camera move the user interrupted.
    for (let attempt = 0; attempt < 2 && framingChanged && scene.framing; attempt++) {
      await waitForLayoutFrame();
      if (run !== generation.current || !followingRef.current) break;
      const correction = refineViewportCamera(map, scene.framing);
      if (!correction) break;
      cameraMoved = await moveResearchCamera(map, correction);
    }
    // Require a real rendered frame and strict live bounds readback.
    const rendered = waitForSceneRender(map, revision, 5_000, () =>
      framingChanged && scene.framing ? framingFitsViewport(map, scene.framing) : cameraMoved,
    );
    const renderReady = await rendered.promise;
    const cameraReady = renderReady === "ready";
    if (run !== generation.current) return "error";
    if (patch?.timeline) {
      const observed = latest.current.timeline?.getContext();
      const requested = patch.timeline;
      if (!observed || observed.mode !== requested.mode || (requested.speed !== undefined && observed.speed !== requested.speed) || (requested.playing !== undefined && observed.playing !== requested.playing) || (requested.mode === "replay" && observed.playing === false && (typeof observed.currentTime !== "number" || Math.abs(observed.currentTime - requested.time) > 1))) throw new Error("TIMELINE_READBACK_MISMATCH");
    }
    const visible = new Set(bridge.getVisibleLayerKeys());
    let resultReadback = readAnalysisResultPresentation(map, presentedAnalysisRef.current, resultCollectionRef.current);
    const resultDeadline = Date.now() + 5_000;
    while (!resultReadback.ready && run === generation.current && Date.now() < resultDeadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
      resultReadback = readAnalysisResultPresentation(map, presentedAnalysisRef.current, resultCollectionRef.current);
    }
    const matches = cameraReady && renderReady === "ready" && resultReadback.ready && Object.entries(scene.layers ?? {}).every(([key, on]) => visible.has(key) === on);
    const resultMessage = resultReadback.featureCount > 0 ? `${resultReadback.featureCount} 筆分析結果已高亮。` : patch?.results === null ? "分析結果已清除。" : null;
    setMessage(matches ? `r${revision} ${resultMessage ?? "地圖設定已同步；資料載入狀態請看原本地圖提示。"}` : "圖層或分析結果狀態有衝突，請重新確認。");
    setActivity({ phase: matches ? "ready" : "error", title: matches ? resultMessage ? "分析結果已呈現" : "地圖已更新" : !cameraReady && !followingRef.current ? "已保留你的視角" : "呈現尚未完成", detail: matches && resultMessage ? resultMessage : !cameraReady && !followingRef.current ? "自動帶鏡頭已暫停；開啟「跟隨 Agent」可恢復後續動作。" : undefined });
    return matches ? "ready" : "error";
  }, []);
  const connect = useCallback((context: BridgeConnectionContext | null) => {
    setEvidence([]);
    controller.current?.stop(); responder.current?.stop(); analysis.current?.clear(); clearAnalysisPresentation(false); analysis.current = context ? new ResearchAnalysisSession(() => latest.current.locked) : null; networkProvider.current = context ? new ValhallaNetworkProvider({ requester: (operation, args) => context.client.networkProvider(context.studyId, context.tabId, operation, args) }) : null; locationLookup.current?.abort("SESSION_REVOKED"); locationLookup.current = null; ++generation.current; ++connectionEpoch.current; previous.current = null; setActivity(null);
    if (latest.current.map) cancelResearchMotion(latest.current.map);
    controller.current = context ? new StudyController(context, render, () => { setMessage("操作未完成，請確認圖層權限或連線狀態。"); setActivity({ phase: "error", title: "地圖動作未完成", detail: "目前視角會保留，請確認連線或重新選擇地點。" }); }) : null;
    responder.current = context ? new QueryResponder(context, async (request: BrowserQuery) => {
      const epoch = connectionEpoch.current;
      const current = latest.current;
      const visible = current.bridge.getVisibleLayerKeys();
      if (!EXPLORATION_OPERATIONS.has(request.operation)) throw new Error("MAP_EXPLORATION_OPERATION_UNSUPPORTED");
      const discoveryContext = { locked: current.locked, visible: new Set(visible) };
      let result: Record<string, unknown>;
      switch (request.operation) {
        case "describe_layer_statistics":
        case "summarize_layer": {
          const layerKey = String(request.args.layerKey ?? "");
          if (current.locked.has(layerKey === "policeStations" ? "policeStation" : layerKey)) throw new Error("LAYER_LOCKED");
          try {
            result = request.operation === "describe_layer_statistics" ? await describeLayerStatistics({ layerKey }) : await summarizeLayer(request.args as unknown as LayerSummaryInput);
          } catch (error) {
            if (!(error instanceof Error) || error.message !== "LAYER_STATISTICS_UNSUPPORTED") throw error;
            result = request.operation === "describe_layer_statistics"
              ? await describeDatasetLayerStatistics(layerKey, current.locked)
              : await summarizeDatasetLayer(request.args as unknown as LayerSummaryInput, current.locked);
          }
          break;
        }
        case "list_layer_capabilities": result = listLayerCapabilities(request.args, current.locked); break;
        case "search_layer_records": {
          const layerKey = String(request.args.layerKey ?? "");
          if (current.locked.has(layerKey === "policeStations" ? "policeStation" : layerKey)) throw new Error("LAYER_LOCKED");
          result = await searchLayerRecords(request.args as unknown as LayerRecordSearchInput);
          break;
        }
        case "time_context":
          if (!current.timeline) throw new Error("TIMELINE_UNAVAILABLE");
          result = current.timeline.getContext(); break;
        case "map_context":
          if (!current.map?.isStyleLoaded()) throw new Error("MAP_NOT_READY");
          result = { observedAt: new Date().toISOString(), camera: current.bridge.getCamera(), viewport: resolveViewportContext(current.map), time: current.timeline?.getContext() ?? null, following: followingRef.current, selection: current.selection ?? null, selectionSource: current.selection ? "feature" : null, visibleLayerKeys: visible.slice(0, 100), totalVisible: visible.length, truncated: visible.length > 100, loading: loadingRegistry.snapshot().slice(0, 20).map(task => task.label), totalLoading: loadingRegistry.snapshot().length, loadingTruncated: loadingRegistry.snapshot().length > 20, dataReadiness: "not_inferred_from_visibility", resultPresentation: readAnalysisResultPresentation(current.map, presentedAnalysisRef.current, resultCollectionRef.current) };
          break;
        case "search_layers": result = discoverLayers(String(request.args.query ?? ""), Number(request.args.offset ?? 0), Number(request.args.limit ?? 20), discoveryContext); break;
        case "search_datasets": result = searchDatasets(String(request.args.query ?? ""), Number(request.args.offset ?? 0), Number(request.args.limit ?? 20), current.locked); break;
        case "describe_dataset": {
          const datasetId = String(request.args.datasetId ?? "");
          await ensureDataset(datasetId, current.locked);
          result = describeDataset(datasetId, current.locked) as unknown as Record<string, unknown>;
          break;
        }
        case "query_records": {
          const input = request.args as unknown as QueryRecordsInput;
          if (!analysis.current) throw new Error("ANALYSIS_SESSION_UNAVAILABLE");
          result = await analysis.current.queryRecords(input);
          break;
        }
        case "plan_data_access": {
          if (!analysis.current) throw new Error("ANALYSIS_SESSION_UNAVAILABLE");
          result = await analysis.current.planDataAccess(request.args as unknown as Parameters<ResearchAnalysisSession["planDataAccess"]>[0]);
          break;
        }
        case "materialize_data": {
          if (!analysis.current) throw new Error("ANALYSIS_SESSION_UNAVAILABLE");
          result = await analysis.current.materializeData(request.args.planId);
          break;
        }
        case "import_warehouse_result": {
          if (!analysis.current) throw new Error("ANALYSIS_SESSION_UNAVAILABLE");
          result = await analysis.current.importWarehouseResult(request.args);
          break;
        }
        case "describe_layer": {
          const layer = describeLayer(String(request.args.layerKey ?? ""), discoveryContext);
          if (!layer) throw new Error("LAYER_NOT_FOUND");
          result = layer as unknown as Record<string, unknown>;
          break;
        }
        case "layer_details": result = await describeLayers(request.args.layerKeys as string[], discoveryContext); break;
        case "layer_controls": result = describeLayerControls(String(request.args.layerKey ?? ""), current.locked); break;
        case "geocode_address": {
          const lookup = new AbortController();
          locationLookup.current = lookup;
          try { result = { ...await resolveOfflineLocation(String(request.args.query ?? ""), lookup.signal) }; }
          finally { if (locationLookup.current === lookup) locationLookup.current = null; }
          break;
        }
        case "route_distance": {
          if (!networkProvider.current) throw new Error("NETWORK_PROVIDER_UNAVAILABLE");
          result = await networkProvider.current.routeDistance(request.args) as unknown as Record<string, unknown>;
          break;
        }
        case "walking_isochrone": {
          if (!networkProvider.current) throw new Error("NETWORK_PROVIDER_UNAVAILABLE");
          const outcome = await networkProvider.current.walkingIsochrone(request.args);
          if (outcome.status === "READY" && "contours" in outcome) {
            if (!analysis.current) throw new Error("ANALYSIS_SESSION_UNAVAILABLE");
            result = analysis.current.storeWalkingIsochrone(outcome);
          } else result = outcome as unknown as Record<string, unknown>;
          break;
        }
        case "find_places": result = findPlaces(String(request.args.query ?? ""), Number(request.args.limit ?? 10)); break;
        default: {
          if (!analysis.current || !ANALYSIS_OPERATIONS.has(request.operation as AnalysisQueryOperation)) throw new Error("MAP_EXPLORATION_OPERATION_UNSUPPORTED");
          result = request.operation === "spatial_query" && ["line_buffer", "surface_intersection", "measure_geometry"].includes(String(request.args.predicate))
            ? await analysis.current.executeGeometry(request.args)
            : analysis.current.execute(request.operation as AnalysisQueryOperation, request.args);
        }
      }
      if (epoch !== connectionEpoch.current) throw new Error("SESSION_REVOKED");
      if (result && ["query_records", "spatial_query", "aggregate_by_area", "compare_regions", "create_analysis_scope", "route_distance", "walking_isochrone"].includes(request.operation)) {
        const evidenceItem = researchEvidence(request.operation, request.args, result);
        setEvidence(items => [evidenceItem, ...items].slice(0, 6));
        result = { ...result, researchScope: { operation: evidenceItem.operation, scope: evidenceItem.scope, sources: evidenceItem.sources } };
      }
      return result!;
    }, () => { setMessage("讀取服務暫時無法同步，請檢查連線。"); setActivity({ phase: "error", title: "連線暫時中斷", detail: "目前地圖會保留，請確認連線後繼續。" }); }, event => {
      const next = activityForOperation(event.request.operation, event.request.args);
      if (!EXPLORATION_OPERATIONS.has(event.request.operation) || !next) return;
      if (event.phase === "started") { setActivity(next); return; }
      if (!event.result?.ok) { setActivity({ phase: "error", title: "這一步沒有完成", detail: analysisErrorMessage(event.result && !event.result.ok ? event.result.error : "UNKNOWN") }); return; }
      setActivity(completedActivityForOperation(event.request.operation, event.result.data));
    }, health => {
      const messages = {
        retrying: { phase: "complete" as const, title: "同步稍慢，正在重試", detail: "目前地圖會保留。" },
        offline: { phase: "error" as const, title: "暫時無法同步", detail: "已連續多次失敗，網站會繼續嘗試連線。" },
        recovered: { phase: "ready" as const, title: "同步已恢復", detail: "可以繼續探索地圖。" },
        paused: { phase: "complete" as const, title: "操作已暫停", detail: "可在本地 Agent 面板恢復操作。" },
        auth: { phase: "error" as const, title: "需要重新確認連線", detail: "請在本地 Agent 面板確認登入與配對狀態。" },
        cancelled: { phase: "complete" as const, title: "這次查詢已取消或逾時", detail: "可以重新提出查詢；目前地圖會保留。" },
      };
      setMessage(health.state === "recovered" ? "同步已恢復。" : `${messages[health.state].title}（${health.code}）`);
      setActivity(messages[health.state]);
    }) : null;
    responder.current?.start();
  }, [clearAnalysisPresentation, render]);
  const disconnect = useCallback(() => { setEvidence([]); connect(null); }, [connect]);
  const receive = useCallback((state: StudyState) => { if (state.paused) setActivity({ phase: "complete", title: "操作已暫停", detail: "目前地圖會保留。" }); controller.current?.receive(state); }, []);
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
    const unsubscribeParams = layerParamsStore.subscribe(manual);
    const map = props.map;
    const started = (event: { originalEvent?: unknown }) => {
      if (!event.originalEvent || !controller.current) return;
      // A gesture interrupts only the movement currently in flight. Keep the
      // user's follow preference so the next explicit Agent command can move
      // the map again without requiring another checkbox click.
      ++generation.current;
      controller.current?.beginManual();
      if (map) cancelResearchMotion(map);
      setActivity({ phase: "complete", title: "已保留目前視角", detail: followingRef.current ? "已停止這次移動；下一個 Agent 動作仍會繼續跟隨。" : "跟隨已由你關閉；下一個 Agent 動作會保留視角。" });
    };
    const moved = (event: { originalEvent?: unknown }) => { if (event.originalEvent) manual(); };
    map?.on("movestart", started); map?.on("moveend", moved);
    return () => { unsubscribe(); unsubscribeParams(); map?.off("movestart", started); map?.off("moveend", moved); if (map) cancelResearchMotion(map); };
  }, [props.map]);
  useEffect(() => {
    const map = props.map;
    if (!map) return;
    // I1 hover: mouse-only (touch gets neither tip nor hover outline); imperative so a mousemove
    // never re-renders this panel. Install/redraw already drops the feature-state highlight.
    const hoverTip = supportsAnalysisHover() ? createAnalysisHoverTip(map.getContainer()) : null;
    const endHover = () => { hoverTip?.hide(); clearAnalysisHover(map); };
    const hover = (event: MapMouseEvent) => {
      if (!hoverTip) return;
      const layers = analysisResultHoverLayerIds(map, presentedAnalysisRef.current.length);
      const feature = layers.length ? map.queryRenderedFeatures(event.point, { layers }).find(candidate => analysisFeatureTarget(candidate)) : undefined;
      const target = feature ? analysisFeatureTarget(feature) : null;
      if (!feature || !target) { endHover(); return; }
      setAnalysisHover(map, target);
      hoverTip.show(event.point, analysisHoverLabel(feature.properties ?? {}), latest.current.isDarkTheme === false);
    };
    const redraw = () => {
      endHover();
      if (!map.isStyleLoaded()) return;
      const resultIds = visibleResultIds(previous.current?.results);
      const allResultIds = previous.current?.results?.items.map(item => item.resultId) ?? [];
      if (allResultIds.length && analysis.current && allResultIds.every(resultId => analysis.current!.hasResult(resultId))) {
        // Read fresh via the ref (not a dep of this effect) so a style/basemap switch — which is
        // exactly what triggers "style.load" below — recolours with the *new* theme, not a stale one.
        const theme = vizThemeForBasemap(latest.current.isDarkTheme);
        const visibleIds = new Set(resultIds);
        const available = analysis.current.presentable(allResultIds);
        const installed = installAnalysisResults(map, available.filter(result => visibleIds.has(result.resultId)), analysisOpacityRef.current, theme, { outlineOnly: analysisOutlineOnlyRef.current });
        presentedAnalysisRef.current = installed; setPresentedAnalysis(installed);
        applyAnalysisSelection();
        setAvailableAnalysis(describeAnalysisResults(available, theme));
      } else {
        removeAnalysisResults(map);
        presentedAnalysisRef.current = []; setPresentedAnalysis([]);
        setAvailableAnalysis([]);
      }
    };
    const click = (event: MapMouseEvent) => {
      const layers = analysisResultInteractiveLayerIds(map, presentedAnalysisRef.current.length);
      const overlaps = researchResultPopupOverlaps(layers.length ? map.queryRenderedFeatures(event.point, { layers }) : []);
      // No hit: the App's own map click handler owns clearing or replacing the docked panel.
      if (!overlaps.features.length) return;
      analysisSelectionRef.current = overlaps.features.map(feature => analysisSelectionOf(feature)).filter((selection): selection is AnalysisSelection => selection !== null);
      applyAnalysisSelection();
      // Registered after useMapInteraction's click listener (map is only passed once prepared),
      // so within one batched click this panel wins over its synchronous "blank click" clear.
      latest.current.onAnalysisResultFeature?.(researchResultPanelProperties(
        overlaps,
        resultId => presentedAnalysisRef.current.find(result => result.resultId === resultId),
        datasetId => describeDataset(datasetId, latest.current.locked).label,
      ));
    };
    let cancelStyleRestore: (() => void) | null = null;
    const redrawAfterStyleLoad = () => {
      redraw();
      // MapView rebuilds its own overlays in the same style cycle. Check again
      // once that work has settled, but only reinstall if the transient result
      // layers really did not survive; do not issue a new analysis query.
      cancelStyleRestore?.();
      cancelStyleRestore = scheduleAnalysisResultStyleRestore(map, redraw, () => {
        const presentation = readAnalysisResultPresentation(map, presentedAnalysisRef.current, resultCollectionRef.current);
        return presentation.sourcesReady && presentation.layersReady;
      });
    };
    redraw(); map.on("style.load", redrawAfterStyleLoad); map.on("click", click);
    if (hoverTip) { map.on("mousemove", hover); map.on("mouseout", endHover); map.on("movestart", endHover); }
    return () => {
      cancelStyleRestore?.(); map.off("style.load", redrawAfterStyleLoad); map.off("click", click);
      if (hoverTip) { map.off("mousemove", hover); map.off("mouseout", endHover); map.off("movestart", endHover); endHover(); hoverTip.destroy(); }
      latest.current.onAnalysisResultFeature?.(null); removeAnalysisResults(map);
    };
  }, [props.map]);
  // G1/G2: the analysis legend lives in the 「圖例」 panel (top group); compact while the docked panel is open.
  useEffect(() => {
    publishAnalysisLegend({
      // Source line = the dataset descriptor's name (not the result title, which is often the same text).
      entries: analysisLegendEntries(presentedAnalysis, datasetId => {
        const label = researchResultDatasetLabel(datasetId, null, id => describeDataset(id, latest.current.locked).label);
        return label === UNNAMED_DATASET_LABEL ? null : label;
      }),
      compact: !!props.analysisResultSelected,
    });
  }, [presentedAnalysis, props.analysisResultSelected]);
  useEffect(() => () => publishAnalysisLegend({ entries: [], compact: false }), []);
  // I2: closing the docked panel, or selecting another layer's feature, restores every result.
  useEffect(() => {
    if (props.analysisResultSelected || !analysisSelectionRef.current.length) return;
    analysisSelectionRef.current = [];
    applyAnalysisSelection();
  }, [props.analysisResultSelected, applyAnalysisSelection]);
  useEffect(() => {
    const resultIds = resultCollection?.items.map(item => item.resultId) ?? [];
    if (!resultIds.length) return;
    const timer = window.setInterval(() => {
      if (!analysis.current || resultIds.some(resultId => !analysis.current!.hasResult(resultId))) {
        clearAnalysisPresentation(true);
        setMessage("分析結果已過期、移除或失去授權；舊 overlay 已清除。");
        setActivity({ phase: "complete", title: "已清除過期結果", detail: "可重新執行分析以取得目前版本。" });
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [clearAnalysisPresentation, resultCollection, setActivity]);
  useEffect(() => () => { controller.current?.stop(); responder.current?.stop(); locationLookup.current?.abort("SESSION_REVOKED"); locationLookup.current = null; latest.current.onAnalysisResultFeature?.(null); if (latest.current.map) removeAnalysisResults(latest.current.map); ++generation.current; ++connectionEpoch.current; }, []);
  const panelOpen = props.embedded || open;
  const showToggle = props.showToggle ?? !props.embedded;
  return <div hidden={props.uiHidden} className={`main-map-agent${props.embedded ? " main-map-agent--embedded" : ""}${showToggle ? "" : " main-map-agent--persistent"}${props.isDarkTheme === false ? " main-map-agent--light" : ""}`}>
    {props.map && createPortal(<div className={`research-activity-position${props.isDarkTheme === false ? " research-activity-position--light" : ""}`} style={props.uiHidden ? { display: "none" } : undefined}><ResearchActivity activity={activity} history={activityHistory.slice(1)} /></div>, props.map.getContainer())}
    {showToggle && <button className="main-map-agent-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>本地 Agent</button>}
    <div className="main-map-agent-panel" data-viewport-occluder="research-agent" hidden={!panelOpen}>
      {!props.embedded && <PanelHeader className="main-map-agent-heading" eyebrow="研究" title="與 Agent 協作" onClose={() => setOpen(false)} borderColor="var(--agent-border)" mutedColor="var(--agent-muted)" textColor="var(--agent-text)" />}
      <ResearchConnection surface="map" onConnection={connect} onDisconnect={disconnect} onState={receive} onReady={() => { followingRef.current = true; setFollowing(true); requestLayerExploration(); setOpen(false); setActivity({ phase: "ready", title: "已連線，可以開始探索", detail: "預設會跟隨 Agent；手動查看地圖後，下一個動作仍可調整圖層與視角。" }); }} />
      <div className="agent-panel-body">
      <label className="agent-follow-setting">
        <input type="checkbox" checked={following} onChange={event => changeFollowing(event.target.checked)} />
        <span>跟隨 Agent 視角<small>可隨時拖曳地圖，停止這次移動。</small></span>
      </label>
      <p className="agent-session-status" role="status">{message.replace(/^r\d+\s+/, "")}</p>
      {resultCollection && <section className="agent-analysis-results" aria-label="分析結果集合">
        <h3>本次分析圖層 <span className="agent-section-count">{resultCollection.items.length}</span></h3>
        <p>{presentedAnalysis.reduce((sum, result) => sum + result.featureCount, 0)} 筆紀錄已顯示 · 僅含本次分析結果</p>
        {resultCollection.groups.length > 0 && <fieldset className="agent-analysis-groups">
          <legend>群組</legend>
          {resultCollection.groups.map(group => <label key={group.groupId} className="agent-analysis-toggle">
            <input type="checkbox" checked={group.visible} onChange={event => updateResultCollection(collection => ({ ...collection, groups: collection.groups.map(candidate => candidate.groupId === group.groupId ? { ...candidate, visible: event.target.checked } : candidate) }))} />
            <span>{group.label}</span>
          </label>)}
        </fieldset>}
        <ul>{resultCollection.items.map((item, index) => {
          const result = availableAnalysis.find(candidate => candidate.resultId === item.resultId);
          const rendered = presentedAnalysis.find(candidate => candidate.resultId === item.resultId);
          const group = item.groupId ? resultCollection.groups.find(candidate => candidate.groupId === item.groupId) : null;
          return <li key={item.resultId} className="agent-analysis-result-item">
            <div className="agent-analysis-row-main">
              <span className={`agent-analysis-swatch agent-analysis-swatch--${(rendered?.geometryType ?? result?.geometryType ?? "none").toLowerCase()}`} style={{ "--analysis-result-color": rendered?.color ?? result?.color ?? "#6b7280" } as CSSProperties} aria-hidden="true" />
              <div className="agent-analysis-row-label"><strong>{result?.displayLabel ?? "分析結果"}</strong><small>{rendered ? `${rendered.featureCount} 筆 · ${rendered.geometryType}` : "目前未顯示"}{group ? ` · ${group.label}` : ""}</small>
                <label className="agent-analysis-opacity">透明度
                  <Slider ariaLabel={`${result?.displayLabel ?? "分析結果"}透明度`} min={0.15} max={1} step={0.05} value={analysisOpacity.byResult[item.resultId] ?? analysisOpacity.defaultOpacity} onChange={value => { setAnalysisOpacityValue(current => ({ ...current, byResult: { ...current.byResult, [item.resultId]: value } })); if (props.map) setAnalysisOpacity(props.map, presentedAnalysis, item.resultId, value); }} />
                </label>
                {rendered?.compareTable && <WarehouseCompareTableView table={rendered.compareTable} onSelectColumn={column => {
                  if (!props.map) return;
                  let point: Record<string, unknown> | undefined;
                  try { point = analysis.current?.presentable([item.resultId])[0]?.rows.find(row => row._compare_index === column.index); } catch { point = undefined; }
                  const geometry = point?.geometry as { type?: string; coordinates?: [number, number] } | undefined;
                  if (geometry?.type === "Point" && Array.isArray(geometry.coordinates)) props.map.flyTo({ center: geometry.coordinates, zoom: Math.max(props.map.getZoom(), 14) });
                }} />}
              </div>
              <LayerToggleSwitch label={`顯示 ${result?.displayLabel ?? "分析結果"}`} on={item.visible} onChange={() => updateResultCollection(collection => ({ ...collection, items: collection.items.map(candidate => candidate.resultId === item.resultId ? { ...candidate, visible: !item.visible } : candidate) }))} ACCENT_TOGGLE={props.isDarkTheme === false ? "#1f2937" : "#fff"} TOGGLE_OFF={props.isDarkTheme === false ? "#d1d5db" : "#4b5563"} TOGGLE_KNOB_ON={props.isDarkTheme === false ? "#fff" : "#1a1a1a"} />
            </div>
            <span className="agent-analysis-order" aria-label={`${item.resultId} 排序`}>
              <button aria-label="往上移動" disabled={index === 0} onClick={() => updateResultCollection(collection => ({ ...collection, items: collection.items.map((candidate, candidateIndex, items) => candidateIndex === index - 1 ? items[index]! : candidateIndex === index ? items[index - 1]! : candidate) }))}>↑</button>
              <button aria-label="往下移動" disabled={index === resultCollection.items.length - 1} onClick={() => updateResultCollection(collection => ({ ...collection, items: collection.items.map((candidate, candidateIndex, items) => candidateIndex === index ? items[index + 1]! : candidateIndex === index + 1 ? items[index]! : candidate) }))}>↓</button>
            </span>
          </li>;
        })}</ul>
        <button className="agent-clear-results" onClick={() => clearAnalysisPresentation(true)}>清除本次圖層</button>
      </section>}
      {!resultCollection && <section className="agent-empty-results"><h3>本次分析圖層</h3><p>在 Codex 提出想了解的地點或主題。<br />Agent 產生的分析圖層會顯示在這裡。</p></section>}
      {evidence.length > 0 && <details className="agent-evidence-disclosure"><summary>分析依據與來源 <span>{evidence.length}</span></summary><ResearchEvidencePanel evidence={evidence} /></details>}
      </div>
    </div>
  </div>;
}
