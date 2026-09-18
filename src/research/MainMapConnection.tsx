import { describeLayerStatistics, summarizeLayer, type LayerSummaryInput } from "./layerStatistics";
import { resolveViewportCamera, resolveViewportContext } from "./viewportFit";
import type { TimelineAdapter } from "./timelineControl";
import { requestLayerExploration } from "./explorationNavigation";
import { createPortal } from "react-dom";
import { ResearchActivity } from "./ResearchActivityCard";
import { activityForOperation, appendActivity, type Activity } from "./researchActivity";
import { cancelResearchMotion, moveResearchCamera } from "./researchMotion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { MapBridge } from "../chat/types";
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import { layerParamsStore } from "../state/layerParamsStore";
import { ResearchConnection } from "./ResearchConnection";
import { StudyController } from "./StudyController";
import type { BridgeConnectionContext, Scene, StudyState, BrowserQuery } from "./bridgeClient";
import { applyMainMapLayers, captureLayerOverrides } from "./mainMapLayers";
import { QueryResponder } from "./QueryResponder";
import { loadingRegistry } from "../lib/loadingRegistry";
import { describeLayers } from "./layerExploration";
import { describeLayer, discoverLayers, findPlaces } from "./discovery";
import { applyLayerControl, describeLayerControls, validateLayerControl } from "./layerControls";
import { resolveOfflineLocation } from "./addressLookup";
import "./mainMapConnection.css";

