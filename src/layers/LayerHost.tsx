// ══════════════════════════════════════════════════════════════════
//  LayerHost — manifest 驅動的圖層掛載點（AR-22 P1）
// ══════════════════════════════════════════════════════════════════
//
// App.tsx 只保留一行 `<LayerHosts deps={…} />`，實際掛哪些 hook 由
// `layerHookRegistry.tsx` 的有序陣列決定。
//
// ── hooks 規則為什麼成立 ────────────────────────────────────────────
// 每個 Host 是**獨立元件**，自己那幾支 hook 的呼叫順序在該元件內是固定的。
// 本檔這層只是 `.map()`：陣列是 module-level 常數（長度與順序恆定）、
// 每個元素配一個穩定的 `key={id}` —— 不會發生「條件式渲染導致 hook 數量變動」。
//
// ── ⚠️ 掛在 JSX **最後**是刻意的 ──────────────────────────────────
// React 的 effect 是 children 先於 parent。搬進 Host 之前，這 67 支 hook 的 effect
// 屬於 App 自己，跑在**所有子元件之後**；把 `<LayerHosts>` 放在 return 的最後一個
// 位置，順序就變成「其他子元件 → LayerHosts → App 自己的 effect」，
// 與搬移前的「其他子元件 → App（含這 67 支）」差異最小。
//
// ── ⚠️ unmount 的順序是**反過來**的（2026-08-20 補記）────────────────
// 掛載順序（children → parent）的鏡像是：卸載時 deleted tree 由上而下走，
// **前面的兄弟先卸載**。MapView 在 App.tsx 的 JSX 位置遠早於 LayerHosts，
// 所以整棵樹被刪時 `map.remove()`（MapView.tsx）先跑，這 67 支 hook 的 cleanup
// 才輪到 —— 它們拿到的是 closure 捕捉的**已銷毀 map**，任何 `getLayer()` /
// `set*Property()` 都會炸（`Cannot read properties of undefined (reading 'getOwnLayer')`）。
// 搬進 Host 之前這些 cleanup 屬於 App 自己的 fiber（早於所有 children），碰不到這條路。
// 對策不是改順序（會破壞上面刻意保真的 mount 等價），而是**每個 cleanup 自帶
// `try { … } catch { /* map 可能已銷毀 */ }`** —— 已於 18 支 hook 全數補齊。
//
// 仍有一項無法消除的順序反轉：App 自己**宣告在 L507 之前**的 effect
// （L434 的日期訂閱、L504 的 timeStore 60Hz 同步、L236/L316/L336/L367 的
// lazy fetch）原本跑在這 67 支之前，現在跑在之後。三者都不是「先建 source
// 才吃得到」型的相依（前兩者訂閱 store、後三者是 fetch → setState），
// 但這是本棒已知的行為差異，交接時列在風險點。
//
// ── memo（PF-6，2026-09-30）────────────────────────────────────────
// P1 時刻意不 memo（等價重構，要「App 一 render 全部 hook 重跑」逐位保真）。
// PF-6 解除：App 已不再訂閱 4Hz 時間 / 500ms 車輛計數，剩下的 App render 多半
// 與圖層無關（tooltip、面板開合…）。`LayerHosts` 以 deps **逐欄位 shallow
// compare** 做 React.memo：任何一欄身分變了才整批重跑，欄位新增自動納入比較，
// 不用另外維護 deps 清單。
// 保真條件（已查核）：
//   - Host 內沒有「無 deps 陣列」的 effect（掃描 src/ 只有 App 端的 useThreeJsLayers
//     一支，不在 Host 內），effect 只會因 deps 變動重跑 —— 跳過 render 不會漏跑。
//   - Host 的時間驅動一律走 timeStore 訂閱（YoubikeHost 自己訂分鐘粒度）、參數走
//     useLayerParams 訂閱，都不依賴 App 重渲把新值帶進來。
//
// ── per-key visibility（PF-8，2026-09-30）────────────────────────────
// `layerVisibility` **不再經 deps 由 App 傳入**（App 面型別 `AppLayerHostDeps` 已剔除
// 該欄），所以開關圖層不會讓 `LayerHosts` 整批重跑。每個 Host 外包一層 `HostSlot`，
// 給它一個**追蹤式 visibility 視圖**（Proxy；Host 以函式呼叫掛在 slot 內，視圖不經 props，
// 原因見 HostSlot 內註解）：Host（或它呼叫的 hook）讀到哪個 key，
// 該 slot 就只在那些 key 變動時重渲 —— Host 端 `deps.layerVisibility.xxx` 寫法一行不改。
// 語意與「整包 prop」保真的條件：
//   - 讀值一律取 store 當下快照（live），首次讀到的 key 立即納入追蹤；追蹤集只增不減。
//   - 比對基準在**每次** store 通知都前進（不只在有變動時），後追蹤到的 key 不會漏判。
//   - 視圖物件身分只在「追蹤到的 key 有變」時換新 → `useMemo(..., [deps.layerVisibility])`、
//     把整包傳進 hook 當 effect deps 的寫法仍會正確重算。
//   - 迭代整包（Object.keys / spread / `in` 以外的列舉）→ 退化成訂閱全部 key。
//   - 條件讀取（`appMode === "historical" && v.fireEvents`）：條件成立時 Host 必因
//     deps 變動重渲，屆時讀到即追蹤。

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { LAYER_HOOK_REGISTRY } from "./layerHookRegistry";
import {
  bumpHostRender, type AppLayerHostDeps, type LayerHostComponent, type LayerHostDeps,
} from "./layerHostDeps";
import { layerVisibilityStore } from "../state/layerVisibilityStore";
import type { LayerVisibility } from "../types";

