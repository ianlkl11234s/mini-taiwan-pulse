// ══════════════════════════════════════════════════════════════════
//  threeRepaintSignal — 3D 圖層「輸入資料換了，重畫一次」的通知通道（PF-9）
// ══════════════════════════════════════════════════════════════════
//
// Three.js custom layer 不再每幀無條件 triggerRepaint。時間 / 參數 / 可見性各有
// 自己的訂閱，這裡補的是**資料 ref 在非時間 tick 時被換掉**的情況：
//   - engine 初始化或停用清空（useRailEngine / useBus*Layer / useTouristShuttleLayer）
//   - 垃圾車軌跡、表定路線載入（useWasteLayer / useWasteScheduleLayer）
//   - App state 驅動的 ref（航班、船、底圖主題、模式…）→ App 以帶 deps 的 effect 呼叫
// 以前靠 useThreeJsLayers 內「無 deps effect 每次 App render 比對 ref」隱性接住，
// App 不 render 就漏畫（例如暫停中資料載入完成、同數量的新軌跡）。
//
// ⚠️ 不要在 timeStore tick 裡呼叫：時間驅動的重畫已由 subscribeTimeRepaint 處理。

type Listener = () => void;
const listeners = new Set<Listener>();

/** 通知 3D 圖層重畫一次（Mapbox 會合併同一幀內的多次 triggerRepaint）。 */
export function requestThreeRepaint(): void {
  for (const cb of listeners) cb();
}

export function subscribeThreeRepaint(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
