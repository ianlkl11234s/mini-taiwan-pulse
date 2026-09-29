# Handoff — R4 圖例對齊與識別色（給 Codex）

> 指派者：使用者（手動轉交）。完成後回報給 Claude session 驗收，**不要自行 merge**。
> 分支：`feat/map-restyle-r4-legend`（已從 master `8799e9ad` 開好，本檔已 commit）。worktree：`.worktrees/map-r4-legend`（`node_modules` 已 symlink 到 analysis-prod）。在這個分支上 commit、push，最後開 PR，標題寫「R4 圖例對齊」。
> Repo：`mini-taiwan-pulse`。
> **同時間 Claude 在另一個 worktree（`.worktrees/map-r3-line-fill`，分支 `feat/map-restyle-r3-line-fill`）做 R3 線與面**，兩邊會先後 merge，所以 §6 的禁改清單要嚴格遵守。

## 1. 背景（一分鐘版）

地圖圖層視覺規格已拍板（`docs/design-system/map-layers.md` §3.7、§4）。R1 做了圖例元件庫 `src/components/legend/legendKit.tsx`（`LegendTitle`／`LegendRow`／`LegendNote`／`LegendNum`／`Swatch*`、`useLegendTheme`），R2 統一了點圖層畫法。**R4 只動圖例那一邊**：讓圖例畫出來的形狀、顏色、暗淡版本跟地圖上真正畫的一致。

一句話原則：**地圖是對的，圖例去對齊地圖。這一輪不改任何地圖畫出來的樣子。**

必讀：
- `docs/design-system/map-layers.md` §3.7（K-1）、§4.2（圖例各型規格 LG-1～LG-8）、§4.3（不一致清單）
- `docs/features/map-layer-restyle/PLAN.md` R4 段
- `docs/design-system/spec.md` §5.32（legendKit）
- `src/components/legend/legendKit.tsx`、`src/components/legend/__tests__/legendKit.test.ts`
- `scripts/design/audit-layer-styles.ts` 約 600–670 行（圖例問題怎麼判定的）

## 2. 目標與完成定義

1. **LG-13**：下面 §3 的 28 個圖例，`npm run design:audit-layers` 重產後 `legends[].issues` 歸零；hook 那 6 個（§3 C 類）若判斷後確定不用改或無法確認，要在回報表寫證據。
2. **K-1 B**：單色圖層的識別色 `LAYER_COLORS`（`src/components/sidebar/layerCatalog.ts`）改成地圖現在的**暗色版**主色；地圖暗淡不同色時，圖例色票跟著暗淡切換。
3. **圖例色票一律引用與 paint 同一個常數**，不在 `LegendPanel.tsx` 再抄一次色號（做法見 §4）。
4. **手寫色票收斂**：`LegendPanel.tsx` 手寫 `width: N, height: N` 色票（目前 90 處）改用 `Swatch*`；把 `legendKit.test.ts` 的上限降到新的實際數字（只准降）。目標 0；做不到的逐個列在回報表並說明（例：特殊形狀 kit 沒有對應元件）。
5. **註記改 `LegendNote`**：圖例裡手寫樣式的方法說明、缺值、來源小字改用 `LegendNote`（不要改文字內容）。
6. 驗收全過（§7），回報表完整（§9）。

**不在範圍**：改任何地圖 paint 的值（顏色、半徑、線寬、透明度）、統計圖層的 `StatisticsLegend`（320 個，R1 已處理）、LG-5 大小圖例／LG-6 icon 圖例新元件（沒有不一致就不做）、LG-9 常駐與收合行為、新增或移除圖例、改圖例文字內容、R3 的線寬（線圖例寬度見 §5）。

## 3. 28 個不一致圖例（2026-09-29 從 inventory 重產）

圖例 id = `layer-style-inventory.json` 的 `legends[].id`，對應 `LegendPanel.tsx` 裡該圖層的圖例區塊。

**A. 形狀不符（9）**：換成對應型的色票，顏色不變。

