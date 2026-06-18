# 2026-04-22 — Mapbox custom layer attach 不觸發：`map.once('load')` 在 load 已 fire 後永不執行

## TL;DR

獨立 hook 裡用 `map.once('load', attach)` 排程 Mapbox custom layer 掛載。
當 hook useEffect 觸發時 map 其實早就 load 過，`isStyleLoaded()` 暫時為 false
導致落入 else 分支，但 `load` event 不會再觸發第二次 → **attach 永不執行 →
Three.js scene 建好但 custom layer 從沒註冊到 map 上 → 畫面沒有東西**。

## 症狀

| 觀察 | 狀態 |
|---|---|
| `[Reservoir] mount effect { visible: true, map: true }` | ✅ hook 有跑 |
| `[Reservoir] RPC returned 37 reservoirs` | ✅ RPC OK |
| `[ReservoirScene] setStatuses input=37` | ✅ scene 有收到 |
| `[ReservoirScene] rebuild count=36` | ✅ mesh 建了 |
| `[Reservoir] attaching custom layer` | ❌ **缺這行** |
| `[ReservoirLayer] onAdd` | ❌ **缺這行** |
| `map.getLayer('reservoir-3d')` | 應 = undefined |
| 地圖畫面上的 cylinder | 完全看不到 |

tsc -b 0 錯誤。沒有任何 runtime error。

## 一開始的錯誤假設

1. **懷疑尺寸太小**：算過 radius_min = 500m × metersPerUnit(23.5) ≈ 7.5e-5 Mercator
   unit，比 `StationPillarScene.RADIUS = 5e-6` 大 15 倍 → 不會太小。
2. **懷疑 Three.js GL state 衝突**：多個 custom layer 共用 GL context，blend state
   污染 → 但既有 pillar 沒問題。
3. **懷疑 InstancedMesh 的 instanceColor**：MeshBasicMaterial 要 `vertexColors: true`？
   但 Three.js r125+ InstancedMesh.instanceColor 會自動 patch shader。
4. **懷疑 visible ref 沒同步**：但 log 顯示 visible=true。

全都猜錯。直到加 log 才發現根本沒到 `attach()`。

## 真相

問題 code：
```ts
const attach = () => {
  console.log("[Reservoir] attaching custom layer");
  map.addLayer(layer);
};

if (map.isStyleLoaded()) attach();
else map.once("load", attach);  // ❌
```

關鍵事實：
- `useReservoirStatusLayer` 是**獨立 hook**，不跟 `addAllLayers`（在 handleMapReady
  同步呼叫）一起
- hook useEffect 觸發時機：`layerVisibility.waterReservoirs` 從 false 變 true
- 當下 map 早已 load 過，但 `isStyleLoaded()` **可能暫時 false**（imagery 動態更新、
  某個 source swap 中）
- `map.once('load', attach)` 排到一個**不會再發生的事件**上 → attach 永遠不會被呼叫

## 修復

改用 polling：
```ts
let cancelled = false;
let timer: ReturnType<typeof setInterval> | null = null;

const attach = () => { ... };

const tryAttach = () => {
  if (cancelled || mountedRef.current) {
    if (timer) clearInterval(timer);
    return;
  }
  if (!map.isStyleLoaded()) return; // 下一 tick 再試
  if (attach() && timer) {
    clearInterval(timer);
    timer = null;
  }
};

if (map.isStyleLoaded()) attach();
else {
  timer = setInterval(tryAttach, 200);
  tryAttach();
}

return () => {
  cancelled = true;
  if (timer) clearInterval(timer);
};
```

**要點**：
1. `setInterval` 200ms 重試，直到 `isStyleLoaded()` 或 mountedRef = true
2. cleanup 時要 `clearInterval` 避免 leak
3. `attach()` 成功（return true）才 `clearInterval`，失敗則繼續重試
4. addLayer 用 `try/catch` 包起來，失敗時 reset mountedRef 讓下次能再試

## 為何 `StationPillarScene` 沒踩這坑

既有的 Three.js custom layer（`stationPillarCustomLayer`、`busCustomLayer` 等）都在
`useThreeJsLayers` 的 `addAllLayers(map)` 裡 attach，而 `addAllLayers` 是在
`handleMapReady(map)` 裡呼叫 —— 也就是 **mapbox `load` event 觸發後的 callback
同步執行**，此時 `isStyleLoaded()` 幾乎一定是 true，即使是 false 也還會收到 load event
（因為是在 handler 內）。