type VisRecord = Record<string, boolean>;

/** 單一 Host 讀過哪些 visibility key（`all` = 曾列舉整包） */
interface VisTracker {
  keys: Set<string>;
  all: boolean;
}

function trackedChanged(t: VisTracker, prev: VisRecord, next: VisRecord): boolean {
  if (prev === next) return false;
  if (t.all) return true;
  for (const k of t.keys) if (prev[k] !== next[k]) return true;
  return false;
}

/** 追蹤式視圖：讀值取 store 當下快照，並把讀到的 key 記進 tracker。 */
function createVisibilityView(t: VisTracker): LayerVisibility {
  const live = () => layerVisibilityStore.getAll() as unknown as VisRecord;
  const track = (k: string | symbol) => {
    if (typeof k === "string" && k in live()) t.keys.add(k);
  };
  return new Proxy({} as LayerVisibility, {
    get(_target, k) { track(k); return (live() as Record<string | symbol, unknown>)[k]; },
    has(_target, k) { track(k); return k in live(); },
    ownKeys() { t.all = true; return Reflect.ownKeys(live()); },
    getOwnPropertyDescriptor(_target, k) {
      track(k);
      const d = Reflect.getOwnPropertyDescriptor(live(), k);
      // target 是空物件：回報的屬性必須 configurable，否則違反 Proxy invariant
      return d ? { ...d, configurable: true } : undefined;
    },
    set() { return false; },
    deleteProperty() { return false; },
  });
}

function HostSlot({ Host, deps }: { Host: LayerHostComponent; deps: AppLayerHostDeps }) {
  const trackerRef = useRef<VisTracker | null>(null);
  trackerRef.current ??= { keys: new Set(), all: false };
  const tracker = trackerRef.current;
  // 比對基準：mount 時的快照；之後每次 store 通知都前進
  const [baseline] = useState(() => layerVisibilityStore.getAll());
  const baseRef = useRef(baseline);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const check = () => {
      const next = layerVisibilityStore.getAll();
      const prev = baseRef.current;
      baseRef.current = next;
      if (trackedChanged(tracker, prev as unknown as VisRecord, next as unknown as VisRecord)) {
        setVersion((v) => v + 1);
      }
    };
    check(); // render → subscribe 之間若已有變動，補一次
    return layerVisibilityStore.subscribe(check);
  }, [tracker]);

  // version 是刻意的 deps：追蹤到的 key 變動 → 視圖換身分
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const view = useMemo(() => createVisibilityView(tracker), [tracker, version]);
  const hostDeps = useMemo<LayerHostDeps>(() => ({ ...deps, layerVisibility: view }), [deps, view]);
  // ⚠️ 直接呼叫而非 `<Host deps={hostDeps} />`：視圖若成為任何元件的 prop，React 19 dev
  // 的 Performance Track（logComponentRender → addObjectDiffToProperties）會在 commit
  // 時深度列舉它，把全部 key 記進 tracker → 此後任何開關都重渲（實測踩到）。
  // Host 固定於此 slot（key={id}、registry 為常數），hook 數量與順序恆定，hooks 規則成立；
  // 代價只是 DevTools 上看到的元件名是 HostSlot。
  return <>{(Host as (props: { deps: LayerHostDeps }) => React.ReactNode)({ deps: hostDeps })}</>;
}

function sameDeps(prev: { deps: AppLayerHostDeps }, next: { deps: AppLayerHostDeps }): boolean {
  const a = prev.deps as unknown as Record<string, unknown>;
  const b = next.deps as unknown as Record<string, unknown>;
  const keys = Object.keys(b);
  if (keys.length !== Object.keys(a).length) return false;
  for (const k of keys) if (!Object.is(a[k], b[k])) return false;
  return true;
}

export const LayerHosts = memo(function LayerHosts({ deps }: { deps: AppLayerHostDeps }) {
  bumpHostRender("LayerHosts");
  return (
    <>
      {LAYER_HOOK_REGISTRY.map(({ id, Host }) => (
        <HostSlot key={id} Host={Host} deps={deps} />
      ))}
    </>
  );
}, sameDeps);
