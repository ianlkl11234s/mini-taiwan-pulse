/**
 * City Sound Atlas 連續潛勢網格（W6-3）：飛機、鐵道、風吹樹葉、海浪、河川開著時，把已載入的 set 畫成北北 250 m 網格。
 * 仿 useSoundRainGridLayer／useSoundRoadGridLayer：
 *
 * - 資料：讀 soundAtlasStore.sets[family]（useSoundAtlasLayer 載入的同一份）→ 網格與接收點同一份資料。
 *   飛機、風、浪、河川要 origin＝"grid"（全北北來源檔）才算：場景快照只有接收點附近，遠處會被誤判成「沒有」。
 *   - 飛機：讀預算每日包（aviation-<D>.class.bin），包的來源雜湊要等於 set 讀的來源檔雜湊，否則整幀無法判斷；
 *   - 鐵道：前端每幀即時算（班表來自 Supabase，預處理拿不到同一份）；
 *   - 自然三族：建一次空間場（每格樹冠／離岸／離河＋最近站），每幀只算每站時間項。
 *   這天沒有全範圍來源檔 → 整幀無法判斷（斜線）；接收點在網格外（臺中和平）→ 不畫。
 * - 時間：timeStore.subscribeThrottled（不把 currentTime 放 deps）；每 10 分一格，值＝該區間的最大潛勢，同一格不重算。
 * - 渲染：src/map/soundGridCustomLayer；色表＝potentialLevelTable(門檻)，飛機換門檻只換色表、不重算幀。
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { timeStore } from "../state/timeStore";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";
import { soundAtlasStore } from "../sound/soundAtlasStore";
import { countyCodes, GRID_CELLS, GRID_UNKNOWN } from "../sound/grid/gridSpec";
import { gridSourceApplies, gridSourceSha } from "../sound/grid/gridSources";
import { fetchPotentialPack, potentialPackFrame, type PotentialPack } from "../sound/grid/potentialPack";
import { potentialLevelTable } from "../sound/grid/potentialCode";
import { buildNaturalField, naturalGridFrame, type NaturalField } from "../sound/grid/naturalGrid";
import { railGridFrame } from "../sound/grid/railGrid";
import {
  potentialGridBin, potentialGridState, POTENTIAL_GRID_STEP_S, setPotentialGridState, type PotentialGridFamily,
} from "../sound/grid/potentialGridState";
import { createSoundGridLayer, paletteFromClasses, type SoundGridLayer } from "../map/soundGridCustomLayer";
import { SOUND_POTENTIAL_GRID_ALPHA, SOUND_POTENTIAL_GRID_COLORS, SOUND_UNKNOWN_COLOR } from "../sound/soundAtlasColors";

const BEFORE_LAYER = "sound-atlas-route-line";
const GRID_THROTTLE_MS = 250;
export const soundPotentialGridLayerId = (family: PotentialGridFamily) => `sound-atlas-grid-${family}`;

/** 256×4 色表：碼 → 分級（potentialLevelOfCode(碼, 門檻)）→ 家族色；255 與未用碼透明（渲染器另畫斜線） */
export function potentialGridPalette(family: PotentialGridFamily, gate: number): Uint8Array {
  const table = potentialLevelTable(gate);
  const colors: string[] = [];
  const alphas: number[] = [];
  for (let c = 0; c < 256; c++) {
    const lv = table[c]!;
    if (lv < 0) { colors[c] = "#000000"; alphas[c] = 0; continue; }
    colors[c] = SOUND_POTENTIAL_GRID_COLORS[family][lv]!;
    alphas[c] = SOUND_POTENTIAL_GRID_ALPHA[lv]!;
  }
  return paletteFromClasses(colors, alphas);
}

const RAIL_CACHE_FRAMES = 36;
const requestIdle = (fn: () => void): number =>
  typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: 2000 }) : (setTimeout(fn, 50) as unknown as number);
const cancelIdle = (h: number): void => {
  if (typeof cancelIdleCallback === "function") cancelIdleCallback(h); else clearTimeout(h);
};

const NATURAL = new Set<PotentialGridFamily>(["wind_vegetation", "coastal_wave", "river_water"]);

