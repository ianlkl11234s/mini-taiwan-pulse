import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { AppMode } from "../types";
import {
  quarterOfTs, reWindow, rePlaySeconds, snapQuarterStart, nextQuarterStart,
  RANGE_START, RANGE_END, type ReGran,
} from "../lib/realEstateTime";

/**
 * 房地產時間軸 + 播放引擎（純 setFilter / setPaintProperty，零 RPC、零 React 逐格 re-render）
 *
 * - realtime：grid=period"ALL"、point 全部、全不透明。
 * - historical：grid 永遠按游標所在「季」snapshot；point：
 *   - 季：filter 當季 + 全不透明（snap）。
 *   - 月/週：依 trade_ts 與游標距離做梯形窗 circle-opacity → 漸入漸出。
 * - 播放：月/週 用 requestAnimationFrame **連續**推進游標（cursorRef，不進 React），
 *   每 ~40ms 更新一次 paint → 平滑演變；季用 interval 逐季 snap。
 * - 暫停/拖曳：依 React cursorTs 套用。
 */

type Kind = "grid" | "point";
const RE_LAYERS: { id: string; type: string; kind: Kind }[] = [
  { id: "re-grid-rental-fill", type: "rental", kind: "grid" },
  { id: "re-grid-rental-line", type: "rental", kind: "grid" },
  { id: "re-grid-sale-fill", type: "sale", kind: "grid" },
  { id: "re-grid-sale-line", type: "sale", kind: "grid" },
  { id: "re-grid-presale-fill", type: "presale", kind: "grid" },
  { id: "re-grid-presale-line", type: "presale", kind: "grid" },
  { id: "re-points-rental-circle", type: "rental", kind: "point" },
  { id: "re-points-sale-circle", type: "sale", kind: "point" },
  { id: "re-points-presale-circle", type: "presale", kind: "point" },
];

const TAIPEI_CITIES = ["taipei", "newtaipei"];
const EXCLUDE_TAIPEI_F: unknown[] = ["!", ["in", ["get", "city"], ["literal", TAIPEI_CITIES]]];

function withClauses(base: unknown[], excludeTaipei: boolean): unknown[] {
  const c = [...base];
  if (excludeTaipei) c.push(EXCLUDE_TAIPEI_F);
  return ["all", ...c];
}

function fadeFactor(cursorTs: number, full: number, fade: number): unknown[] {
  return [
    "interpolate", ["linear"], ["-", cursorTs, ["coalesce", ["get", "trade_ts"], 0]],
    -1, 0, 0, 1, full, 1, full + fade, 0,
  ];
}

export interface ReTimelineOpts {
  appMode: AppMode;
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
  const { appMode, gran, cursorTs, excludeTaipei, baseOpacity, playing, speed, onCursorChange, onStop } = opts;
  const cursorRef = useRef(cursorTs);
  // 非播放時：React 游標 → ref（拖曳/初始）
  if (!playing) cursorRef.current = cursorTs;

  // 全套用：grid+point 的 filter + 初始 opacity（scrub / 播放起點 / 換季時呼叫）
  const applyRef = useRef<(ts: number) => void>(() => {});
  // 僅更新點 opacity（RAF 每幀呼叫，避免每幀重設 grid filter）
  const paintPointsRef = useRef<(ts: number) => void>(() => {});

  applyRef.current = (ts: number) => {
    const map = mapRef.current;
    if (!map) return;
    const historical = appMode === "historical";
    const quarter = historical ? quarterOfTs(ts) : "ALL";
    const fadeMode = historical && gran !== "quarter";
    const win = reWindow(gran);
    for (const l of RE_LAYERS) {
      if (!map.getLayer(l.id)) continue;
      const typeF = ["==", ["get", "type"], l.type];
      if (l.kind === "grid") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.setFilter(l.id, withClauses([typeF, ["==", ["get", "period"], quarter]], excludeTaipei) as any);
      } else if (fadeMode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.setFilter(l.id, withClauses([typeF], excludeTaipei) as any);
        // 短 transition：讓 ~20fps 的 opacity 更新平滑銜接（不用預設 300ms，否則會 chase 變鈍）
        map.setPaintProperty(l.id, "circle-opacity-transition", { duration: 150, delay: 0 });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.setPaintProperty(l.id, "circle-opacity", ["*", baseOpacity, fadeFactor(ts, win.full, win.fade)] as any);
      } else {
        const base: unknown[] = historical ? [typeF, ["==", ["get", "period"], quarter]] : [typeF];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.setFilter(l.id, withClauses(base, excludeTaipei) as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.setPaintProperty(l.id, "circle-opacity", baseOpacity as any);
      }
    }
  };

  paintPointsRef.current = (ts: number) => {
    const map = mapRef.current;
    if (!map) return;
    const win = reWindow(gran);
    for (const l of RE_LAYERS) {
      if (l.kind !== "point" || !map.getLayer(l.id)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.setPaintProperty(l.id, "circle-opacity", ["*", baseOpacity, fadeFactor(ts, win.full, win.fade)] as any);
    }
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
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !playing || appMode !== "historical") return;

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

    // 月/週：RAF 連續推進
    const span = RANGE_END - RANGE_START;
    const ratePerMs = span / ((rePlaySeconds(gran) * 1000) / speed); // 資料秒 / 真實毫秒
    let cur = cursorRef.current;
    if (cur >= RANGE_END) cur = RANGE_START; // 已到底 → 從頭播
    let raf = 0;
    let last = performance.now();
    let lastPaint = 0;
    let lastSync = 0;
    let lastQuarter = quarterOfTs(cur);
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
      if (q !== lastQuarter) { applyRef.current(cur); lastQuarter = q; lastPaint = now; } // 換季 → 連 grid 一起刷
      else if (now - lastPaint > 50) { paintPointsRef.current(cur); lastPaint = now; } // 平常只更新點 opacity
      if (now - lastSync > 200) { onCursorChange(cur); lastSync = now; }
      raf = requestAnimationFrame(tick);
    };
    applyRef.current(cur); // 起點全套用一次
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, appMode, gran, excludeTaipei, baseOpacity, playing, speed, onCursorChange, onStop]);
}