獨立 hook 不享有這個時序保證，必須自己處理。

## 教訓

### 1. `once(event, handler)` 只是註冊下次，不保證 event 未觸發過
Mapbox 的 `load` event 只 fire **一次**（map 初次載入完成）。`once('load', ...)`
之後在 handler 註冊的 listener 是死的。

這個陷阱在很多 event-driven API 都存在：`DOMContentLoaded`、`<img>.onload`、
WebSocket open 等。正確處理都是「先 check 當前狀態，再 fallback 訂閱事件」。

### 2. 獨立 hook 跟 `handleMapReady` 時序不同
跟著 `addAllLayers(map)` 的 layer **保證 style ready**。獨立 hook 的 useEffect
可能在任意時機觸發（prop 變化、state 變化），**不能假設 map style ready**。

### 3. 多層非同步 gate 的 debug 策略
這次 bug 的痛點：從 `hook mount → scene.rebuild → custom layer onAdd → render`
有 4+ 層 gate。只看「沒看到畫面」無法定位是哪層壞。

**預防**：每層**預先**加 log。寫視覺層代碼時，就當 debug 時一定會用到。
詳見 `.claude/lessons.md` P0.2。

## 相關 commit

- mini-taiwan-pulse: `06bfba5` — `feat(water): 水庫互動三合一`
  - `src/hooks/useReservoirStatusLayer.ts` 內的 polling 邏輯

## 相關規則

- `.claude/lessons.md` P0.1 Mapbox custom layer 掛載用 polling
- `.claude/lessons.md` P0.2 視覺層代碼預設加 checkpoint log

---

## 2026-06-18 第二次踩到 — energy beam（usePowerGenerationBeamLayer）

**情境**：能源 MVP v1.3 機組即時出力 3D beam，獨立 hook 改寫成 toggle 才 mount，
完整重蹈 2026-04-22 的覆轍。**症狀完全一樣**：

```
[PowerBeam] mount effect run; visible= true mapReady= true   ✓
[PowerBeam] style 還沒 load，等 style.load 觸發              ← 這行就是死亡標記
[PowerBeam] fetch effect run; visible= true                  ✓
[PowerBeam] load() 開始 fetch 24h...                          ✓
[PowerBeam] fetch 成功：14 廠 × 143 ts                       ✓ 但畫面沒柱
```

`map.isStyleLoaded()` 在 toggle ON 那 frame 回 false → 落入 `map.on("style.load", mount)`
分支 → style 早就 load 過不會再 fire → CustomLayer 永遠沒 addLayer。

**修復走 try/catch + idle 重試**（跟 2026-04-22 的 setInterval 200ms 重試是同類型解）：

```ts
const tryMount = () => {
  if (map.getLayer(LAYER_ID)) return;
  try {
    map.addLayer(layer);
  } catch (e) {
    map.once("idle", tryMount); // style 還在 load → 等 mapbox 安靜下來
  }
};
tryMount();
map.on("style.load", tryMount); // Dark/Light 切換用
```

commit：mini-taiwan-pulse `f6c9566` energy-mvp(v1.3.5)。

**為什麼又踩**：寫獨立 3D hook 時想當然用了 `if (isStyleLoaded()) mount; else map.on("style.load", mount)`
這個「教科書」pattern，但 mapbox 在動態 source swap 時 isStyleLoaded() 會 racy false，
style.load 又只 fire 第一次。**獨立 hook 永遠用 try/catch + idle 重試**，不要相信 isStyleLoaded()。

## 下次寫獨立 Custom Layer hook 的 SOP

> 觸發詞：「3D 圖層 / Three.js / CustomLayer / addLayer / Three.js scene」
> 看到這幾個詞，**立刻打開本檔讀過再開始寫**

1. 不要 `if (isStyleLoaded()) ... else map.on("style.load", ...)`
2. 用 `try map.addLayer + catch → map.once("idle", retry)` 或 setInterval 200ms 重試
3. mount 函式預先加 5 個 checkpoint log（mount entry / styleLoaded? / try addLayer / catch / success ✓）
4. mount + fetch 分兩個 useEffect，**deps 都包 `visible`**（避免 mapRef 初始 null 永遠不重跑）
5. cleanup `map.off("style.load", ...)` + 取消 idle listener 避免 leak
