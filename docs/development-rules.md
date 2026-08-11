# Mini Taiwan Pulse — 開發規則（詳細版）

> CLAUDE.md 是精簡版規則索引，本文件是完整 rationale + 範例。

## 1. 資料來源管理

### Supabase 為主，靜態檔為輔
- **動態時序資料**（船舶、航班、溫度、壅塞、地震、災害示警 等）→ Supabase RPC
- **靜態 GeoJSON**（機場、港口、燈塔、路網 等）→ `public/*.geojson`
- **大型預聚合 JSON**（H3、rail_bundle、station_pillars）→ `public/`（由 S3 deploy-assets 管理）

### Schema 分工
| Schema | 用途 | 前端可讀 |
|---|---|---|
| `realtime` | 高頻時序（ship/flight/freeway/temperature/disaster...） | ❌（要透過 public RPC） |
| `reference` | 低頻參考（daily_schedules, temperature_grid_cells） | ✅ 可 PostgREST 直讀 |
| `spatial` | 空間分析（boundaries, h3_demographics） | ✅ |
| `metadata` | 系統管理 | ❌ |
| `public` | 所有對前端開放的 RPC wrapper | ✅ |

**Rule**: 前端只用 `public.*` RPC 或 `reference.*` / `spatial.*` 直讀。不允許前端直接打 `realtime.*`。

### 環境變數
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（前端）
- `SUPABASE_SERVICE_ROLE_KEY`（腳本，禁止進前端 bundle）
- `SUPABASE_DB_URL`（psql 直連，腳本用）

## 2. 資料載入規範（必配 Loading UI）

### 原則
**所有** 透過 Supabase 的非同步載入，使用者必須看到「正在載入什麼」。

### 觸發場景（必須有 loading）
- 初次載入（LoadingScreen）
- 切換 timeline 日期
- Toggle 圖層開關（若 layer 首次開啟會打 DB）
- 切換 layer 參數（若會重抓資料）

### 實作方式
使用 `src/lib/loadingRegistry.ts` + `src/hooks/useLoadingTasks.ts`：

```typescript
// Loader 端：所有 fetch / RPC 包 withLoading（自動 start / end）
import { withLoading } from "../lib/loadingRegistry";

export async function loadXxxData(date: string) {
  const { data, error } = await withLoading(
    `xxx:${date}`,
    `載入 XXX ${date}`,
    supabase.rpc("get_xxx", { target_date: date }),
  );
  if (error) throw error;
  return data;
}
```

```typescript
// Mapbox setData / updateImage 之後：延續 loading 直到真正畫上地圖
// （withLoading 只涵蓋 RPC 返回；不接這段使用者會看到 loading 消失但圖還沒出來）
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";

source.setData(geojson);
keepLoadingUntilMapIdle(map, `xxx-render:${date}`, "XXX 渲染中", SOURCE_ID);
```

```tsx
// Hook 端：React state + loading 自動綁定
export function useXxxLayer(date: string, enabled: boolean) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    loadXxxData(date).then(setData).catch(console.error);
  }, [date, enabled]);
  return data;
}
```

`LoadingIndicator` 會自動從 `loadingRegistry` 訂閱所有 task，顯示在右上角。

### 反例（禁止）
```typescript
// ❌ 靜默抓取
useEffect(() => {
  supabase.rpc("get_xxx").then(({ data }) => setData(data));
}, []);
```
→ 使用者看不到 loading，誤以為當機。

## 3. 資料庫優化（Pre-aggregate Pattern）

### 觸發條件
任何 RPC **任一** 條件成立就必須套 pattern：
- 響應時間 > 1 秒
- 回傳 > 10,000 rows
- 對分區表做 cross-partition 掃描
- 含 string_agg / ST_Union / 複雜 JOIN

### SOP
1. 先 `EXPLAIN (ANALYZE, BUFFERS) SELECT ...` 確認瓶頸
2. `ANALYZE` 更新統計看能不能改善 plan（可能就夠了）
3. 真需要預聚合 → 照 `docs/supabase-optimization.md` pattern
4. SQL 範本放 `../data-collectors/docs/sql/matview_xxx.sql`
5. 加進 `docs/supabase_rpc_audit.md` 追蹤

