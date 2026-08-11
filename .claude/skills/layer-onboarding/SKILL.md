---
name: layer-onboarding
description: 從資料落地到 Layer 上線的完整驗收 SOP + UX baseline 表。當用戶說「新資料要接圖層」「PMTiles 好了怎麼上」「這個 layer 為什麼點少了」「這個 layer 的透明度/大小/popup 該怎麼設」「新 layer 該檢查什麼」「上游資料改了下游要跟嗎」「跨 repo 交接資料」時觸發。用來守門「常漏點 / 常漏 UX 設定 / 跨 repo 契約沒對齊」三大痛點。與 `/new-layer` command（產骨架）互補 — 本 skill 專注**驗收 + UX 決策 + 跨 repo 對齊**。
---

# Layer Onboarding SOP

**目的**：把「從 taipei-gis-analytics 資料落地 → mini-taiwan-pulse 上線」變成無法漏項的流程。

## 何時觸發

- 「新 layer 要接」「PMTiles 好了要怎麼上」
- 「這 layer 點怎麼少了」「這 layer 為什麼有些點顯示不出來」
- 「透明度 / 半徑 / popup / 圖例 該怎麼設」
- 「上游改了欄位下游要動嗎」
- Review 一個剛完成的 layer 前

## 步驟總覽

```
Step 0  規劃 (feature 資料夾 + upstream handoff)
Step 1  資料完整性驗收 (count / attrs / 檔名契約)
Step 2  接線 (走 /new-layer 或手動：manifest 一筆 + spec 一筆 + 邏輯檔)
Step 3  UX baseline 套用 (radius / opacity / cluster / min-zoom)
Step 4  四鐵則自檢 (slider / legend / popup / dropdown)
Step 5  跨 repo 對齊 (handoff 反向引用 + commit hash)
Step 6  驗收 (tsc / test / browser All Off 單測)
Step 7  收尾 (changelog + backlog 標 ✅)
```

## Step 0 — 規劃

- 選 slug：kebab-case，例如 `air-quality-station`
- 開 upstream handoff（若還沒）：`taipei-gis-analytics/docs/handoff/<slug>.md`
- 開 downstream feature 資料夾：`cp -r docs/features/_TEMPLATE docs/features/<slug>`
- 開 branch：`git checkout -b feat/<slug>`

## Step 1 — 資料完整性驗收（⚠️ 最常漏的地方）

從 upstream 拿到產物後**先驗數字對得上**，不要急著接線。

### PMTiles

```bash
# 檢查 tile 數 + zoom 範圍
tippecanoe-decode public/xxx.pmtiles | head -20

# 檢查 keep_attrs 是否帶到（隨機挑 tile）
tile-join --version && python3 -c "
import subprocess
# 從 PMTiles 抽 feature 屬性看 keep_attrs 齊不齊
"
```

**常見漏項**：
- keep_attrs 沒帶 → 前端 popup 空白 / 分色失效 → 回上游改 tippecanoe 參數重出
- 扁平檔名契約斷了 → nginx 找不到 → 檢查 `public/` 命名（不要加子資料夾）

### GeoJSON

```bash
# 點數
jq '.features | length' public/xxx.geojson
# 屬性 key 齊不齊
jq '.features[0].properties | keys' public/xxx.geojson
```

### Supabase RPC

```sql
-- 直接跑 EXPLAIN ANALYZE
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.get_xxx(...);
```

**若 > 1s 或 > 10k rows → 立刻套 pre-aggregate pattern**（見 `supabase-optimize` skill）。

### 座標系統

`|Response_X| > 1000` → 是 TWD97 TM2 → 要轉 WGS84。

## Step 2 — 接線

**優先走 `/new-layer <slug>` slash command**（自動產骨架 + 跑 tsc / vitest）。

若手動，強制順序（CLAUDE.md §5 / development-rules §4）——
⚠️ **2026-08-12（AR-22 Phase 4）起登記簿不再手寫**：

1. `src/types/index.ts` → `LayerVisibility` 加 key（可點選再加 `FeatureInfo["layerType"]`）
2. `src/data/layerManifest.ts` → **一筆完整 entry**。`LAYER_COLORS` / `LAYER_ICONS` /
   THEMES 的 LayerDef / `LAYER_LABELS` / `UPSTREAM_REGISTRY` 全部由它派生，**不要手寫**
   - ⚠️ `legend` / `popup` / `params` 寫 `null` = 豁免鐵則 2/3/1 →
     必須同步 `layerConsistency.test.ts` 的對應 ledger **並寫理由**，否則測試紅
3. `src/components/sidebar/layerCatalog.ts` → THEMES 對應子群加一行 `fromManifest("key")`
   （只放位置；SECTIONS / LAYER_LABELS 自動派生）
4. `src/data/layerParamsSpec.ts` → 一筆 `key: [ opacitySlider("keyOpacity", 0.8), … ]`
   （⚠️ 禁去 `useLayerParamsRuntime.ts` 加 `useState` / `case` / deps）
