/**
 * useTwMarineHeatLayer — 海洋熱浪月分級（twMarineHeatwaves）與珊瑚白化熱壓力（twCoralBleachingHeatStress）的月幀 raster。
 *
 * - 期別由設定面板的「年份／月份」下拉決定（不跟即時時間軸：兩層涵蓋 24–45 年的月資料，
 *   timeStore 只服務 30 天內的即時圖層；分期快照的長期時間條尚未實作，見 docs/features/longterm-time/STANDARD.md）。
 * - 幀來自「每年一張拼圖」（data/marineYearAtlas.ts）：同年只抓一次，換月只重裁；幀清單沒有的月份＝未涵蓋（隱藏圖層、圖例說明），不沿用上一幀。
 * - 每次換期別：幀清單、拼圖、數值檔、裁切都掛 loadingRegistry；序號防止舊請求蓋掉新畫面。
 * - popup：raster 不能 queryRenderedFeatures，useMapInteraction 在沒命中向量 feature 時呼叫 pickTwMarineHeatCells 查當月數值檔。
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { createJmaImageryLayer, type JmaImageryLayerHandle } from "../map/jmaImageryLayer";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import {
  cropYearAtlasTile, loadYearAtlasBitmap, loadYearAtlasManifest, loadYearAtlasValues, pickYearAtlasFrame,
  yearAtlasCellIndex, yearAtlasUrl, type YearAtlasGrid, type YearAtlasManifest,
} from "../data/marineYearAtlas";
import {
  TW_CRW_BAA_LEVELS, TW_MARINE_HEAT_PRODUCTS, TW_MHW_LEVELS, twMarineHeatRasterPaint,
  type TwMarineHeatLayerKey,
} from "../data/twMarineHeatTypes";
import { useMapReadyTick } from "./useMapReadyTick";

// ── 狀態（圖例與 popup 讀） ──

export type TwMarineHeatState = "idle" | "loading" | "shown" | "uncovered" | "error";
export interface TwMarineHeatStatus {
  state: TwMarineHeatState;
  period: string | null;
  message?: string;
}

interface MhwMonth { level: (number | null)[]; sst_anomaly: (number | null)[]; sst: (number | null)[] }
interface CrwMonth { dhw_max: (number | null)[]; baa5_max: (number | null)[] }
interface YearValues<M> { grid: YearAtlasGrid & { cells?: number[] }; months: Record<string, M> }

interface PickState {
  period: string;
  values: YearValues<MhwMonth> | YearValues<CrwMonth>;
}

const IDLE: TwMarineHeatStatus = { state: "idle", period: null };
const statuses: Record<TwMarineHeatLayerKey, TwMarineHeatStatus> = { twMarineHeatwaves: IDLE, twCoralBleachingHeatStress: IDLE };
const pickStates: Record<TwMarineHeatLayerKey, PickState | null> = { twMarineHeatwaves: null, twCoralBleachingHeatStress: null };
const listeners = new Set<() => void>();

function setStatus(key: TwMarineHeatLayerKey, next: TwMarineHeatStatus) {
  const cur = statuses[key];
  if (cur.state === next.state && cur.period === next.period && cur.message === next.message) return;
  statuses[key] = next;
  listeners.forEach((fn) => fn());
}
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function getTwMarineHeatStatus(key: TwMarineHeatLayerKey): TwMarineHeatStatus { return statuses[key]; }
export function useTwMarineHeatStatus(key: TwMarineHeatLayerKey): TwMarineHeatStatus {
  return useSyncExternalStore(subscribe, () => statuses[key], () => statuses[key]);
}

const MHW_LEVEL_ZH = new Map(TW_MHW_LEVELS.map((l) => [l.value, l.zh]));
const BAA_LEVEL_ZH = new Map(TW_CRW_BAA_LEVELS.map((l) => [l.value, l.zh]));

/**
 * 點擊查值（只查目前顯示的那個月）。回傳 popup properties；不開 popup 時回 null：
 * 格網外、陸地（海洋熱浪 sst 為空；珊瑚層數值為空）、珊瑚層 NOAA 監測範圍外。
 * 海洋格有海溫但沒有熱浪等級＝「無資料」，不當成 0 級。
 */
function pickCell(key: TwMarineHeatLayerKey, lng: number, lat: number): Record<string, unknown> | null {
  const s = pickStates[key];
  if (!s || statuses[key].state !== "shown") return null;
  const month = s.values.months[s.period];
  if (!month) return null;
  const idx = yearAtlasCellIndex(s.values.grid, lng, lat);
  if (idx === null) return null;
  if (key === "twMarineHeatwaves") {
    const m = month as MhwMonth;
    const sst = m.sst[idx] ?? null;
    if (sst === null) return null;
    const level = m.level[idx] ?? null;
    return {
      kind: "mhw", period: s.period, level, levelZh: level === null ? null : MHW_LEVEL_ZH.get(level) ?? null,
      sst, sstAnomaly: m.sst_anomaly[idx] ?? null,
    };
  }
  const cells = s.values.grid.cells ?? [];
  const pos = cells.indexOf(idx);
  if (pos < 0) return null;
  const m = month as CrwMonth;
  const dhw = m.dhw_max[pos] ?? null;
  const baa = m.baa5_max[pos] ?? null;
  if (dhw === null && baa === null) return null;
  return { kind: "crw", period: s.period, dhw, baa, baaZh: baa === null ? null : BAA_LEVEL_ZH.get(baa) ?? null };
}