### 禁止
- ❌ 用 `MATERIALIZED VIEW`（一次 REFRESH 會撞 pooler 2min timeout）
- ❌ 前端自己做 N+1 query 拼資料
- ❌ 假設 Supabase pooler statement_timeout 可以繞過

## 4. 新增 Layer 流程（完整觸點表）

> 2026-08-10 稽核（`docs/research/architecture-audit-2026-08-10.md` C-2）用 3 個真實 commit 實測
> （落雷單層 11 檔 29 hunk／殯葬 5 層 14 檔／教育 16 層同 14 檔＝規模經濟），發現舊版「7 步」漏了
> 7 個觸點——新人照舊表做必漏。下表是完整版，🔒 = tsc 或測試強制擋漏接，⚠️ = 只能靠人工 review。

| # | 檔案 | 動作 | 守門 |
|---|---|---|---|
| 1 | `src/types/index.ts` | `LayerVisibility` interface 加 key | 🔒 tsc（下游多處 `Record<keyof LayerVisibility,T>` 全部強制） |
| 2 | `src/types/index.ts` | 若可點選：`FeatureInfo["layerType"]` union 加 key | 🔒 tsc（`HEADER_LABELS` 是 Record，見 #15） |
| 3 | `src/data/xxxLoader.ts` | 寫 loader，Supabase RPC / 靜態 fetch 包 `withLoading` | 🔒 `loadingRegistryContract.test.ts`（檔名需符合 `/Loaders?\.ts$/`；`intelLoaders.ts` 複數檔名曾逃過舊版 filter，已修） |
| 4 | `src/data/xxxTypes.ts` | 若分類 ≥2 種：色/標籤 SSOT，供 factory / featureInfo / legend 三邊 import | ⚠️ 人工（漏建會導致三邊各自 inline hex，見 PRINCIPLES 三邊色彩一致性段） |
| 5 | `src/hooks/useXxxLayer.ts` | React hook：state + 觸發 loader + cleanup | ⚠️ 人工 |
| 6 | `src/map/overlayRegistry.ts` 或 `src/map/xxxCustomLayer.ts` | 靜態 → registry entry；動態 → CustomLayer | ⚠️ 人工 |
| 7 | `src/components/sidebar/layerCatalog.ts` | `LAYER_COLORS` 加 key | 🔒 tsc（`Record<keyof LayerVisibility,string>`，漏了 TS2739） |
| 8 | `src/components/sidebar/layerCatalog.ts` | `SECTIONS` 對應分區加 key（單一真實來源，桌機/手機兩側欄共用；UI toggle 渲染在 `IconRailSidebar.tsx` / `LayerSidebar.tsx`） | 🔒 `layerConsistency.test.ts`（`BASELINE_NOT_IN_SIDEBAR` ratchet） |
| 9 | `src/App.tsx` | 接線：引入 hook、傳 props 到 MapView | ⚠️ 人工 |
| 10 | `src/hooks/useLayerVisibility.ts` | 僅預設開啟才需要：加進 `DEFAULT_ON`；預設 false 自動派生免改 | ⚠️ 人工（`Set`，非 `Record`，tsc 不強制） |
| 11 | `src/data/layerParamsSpec.ts` | 在 `LAYER_PARAMS_SPEC` 加**一筆** `key: [ …控件… ]`（opacity slider 由規則 1 強制）。控件長相／預設值／`overlayParams` 編碼三者全由這筆規格派生 —— **不要**再去 hook 加 `useState`／`case`／deps，見下方「§4 params 新流程」 | 🔒 `layerConsistency.test.ts`（`BASELINE_NO_PARAMS` ratchet，判準走 `isMigratedParamsKey`）+ `layerParamsSharedState.test.ts`（共用 slot / 殘影）+ 黃金快照 `params` section |
| 11a | `src/data/layerManifest.ts` | 同一筆 entry 的 `params: { count, kinds }`（沒有控件寫 `null`） | 🔒 `layerManifest.test.ts`「params 宣告 = 實際回傳的控件數與型別序列」 |
| 12 | `src/components/LegendPanel.tsx` | 若規則 2 觸發：寫圖例 sub-component | ⚠️ 人工（元件內容本身無格式測試） |
| 13 | `src/components/LegendPanel.tsx` | 同檔 `LEGEND_REGISTRY` 加一行 | 🔒 `layerConsistency.test.ts`——但只擋**新**漏接，`BASELINE_NO_LEGEND` 批次凍結的舊漂移不會被抓（見 A-1）；`AqiLegend` 目前繞過本 registry，勿沿用此例 |
| 14 | `src/components/featureInfo/<domain>Panels.tsx` | 若規則 3 觸發：寫 popup panel 元件 | ⚠️ 人工 |
| 15 | `src/components/featureInfo/registry.tsx` | `PANEL_REGISTRY` + `HEADER_LABELS` 各加一行 | 🔒 `registry.test.ts`（ratchet，`HEADER_LABELS` 是 Record 定全集） |
| 16 | `src/hooks/useMapInteraction.ts` | `GIS_LAYERS` 陣列加 `{ layers: [...], type: "..." }`（**first-hit-wins**：細節豐富的小範圍排前面，大面積背景排後面） | ⚠️ `mapInteractionLayers.test.ts` **只驗證已存在條目的 layer id 是否真實**，**不驗證新圖層是否漏加條目**——2026-08-10 稽核標為守門盲點 |
| 17 | `src/components/IconRailSidebar.tsx` | `LAYER_ICONS` 加 key | 🔒 tsc（`Record<keyof LayerVisibility,LucideIcon>`） |
| 18 | `src/data/upstreamRegistry.ts` | 加資料血緣條目（對應 taipei-gis-analytics catalog dataset） | 🔒 `upstreamRegistry.test.ts`（涵蓋所有 `LAYER_COLORS` keys） |
| 19 | `src/chat/tools/datasets.ts` | 選配：若是點狀＋有分類欄位的靜態 GeoJSON，想讓 BYOK 對話查詢，加進 `DATASET_WHITELIST` | ⚠️ 人工（非強制） |
| 20 | `nginx.conf` + `scripts/deploy/upload-deploy-assets.sh` / `pull-deploy-assets.sh` | 僅 PMTiles／大型靜態檔層：nginx location 對應 + deploy 腳本清單加檔名 | ⚠️ 人工——PT-1 曾因漏此步，13 層全站 404 |

