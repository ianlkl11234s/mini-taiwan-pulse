---
description: 依專案規則自動產生新 Layer 的完整檔案骨架
argument-hint: <layerKey> [--static|--dynamic] [--source=supabase|geojson]
---

# /new-layer

為 Mini Taiwan Pulse 新增一個地圖圖層。依照 `CLAUDE.md` 定義的「新增 Layer 強制順序」產生所有必要檔案。

## 參數

- `$1` (必填): layer key，camelCase，例如 `busRoutes` / `floodZones`
- `--static` / `--dynamic` (擇一)：
  - `static` = Mapbox overlayRegistry（GeoJSON，fill/line/circle）
  - `dynamic` = Custom WebGL layer 或 Three.js scene（時序動畫）
- `--source=supabase|geojson`：資料來源

## 執行步驟

使用 `layer-creator` subagent 處理樣板產生。委派時一併傳入：
1. Layer key（從 $1）
2. Layer 類型（static/dynamic）
3. 資料來源
4. 現有類似 layer 參考（若 static → `earthquakes` / `disasterAlerts`；若 dynamic → `freewayCongestion` / `cwaImagery`）

## 必須產生/修改的檔案

1. **`src/types/index.ts`** — `LayerVisibility` interface 新增 `$1: boolean`
2. **`src/data/$1Loader.ts`** — Supabase loader（含 `loadingRegistry.start/complete`）
3. **`src/hooks/use$1Layer.ts`** — React hook（state + effect + cleanup）
4. **`src/map/overlayRegistry.ts`** 或 **`src/map/$1CustomLayer.ts`**
5. **`src/components/sidebar/layerCatalog.ts`** — ⚠️ `LAYER_COLORS` 補 `$1: "#XXX"`（漏了會 tsc error TS2739）+ `SECTIONS` 對應分區加 `$1`（單一真實來源，桌機/手機兩側欄共用）；UI toggle 渲染仍在 `IconRailSidebar.tsx` / `LayerSidebar.tsx`
6. **`src/App.tsx`** — 接線
7. **`src/hooks/useLayerVisibility.ts`** — 預設可見性

## 檢查清單（agent 完成後執行）

```bash
npx tsc -b        # 必須通過
```

- [ ] `LAYER_COLORS` 有補上（編譯時會強制，沒補會 error TS2739）
- [ ] Loader 有呼叫 `loadingRegistry.start()` / `.complete()`
- [ ] Toggle layer 時 UI 有 loading 浮層
- [ ] 若是 Supabase RPC，響應時間 < 1s（否則先跑 `/check-rpc` 判斷是否需要 pre-aggregate）

## 範例

```
/new-layer floodZones --static --source=geojson
/new-layer typhoonPaths --dynamic --source=supabase
```