export function useSoundPotentialGridLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  family: PotentialGridFamily,
  visible: boolean,
  opacity: number,
  gate = 0,
): void {
  const layerId = soundPotentialGridLayerId(family);
  const mapTick = useMapReadyTick(mapRef, visible);
  const set = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().sets[family] ?? null);
  const origin = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().origins[family] ?? null);
  const receiver = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().receiver);
  const outside = !!receiver && !gridSourceApplies(receiver);
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;
  const layerRef = useRef<SoundGridLayer | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visible) return;
    if (!layerRef.current) {
      const codes = countyCodes();
      const mask = new Uint8Array(GRID_CELLS);
      for (let i = 0; i < GRID_CELLS; i++) mask[i] = codes[i] ? 1 : 0;
      layerRef.current = createSoundGridLayer({
        id: layerId,
        getOpacity: () => opacityRef.current,
        mask,
        hatch: { color: SOUND_UNKNOWN_COLOR, alpha: 0.75 },
        onUploadMs: (ms) => setPotentialGridState(family, { lastUploadMs: ms }),
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
  }, [mapRef, visible, mapTick, family, layerId]);

  // 換門檻只換色表
  useEffect(() => {
    if (!visible || !layerRef.current) return;
    layerRef.current.setPalette(potentialGridPalette(family, gate));
    setPotentialGridState(family, { gate });
    mapRef.current?.triggerRepaint();
  }, [mapRef, visible, mapTick, family, gate]);

  useEffect(() => { mapRef.current?.triggerRepaint(); }, [mapRef, opacity, mapTick]);

  useEffect(() => {
    if (visible) return;
    setPotentialGridState(family, { set: null, binStart: null, frameNote: null });
    layerRef.current?.setFrame(null);
  }, [visible, family]);

  // 飛機每日包（只在全範圍來源檔時讀；雜湊不符就不用）
  const [pack, setPack] = useState<{ key: string; pack: PotentialPack | null; note: string | null } | null>(null);
  const packKey = family === "aviation" && visible && set && origin === "grid" ? set.dateKey : null;
  useEffect(() => {
    if (!packKey) return;
    let alive = true;
    const t0 = performance.now();
    void fetchPotentialPack("aviation", packKey).then((p) => {
      if (!alive) return;
      const sha = gridSourceSha("aviation", packKey);
      const note = !p ? "no_pack_for_date" : sha && p.meta.source.sha256 !== sha ? "pack_source_mismatch" : null;
      setPotentialGridState(family, { prepMs: performance.now() - t0 });
      setPack({ key: packKey, pack: note ? null : p, note });
    });
    return () => { alive = false; };
  }, [packKey, family]);

  // 自然三族：空間場（每個 set 一次）
  const field = useMemo<NaturalField | null>(() => {
    if (!NATURAL.has(family) || !set || origin !== "grid") return null;
    const f = buildNaturalField(family as NaturalField["family"], set);
    setPotentialGridState(family, { prepMs: f.buildMs });
    return f;
  }, [family, set, origin]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !visible || !layer) return;
    const buf = new Uint8Array(GRID_CELLS);
    // 鐵道冷算一幀約 70–250 ms：10 分格快取（同一份 set）＋閒置時預算前後各一格，播放與來回拖曳時換幀是查表
    const railCache = new Map<number, Uint8Array>();
    let idleHandle: number | null = null;
    const railFrame = (b: number): Uint8Array => {
      let f = railCache.get(b);
      if (!f) {
        f = railGridFrame(set, b, b + POTENTIAL_GRID_STEP_S - 1e-6, new Uint8Array(GRID_CELLS)).values;
        railCache.set(b, f);
        while (railCache.size > RAIL_CACHE_FRAMES) railCache.delete(railCache.keys().next().value!);
      }
      return f;
    };
    const prefetchRail = (b: number) => {
      if (idleHandle != null) cancelIdle(idleHandle);
      const todo = [b + POTENTIAL_GRID_STEP_S, b - POTENTIAL_GRID_STEP_S].filter((x) => !railCache.has(x));
      const step = () => {
        idleHandle = null;
        const next = todo.shift();
        if (next == null) return;
        railFrame(next);
        if (todo.length) idleHandle = requestIdle(step);
      };
      if (todo.length) idleHandle = requestIdle(step);
    };
    let lastBin: number | null = null;
    let firstFrame = true;
    // 整幀判定（不必每幀算）
    let wholeNote: string | null = null;
    if (outside && family !== "rail") wholeNote = "receiver_outside_grid";
    else if (family !== "rail" && set && origin !== "grid") wholeNote = "no_full_area_source";
    else if (family === "aviation" && set) wholeNote = pack?.key === set.dateKey ? pack.note : "pack_loading";
    setPotentialGridState(family, { set, origin, binStart: null, frameNote: wholeNote === "pack_loading" ? null : wholeNote });
    if (wholeNote === "receiver_outside_grid") { layer.setFrame(null); return; }
    if (wholeNote === "pack_loading") return;
    const apply = (t: number) => {
      const bin = potentialGridBin(t);
      if (bin === lastBin) return;
      lastBin = bin;
      const s = performance.now();
      let values: Uint8Array = buf;
      let note: string | null = wholeNote;
      if (!set) { buf.fill(GRID_UNKNOWN); note = "source_not_loaded"; }
      else if (wholeNote) buf.fill(GRID_UNKNOWN);
      else if (family === "aviation") {
        const f = pack?.pack ? potentialPackFrame(pack.pack, bin) : null;
        if (f) values = f; else { buf.fill(GRID_UNKNOWN); note = "outside_pack_time"; }
      } else if (family === "rail") {
        values = railFrame(bin);
        note = null;
        prefetchRail(bin);
      } else {
        const r = naturalGridFrame(field, bin, bin + POTENTIAL_GRID_STEP_S - 1e-6, buf);
        note = r.gateReason;
      }
      layer.setFrame(values);
      setPotentialGridState(family, { binStart: bin, frameNote: note, lastFrameMs: performance.now() - s, frames: potentialGridState(family).frames + 1 });
      if (firstFrame && set) {
        firstFrame = false;
        keepLoadingUntilMapIdle(map, `sound-${family}-grid-render:${set.dateKey}`, `聲景${family}網格 ${set.dateKey}`);
      }
    };
    apply(timeStore.getTime());
    const unsub = timeStore.subscribeThrottled(GRID_THROTTLE_MS, apply);
    return () => {
      unsub();
      if (idleHandle != null) cancelIdle(idleHandle);
    };
  }, [mapRef, visible, set, origin, field, pack, outside, family, mapTick]);
}

// 開發用量測／驗收把手（同 __soundRainGrid）
if (import.meta.env.DEV && typeof window !== "undefined") {
  void Promise.all([import("../state/timelineJumpBridge"), import("../sound/grid/potentialGridState")]).then(([bridge, grid]) => {
    (window as unknown as Record<string, unknown>).__soundPotentialGrid = {
      state: grid.potentialGridState,
      jump: (unix: number) => bridge.requestTimelineJump(unix),
      pick: grid.pickSoundPotentialCell,
    };
  });
}