**條件觸發（並非每層都要）**：#4（無多色分類可省）、#10（非預設開可省）、#12-15（無可 popup 屬性可省）、#19（不想開放對話查詢可省）、#20（非 PMTiles/純 Supabase 動態層可省）。

### §4 params 新流程：**規格一筆 + 控件自動生成**（AR-22 Phase 3 完成後）

> 2026-08-12 起 `useTransportParams.ts` 已更名 `src/hooks/useLayerParamsRuntime.ts`，
> 且**不再持有任何參數**（`useState` 645 → 0，348 key 中 336 個走規格）。
> 舊流程「加 state ＋ 加 `case` ＋ 加 `overlayParams` 一行 ＋ 加 deps 一項」共 4-5 個 hunk，
> 現在是**一個檔一筆宣告**。

**做法**——在 `src/data/layerParamsSpec.ts` 的 `LAYER_PARAMS_SPEC` 加一筆：

```ts
myNewLayer: [
  // slider：label 印成 `透明度 0.80`；`out` 省略 = 用參數名當 overlayParams key
  opacitySlider("myNewLayerOpacity", 0.8),
  scaleSlider("myNewLayerScale", 1),
  // select：store 存字串，`encode` 宣告字串 → 數字的對照，paint 讀到的是 index
  {
    kind: "select", name: "myNewLayerMode", label: "模式", default: "all",
    options: MY_MODES, out: "myNewLayerModeIdx", encode: ["all", "a", "b"],
  },
],
```

