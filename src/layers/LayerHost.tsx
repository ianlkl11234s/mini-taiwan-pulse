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
// 仍有一項無法消除的順序反轉：App 自己**宣告在 L507 之前**的 effect
// （L434 的日期訂閱、L504 的 timeStore 60Hz 同步、L236/L316/L336/L367 的
// lazy fetch）原本跑在這 67 支之前，現在跑在之後。三者都不是「先建 source
// 才吃得到」型的相依（前兩者訂閱 store、後三者是 fetch → setState），
// 但這是本棒已知的行為差異，交接時列在風險點。
//
// ⚠️ **不要 `React.memo`**：現況是「App 一 render 全部 hook 重跑」，本棒是等價
// 重構，行為必須逐位保真。per-key 訂閱帶來的 re-render 收斂是第 4 階段的事。

import { LAYER_HOOK_REGISTRY } from "./layerHookRegistry";
import { bumpHostRender, type LayerHostDeps } from "./layerHostDeps";

export function LayerHosts({ deps }: { deps: LayerHostDeps }) {
  bumpHostRender("LayerHosts");
  return (
    <>
      {LAYER_HOOK_REGISTRY.map(({ id, Host }) => (
        <Host key={id} deps={deps} />
      ))}
    </>
  );
}
