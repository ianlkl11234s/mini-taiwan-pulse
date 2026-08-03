import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { AppMode } from "../types";
import {
  quarterOfTs, reWindow, rePlaySeconds, snapQuarterStart, nextQuarterStart,
  RANGE_START, RANGE_END, DAY, type ReGran,
} from "../lib/realEstateTime";
import { rePointsStore } from "../state/realEstatePointsStore";

/**
 * 房地產時間軸 + 播放引擎（grid 走 PMTiles setFilter；point 走 WebGL CustomLayer）。
 *
 * 本 hook 負責：
 *   - grid（PMTiles fill/line）的 period filter：realtime → "ALL"、historical → 當季 snapshot。
 *   - 寫 rePointsStore 的「時間欄位」（mode / cursorTs / 季窗 / fade 窗）給 CustomLayer 讀。
 *   - 播放：月/週用 requestAnimationFrame 連續推進游標（只更新 store.cursorTs + triggerRepaint，
 *     fade 在 GPU 算 → 每幀零逐 feature 成本）；季用 interval 逐季 snap。
 *
 * point 的 opacity/fade 不再由這裡 setPaintProperty —— 改由 RealEstatePointsScene 的 uCursorTs uniform。
 * 控制欄位（show / excludeTaipei / baseOpacity）由 useRealEstatePointsLayer 寫入 store。
 */

// grid PMTiles 圖層（fill + line × 3 類）；point 已移除
const RE_GRID_LAYERS: { id: string; type: string }[] = [
  { id: "re-grid-rental-fill", type: "rental" },
  { id: "re-grid-rental-line", type: "rental" },
  { id: "re-grid-sale-fill", type: "sale" },
  { id: "re-grid-sale-line", type: "sale" },
  { id: "re-grid-presale-fill", type: "presale" },
  { id: "re-grid-presale-line", type: "presale" },
];

const TAIPEI_CITIES = ["taipei", "newtaipei"];
const EXCLUDE_TAIPEI_F: unknown[] = ["!", ["in", ["get", "city"], ["literal", TAIPEI_CITIES]]];

function withClauses(base: unknown[], excludeTaipei: boolean): unknown[] {
  const c = [...base];
  if (excludeTaipei) c.push(EXCLUDE_TAIPEI_F);
  return ["all", ...c];
}

/** 當季 [start, end)（絕對 unix 秒）；最後一季 end 用 RANGE_END+1天 */
function quarterBounds(ts: number): { start: number; end: number } {
  const start = snapQuarterStart(ts);
  const next = nextQuarterStart(start);
  return { start, end: next > start ? next : RANGE_END + DAY };
}

export interface ReTimelineOpts {
  appMode: AppMode;
  /** 是否有任一房地產 layer 開著。false 時本 hook 不接管歷史播放 */
  active: boolean;
  gran: ReGran;
  cursorTs: number;
  excludeTaipei: boolean;
  baseOpacity: number;
  playing: boolean;
  speed: number;
  onCursorChange: (ts: number) => void;
  onStop: () => void;
}