自動發生的三件事（都**不用**再手寫）：

| 你不用做 | 誰做的 |
|---|---|
| `getControls` 的 `case` | `state/layerParamsControls.ts` 的 `buildParamControls()` 從規格派生 |
| 值的 state ＋ 預設值 | `state/layerParamsStore.ts`（`buildDefaultParams()` 從規格的 `default` 起手） |
| `overlayParams` 的一行 ＋ deps 的一項 | `encodeParamsToOverlay()` 從規格的 `out` / `encode` 派生 |

**只有這幾種情況才需要碰 `useLayerParamsRuntime.ts`**：

1. 這個參數的消費者**不是 paint**，而是 React／Three.js（`refs.current`、子物件、平鋪欄位）
   → 規格寫 `out: null`，並在 hook 的 `return {}` 接一條線；
   同時**必須**在 `__tests__/useLayerParamsRuntimeReturn.test.ts` 的 `RETURN_CHANNEL`
   宣告它的回傳路徑（活文件，漏了等值閘 B 立刻紅）。
2. 這層**有意沒有控件**（純靜態展示層）→ 兩種寫法擇一：manifest 寫 `params: null`
   ＋ hook 留一個 `emptyByDesign` 分支（現存 5 個），或列進 `BASELINE_NO_PARAMS`。
3. 鏡像 ref：一律用 `useParamRefNum` / `useParamRefBool` / `useParamRefEnum`，
   ⚠️ **initial 吃規格常數、current 才吃 store 現值** —— 兩者同源會讓「刪掉同步賦值」
   這個突變在測試裡驗不出來（每次 capture 都是全新 mount）。

**驗收**：`npx tsc -b` ＋ `npx vitest run`，且 `src/data/__tests__/__fixtures__/layer-golden.json`
的**既有層那幾行必須逐位元不變**（新層是新增 key，只有新 key 那幾行會動；既有層的任何 diff 都是回歸）。
⚠️ AR-22 Phase 4 起該 fixture 只凍 3 個 section（`overlays` / `params` / `gisLayers`）——
另外 9 個已被 `layerManifest.test.ts` 逐 key 焊死，凍第二份只是 churn。
新層要更新 fixture：`npx vite-node scripts/preprocess/dump-layer-golden.ts` 後 `git diff` 逐行 review。

**規模經濟**：殯葬 5 層與教育 16 層兩次實測都落在同一 14 個檔案——多層共用同一批基礎設施檔案（layerCatalog／App.tsx／useMapInteraction 等）只需改一次，per-layer 邊際成本主要落在 #1-6、#11-15（型別／loader／hook／registry／params／legend／popup）。

### 檢查清單
- [ ] `tsc -b` pass
- [ ] `LAYER_COLORS` 補齊（`Record<keyof LayerVisibility, string>` 編譯時會強制）
- [ ] Loader 有 loadingRegistry
- [ ] Toggle 開關有 loading 提示
- [ ] 無 DB 查詢時間 > 1s（否則套 pre-aggregate）
- [ ] **若為動態時序圖層：遵守 §8 動態圖層時間訂閱規則**
- [ ] **若 paint 用顏色區分類別／級別：依 §4a 規則 2 寫圖例**
- [ ] **可選取物件（POI / polygon / line）：依 §4a 規則 3 接 click popup**
- [ ] **opacity 控制必備（依 §4a 規則 1）**
- [ ] **Select control options ≥ 4 必用原生 `<select>`（依 §4a 規則 4）**

## 4a. 圖層 UX 標配（四大鐵則）

新 layer 必須同時通過下列四條，缺一不可。違反時 reviewer 應退件。

### 規則 1：透明度 slider 必備
所有 layer（不論 fill / line / circle / 3D）都要有 opacity slider，
使用者得以與底圖混合 / 跟其他 layer 疊看不致互卡。