| 圖例 | 問題 | 改成 |
|---|---|---|
| `buildingsGba`、`urbanFormGrid` | 面圖層卻用圓點 | `SwatchSquare`（LG-2） |
| `propertyValueGrid` | 面圖層用圓點＋1 個色票不在 paint（缺值灰） | `SwatchSquare`；缺值那列對照 paint 實際缺值畫法（若是透明＋斜線用 `SwatchHatch`，若 paint 真的有灰就引用同一常數） |
| `fireHydrants`、`govServiceOffices`、`noiseEnforcementEvents`、`soundCameraLocations` | 點圖層卻用方塊 | `SwatchDot`（LG-1） |
| `osmBridgeCarriers`、`osmRoadDrive` | 線圖層卻用點／方塊 | `SwatchLine`（LG-4），dash 同 paint |

**B. 色票不在圖層 paint（確定，2）**

| 圖例 | 問題 |
|---|---|
| `medHospital`（成員 medAED／medClinic／medHospital／medLTC／medPharmacy） | 5 色全不同。圖例用 `LAYER_COLORS`（如 `#d32f2f`），地圖暗 `#e53935`／淡 `#c62828`。照 K-1 B：`LAYER_COLORS` 改成地圖暗色版，圖例依暗淡切換 |
| `officialNoiseMonitoring` | 9 個色票有 2 個不在 paint |

（原 §4.3 列的 `mountainRescueIncidents` 已不在最新清單，不用處理；若你看到它仍不一致再回報。）

**C. 色票不在 registry paint，但另有 hook 可能在 runtime 覆寫（6，先判斷再改）**

| 圖例 | 成員 | 可能覆寫的 hook |
|---|---|---|
| `facPrimary` | facPrimary／facSecondary／facPlanned／facHistorical／facOsmSupplement | `useEnergyPoiLayer` |
| `gasStationCpc` | 加油站、LPG、LNG、管線、煉油、儲槽、燃煤碼頭等 14 層 | 見 inventory `issues` 全文 |
| `livestockFarmPig` | 7 種畜牧場 | `useLivestockLayers` |
| `parkingOnstreet` | parkingOnstreet／parkingOffstreet | `useParkingLayer` |
| `pollutionPenaltyCritical` | 3 層污染裁處 | `usePollutionLayers` |
| `powerPlants` | powerGenerationUnit／powerPlants | `usePowerGenerationBeamLayer`、`useEnergyPoiLayer` |

做法：讀 hook 程式，確認 runtime 實際畫在地圖上的是 hook 的顏色還是 registry 的顏色（看 hook 是否 `setPaintProperty(..., "circle-color"/"line-color"/"fill-color", ...)` 或自己 addLayer 取代 registry 圖層、以及執行條件）。
- 能確定 → 圖例對齊實際畫面那一邊，回報表附 `檔案:行號` 證據。
- 不能確定（依條件、依資料、看不出哪個先執行）→ **不要改**，回報表標「待瀏覽器確認」，Claude 驗收時實看。
- 若 hook 的色號是檔內私有常數，可以在該 hook 檔**加 `export`**（不改值、不改其他行）讓圖例引用。

**D. 地圖主色暗淡不同、圖例只有一套（12）**

`companyCapitalGrid`、`ecoNetworkZones`、`forestCompartments`（14 個成員）、`industrialParkBoundaries`、`industrialParkComparison`、`jpAccommodationDensity`、`medHospital`、`newsEvents`、`ooklaPerformanceGrid`、`realEstateRentalGrid`、`schools`（17 個成員）、`waterCanals`

做法：圖例色票依 `LegendContext` 的 `isDark`（或 `useLegendTheme()` 所在的同一個 context，照 `LegendPanel.tsx` 既有寫法）切換成地圖同一邊的色。文字色一律走 `useLegendTheme()`，不直接用 `COLORS.*`。

