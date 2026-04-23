# Claude Lessons — Mini Taiwan Pulse

> **本檔是 Claude 每次 session 開頭必讀的 P0 規則累積。**
> 每條規則都來自一次實戰教訓。違反成本以 hours 計。
>
> 來源：`.claude/retrospectives/` 升級；新規則請附出處 retro 連結。

---

## P0 — 必守規則

### P0.1 Mapbox custom layer 掛載用 polling，不要 `map.once('load', ...)`

**情境**：在 hook 裡 `map.addLayer(customLayer)` 時 style 可能暫時未 ready。

**錯誤模式**：
```ts
if (map.isStyleLoaded()) attach();
else map.once('load', attach);  // ❌ load 已 fire 過 → 永不觸發
```

**正確模式**：polling 重試直到 ready：
```ts
const tryAttach = () => {
  if (cancelled || mountedRef.current) return;
  if (!map.isStyleLoaded()) return; // 下一個 tick 再試
  attach();
};
if (map.isStyleLoaded()) attach();
else {
  const timer = setInterval(tryAttach, 200);
  return () => clearInterval(timer);
}
```

**為何 StationPillarScene 沒踩**：它跟著 `addAllLayers` 在 `handleMapReady` 呼叫，
此時 style 保證 ready，所以既有 pattern 看起來 OK，但**獨立 hook 不能照抄**。

來源：[2026-04-22 retro](./retrospectives/2026-04-22-water-phase-1.md#P0)，
詳細 debug 過程：[pitfall](./pitfalls/2026-04-22-mapbox-load-once-fired.md)

---

### P0.2 視覺層代碼 `tsc -b` 通過不代表能動，預設加 checkpoint log

**情境**：寫 Three.js scene / Mapbox custom layer / WebGL shader / Canvas drawing 等
**非 React 純 state 的視覺代碼**。

**錯誤心態**：「tsc 通過 → 完成」。

**事實**：從 hook mount → scene setup → RPC fetch → setStatuses → custom layer
`onAdd` → `render` 是**多層非同步 gate**，任何一層壞掉視覺都表現為「什麼都沒發生」。
沒 log 就只能瞎猜。

**強制 checkpoint**（功能驗證前先加，驗證後再決定要不要拔，建議保留）：

| 位置 | log 內容 |
|---|---|
| hook mount useEffect | visible / map ready / mounted 狀態 |
| RPC fetch 返回 | 筆數 + 第一筆 sample |
| scene.setX 入口 | input count |
| scene.rebuild | mesh count + 第一個 instance 的 position / scale |
| custom layer onAdd | 被呼叫過了 |
| custom layer render 第 1/60 次 | initialized / visible / data count |

log 頻率控制：render 那層用 `if (n <= 3 || n % 60 === 0)` 避免每 frame 吵。

**反例驗證清單**（看到這些症狀就是踩到 P0.2）：
- 「tsc 通過但畫面沒東西」
- 「所有依賴看起來都載入了但就是看不到」
- 「某個水庫打開有反應但沒視覺變化」

來源：[2026-04-22 retro](./retrospectives/2026-04-22-water-phase-1.md#P0)

---

## P1 — 應遵守

_（沒有條目 = 沒 promote 上來。新 P1 累積 2 次就會升 P0。）_

---

## 常用 pattern（非必守，但可復用）

### React hook 掛 Mapbox custom layer 的完整 skeleton

見 `src/hooks/useReservoirStatusLayer.ts`（2026-04-22 建立的 reference 實作）。
關鍵：
1. `visible` prop 變 true 才首次 mount（handleMapReady 的時序跟 hook mount 不同步）
2. Polling 200ms 重試 attach 直到 `isStyleLoaded()`
3. 不在 cleanup 移除圖層（避免 StrictMode double-invoke 時損失資料）
4. Scene 的 refresh（如 statusesRef 更新）**在 scene 掛好後立即 setX**

### PostGIS 的 ST_Intersection 效能

大幾何 × polygon 做 ST_Intersection 時，**Simplify 放在 Intersection 之後**
（對剪完的小幾何），可以 10-20x 提速。見 `gis-platform/migrations/053`。

---

## Deprecated

_（目前無）_

---

## Meta

- 最後更新：2026-04-22
- 規則數：P0 × 2 / P1 × 0
- 目標：控制 P0 總數 ≤ 10（超過代表規則沒被內化，需要重新設計 review 流程）
