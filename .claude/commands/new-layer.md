---
description: 依專案規則自動產生新 Layer 的完整檔案骨架 + 觸發 layer-onboarding 驗收 SOP
argument-hint: <layerKey> [--static|--dynamic] [--source=supabase|geojson]
---

# /new-layer

為 Mini Taiwan Pulse 新增一個地圖圖層。

**本 command 只負責產骨架**。UX 決策 / 資料驗收 / 跨 repo 對齊 → 走 [`layer-onboarding`](../skills/layer-onboarding/SKILL.md) skill（本 command 執行完會自動提示）。

> ⚠️ **2026-08-12（AR-22 Phase 4）改版**：舊版的「7 步強制順序」裡有 5 個接觸點是
> **登記簿**（`LAYER_COLORS` / `LAYER_ICONS` / THEMES 的 label / `UPSTREAM_REGISTRY` /
> `useTransportParams` 的 `case`），現在**全部由 `layerManifest.ts` 與 `layerParamsSpec.ts`
> 兩筆宣告派生**。新流程是 **manifest 一筆 ＋ spec 一筆 ＋ 實質邏輯檔**。
>
> 舊版還要求手動改 `useLayerVisibility.ts` 的 `DEFAULT_ON` ——
> 那張表的 key 全集已由 `LAYER_COLORS` 派生且現為空集合，**預設關的層完全不用碰**。

## 參數

- `$1` (必填): layer key，camelCase，例如 `busRoutes` / `floodZones`
- `--static` / `--dynamic` (擇一)：
  - `static` = Mapbox overlayRegistry（GeoJSON / PMTiles，fill/line/circle）
  - `dynamic` = Custom WebGL layer 或 Three.js scene（時序動畫）
- `--source=supabase|geojson|pmtiles`：資料來源

## Step 0 — 開跑前必做（⚠️ 不可跳）

跑本 command 前先確認：

1. **Feature slug 已定**（kebab-case，例如 `flood-zones`）
2. **開分支**：`git checkout -b feat/<slug>`
3. **建 feature 資料夾**：
   ```bash
   cp -r docs/features/_TEMPLATE docs/features/<slug>
   ```
4. **若涉新資料 / 資料契約**：先開 upstream handoff
   ```bash
   cp taipei-gis-analytics/docs/handoff/_TEMPLATE.md \
      taipei-gis-analytics/docs/handoff/<slug>.md
   ```

## Step 1 — 產骨架

使用 `layer-creator` subagent 處理樣板產生。委派時傳入：
1. Layer key（從 $1）
2. Layer 類型（static/dynamic）
3. 資料來源
4. 現有類似 layer 參考（若 static → `earthquakes` / `disasterAlerts`；若 dynamic → `freewayCongestion` / `cwaImagery`）

## 必產生 / 修改的檔案（新三步 ＋ 條件觸點）

### ① 型別入口

**`src/types/index.ts`** — `LayerVisibility` interface 加 `$1: boolean`。
若這層可點選 → 同檔 `FeatureInfo["layerType"]` union 也加一個 layerType。

🔒 tsc：下游多張 `Record<keyof LayerVisibility, T>` 會立刻 TS2739。

### ② manifest 一筆（**取代舊版 5 個登記簿觸點**）

**`src/data/layerManifest.ts`** — `LAYER_MANIFEST` 加一筆完整 entry：

```ts
$1: {
  key: "$1",
  section: { theme: "水資源 Water", group: "河川" },  // orphan 才寫 null
  label: "中文名 English",
  // labelMobile / expandable / gated 選填
  color: "#0284c7",
  icon: Waves,                       // lucide 元件參照，不是字串
  upstream: { status: "verified", datasets: [{ datasetId: "…", confidence: "HIGH" }] },
  dataClass: "A",                    // A 靜態 GeoJSON / B PMTiles / C Supabase / D 自行接線
  source: { kind: "geojson", sourceId: "$1-src", url: "./$1.geojson" },
  legend: null,                      // 分類 ≥ 2 色就要填圖例 id（鐵則 2）
  popup: null,                       // 可點選就填 FeatureInfo 的 layerType（鐵則 3）
  params: { count: 1, kinds: ["slider"] },   // 沒有控件寫 null（鐵則 1）
  description: "一句話說明這層在講什麼",
  topics: ["水資源", "河川"],
},
```

**這一筆自動派生**：`LAYER_COLORS`／`LAYER_ICONS`／`UPSTREAM_REGISTRY`／
THEMES 的 `LayerDef`（label / labelMobile / expandable / gated）／`LAYER_LABELS`。
**不要**再去那幾張表手寫任何一行。

⚠️ 三個 `null` 不是預設值，是**豁免宣告**：寫了 null 就必須同步到
`src/components/sidebar/__tests__/layerConsistency.test.ts` 的對應 ledger
（`NO_LEGEND_LEDGER` / `NO_POPUP_LEDGER` / `NO_PARAMS_LEDGER`）加一行**並寫下理由**，
否則測試紅。這是刻意的——豁免 UX 鐵則必須是有意識的決定。

🔒 `layerConsistency.test.ts`（key 空間完整 ＋ 必要欄有真值 ＋ 豁免 ledger）
＋ `layerManifest.test.ts`（每一欄與下游登記簿逐一對帳）。

### ③ sidebar 位置

**`src/components/sidebar/layerCatalog.ts`** — `THEMES` 對應子群加一行
`fromManifest("$1")`。**只放位置**（label / expandable / gated 都從 manifest 來）。
`SECTIONS` / `LAYER_LABELS` 由 THEMES 自動派生，不用碰。