**K-1 的 10 層單色圖層**：規格只寫「單色點層有 10 層的地圖色和 `LAYER_COLORS` 不同，醫療 5 層最明顯」，**沒有現成清單**。請自己列：`LAYER_COLORS` 有登記、paint 主色是單一常數色（不是 match／interpolate）、兩者不同的圖層。列完寫進回報表，再逐一改 `LAYER_COLORS`（改成地圖暗色版）。類別或序列圖層（paint 用 match／step／interpolate）**不用改**，`LAYER_COLORS` 只當識別色。

## 4. 「同一個常數」怎麼做

目標：圖例和 paint 讀同一個名字，之後有人改色只要改一處。

1. paint 的色號**已經是 export 的常數**（例：`NOISE_LAYER_COLORS`、`RELIGION_LAYER_COLORS`、`src/data/*Types.ts` 的色表）→ 圖例直接 import。
2. paint 的色號是 `overlayRegistry.ts` 裡的**字面值**（`"#e53935"` 或 `isDark ? "#x" : "#y"`）→ 把色號抽成常數，放在該圖層既有的 `src/data/<domain>Types.ts`（沒有就放 `src/map/layerPaintColors.ts`，新檔），`overlayRegistry.ts` 與 `LegendPanel.tsx` 都改成引用它。
   - **`overlayRegistry.ts` 只准改「顏色值那一格」**：`"circle-color"`／`"line-color"`／`"fill-color"`／`"fill-extrusion-color"`／`"circle-stroke-color"` 的值從字面值換成常數引用，值必須完全相同；外加檔頭 import。**同一行或鄰近的寬度、透明度、半徑、dash、cap／join、`fill-outline-color`、zoom 插值一律不碰**（那是 R3 的地盤）。
   - 若字面值在 match 表達式裡，抽成 `{ 類別: 色 }` 物件，paint 與圖例都從物件取。
3. 驗證：抽常數後 `dump-layer-golden` 重產的 fixture **應該完全沒有差異**（值一樣）。有差異 = 抽錯了，要修到沒差異。

## 5. 線圖例寬度（跟 R3 的接點）

LG-4：線段色票 20×線寬（最少 2px），線寬用 L-1 的 z14 值等比縮小。R3 正在把線寬接到 `src/map/mapStyleScale.ts` 的 `LINE_WIDTH`（細／標準／強調）。本輪：
- 只處理 §3 A 類的 `osmBridgeCarriers`、`osmRoadDrive` 換成 `SwatchLine`；寬度用 `SwatchLine` 預設（2）或 import `LINE_WIDTH` 取對應階（**只 import，不改 `mapStyleScale.ts`**）。
- 其他既有線圖例的寬度不動。

## 6. 禁改清單（共用檔，會跟 R3 或其他工作衝突）

**不要修改**：
- `src/map/mapStyleScale.ts`、`src/map/pointSpec.ts`、`src/map/pointTiers.ts`（可以 import）
- `src/map/overlayRegistry.ts`：**只准 §4 第 2 點的顏色抽常數**，其他一律不動
- `src/hooks/*`：只准 §3 C 類的「加 `export`」，其他不動
- `src/data/layerManifest.ts`、`src/data/layerParamsSpec.ts`
- `src/data/__tests__/__fixtures__/*`（黃金快照：你只重產來比對，**不要 commit**；若真的有差異，代表抽常數抽錯）
- `docs/design-system/README.md`、`CHANGELOG.md`、`map-layers.md`、`spec.md`、`docs/features/map-layer-restyle/PLAN.md`（R3 也要寫，由 Claude 驗收時統一寫）
- `docs/design-system/layer-style-inventory.json`：重產來驗收，**不要 commit**（R3 也會重產，Claude 最後統一重產）

需要改這些檔才能完成的：**不要改，寫進回報表「需要 Claude 處理」**。

工作區看到不是你改的檔：不要碰、不要 revert，回報就好。

## 7. 驗收（每一項都要做，結果寫進回報）

