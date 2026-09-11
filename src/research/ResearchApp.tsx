import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { type Map as ResearchMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { withLoading } from "../lib/loadingRegistry";
import { useLoadingTasks } from "../hooks/useLoadingTasks";
import { coordinateCanvas } from "./basemap";
import { installResult, removeResult, RESULT_HOST, RESULT_LAYER_IDS } from "./resultOverlay";
import { awaitSceneIdle, type ScenePhase } from "./sceneReadiness";
import { MAX_RESULT_BYTES, parseResult } from "./resultValidator";
import type { ResearchResult } from "./contracts/result-validator.mjs";
import { ResearchConnection } from "./ResearchConnection";
import type { BridgeConnectionContext, Scene, StudyState } from "./bridgeClient";
import { StudyController } from "./StudyController";
import fixture from "./contracts/fixture.json";
import "./research.css";

const statusLabel: Record<string, string> = { valid: "有效", partial: "部分", unknown: "未知", suppressed: "隱匿", undefined: "未定義", not_comparable: "不可比較", error: "錯誤", complete: "完整", none: "無覆蓋", not_applicable: "不適用", fresh: "符合時效", stale: "過時" };
const phaseLabel: Record<ScenePhase, string> = { empty: "空白畫布", loading: "正在呈現", ready: "呈現完成", error: "呈現失敗／逾時" };

/** Deliberately independent of App, Chat, auth credentials and permanent layer stores. */
export function ResearchApp() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<ResearchMap | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [opacity, setOpacity] = useState<number>(RESULT_HOST.opacity);
  const [phase, setPhase] = useState<ScenePhase>("empty");
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [view, setView] = useState<"map" | "table">("map");
  const [paired, setPaired] = useState(false);
  const mounted = useRef(true);
  const controller = useRef<StudyController | null>(null);
  const sceneRef = useRef<Scene>({ camera: { center: [121.525, 25.025], zoom: 12 }, resultMode: "empty" });
  const programmaticCamera = useRef(false);
  const userCameraGesture = useRef(false);
  const renderCancel = useRef<(() => void) | null>(null);
  const resultRef = useRef<ResearchResult | null>(null);
  const opacityRef = useRef<number>(RESULT_HOST.opacity);
  const loading = useLoadingTasks().filter(t => t.id.startsWith("research:"));

  const renderScene = useCallback((scene: Scene, nextRevision: number): Promise<"ready" | "error"> => {
    if (scene.nearby) throw new Error("MAIN_MAP_REQUIRED");
    if (scene.layers && Object.keys(scene.layers).length) throw new Error("MAIN_MAP_REQUIRED");
    const instance = map.current;
    if (!instance || !instance.isStyleLoaded()) throw new Error("MAP_NOT_READY");
    renderCancel.current?.();
    const nextResult = scene.resultMode === "synthetic" ? parseResult(JSON.stringify(fixture)) : null;
    sceneRef.current = scene; resultRef.current = nextResult;
    setResult(nextResult); setSelected(null); setPoint(null); setRevision(nextRevision);
    programmaticCamera.current = true;
    try {
      instance.jumpTo({ center: scene.camera.center, zoom: scene.camera.zoom });
      if (nextResult?.geojson) installResult(instance, nextResult.geojson as FeatureCollection, opacityRef.current);
      else removeResult(instance);
    } finally { programmaticCamera.current = false; }
    return new Promise(resolve => {
      const cancel = awaitSceneIdle(instance, nextRevision, next => {
        setPhase(next === "ready" && !nextResult ? "empty" : next);
        if (next === "ready" || next === "error") resolve(next);
      });
      renderCancel.current = () => { cancel(); resolve("error"); };
    });
  }, []);
  const handleBridgeState = useCallback((state: StudyState) => { controller.current?.receive(state); }, []);
  const disconnect = useCallback(() => {
    controller.current?.stop(); controller.current = null;
    renderCancel.current?.(); setPaired(false);
  }, []);
  const connect = useCallback((context: BridgeConnectionContext | null) => {
    controller.current?.stop();
    controller.current = context ? new StudyController(context, renderScene, () => setError("同步未完成，已停止套用後續指令；請檢查連線後重新配對。")) : null;
    setPaired(context !== null);
  }, [renderScene]);

  useEffect(() => {
    mounted.current = true;
    if (!container.current) return;
    let instance: ResearchMap;
    try {
      instance = new maplibregl.Map({ container: container.current, style: coordinateCanvas(), center: sceneRef.current.camera.center, zoom: 12, minZoom: 0, maxZoom: 18, renderWorldCopies: false, attributionControl: false });
    } catch {
      setError("地圖無法啟動，請確認瀏覽器支援 WebGL。表格仍可使用。"); setPhase("error");
      return () => { mounted.current = false; };
    }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    instance.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    instance.on("style.load", () => setStyleVersion(n => n + 1));
    instance.on("error", () => { setPhase("error"); setError("地圖載入失敗；目前畫面不能當作完整呈現。"); });
    instance.on("click", event => {
      const layers = RESULT_LAYER_IDS.filter(id => instance.getLayer(id));
      const hit = layers.length ? instance.queryRenderedFeatures(event.point, { layers })[0] : undefined;
      setSelected(hit?.properties ?? null); setPoint([event.lngLat.lng, event.lngLat.lat]);
    });
    instance.on("movestart", event => {
      if (!programmaticCamera.current && event.originalEvent) { userCameraGesture.current = true; controller.current?.beginManual(); }
    });
    instance.on("moveend", () => {
      if (programmaticCamera.current || !userCameraGesture.current) return;
      userCameraGesture.current = false;
      const center = instance.getCenter();
      sceneRef.current = { ...sceneRef.current, camera: { center: [Math.max(-180, Math.min(180, center.lng)), Math.max(-85, Math.min(85, center.lat))], zoom: instance.getZoom() } };
      controller.current?.manual(sceneRef.current);
    });
    const observer = new ResizeObserver(() => instance.resize()); observer.observe(container.current);
    return () => {
      mounted.current = false; controller.current?.stop(); renderCancel.current?.();
      observer.disconnect(); instance.remove(); map.current = null;
    };
  }, []);

  // Local preview has its own render cycle; paired revisions are owned by StudyController.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !styleVersion || paired) return;
    renderCancel.current?.();
    const cancel = awaitSceneIdle(instance, revision, next => setPhase(next === "ready" && !result ? "empty" : next));
    renderCancel.current = cancel;
    try {
      if (result?.geojson) installResult(instance, result.geojson as FeatureCollection, opacity);
      else removeResult(instance);
    } catch { cancel(); setPhase("error"); setError("成果無法呈現；請檢查幾何與瀏覽器狀態。"); }
    return cancel;
  }, [result, opacity, revision, styleVersion, paired]);
  useEffect(() => { map.current?.resize(); }, [view]);

  const load = async (file?: File) => {
    if (controller.current) {
      if (file) return;
      sceneRef.current = { ...sceneRef.current, resultMode: "synthetic" };
      controller.current.manual(sceneRef.current); return;
    }
    setBusy(true); setError("");
    try {
      const text = await withLoading("research:validate", "驗證合成成果", (async () => {
        if (file) { if (file.size > MAX_RESULT_BYTES) throw new Error("RESULT_TOO_LARGE：成果不得超過 5 MiB。"); return file.text(); }
        return JSON.stringify(fixture);
      })());
      const value = parseResult(text);
      if (!mounted.current || controller.current) return;
      resultRef.current = value; sceneRef.current = { ...sceneRef.current, resultMode: "synthetic" };
      setResult(value); setSelected(null); setPoint(null); setRevision(n => n + 1);
      const bounds = value.geojson?.bbox;
      if (bounds) map.current?.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 70, maxZoom: 14, duration: 0 });
    } catch (reason) {
      if (mounted.current) setError(`未套用新成果，保留目前畫布。${reason instanceof Error ? reason.message : "RESULT_INVALID"}`);
    } finally { if (mounted.current) setBusy(false); }
  };
  const clear = () => {
    sceneRef.current = { ...sceneRef.current, resultMode: "empty" };
    if (controller.current) { controller.current.manual(sceneRef.current); return; }
    resultRef.current = null; setResult(null); setSelected(null); setPoint(null); setError(""); setRevision(n => n + 1);
  };

  return <div className="research-app">
    <header className="research-header">
      <a href="/" className="research-brand">PULSE <span>／研究工作台</span></a>
      <span className="research-preview">本地預覽 · 合成資料</span>
      <a href="/" className="research-back">返回一般地圖 ↗</a>
    </header>
    <main className="research-layout">
      <aside className="research-sidebar" aria-label="研究側欄">
        <div className="research-heading"><span className="research-eyebrow">RESEARCH / 01</span><h1>從一個問題，<br />開始一張地圖。</h1><p>資料處理在本地，成果留在畫布。</p></div>
        <ResearchConnection onState={handleBridgeState} onDisconnect={disconnect} onConnection={connect} />
        <section className="research-section"><h2>01 <span>研究成果</span></h2>
          <p>先載入合成範例，檢查點、線、面與表格。這些數值不代表真實地區。</p>
          <button className="research-primary" disabled={busy} onClick={() => void load()}>{busy ? "正在驗證…" : "載入合成範例 ↗"}</button>
          {!paired && <><button className="research-secondary" disabled={busy} onClick={() => fileInput.current?.click()}>開啟本地合成成果 JSON</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) void load(file); }} /></>}
          <small>只在本頁讀取，不會上傳。真實來源需待授權機制完成。</small>
        </section>
        <section className="research-section"><h2>02 <span>畫布內容</span></h2>
          {result ? <><div className="research-result-title"><strong>{result.title}</strong><button onClick={clear}>清除</button></div>
          <label className="research-opacity">透明度 <output>{Math.round(opacity * 100)}%</output><input aria-label="成果透明度" type="range" min="0" max="1" step="0.05" value={opacity} onChange={e => { const value = Number(e.target.value); opacityRef.current = value; setOpacity(value); if (controller.current && map.current && resultRef.current?.geojson) installResult(map.current, resultRef.current.geojson as FeatureCollection, value); }} /></label>
          <p>{result.geojson?.features.filter(f => f.geometry !== null).length ?? 0} 個可上圖物件 · {result.quality.displayTruncated ? "展示已抽樣" : "展示未抽樣"}</p></> : <p className="research-muted">尚無成果。載入後可逐一點選查看屬性。</p>}
          {point && <div className="research-selection"><strong>選取位置</strong><code>{point[0].toFixed(5)}, {point[1].toFixed(5)}</code><small>經度、緯度 · 周邊查詢尚未接通</small></div>}
        </section>
        <section className="research-section"><h2>03 <span>來源與方法</span></h2>{result ? <>
          <p><strong>{result.method.name}</strong> · {result.method.version}</p>
          <p>資料模式：合成測試<br />時效：{statusLabel[result.quality.freshness.status] ?? result.quality.freshness.status}</p>
          <details><summary>查看方法與限制</summary><p>建立時間：{result.createdAt}</p><p>方法參數預覽（最多 4,096 字元；完整內容在原始成果檔）</p><pre>{JSON.stringify(result.method.parameters, null, 2).slice(0, 4096)}</pre>{result.sourceRefs.map((s, i) => <p key={i}>{s}</p>)}{result.licenseRefs.map((s, i) => <p key={`license-${i}`}>{s}</p>)}{result.limitations.map((s, i) => <p key={`limit-${i}`}>{s}</p>)}</details>
        </> : <p className="research-muted">每份成果保留方法、單位、完整度與限制；缺值不補成零。</p>}</section>
        <footer className="research-local-note">本次沒有來源資料下載。<br />本地快取與費用確認介面將在後續接入。</footer>
      </aside>
      <section className="research-workspace" aria-label="研究畫布">
        <div className="research-toolbar"><div className="research-tabs" role="group" aria-label="成果檢視"><button aria-pressed={view === "map"} onClick={() => setView("map")}>地圖</button><button aria-pressed={view === "table"} onClick={() => setView("table")}>表格</button></div><span role="status">{loading.length ? loading[0]?.label : phaseLabel[phase]} <span className="research-revision">· r{revision}</span></span></div>
        {error && <div role="alert" className="research-error">{error}</div>}
        <div className="research-map-wrap" style={{ display: view === "map" ? "block" : "none" }}>
          <div ref={container} className="research-map" aria-label="可點選與縮放的研究地圖" />
          {!result && <div className="research-empty"><span>＋</span><h2>一張空白的研究畫布</h2><p>先載入合成成果，<br />再看資料如何成為可解釋的圖層。</p></div>}
          <div className="research-map-caption">經緯度參考格線 · 無街道底圖 · EPSG:4326</div>
          {result?.geojson && <div className="research-legend" aria-label="成果圖例"><strong>合成資料</strong><span><i style={{ background: RESULT_HOST.colors.point }} />點位</span><span><i style={{ background: RESULT_HOST.colors.line }} />線段</span><span><i style={{ background: RESULT_HOST.colors.polygon }} />範圍</span></div>}
          {selected && <div className="research-popup" role="dialog" aria-label="物件屬性"><button aria-label="關閉物件屬性" onClick={() => setSelected(null)}>×</button><strong>展示物件</strong><dl>{Object.entries(selected).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value === null ? "未知" : String(value)}</dd></div>)}</dl></div>}
        </div>
        {view === "table" && <div className="research-table-wrap">{result?.table ? <table><caption>{result.title} · 合成資料（顯示 {Math.min(100, result.table.rows.length)} / {result.table.rows.length} 列、{Math.min(20, result.table.columns.length)} / {result.table.columns.length} 欄；完整數據留於原檔，分析指標不隨預覽裁切）</caption><thead><tr>{result.table.columns.slice(0, 20).map((column, i) => <th key={i}>{column}</th>)}</tr></thead><tbody>{result.table.rows.slice(0, 100).map((row, i) => <tr key={i}>{row.slice(0, 20).map((cell, j) => <td key={j}>{cell === null ? "未知" : String(cell)}</td>)}</tr>)}</tbody></table> : <p>尚無表格成果。</p>}</div>}
        <div className="research-metrics" aria-label="分析指標">{result ? result.metrics.map((metric, i) => <article key={i}><span>{metric.name}</span><strong>{metric.value === null ? "—" : metric.value.toLocaleString("zh-TW", { maximumFractionDigits: 3 })}<small>{metric.unit}</small></strong><p>{statusLabel[metric.status] ?? metric.status} · {metric.scope.spatialRef}{metric.reason ? ` · ${metric.reason}` : ""}</p></article>) : <article><span>分析摘要</span><p>等待成果。完成呈現不代表資料完整；每個指標會另外顯示品質狀態。</p></article>}</div>
      </section>
    </main>
  </div>;
}