🔒 `layerConsistency.test.ts`（manifest `section` ⇔ `ORPHAN_LEDGER`）
＋ `layerManifest.test.ts`（`section` 宣告 ⇔ THEMES 實際位置，雙向）。

### ④ params 規格一筆

**`src/data/layerParamsSpec.ts`** — `LAYER_PARAMS_SPEC` 加一筆：

```ts
$1: [
  opacitySlider("$1Opacity", 0.8),   // 鐵則 1 強制
  scaleSlider("$1Scale", 1),
],
```

控件長相／預設值／`overlayParams` 編碼三者全由這筆派生。
⚠️ **不要**去 `src/hooks/useLayerParamsRuntime.ts` 加 `useState`／`case`／deps ——
那支的 switch 已於 Phase 4 清空，加回去有測試擋。
多個 key 共用同一份值 → 該參數填同一個 `sharedGroup` id。

### ⑤ 實質邏輯檔（骨架產生器真正要寫程式的地方）

| 檔 | 內容 |
|---|---|
| `src/data/$1Loader.ts` | 所有 fetch / RPC 包 `withLoading(id, label, promise)`；`setData` 後接 `keepLoadingUntilMapIdle` |
| `src/hooks/use$1Layer.ts` | React hook。⚠️ 動態圖層：`currentTime` **禁止**進 useEffect deps，改走 `timeStore.subscribeThrottled(ms, cb)`（CLAUDE.md §6） |
| `src/map/overlayRegistry.ts` **或** `src/map/$1CustomLayer.ts` | static → registry entry（`sourceId` 必須與 manifest 的 `source.sourceId` 逐字相同）；dynamic → CustomLayer |
| `src/App.tsx` | 引入 hook、傳 props 到 MapView |

### ⑥ 條件觸點（不是每層都要）

| 條件 | 要動 |
|---|---|
| 分類 ≥ 2 色（鐵則 2） | `LegendPanel.tsx` 寫 sub-component ＋ 同檔 `LEGEND_REGISTRY` 加一行；manifest `legend` 填該 id |
| 可點選（鐵則 3） | `featureInfo/<domain>Panels.tsx` 寫 panel ＋ `featureInfo/registry.tsx` 的 `PANEL_REGISTRY` + `HEADER_LABELS` 各加一行 ＋ `useMapInteraction.ts` 的 `GIS_LAYERS` 加條目（**first-hit-wins**：小範圍排前、大面積背景排後）；manifest `popup` 填該 layerType |
| 分類色票要三邊共用 | 抽 `src/data/$1Types.ts` 供 factory / featureInfo / legend 三邊 import |
| PMTiles / 大型靜態檔 | `nginx.conf` location ＋ `scripts/deploy/upload-deploy-assets.sh` / `pull-deploy-assets.sh` 清單（⚠️ PT-1 曾漏此步導致 13 層全站 404） |
| 想讓 BYOK 對話查得到 | `src/chat/tools/datasets.ts` 的 `DATASET_WHITELIST` |

> 完整 20 項觸點表（含每項的守門機制）→ [`docs/development-rules.md` §4](../../docs/development-rules.md)

## Step 2 — 骨架驗證

```bash
npx tsc -b                                              # 必過
npx vitest run                                          # 全綠
npx vite-node scripts/preprocess/dump-layer-golden.ts   # 只有新 key 那幾行該動
git diff src/data/__tests__/__fixtures__/layer-golden.json   # 逐行 review
```

⚠️ 黃金快照 fixture 只凍 `overlays` / `params` / `gisLayers` 三個 section。
**既有層的任何 diff 都是回歸**——回去修程式，不要無腦重跑 dump 腳本。

## Step 3 — ⭐ 立即接著跑 `layer-onboarding` skill

**產完骨架不算完成**。以下事情由 skill 引導：

- 資料完整性驗收（PMTiles keep_attrs / 座標 / 點數）
- UX baseline 表套用（radius / opacity / cluster / min-zoom）
- 四鐵則自檢（slider / legend / popup / select）
- 跨 repo handoff 對齊
- Feature 資料夾 changelog / backlog 更新

## Step 4 — 收尾

- 更新 `docs/features/<slug>/changelog.md`
- 更新 `docs/features/<slug>/backlog.md` 對應項標 ✅
- 若動到資料契約 → 開 ADR
- 走 GitHub Flow PR（模板見 CLAUDE.md §Git Workflow）

## Command 完成後自動輸出

執行 command 的 Claude 完成骨架後，**必須用一句話提示用戶**：

> ✅ 骨架完成。接著走 `layer-onboarding` skill 完成 Step 1（資料驗收）→ Step 3（UX baseline）→ Step 5（跨 repo 對齊）→ Step 7（收尾）。

## 範例

```
/new-layer floodZones --static --source=pmtiles
/new-layer typhoonPaths --dynamic --source=supabase
```

## Related

- Skill：`layer-onboarding`（驗收 + UX + 跨 repo）— **本 command 結束後必跑**
- Skill：`supabase-optimize`（若 RPC > 1s）
- Skill：`three-3d-component`（若走 3D CustomLayer）
- Rules：`CLAUDE.md §5 §5a §Git Workflow`、`docs/development-rules.md §4 §4a`
- 工程紀錄：`docs/features/layer-manifest/`（manifest 為什麼長這樣、豁免 ledger 的由來）