1. `npx tsc -b`（禁用 `--noEmit`）綠。
2. `npx vitest run` 全過。機器負載高時 `capabilityAudit`、`pollutionPenaltiesDataset`、`explorationBoundary` 可能逾時，單獨重跑過即可（回報寫明）。特別確認 `legendKit.test.ts`、`layerConsistency`、`designSystemGuard.test.ts` 綠；design guard 紅燈要修程式，**不可改基準**。
3. `npx vite-node scripts/preprocess/dump-layer-golden.ts` 重產 → `git diff --stat src/data/__tests__/__fixtures__/` **應為空**。確認後把 fixture 還原（`git restore <該檔>`，只還原 fixture 檔）。
4. `npm run design:audit-layers` → `summary.legendsWithIssues` 從 28 降到 0（C 類「待瀏覽器確認」的除外，逐一列出）；`layers` 區段的 paint 值不應有任何變化（用 `git diff` 看 JSON，差異只該在 `legends`）。確認後還原 JSON（不 commit）。
5. 改後圖例頁：寫一個臨時腳本（放 scratch，不 commit）用 `renderToStaticMarkup` 把 §3 每個改到的圖例在 **暗、淡** 兩種主題下各渲染一次，暗淡並排，輸出成 `docs/features/map-layer-restyle/r4-legend-after.html`（這個 HTML 要 commit）。每格標圖例 id 與改了什麼。腳本路徑寫在回報裡；「改前」那一欄由 Claude 驗收時用同一支腳本在 master 渲染，所以腳本請只依賴 `LegendPanel.tsx` 的公開 export。
6. 瀏覽器（可選，做不到就註明）：dev server 用 port **3749**（Claude 用 3748）；**絕不 `pkill -f vite`**，用 `lsof -ti :3749` 找 PID 再 kill。不要 curl vite 轉譯後的模組（會印出金鑰），不讀 `.env`。

## 8. 環境與鐵則

- 在 `.worktrees/map-r4-legend` 工作，不要動主目錄、`analysis-prod`、`research-streamline`、`transport-facilities`、`map-r3-line-fill`。
- 本機 `grep` 被 shell function 覆寫、可能吞輸出；否定結論（「沒有引用」）一律用 `/usr/bin/grep` 或 `rg` 複驗。
- 不 `reset --hard`／`checkout -- .`／`clean -fd`。
- commit 用 Conventional Commits（`feat(legend): …`／`refactor(map): …`），可以分多個 commit（建議：抽常數一個、形狀一個、暗淡一個、K-1 一個、手寫色票收斂一個）。
- push、開 PR 可以；**不要 merge**。
- 若 R3 先 merge 進 master：`git fetch && git rebase origin/master`，衝突時**顏色值取你的、其他（寬度、透明度、外框）取 master**；rebase 後重跑 §7 的 1–4。
- **例外：R3 也會改這幾層的顏色，衝突一律以 master（R3）為準**：`countyBoundary`／`townshipBoundary`／`villageBoundary`（`line-color` 改 `BOUNDARY_GRAY`）；`facOffshore`／`jpBuildingHeight`／`offshoreWindZones`／`parkingOnstreet`（`fill-outline-color` 改成新增的外框 line 子圖層）。其中 `parkingOnstreet` 也在你的 §3 C 類：它的 `fill-color` 你可以抽常數，但**不要動 `fill-outline-color`**。

## 9. 回報（寫在 PR 描述，並另存 `docs/features/map-layer-restyle/R4-report.md` commit 進分支）

1. 驗收結果：§7 每一項的結果（tsc、vitest 含逾時重跑、golden diff 是否為空、`legendsWithIssues` 前後數字）。
2. 28 個圖例逐一：圖例 id｜類別（A／B／C／D）｜改了什麼｜色號引用的常數名與檔案。
3. C 類 hook 判斷：圖例 id｜實際畫面取哪一邊｜證據 `檔案:行號`｜是否已改／待瀏覽器確認。
4. K-1：列出的單色圖層清單｜`LAYER_COLORS` 舊值 → 新值｜地圖暗／淡色。
5. 新增的常數：名稱｜檔案｜在 `overlayRegistry.ts` 取代了哪幾行（行號）。
6. 手寫色票：90 → N；剩下的每處為什麼沒改。
7. 需要 Claude 處理：要改禁改清單的地方、規格沒寫清楚你自己做了判斷的地方。