5. `src/data/xxxLoader.ts` → loader + loadingRegistry（⚠️ 禁靜默 rpc().then()）
6. `src/hooks/useXxxLayer.ts` → React hook（⚠️ 動態圖層禁 currentTime 進 deps）
7. `src/map/overlayRegistry.ts` 或 CustomLayer（`sourceId` 要與 manifest 的 `source` 逐字相同）
8. `src/App.tsx` → 接線
9. 預設開啟的層才需要碰 `src/state/layerVisibilityStore.ts` 的 `DEFAULT_ON`
   （現為空集合；key 全集自動派生）

## Step 3 — UX Baseline 表（照類型套，不用猜）

### 點層 POI

| 資料密度 | radius (zoom 6) | radius (zoom 12) | opacity 預設 | cluster？ |
|---|---|---|---|---|
| < 1k | 4px | 8px | 0.9 | 否 |
| 1k ~ 10k | 3px | 6px | 0.85 | 否 |
| 10k ~ 100k | 2px | 5px | 0.75 | 可選（zoom < 10 開） |
| > 100k | 1.5px | 4px | 0.6 | **必開** cluster + 低 zoom `-r` 抽稀 |

### 線層

| 類型 | width (zoom 6) | width (zoom 14) | opacity |
|---|---|---|---|
| 主要路網 | 1px | 3px | 0.9 |
| 次要路網 | 0.5px | 2px | 0.7 |
| 軌跡 / 流向 | 2px | 4px | 0.85 |

### Polygon / 覆蓋

| 類型 | fill-opacity | outline width |
|---|---|---|
| 熱區 / 密度圖 | 0.55 | 0 |
| 行政區 | 0.15 | 0.5px |
| 覆蓋範圍（等時圈類） | 0.35 | 1px |

### Raster / 影像

- 預設 opacity 0.7（可蓋底圖）
- Slider 範圍 0.3 ~ 1.0

### 3D / CustomLayer

- 先跑 `three-3d-component` skill 看元件庫
- 確認 dispose / blending / 動態時間源

**所有 layer 都必提供 opacity slider**（見四鐵則 #1）。

## Step 4 — 圖層 UX 四鐵則自檢

| # | 鐵則 | 檢查 |
|---|---|---|
| 1 | 透明度 slider | `useTransportParams.ts` 有 opacity control？ |
| 2 | 分類 ≥ 2 種必寫圖例 | `LEGEND_REGISTRY` 有加？`LegendPanel.tsx` sub-component 有寫？ |
| 3 | 可選取物件必接 click popup | `useMapInteraction.ts` + `featureInfo/registry.tsx` 有加？ |
| 4 | Select options ≥ 4 用原生 `<select>` | `ctrl.options.length > 3` 自動切 dropdown？ |

`layerConsistency` test 會擋 #2，但 #1/#3/#4 靠自檢。

## Step 5 — 跨 repo 對齊

**必動的四份檔**：
1. `taipei-gis-analytics/docs/handoff/<slug>.md` — 資料契約 SSOT（upstream）
2. `mini-taiwan-pulse/docs/features/<slug>/handoff.md` — 反向引用 + 硬依賴欄位表
3. `mini-taiwan-pulse/docs/features/<slug>/changelog.md` — 本次 PR 記
4. `mini-taiwan-pulse/docs/features/<slug>/backlog.md` — 對應項標 ✅

**若動到資料契約 → 開 ADR**：`taipei-gis-analytics/docs/adr/NNNN-<title>.md`。

## Step 6 — 驗收

```bash
# TypeScript 驗證（禁 --noEmit）
npx tsc -b

# 全站測試（含 layerConsistency 擋漏圖例）
pnpm test

# Browser：按「All Off」→ 只開新 layer → 邊界 zoom / timeline 都測
pnpm dev
```

**常見驗收失敗**：
- TS2739 → `LayerVisibility` 加了 key 但 `layerManifest.ts` 沒補 entry
- layerConsistency「沒有 manifest entry」→ 同上（別塞 `HANDWRITTEN_LAYER_COLORS` 繞過）
- layerConsistency「宣告了『沒有 X』但沒登記進 ledger」→ manifest 寫了 `null`，
  去該測試檔的 `NO_LEGEND_LEDGER` / `NO_POPUP_LEDGER` / `NO_PARAMS_LEDGER` 補一行 + 理由
- layerManifest「legend 宣告了但 LEGEND_REGISTRY 沒覆蓋」→ LegendPanel 沒加
- Browser 打不出 popup → useMapInteraction 的 GIS_LAYERS 沒 register

## Step 7 — 收尾

- 更新 `docs/features/<slug>/changelog.md`（PR # + squash hash）
- 更新 `docs/features/<slug>/backlog.md` 標 ✅
- 更新 `.claude/memory/STATUS.md` 加最新段落
- 若踩到新坑 → 寫 `.claude/pitfalls/YYYY-MM-DD-<slug>.md`
- 若學到 P0 規則 → 補進 `.claude/memory/PRINCIPLES.md`

## 常漏點快速索引

看 [`.claude/pitfalls/2026-07-01-layer-integration-common-misses.md`](../../pitfalls/2026-07-01-layer-integration-common-misses.md)。

## Related

- Command：`/new-layer` — 產骨架
- Skill：`supabase-optimize` — RPC 效能
- Skill：`three-3d-component` — 3D layer
- Skill：`gis-data-onboard`（在 taipei-gis-analytics）— 資料落地路由
- Rules：`CLAUDE.md §5 §5a` + `docs/development-rules.md`
