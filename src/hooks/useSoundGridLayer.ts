/**
 * 聲景網格圖層共用 hook（W6-4）：七族網格與綜合網格都走這一支。幀在 Web Worker 算（sound/grid/soundGridClient），
 * 主執行緒只做：掛圖層、換色表、跟時間軸請求幀、收到後上傳貼圖。
 *
 * - 時間：timeStore.subscribeThrottled（不把 currentTime 放 deps，development-rules §8）；每 10 分一格，同格不重請求。
 * - 競態：每次請求有序號，只套用最後一次請求的回應（快速跳時間時晚回來的舊格不蓋新格）；Worker 端同 key 的排隊請求也會被取代。
 * - 載入中：每次請求註冊 loadingRegistry（Worker 算完才結束）；資料（版次）換了先清掉舊幀（不畫），**不會先畫成全 0**。
 * - 該族還沒就緒（set 未載、飛機每日包還在抓）→ 不請求、不畫。
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle, withLoading } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";
import { countyCodes, GRID_CELLS } from "../sound/grid/gridSpec";
import { GRID_STEP_S } from "../sound/grid/gridComputeCore";
import { createLatestGate, soundGridClient } from "../sound/grid/soundGridClient";
import type { FromWorker, GridFamily } from "../sound/grid/gridWire";
import { createSoundGridLayer, type SoundGridLayer } from "../map/soundGridCustomLayer";
import { SOUND_UNKNOWN_COLOR } from "../sound/soundAtlasColors";

const BEFORE_LAYER = "sound-atlas-route-line";
const GRID_THROTTLE_MS = 250;

export const soundGridBin = (t: number): number => Math.floor(t / GRID_STEP_S) * GRID_STEP_S;

export type GridLayerResult = Extract<FromWorker, { type: "frame" | "composite" }>;

export interface SoundGridLayerOptions {
  mapRef: React.RefObject<MapboxMap | null>;
  layerId: string;
  /** 一族，或 "composite"（七族即時合成） */
  target: GridFamily | "composite";
  visible: boolean;
  /** 圖層開著但這幀不畫（例：接收點在網格外） */
  suppressed?: boolean;
  /** 額外的就緒條件（例：綜合要等七族都載完） */
  ready?: boolean;
  opacity: number;
  palette: Uint8Array;
  /** 綜合用（飛機顯示門檻）；換了要重算 */
  gate?: number;
  /** 回應 → 要上傳的幀（綜合挑甲或乙） */
  pick?: (r: GridLayerResult) => Uint8Array;
  /** 載入中提示的名稱 */
  label: string;
  onFrame?: (r: GridLayerResult) => void;
  onUploadMs?: (ms: number) => void;
}

export function useSoundGridLayer(o: SoundGridLayerOptions): void {
  const { mapRef, layerId, target, visible, suppressed = false, ready: extraReady = true, opacity, palette, gate = 0, label } = o;
  const mapTick = useMapReadyTick(mapRef, visible);
  const client = visible ? soundGridClient() : null;
  const sync = useSyncExternalStore(client?.subscribe ?? noopSub, client?.getSync ?? nullSync);
  const fams: readonly GridFamily[] = target === "composite" ? Object.keys(sync ?? {}) as GridFamily[] : [target];
  const versionKey = sync ? fams.map((f) => sync[f]?.version ?? 0).join(",") : "";
  const ready = !!sync && extraReady && fams.every((f) => sync[f]?.ready);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const cbRef = useRef(o);
  cbRef.current = o;
  const layerRef = useRef<SoundGridLayer | null>(null);
  const lastResult = useRef<GridLayerResult | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    if (!layerRef.current) {
      const codes = countyCodes();
      const mask = new Uint8Array(GRID_CELLS);
      for (let i = 0; i < GRID_CELLS; i++) mask[i] = codes[i] ? 1 : 0;
      layerRef.current = createSoundGridLayer({
        id: layerId, getOpacity: () => opacityRef.current, mask, hatch: { color: SOUND_UNKNOWN_COLOR, alpha: 0.75 },
        onUploadMs: (ms) => cbRef.current.onUploadMs?.(ms),
      });
    }
    const layer = layerRef.current;
    const mount = () => {
      if (map.getLayer(layerId)) return;
      map.addLayer(layer, map.getLayer(BEFORE_LAYER) ? BEFORE_LAYER : undefined);
    };
    mount();
    map.on("style.load", mount);
    return () => {
      map.off("style.load", mount);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    };
  }, [mapRef, visible, mapTick, layerId]);

  // 色表（綜合切甲乙時也換已收到的幀，不重算）
  useEffect(() => {
    const layer = layerRef.current;
    if (!visible || !layer) return;
    layer.setPalette(palette);
    const r = lastResult.current;
    if (r && !suppressed) layer.setFrame(cbRef.current.pick ? cbRef.current.pick(r) : (r as Extract<GridLayerResult, { type: "frame" }>).values);
    mapRef.current?.triggerRepaint();
  }, [mapRef, visible, mapTick, palette, suppressed]);

  useEffect(() => { mapRef.current?.triggerRepaint(); }, [mapRef, opacity, mapTick]);

  useEffect(() => {
    if (visible) return;
    lastResult.current = null;
    layerRef.current?.setFrame(null);
  }, [visible]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !visible || !layer || !client) return;
    // 資料換了：先清舊幀（不畫），等新幀回來
    lastResult.current = null;
    layer.setFrame(null);
    map.triggerRepaint();
    if (suppressed || !ready) return;
    let lastBin: number | null = null;
    const gateSeq = createLatestGate();
    let firstFrame = true;
    let alive = true;
    const apply = (t: number) => {
      const bin = soundGridBin(t);
      if (bin === lastBin) return;
      lastBin = bin;
      const seq = gateSeq.next();
      const key = `${layerId}`;
      const p: Promise<GridLayerResult | null> = target === "composite" ? client.composite(key, bin, gate) : client.frame(key, target, bin);
      void withLoading(`sound-grid:${layerId}`, label, p).then((r) => {
        if (!alive || !gateSeq.isLatest(seq) || !r) return; // 被取代或不是最後一次請求 → 丟掉
        lastResult.current = r;
        const s = performance.now();
        layer.setFrame(cbRef.current.pick ? cbRef.current.pick(r) : (r as Extract<GridLayerResult, { type: "frame" }>).values);
        map.triggerRepaint();
        cbRef.current.onFrame?.(r);
        recordApply(layerId, performance.now() - s);
        if (firstFrame) {
          firstFrame = false;
          keepLoadingUntilMapIdle(map, `sound-grid-render:${layerId}`, label);
        }
      }, (e) => console.error(`[SoundGrid] ${layerId}`, e));
    };
    apply(timeStore.getTime());
    const unsub = timeStore.subscribeThrottled(GRID_THROTTLE_MS, apply);
    return () => { alive = false; unsub(); };
    // versionKey 代表資料版次（換了重新請求）；label 只是顯示文字，不需要重訂閱
  }, [mapRef, visible, mapTick, layerId, target, versionKey, ready, suppressed, gate, client]);
}

const noopSub = () => () => {};
const nullSync = () => null;

/** 量測：主執行緒「收到幀 → 上傳」最長時間（ms） */
const applyPerf: Record<string, { max: number; n: number }> = {};
function recordApply(id: string, ms: number): void {
  const p = (applyPerf[id] ??= { max: 0, n: 0 });
  p.max = Math.max(p.max, ms);
  p.n++;
}
if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as Record<string, unknown>).__soundGridApplyPerf = applyPerf;