type Props = { timeline?: TimelineAdapter; bridge: MapBridge; map: MapboxMap | null; labels: Record<string, string>; locked: ReadonlySet<string>; selection?: [number, number] | null; embedded?: boolean };
const EXPLORATION_OPERATIONS = new Set<BrowserQuery["operation"]>(["describe_layer_statistics", "summarize_layer", "search_layers", "describe_layer", "layer_details", "layer_controls", "map_context", "find_places", "geocode_address", "time_context"]);
/** First-stage adapter: pairing can only search, explain, select, toggle, and move the map. */
export function MainMapConnection(props: Props) {
  const [open, setOpen] = useState(false);
  const [activityHistory, setActivityHistory] = useState<Activity[]>([]);
  const activity = activityHistory[0] ?? null;
  const setActivity = useCallback((next: Activity | null | ((current: Activity | null) => Activity | null)) => {
    setActivityHistory(history => appendActivity(history, typeof next === "function" ? next(history[0] ?? null) : next));
  }, []);
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  const [message, setMessage] = useState("先配對，再到 Codex 說出想探索的主題。");
  const latest = useRef(props); latest.current = props;
  const controller = useRef<StudyController | null>(null);
  const responder = useRef<QueryResponder | null>(null);
  const connectionEpoch = useRef(0);
  const applying = useRef(false);
  const previous = useRef<Scene | null>(null);
  const generation = useRef(0);
  const capture = (): Scene => {
    const camera = latest.current.bridge.getCamera();
    return { camera: { center: [((camera.lng + 180) % 360 + 360) % 360 - 180, Math.max(-85, Math.min(85, camera.lat))], zoom: Math.max(0, Math.min(18, camera.zoom)) }, resultMode: "empty", layers: captureLayerOverrides(previous.current?.layers, latest.current.bridge.getVisibleLayerKeys()), layerControl: null, framing: null, timeline: null };
  };
  const render = useCallback(async (scene: Scene, revision: number, patch?: Partial<Scene>): Promise<"ready" | "error"> => {
    const { bridge, map, labels, locked } = latest.current;
    if (!map || !map.isStyleLoaded()) throw new Error("MAP_NOT_READY");
    if (scene.resultMode !== "empty" || scene.nearby != null || scene.results != null || scene.focus != null) throw new Error("MAP_EXPLORATION_ONLY");
    // Pairing must never reset the user's camera or visible layers.
    if (revision === 0) { previous.current = scene; return "ready"; }
    const framingChanged = !!scene.framing && (!!patch?.framing || JSON.stringify(scene.framing) !== JSON.stringify(previous.current?.framing ?? null));
    const cameraChanged = framingChanged || !!patch?.camera || JSON.stringify(scene.camera) !== JSON.stringify(previous.current?.camera);
    const run = ++generation.current;
    let movement: Promise<boolean> = Promise.resolve(true);
    setActivity({ phase: "presenting", title: "正在同步地圖" });
    applying.current = true;
    try {
      if (scene.layerControl && JSON.stringify(scene.layerControl) !== JSON.stringify(previous.current?.layerControl ?? null)) validateLayerControl(scene.layerControl, locked);
      const newlyEnabled = Object.entries(scene.layers ?? {}).filter(([key, on]) => on && previous.current?.layers?.[key] !== true).map(([key]) => key);
      applyMainMapLayers(scene.layers ?? {}, new Set(Object.keys(labels)), locked, bridge);
      if (newlyEnabled.length) requestLayerExploration(newlyEnabled);
      if (scene.layerControl && JSON.stringify(scene.layerControl) !== JSON.stringify(previous.current?.layerControl ?? null)) applyLayerControl(scene.layerControl, locked);
      if (scene.timeline && patch?.timeline) {
        if (!latest.current.timeline) throw new Error("TIMELINE_UNAVAILABLE");
        await latest.current.timeline.apply(scene.timeline);
      }
      if (cameraChanged && followingRef.current) {
        // Measure after panel selection and activity card have committed to layout.
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        if (run !== generation.current || !followingRef.current) return "error";
        movement = moveResearchCamera(map, framingChanged && scene.framing ? resolveViewportCamera(map, scene.framing) : scene.camera);
      }
      else if (cameraChanged) movement = Promise.resolve(false);
      previous.current = scene;
    } finally { applying.current = false; }
    const cameraReady = await movement;
    // This receipt confirms switch state only. Loading/coverage remains the map's own UI.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (run !== generation.current) return "error";
    if (patch?.timeline) {
      const observed = latest.current.timeline?.getContext();
      const requested = patch.timeline;
      if (!observed || observed.mode !== requested.mode || (requested.speed !== undefined && observed.speed !== requested.speed) || (requested.playing !== undefined && observed.playing !== requested.playing) || (requested.mode === "replay" && observed.playing === false && (typeof observed.currentTime !== "number" || Math.abs(observed.currentTime - requested.time) > 1))) throw new Error("TIMELINE_READBACK_MISMATCH");
    }
    const visible = new Set(bridge.getVisibleLayerKeys());
    const matches = cameraReady && Object.entries(scene.layers ?? {}).every(([key, on]) => visible.has(key) === on);
    setMessage(matches ? `r${revision} 地圖設定已同步；資料載入狀態請看原本地圖提示。` : "圖層狀態有衝突，請重新確認。");
    setActivity({ phase: matches ? "ready" : "error", title: matches ? "地圖已更新" : !cameraReady && !followingRef.current ? "已保留你的視角" : "呈現尚未完成", detail: !cameraReady && !followingRef.current ? "自動帶鏡頭已暫停；開啟「跟隨 Agent」可恢復後續動作。" : undefined });
    return matches ? "ready" : "error";
  }, []);
  const connect = useCallback((context: BridgeConnectionContext | null) => {
    controller.current?.stop(); responder.current?.stop(); ++generation.current; ++connectionEpoch.current; previous.current = null; setActivity(null);
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
          result = request.operation === "describe_layer_statistics" ? await describeLayerStatistics({ layerKey }) : await summarizeLayer(request.args as unknown as LayerSummaryInput);
          break;
        }
        case "time_context":
          if (!current.timeline) throw new Error("TIMELINE_UNAVAILABLE");
          result = current.timeline.getContext(); break;
        case "map_context":
          if (!current.map?.isStyleLoaded()) throw new Error("MAP_NOT_READY");
          result = { observedAt: new Date().toISOString(), camera: current.bridge.getCamera(), viewport: resolveViewportContext(current.map), time: current.timeline?.getContext() ?? null, following: followingRef.current, selection: current.selection ?? null, selectionSource: current.selection ? "feature" : null, visibleLayerKeys: visible.slice(0, 100), totalVisible: visible.length, truncated: visible.length > 100, loading: loadingRegistry.snapshot().slice(0, 20).map(task => task.label), totalLoading: loadingRegistry.snapshot().length, loadingTruncated: loadingRegistry.snapshot().length > 20, dataReadiness: "not_inferred_from_visibility" };
          break;
        case "search_layers": result = discoverLayers(String(request.args.query ?? ""), Number(request.args.offset ?? 0), Number(request.args.limit ?? 20), discoveryContext); break;
        case "describe_layer": {
          const layer = describeLayer(String(request.args.layerKey ?? ""), discoveryContext);
          if (!layer) throw new Error("LAYER_NOT_FOUND");
          result = layer as unknown as Record<string, unknown>;
          break;
        }
        case "layer_details": result = await describeLayers(request.args.layerKeys as string[], discoveryContext); break;
        case "layer_controls": result = describeLayerControls(String(request.args.layerKey ?? ""), current.locked); break;
        case "geocode_address": result = { ...await resolveOfflineLocation(String(request.args.query ?? "")) }; break;
        case "find_places": result = findPlaces(String(request.args.query ?? ""), Number(request.args.limit ?? 10)); break;
      }
      if (epoch !== connectionEpoch.current) throw new Error("SESSION_REVOKED");
      return result!;
    }, () => { setMessage("讀取服務暫時無法同步，請檢查連線。"); setActivity({ phase: "error", title: "連線暫時中斷", detail: "目前地圖會保留，請確認連線後繼續。" }); }, event => {
      const next = activityForOperation(event.request.operation, event.request.args);
      if (!EXPLORATION_OPERATIONS.has(event.request.operation) || !next) return;
      if (event.phase === "started") { setActivity(next); return; }
      if (!event.result?.ok) { setActivity({ phase: "error", title: "這一步沒有完成", detail: "資料可能暫時無法讀取；這不代表沒有符合的結果。" }); return; }
      const data = event.result.data;
      const count = typeof data.totalMatched === "number" ? data.totalMatched : null;
      setActivity({ phase: "complete", title: event.request.operation === "search_layers" ? count === 0 ? "這次搜尋沒有找到圖層" : "已找到相關圖層" : event.request.operation === "layer_details" || event.request.operation === "describe_layer" ? "圖層說明已備妥" : "這一步已完成", detail: count === null ? "資料已回傳給 Agent，可繼續探索。" : event.request.operation === "summarize_layer" ? `符合 ${count} 筆來源紀錄；範圍、粒度與缺值已一併回傳。` : `找到 ${count} 個候選圖層，Agent 正在整理適合的選項。` });
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
  }, [render]);
  const disconnect = useCallback(() => connect(null), [connect]);
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
      followingRef.current = false; setFollowing(false); ++generation.current;
      controller.current?.beginManual();
      if (map) cancelResearchMotion(map);
      setActivity({ phase: "complete", title: "已保留你的視角", detail: "你正在查看地圖，Agent 已暫停自動帶鏡頭。" });
    };
    const moved = (event: { originalEvent?: unknown }) => { if (event.originalEvent) manual(); };
    map?.on("movestart", started); map?.on("moveend", moved);
    return () => { unsubscribe(); unsubscribeParams(); map?.off("movestart", started); map?.off("moveend", moved); if (map) cancelResearchMotion(map); };
  }, [props.map]);
  useEffect(() => () => { controller.current?.stop(); responder.current?.stop(); ++generation.current; ++connectionEpoch.current; }, []);
  const panelOpen = props.embedded || open;
  return <div className={`main-map-agent${props.embedded ? " main-map-agent--embedded" : ""}`}>
    {props.map && createPortal(<div className="research-activity-position"><ResearchActivity activity={activity} history={activityHistory.slice(1)} /></div>, props.map.getContainer())}
    {!props.embedded && <button className="main-map-agent-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>本地 Agent</button>}
    <div className="main-map-agent-panel" hidden={!panelOpen}>
      {!props.embedded && <h2>連接這張地圖</h2>}
      <ResearchConnection surface="map" onConnection={connect} onDisconnect={disconnect} onState={receive} onReady={() => { requestLayerExploration(); setOpen(false); setActivity({ phase: "ready", title: "已連線，可以開始探索", detail: "到 Codex 說出你想了解的主題，圖層與地圖會隨操作同步。" }); }} />
      <label className="agent-follow-setting">
        <input type="checkbox" checked={following} onChange={event => changeFollowing(event.target.checked)} />
        <span>跟隨 Agent<small>允許 Agent 帶你移動視角；手動拖曳地圖時會暫停跟隨。</small></span>
      </label>
      <p role="status">{message}</p>
    </div>
  </div>;
}