寫法是在 `src/data/layerParamsSpec.ts` 的 `LAYER_PARAMS_SPEC` 該 key 底下放一筆
`opacitySlider("<key>Opacity", 0.8)`（控件與 `overlayParams` 編碼自動生成，
見 §4「params 新流程」）。**不要**再去 `useLayerParamsRuntime.ts` 加 `useState`。

### 規則 2：分類 ≥ 2 種 → 必寫圖例
**只要 layer 內的 feature 用顏色區分出 2 種以上類別／級別，不論點位 / polygon / line，
都必須有圖例。** 判斷三問：

1. paint 是否用了 `match` / `step` / `interpolate by 屬性`？
2. 同 layer 內會不會出現 ≥ 2 種顏色？
3. 用戶看到色塊能不能直覺對應到資料意義？

第 1 或 2 為「是」、第 3 為「否」 → **必須**在 `src/components/LegendPanel.tsx` 寫
sub-component 並在同檔 `LEGEND_REGISTRY` 加一行（`layerConsistency` 測試會擋漏接）。
三邊配色（factory paint expression / featureInfo panel / legend sub-component）
**單一資料源**，把類型表抽到 `src/data/xxxTypes.ts` 共享，避免改一邊忘改另一邊。

豁免條件（同時滿足才可豁免）：
- 整層**單一顏色** + opacity 由 confidence / 數值 attribute 自動調節（如 FTW 田區）
- 用戶不需要分辨個別 feature 的類別

### 反例（過去踩過）
- 農業 POI 三類（休農場 / 田媽媽 / 特色農旅）顏色不同 → **第一次漏寫圖例**，
  用戶看到三色點分不出來
- 作物適栽 4 級配色 → **第一次漏寫圖例**，用戶看不出「綠色 = 適栽」

### 規則 3：可選取物件 → 必接 click popup
**所有承載有意義屬性的 feature**（POI circle / polygon / line / 3D）都必須接到
`FeatureInfoPanel` 的 click popup。**polygon / line 不是 POI 的豁免條件** —
只要點下去能講出資訊，就要接。

前端 3 處接線：
1. `src/types/index.ts` 的 `FeatureInfo.layerType` union 加 key
2. `src/components/featureInfo/` 對應 domain 檔（waterPanels / agriPanels / ...）寫 panel 元件，
   再到 `featureInfo/registry.tsx` 的 `PANEL_REGISTRY` + `HEADER_LABELS` 各加一行
   （registry 完整性測試會擋漏接）
3. `src/hooks/useMapInteraction.ts` 的 `GIS_LAYERS` 陣列加 `{ layers: [...], type: "..." }`
   - **GIS_LAYERS 為 first-hit-wins**：把細節豐富的小範圍（如休農區）排在前面，
     大面積背景（如全台土壤分類）排在後面，避免被覆蓋

PMTiles 後端配套（**跨 repo**，在 `taipei-gis-analytics/pipelines/`）：
4. `keep_attrs` 必須包含 popup 要顯示的所有欄位 —
   原始 raw 屬性 ≠ 進 PMTiles 的屬性；tippecanoe 預設**只保留 -y 指定**的欄位。
   重出後務必同步複製 `data/processed/agriculture/*/*.pmtiles` 到本 repo
   `public/agriculture/`
5. 數值欄位給單位（pH 無 / OM `%` / CEC `cmol(+)/kg` / M3_P/K `mg/kg` / area `公頃`）

3D 物件（Three.js scene）走自己的 picking 路徑，但 tooltip 也要實作（參考
`flightSceneRef.pickFlight` / `railSceneRef.pickTrain` 模式）。

### 規則 4：Sidebar 控件不得橫向溢出
Layer 的展開參數區是**直式 narrow column**（~240px），所有 control 必須完全裝進去。

**SelectConfig 渲染規則**（兩個 sidebar `LayerSidebar.tsx` + `IconRailSidebar.tsx` 共用）：
- `options.length ≤ 3` → 橫向 button row（如 rail Track 2D/3D、bus color route/speed/density）
- `options.length ≥ 4` → 原生 `<select>` dropdown（如作物 132 種、土壤肥力 6 metric）