/** useMapInteraction 用：兩層各查一次，都沒有值回 null（popup layerType `twMarineHeat`） */
export function pickTwMarineHeatCells(lng: number, lat: number): { mhw: Record<string, unknown> | null; crw: Record<string, unknown> | null } | null {
  const mhw = pickCell("twMarineHeatwaves", lng, lat);
  const crw = pickCell("twCoralBleachingHeatStress", lng, lat);
  return mhw || crw ? { mhw, crw } : null;
}

// ── hook ──

interface Options {
  mapRef: React.RefObject<MapboxMap | null>;
  visible: boolean;
  layerKey: TwMarineHeatLayerKey;
  opacity: number;
  /** YYYY-MM */
  period: string;
  channel: "r" | "g";
  /** raster-color 運算式（含類別篩選） */
  color: unknown[];
}

export function useTwMarineHeatLayer({ mapRef, visible, layerKey, opacity, period, channel, color }: Options) {
  const mapTick = useMapReadyTick(mapRef, visible);
  const sourceId = `tw-marine-heat-${layerKey}-src`;
  const layerId = `tw-marine-heat-${layerKey}-layer`;
  const handleRef = useRef<JmaImageryLayerHandle | null>(null);
  const urlsRef = useRef<string[]>([]);
  const seqRef = useRef(0);
  const paintRef = useRef({ opacity, channel, color });
  paintRef.current = { opacity, channel, color };

  // 換期別／開關／style 重載：取幀 → 裁切 → updateImage
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const product = TW_MARINE_HEAT_PRODUCTS[layerKey];
    const hide = () => { try { handleRef.current?.setVisible(false); } catch { /* style 轉換中 */ } };
    if (!visible) {
      hide();
      pickStates[layerKey] = null;
      setStatus(layerKey, IDLE);
      return;
    }
    const seq = ++seqRef.current;
    const label = layerKey === "twMarineHeatwaves" ? `海洋熱浪 ${period}` : `珊瑚白化熱壓力 ${period}`;
    setStatus(layerKey, { state: "loading", period });

    const run = async () => {
      const manifest: YearAtlasManifest = await loadYearAtlasManifest(yearAtlasUrl(product.base, product.framesKey), `${label} 幀清單`);
      if (seq !== seqRef.current) return;
      const frame = pickYearAtlasFrame(manifest, period);
      if (!frame) {
        hide();
        pickStates[layerKey] = null;
        setStatus(layerKey, { state: "uncovered", period });
        return;
      }
      const [bitmap, values] = await Promise.all([
        loadYearAtlasBitmap(yearAtlasUrl(product.base, frame.atlas_key), `${label} 影像`),
        loadYearAtlasValues<PickState["values"]>(yearAtlasUrl(product.base, frame.values_key), `${label} 數值`),
      ]);
      if (seq !== seqRef.current) return;
      const url = await cropYearAtlasTile(bitmap, frame, `${label} 切換月份`);
      if (seq !== seqRef.current) { URL.revokeObjectURL(url); return; }
      const bbox = { lonMin: frame.lon_min, lonMax: frame.lon_max, latMin: frame.lat_min, latMax: frame.lat_max };
      const p = paintRef.current;
      if (!handleRef.current) {
        handleRef.current = createJmaImageryLayer(map, {
          sourceId, layerId, url, bbox, opacity: p.opacity,
          paint: (op) => twMarineHeatRasterPaint(paintRef.current.channel, paintRef.current.color, op),
        });
      } else {
        handleRef.current.ensure();
        handleRef.current.setFrame(url, bbox);
        handleRef.current.setVisible(true);
      }
      // 保留目前與上一張（上一張可能還在被 mapbox 讀），更早的釋放
      urlsRef.current.push(url);
      while (urlsRef.current.length > 2) URL.revokeObjectURL(urlsRef.current.shift()!);
      keepLoadingUntilMapIdle(map, `tw-marine-heat-render:${layerKey}`, `${label} 渲染中`, null);
      pickStates[layerKey] = { period, values };
      setStatus(layerKey, { state: "shown", period });
    };
    run().catch((err: unknown) => {
      if (seq !== seqRef.current) return;
      hide();
      pickStates[layerKey] = null;
      console.warn(`[twMarineHeat] ${layerKey} ${period} 載入失敗`, err);
      setStatus(layerKey, { state: "error", period, message: err instanceof Error ? err.message : String(err) });
    });
  }, [mapRef, visible, layerKey, period, sourceId, layerId, mapTick]);

  // 換底圖：自訂 source/layer 會被清掉，用最新一張重建
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    const onStyle = () => { try { handleRef.current?.ensure(); } catch { /* 下一輪補 */ } };
    map.on("style.load", onStyle);
    return () => { map.off("style.load", onStyle); };
  }, [mapRef, visible, mapTick]);

  // 透明度與上色（含篩選、DHW／警報切換）：只改 paint，不重抓
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible || !handleRef.current) return;
    try {
      if (!map.getLayer(layerId)) return;
      const paint = twMarineHeatRasterPaint(channel, color, opacity);
      map.setPaintProperty(layerId, "raster-opacity", opacity);
      map.setPaintProperty(layerId, "raster-color-mix", paint["raster-color-mix"] as never);
      map.setPaintProperty(layerId, "raster-color", color as never);
    } catch { /* style 轉換中 */ }
  }, [mapRef, visible, layerId, opacity, channel, color, mapTick]);

  // unmount
  useEffect(() => () => {
    try { handleRef.current?.remove(); } catch { /* map 可能已銷毀 */ }
    handleRef.current = null;
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    pickStates[layerKey] = null;
    setStatus(layerKey, IDLE);
  }, [layerKey]);
}
