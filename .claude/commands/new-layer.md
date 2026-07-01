---
description: 依專案規則自動產生新 Layer 的完整檔案骨架 + 觸發 layer-onboarding 驗收 SOP
argument-hint: <layerKey> [--static|--dynamic] [--source=supabase|geojson]
---

# /new-layer

為 Mini Taiwan Pulse 新增一個地圖圖層。

**本 command 只負責產骨架**。UX 決策 / 資料驗收 / 跨 repo 對齊 → 走 [`layer-onboarding`](../skills/layer-onboarding/SKILL.md) skill（本 command 執行完會自動提示）。

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

## 必產生 / 修改的檔案（7 步強制順序）

1. **`src/types/index.ts`** — `LayerVisibility` interface 加 `$1: boolean`
2. **`src/data/$1Loader.ts`** — Supabase / PMTiles loader（所有非同步都包 `withLoading(id, label, promise)`，來自 `src/lib/loadingRegistry.ts`）
3. **`src/hooks/use$1Layer.ts`** — React hook
   - ⚠️ 動態圖層：`currentTime` **禁止**進 useEffect deps，改走 `timeStore.subscribeThrottled(ms, cb)`（CLAUDE.md §6）
4. **`src/map/overlayRegistry.ts`** 或 **`src/map/$1CustomLayer.ts`**
5. **`src/components/sidebar/layerCatalog.ts`** — ⚠️ `LAYER_COLORS` 補 `$1: "#XXX"`（漏了會 tsc TS2739）+ `SECTIONS` 對應分區加 `$1`
6. **`src/App.tsx`** — 接線
7. **`src/hooks/useLayerVisibility.ts`** — 僅「預設開啟」才加 `DEFAULT_ON`

## Step 2 — 骨架驗證

```bash
npx tsc -b        # 必過
pnpm test         # layerConsistency 會擋漏 legend
```

## Step 3 — ⭐ 立即接著跑 `layer-onboarding` skill

**產完骨架不算完成**。以下事情由 skill 引導：

- 資料完整性驗收（PMTiles keep_attrs / 座標 / 點數）
- UX baseline 表套用（radius / opacity / cluster / min-zoom）
- 四鐵則自檢（slider / legend / popup / dropdown）
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
- Rules：`CLAUDE.md §5 §5a §Git Workflow`