不要試著用 button row 塞 4+ option，**中文標籤幾乎一定撐爆 sidebar**（如「陽離子交換量 CEC」）。

其他控件原則：
- 一行 slider + 數值 label，不要把多個 slider 並排
- toggle 用單一 button，不要 button row
- 如果某層需要很多參數，**用 dropdown 切換 "mode" 而不是把所有 slider 並排呈現**
  （如土壤肥力的 6 metric，做成一個 dropdown 切換著色，而非 6 個獨立 slider 控件）

### 為什麼

| 問題 | 後果 |
|---|---|
| 沒透明度 | 疊在底圖上看不見地形 / 跟其他 layer 互蓋無法調整 |
| 有顏色分級沒圖例 | 用戶看到一片色塊不知道意思（如作物適栽 4 級綠→紅都不知道哪個好） |
| 可點物件沒接 popup | 屬性鎖在 PMTiles / GeoJSON 裡，使用者看不到 |
| PMTiles `keep_attrs` 漏欄位 | 前端 panel 拿到 `undefined`，user 點開只看到空白 |
| 控件橫向溢出 | 按鈕被切掉、覆蓋下一層 toggle，無法點選 |

### 範例
| Layer | 分類數 | 圖例 | Click popup |
|---|---:|---|---|
| 作物適栽（agriCropSuitability） | 4 級 kind | ✅ CropSuitabilityLegend | ✅ AgriCropSuitabilityPanel |
| 農業 POI（agriPOI） | 3 類 poi_type | ✅ AgriPOILegend | ✅ AgriPOIPanel |
| 土壤肥力（agriSoilFertility） | 6 metric 可切 | ✅ SoilFertilityLegend（隨 metric 切換）| ✅ AgriSoilFertilityPanel（含分級註解） |
| 農村再生（agriRuralRegen） | 1（單色） | — | ✅ AgriRuralRegenPanel |
| 土壤分類（agriSoil） | 1（單色） | — | ✅ AgriSoilPanel |
| 休農區（agriLeisureFarmZones） | 1（單色） | — | ✅ AgriLeisureFarmZonesPanel |
| FTW 田區（agriculture） | 1（confidence opacity） | — | — (僅 confidence 無實用資訊) |

POI 三類 / 土壤肥力 6 metric 的單一資料源放在 `src/data/agriPOITypes.ts` /
`src/data/agriSoilFertilityMetrics.ts`，多處（factory / FeatureInfoPanel /
LegendPanel）共用。

## 5. 命名慣例

| 角色 | 位置 | 命名 |
|---|---|---|
| Supabase fetcher | `src/data/` | `xxxLoader.ts`，export `loadXxxData()` |
| Layer React hook | `src/hooks/` | `useXxxLayer.ts`（新）；舊的 `useXxxData.ts` 漸進改名 |
| Mapbox overlay config | `src/map/overlayRegistry.ts` | 加一筆 `OverlayConfig` |
| Three.js scene | `src/three/` | `XxxScene.ts` |
| Custom WebGL layer | `src/map/` | `xxxCustomLayer.ts` |
| 靜態 GeoJSON | `public/` | `xxx.geojson`（扁平，S3 deploy-assets 契約） |
| 預處理腳本 | `scripts/preprocess/` | `preprocess-xxx.py` 或 `generate-xxx.py` |
| S3 上傳腳本 | `scripts/deploy/` | `upload-xxx-to-s3.ts` |
| 外部 API fetch | `scripts/fetch/` | `fetch-xxx.ts` / `.py` |
| 資料庫匯出 | `scripts/export/` | `export-xxx.py` |

## 6. TypeScript 驗證
```bash
npx tsc -b   # project references，不要用 tsc --noEmit
```
Commit 前必跑。

## 7. 部署 Checklist
見 CLAUDE.md 或 deploy-checklist memory。改 `public/*` 檔案要注意 S3 deploy-assets 契約（扁平檔名）。

## 8. 動態圖層時間訂閱（External Time Store）

> 2026-04-14 後所有隨時間變化的圖層**強制**遵守此規則。背景見 `docs/perf-external-time-store.md`。