export function useRealEstateTimeline(
  mapRef: React.RefObject<MapboxMap | null>,
  opts: ReTimelineOpts,
) {
  const { appMode, active, gran, cursorTs, excludeTaipei, baseOpacity, playing, speed, onCursorChange, onStop } = opts;
  const cursorRef = useRef(cursorTs);
  if (!playing) cursorRef.current = cursorTs;

  // grid filter 套用 + 寫 store 時間欄位（scrub / 播放起點 / 換季時呼叫）
  const applyRef = useRef<(ts: number) => void>(() => {});
  applyRef.current = (ts: number) => {
    const map = mapRef.current;
    if (!map) return;
    const historical = appMode === "historical";
    const quarter = historical ? quarterOfTs(ts) : "ALL";

    // grid PMTiles filter
    for (const l of RE_GRID_LAYERS) {
      if (!map.getLayer(l.id)) continue;
      const typeF = ["==", ["get", "type"], l.type];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setFilter(l.id, withClauses([typeF, ["==", ["get", "period"], quarter]], excludeTaipei) as any);
    }

    // store 時間欄位 → CustomLayer
    if (!historical) {
      rePointsStore.mode = "realtime";
    } else if (gran === "quarter") {
      rePointsStore.mode = "quarter";
      const b = quarterBounds(ts);
      rePointsStore.qStart = b.start;
      rePointsStore.qEnd = b.end;
    } else {
      rePointsStore.mode = "fadewindow";
      const win = reWindow(gran);
      rePointsStore.full = win.full;
      rePointsStore.fade = win.fade;
    }
    rePointsStore.cursorTs = ts;
    map.triggerRepaint();
  };

  // 暫停 / realtime / 拖曳：靜態套用 + style.load 重套
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (playing && appMode === "historical") return; // 播放交給下面引擎
    const run = () => applyRef.current(cursorTs);
    run();
    map.on("style.load", run);
    return () => { map.off("style.load", run); };
  }, [mapRef, appMode, gran, cursorTs, excludeTaipei, baseOpacity, playing]);

  // 播放引擎（不 depend cursorTs → 不會被自己的 onCursorChange 重啟）
  //
  // ⚠️ `active` 這道 guard 不可省：App 那邊的歷史播放 effect 在 realEstateActive
  // 時會讓位給本引擎，但本引擎過去沒有對應的守門 —— 只要 historical+playing 就跑，
  // 而游標預設停在 RANGE_END，第一個 tick 就 `nx <= cur` → onStop() 把
  // historicalPlaying 關掉。症狀是「歷史模式按 ▶ 永遠只前進一格」，
  // 火災 / 人口 / 共機活動區都中招。
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active || !playing || appMode !== "historical") return;

    // 季：interval 逐季 snap
    if (gran === "quarter") {
      let cur = snapQuarterStart(cursorRef.current);
      applyRef.current(cur);
      onCursorChange(cur);
      const stepMs = Math.max(300, (rePlaySeconds("quarter") * 1000) / 7 / speed);
      const id = window.setInterval(() => {
        const nx = nextQuarterStart(cur);
        if (nx <= cur) { onStop(); return; }
        cur = nx;
        cursorRef.current = cur;
        applyRef.current(cur);
        onCursorChange(cur);
      }, stepMs);
      return () => window.clearInterval(id);
    }

    // 月/週：RAF 連續推進（只更新 store.cursorTs + triggerRepaint，fade 在 GPU）
    const span = RANGE_END - RANGE_START;
    const ratePerMs = span / ((rePlaySeconds(gran) * 1000) / speed); // 資料秒 / 真實毫秒
    let cur = cursorRef.current;
    if (cur >= RANGE_END) cur = RANGE_START;
    let raf = 0;
    let last = performance.now();
    let lastSync = 0;
    let lastQuarter = quarterOfTs(cur);
    applyRef.current(cur); // 起點：grid + store 全套用
    const tick = (now: number) => {
      cur += ratePerMs * (now - last);
      last = now;
      if (cur >= RANGE_END) {
        cur = RANGE_END;
        cursorRef.current = cur;
        applyRef.current(cur);
        onCursorChange(cur);
        onStop();
        return;
      }
      cursorRef.current = cur;
      const q = quarterOfTs(cur);
      if (q !== lastQuarter) {
        applyRef.current(cur); // 換季 → 連 grid filter 一起刷（內含 triggerRepaint）
        lastQuarter = q;
      } else {
        rePointsStore.cursorTs = cur; // 平常只推游標
        map.triggerRepaint();
      }
      if (now - lastSync > 200) { onCursorChange(cur); lastSync = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, appMode, active, gran, excludeTaipei, baseOpacity, playing, speed, onCursorChange, onStop]);
}