### 原則
Timeline 的 `currentTime` 存在 **`src/state/timeStore.ts`**（不是 React state）。
所有動態圖層的時間依賴，**一律透過 store 訂閱**，禁止把 `currentTime` 放進 React `useEffect` / `useMemo` deps。

### 為什麼
- Replay 模式下 `currentTime` 每秒變動 60 次。
- 若放進 React deps → 每幀整個 App.tsx re-render → N 個圖層的 hook 全部重 evaluate → 調度成本 O(N × 60Hz) 爆炸。
- 單獨開一層感覺不出，多層同開就卡。

### API
```ts
import { timeStore } from "../state/timeStore";

timeStore.getTime()               // 當前 unix 秒（純讀）
timeStore.getDateKey()            // "YYYY-MM-DD"（Asia/Taipei）
timeStore.subscribe(cb)           // 每次變動（60Hz，動畫用）
timeStore.subscribeThrottled(ms, cb)  // 節流
timeStore.subscribeDate(cb)       // 只在日期變化時觸發
```

### 使用決策表

| 使用情境 | 用什麼 | 範例 |
|---|---|---|
| RAF / per-frame 內讀時間 | `timeStore.getTime()` 同步讀 | customLayer、scene.update() |
| 每次時間變動都要 react（如 timeRef 同步） | `subscribe(cb)` | App.tsx timeRef 同步 |
| filter / lookup 類，每 200ms~1s 更新足夠 | `subscribeThrottled(ms, cb)` | news filter (200ms)、freeway snapshot (1000ms) |
| 只在日期切換時才觸發（跨日載入） | `subscribeDate(cb)` | bus replay、ship/flight 跨日載入 |
| UI 顯示（HH:MM:SS 文字） | 元件內 `useSyncExternalStore` + `subscribeThrottled` | TimelineControls (250ms) |

### 節流建議

| 圖層/用途 | 節流 ms | 理由 |
|---|---|---|
| UI 時間數字 | 250 | 肉眼感受不出 |
| News 時間過濾 | 200 | 反應需近即時 |
| Earthquake filter | 500 | ripple 自帶 RAF |
| Disaster Alert | 500 | active set 變化慢 |
| Freeway snapshot | 1000 | 資料 10min 粒度 |
| CWA imagery frame | 1000 | frame 粒度 10min |
| YouBike 分鐘 key | minute-boundary 內判 | 1 分鐘粒度 |

### 正例

```tsx
// ✅ 時間過濾訂閱節流
useEffect(() => {
  const apply = (currentTime: number) => {
    map.setFilter(layerId, ["<=", ["get", "ts"], currentTime]);
  };
  apply(timeStore.getTime()); // 初始化
  return timeStore.subscribeThrottled(500, apply);
}, [/* 不含 currentTime */ visible, layerId]);

// ✅ 跨日載入訂閱日期
useEffect(() => {
  const handler = (dateStr: string) => { if (dateStr) loadDay(dateStr); };
  handler(timeStore.getDateKey());
  return timeStore.subscribeDate(handler);
}, [loadDay]);

// ✅ 動畫迴圈同步讀
render() {
  const t = timeStore.getTime();
  scene.update(t);
}
```

### 反例（禁止）

```tsx
// ❌ currentTime 進 useEffect deps（每幀觸發 re-run）
useEffect(() => {
  map.setFilter(layerId, ["<=", ["get", "ts"], currentTime]);
}, [currentTime, visible]);

// ❌ hook 參數收 currentTime
export function useMyLayer(mapRef, currentTime, visible) { ... }
// 改為：useMyLayer(mapRef, visible) + 內部訂閱 timeStore
```

### 檢查清單（動態圖層）
- [ ] Hook 參數表不含 `currentTime`
- [ ] 所有時間依賴 effect 透過 `timeStore.subscribe*`，不在 deps
- [ ] RAF 內部讀 `timeStore.getTime()`，不走 props
- [ ] 節流時間依資料粒度設定（見上表）
