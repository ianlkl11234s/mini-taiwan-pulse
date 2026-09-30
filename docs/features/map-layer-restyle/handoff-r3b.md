# Handoff — R3b hook 線面＋網格／影像／文字／擠出（給 Codex）

> 指派者：使用者（手動轉交）。完成後回報給 Claude session 驗收，**不要自行 merge**。
> 分支：從最新 `origin/master` 開 `feat/map-restyle-r3b`；worktree 開在 `.worktrees/map-r3b-impl`，`node_modules` symlink 到 `../analysis-prod/mini/node_modules`。
> Repo：`mini-taiwan-pulse`。本輪沒有其他人平行改地圖樣式，但主目錄、`analysis-prod`、`research-streamline`、`transport-facilities` 有別人的工作，不要動。

## 0. 兩段式（一定要停在第一段結尾）

| 段 | 做什麼 | 結束時 |
|---|---|---|
| **第一段：盤點＋提案** | §3 逐檔確認哪些圖層真的畫線／面／影像／文字／擠出，照 §4 規則給每層建議，產出比較頁 `docs/features/map-layer-restyle/r3b-tiers.html` | commit＋push，**停下來回報**。使用者在比較頁選完、把改動清單貼回來之前，**不改任何圖層程式** |
| **第二段：實作** | 依使用者確認版實作 §5，跑 §7 驗收，寫 §8 回報 | 開 PR，標題「R3b 線面（hook）＋網格／影像／文字／擠出」，不 merge |

## 1. 背景（一分鐘版）

地圖視覺規格已拍板（`docs/design-system/map-layers.md` §3）。已完成：

- **R2**：點圖層（registry＋hook）。
- **R3a（#461）**：OVERLAY_REGISTRY 畫的線與面。做法是分階表 `src/map/lineFillTiers.ts`＋在 registry 出口統一套用的 `src/map/lineFillSpec.ts`（`withLineFillSpec`）。**先把這兩個檔讀懂，R3b 照同一套邏輯**：線寬三階、線透明度兩階、面透明度四階、外框依面的階、依資料變化的值保留（資料編碼）、滑桿倍率＝原 paint「目前參數 ÷ 規格預設」的比值、K-4 暗淡只換色。
- **R4（#465）**：圖例與地圖同源。R3b 若改到地圖顏色（例如外框改中性灰），**對應圖例要一起改**，色票引用同一常數（`spec.md` §5.32「色票同源」）。

R3b 處理 R3a 沒涵蓋的五塊：

| 代號 | 範圍 | 規格 |
|---|---|---|
| **A** | hook／factory 自己 `addLayer` 的線與面（不經過 registry，`withLineFillSpec` 管不到） | L-1～L-5、F-1、F-2、K-4（同 R3a） |
| **B** | 規則網格 14 層（多在 registry） | G-3：面 0.7（R3a 已做）、**空格不畫**、格縫 0.5px 底圖色（R3a 已做） |
| **C** | 影像 raster | G-4：預設透明度 0.7、滑桿 0.3–1.0；量測值影像 `raster-resampling: nearest`、照片／雲圖 `linear`；時間序列 `raster-fade-duration: 0` |
| **D** | 文字標籤（`text-field`） | T-2 字級 POI z10 10／z14 12、計數徽章 11／13 Bold、halo 1.25 底圖色；T-3 標籤 z ≥ 13 才出現、`text-allow-overlap: false`，計數徽章可 overlap |
| **E** | 3D 擠出 `fill-extrusion` | F-4：開啟時不透明度 0.85、`fill-extrusion-vertical-gradient: true`、高度倍率滑桿預設 1 |

數值常數：線面用 `src/map/mapStyleScale.ts` 既有的 `LINE_WIDTH`／`lineWidthExpr`／`LINE_OPACITY`／`LINE_DASH`／`BOUNDARY_GRAY`／`FILL_OPACITY`／`FILL_OUTLINE`／`GRADED_SEAM`／`mapSeamColor`／`LABEL`。影像與擠出**還沒有常數**，第二段新增在 `mapStyleScale.ts`（建議 `RASTER = { opacity: 0.7, sliderMin: 0.3, sliderMax: 1 }`、`EXTRUSION = { opacity: 0.85, verticalGradient: true }`），各層只引用、不寫字面值。

必讀：`map-layers.md` §3.2–3.6、`PLAN.md` R3 段、`handoff-r2-hooks.md`（hook 逐檔改的前例，§3 盤點方法照抄）、`src/map/lineFillSpec.ts`、`src/map/lineFillTiers.ts`、`src/map/__tests__/lineFillSpec.test.ts`、`src/map/__tests__/hookPointSpec.test.ts`（hook 規格守門的寫法）。

## 2. 起始盤點數字（粗估，第一段要逐檔確認）

- A：`src/hooks/*`、`src/map/*Factory.ts` 中含 `type: "line"` 的檔 31 個、含 `type: "fill"` 的 34 個。`design:audit-layers` 的 hook 掃描是**整支檔一起列**，同檔其他圖層會被誤列（R2 踩過：`useJpWaterLayers` 的洪水其實是 raster、`agricultureLayerFactory` 的作物適栽其實是面）。
- hook 內仍用 `fill-outline-color` 的：`agricultureLayerFactory.ts`、`earthquakeReplayLayerFactory.ts`、`useJpWaterLayers.ts`、`useSatellitesLayer.ts`、`usePropertyValueAdminLayer.ts`、`useAnimalShelterPressureLayer.ts`（`src/embed/`、`src/research/analysisResultOverlay.ts` 不在範圍）。
- B：網格 14 層：`companyAgeStructure`、`companyCapitalGrid`、`companyIndustryDistribution`、`companyPoints`、`factoryDensityGrid`、`jpBuildingHeight`、`manufacturingCompanyDensityGrid`、`noiseCaptureGrid`、`propertyValueGrid`、`realEstatePresaleGrid`、`realEstateRentalGrid`、`realEstateSaleGrid`、`regulatedFacilityDensityGrid`、`urbanFormGrid`。
- C：registry 3 層（`urbanHeat`、`canopyHeight`、`jpCanopyHeight`）＋`src/map/cwaImageryLayer.ts`（雷達、衛星雲圖、空品影像等）、`useDustForecastLayer.ts`、`useJpWaterLayers.ts`（洪水浸水想定）。其他以 raster source 掛上的影像也要找（搜 `"raster"`、`raster-opacity`）。
- D：`text-field` 出現在 registry 3 處、`useGlobalEventsLayer.ts`、`useMicroSensorsLayer.ts`、`useGfwHourlyGridLayer.ts`（規格估 6 個文字子圖層）。**icon（symbol 只畫圖示、沒有文字）不在 D**，那是 R2 的 P-5。
- E：registry 3 層（`buildingsGba`、`jpBuildingHeight`、`propertyValueGrid`）＋hook 約 5 個檔含 `fill-extrusion`。

## 3. 第一段：逐檔盤點（不要跳過）

對每個候選檔：

1. 讀程式，列出每個 layer key 實際 `addLayer` 了哪些 `type`、子圖層 id、目前的寬度／透明度／dash／外框／縮放插值、是否依暗淡分支改寬度或透明度（K-4）、滑桿名稱與預設（`src/data/layerParamsSpec.ts`）。
2. 名單裡**沒有畫該類型**的 key：標「掃描誤列」。名單外但同檔有畫的：列出來，由使用者決定。
3. 裝飾子圖層（光暈、漣漪、點擊熱區，`DECORATION_SUFFIX_RE`）不套規格，列出來即可。
4. 依資料變化的寬度／透明度／外框顏色／dash（`isDataDriven`）＝資料編碼，建議「保留」，寫出依哪個欄位。
5. B 網格「空格不畫」要先判斷語意，**這是最容易出錯的地方**：
   - 「空格」只指**計數＝0 代表真的沒有東西**的格子（例：該格 0 家公司）。
   - **缺值、未涵蓋、遮蔽（null／undefined／suppressed）不是 0**，不能靠「不畫」讓它消失成跟 0 一樣；照 F-3 缺值斜線或維持現狀，列出來給使用者判斷。
   - 資料本身就只存非零格（檔案裡沒有 0 的格）的層，標「已經沒有空格，不用改」。
   - 每層寫出判斷依據（欄位名、資料檔或 loader 行號）。
6. C 影像逐層分類：量測值（熱島、樹冠高、雷達回波、空品、沙塵濃度、淹水深度…）→ `nearest`；照片／雲圖 → `linear`；時間序列（隨時間軸換幀）→ `fade 0`。寫出依據。
7. D 文字逐層分類：POI 名稱／計數徽章／其他（例：數值標籤）；目前 minzoom 與 overlap 設定。

### 3.1 比較頁 `r3b-tiers.html`

格式**照抄 `docs/features/map-layer-restyle/r3-tiers.html`**（深色頁、每列「現在｜改後｜選擇按鈕｜理由」、現在與改後各是左暗右淡的 1:1 小圖、頁尾「你改過的層」可複製、localStorage key 用 `r3b-tiers`）。分五區 A–E：

- A：同 r3-tiers 的線／面列（線：寬 細／標準／強調／保留 × 透明度 0.85／0.6／保留；面：分級／覆蓋／背景／網格／保留）。分階規則同 `lineFillTiers.ts` 檔頭。
- B：每層一列，選項「不畫 0 值格」／「維持」／「缺值改斜線」，理由欄寫語意判斷。
- C：每層一列，選項 resampling「nearest／linear」、「換幀不淡入 是／否」，並顯示現在與建議的預設透明度。
- D：每層一列，選項「POI 名稱／計數徽章／不套」，顯示現在與建議的字級、minzoom。
- E：每層一列，顯示現在與建議的不透明度、vertical-gradient、高度滑桿預設。

產生頁面的腳本放 scratch（不提交）；頁面本身 commit。push 後回報比較頁路徑與各區數量，**然後停**。

## 4. 建議規則（第一段用；使用者確認後才算數）

- 線寬：z14 ≤1.2 → 細；≥3 → 強調；其他 → 標準；寬度依資料 → 保留。
- 線透明度：≥0.75 → 0.85；其他 → 0.6；依資料 → 保留（仍不得低於 0.3，除非原本就是 0 的隱藏層）。
- 面：透明度依資料 → 保留；規則網格 → 網格 0.7；序列色分級 → 分級 0.55；≤0.2 → 背景 0.15；其他 → 覆蓋 0.35。
- 同一 hook 內的面外框線照 F-2：覆蓋 1px 同色 0.8、背景 0.5px 中性灰 0.6（外框顏色依資料時保留）、分級與網格底圖色細縫。
- 行政界類、海域界、流域界尖角；其他主體線圓頭圓角。
- `fill-outline-color` 一律改獨立 line 子圖層或拿掉（網格可選「無外框」）。

## 5. 第二段：實作（使用者確認後）

1. **分階表**：hook 的線面分階加在 `src/map/lineFillTiers.ts`，新增 `HOOK_LINE_TIERS`／`HOOK_FILL_TIERS`（照 `pointTiers.ts` 的 `HOOK_POINT_TIERS` 前例，檔頭寫規則與使用者確認日期）。
2. **helper**：hook 不經過 registry 出口，要在 `src/map/lineFillSpec.ts` 匯出可直接呼叫的 helper（例：`hookLinePaint(key, suffix, base, defaults, isDark)`、`hookFillPaint(...)`，或更簡單的 `lineWidthExpr`＋`lineOpacityFor(tier, factor)`＋`fillOutlinePaint(tier, isDark, factor)`），**與 `withLineFillSpec` 共用同一份計算**，不要在 hook 裡另寫一套。沿用各 hook 現有的滑桿取值方式，只改算式。
3. **B／C／D／E** 依確認版逐層改；影像與擠出常數加在 `mapStyleScale.ts`。影像預設透明度改 0.7、滑桿 0.3–1.0 要改 `layerParamsSpec.ts` 的 default／min（這輪允許）。
4. **主題與透明度只能改樣式**（`setPaintProperty`），不可因為這輪改動觸發重新抓資料或重算。
5. **圖例**：地圖顏色有變（例：外框改中性灰、網格空格不畫後圖例要不要列「0」）的層，圖例同步，色票引用同一常數；`legendAlignment.test.ts`、`legendKit.test.ts` 要綠。
6. **護欄**：仿 `hookPointSpec.test.ts` 新增 hook 線面檢查（例：確認版列為套階的 hook 檔必須引用 helper、不得在 paint 裡依 `isDark` 分支寬度或透明度、hook 內 `fill-outline-color` 數量 ratchet 只減不增）。能機械檢查的 G-4／T-3／F-4 規則也加測試。
7. **文件**（這輪由你寫、Claude 驗收）：`map-layers.md` 把 G-3、G-4、T-2、T-3、F-4 與 hook 線面的「R3b 待接線」改成實際狀態；`CHANGELOG.md` 新增 R3b 一段（決定、範圍、保留的例外）；`README.md` 進度表 R3b 列；`PLAN.md` 狀態列；活的元件頁 `src/design-system/sections/MapLayerSection.tsx` 補 hook 分階表與影像／擠出常數，dev server 開著時跑 `npm run design:snapshot -- --port 3749` 更新 `reference.html`。

## 6. 禁改與注意

- 不改資料來源、popup 內容、圖層開關、圖層 id（新增外框子圖層可以，要同步 `gisClickRegistry.ts` 等引用若有需要）。
- 不動 `src/embed/`、`src/research/`（分析結果走 viz-library）、統計 renderer `regionalStatisticsMap.ts`（R1 已處理）、Three.js／CustomLayer（R6）。
- `design:audit-layers` 產生的 `layer-style-inventory.json`、黃金快照 fixture：第二段確認差異都是有意的之後**要 commit**（這輪沒有平行工作）。
- design guard（`designSystemGuard.test.ts`）紅燈要修程式，**不可改基準**。
- 看到不是你改的檔：不要碰、不要 revert，回報。

## 7. 驗收（第二段每項都要做，結果寫進回報）

1. `npx tsc -b`（禁用 `--noEmit`）綠。
2. `npx vitest run` 全套；高負載下 `capabilityAudit`、`pollutionPenaltiesDataset`、`explorationBoundary` 等 research 測試可能逾時，單獨重跑過即可（寫明）。
3. 黃金快照：`npx vite-node scripts/preprocess/dump-layer-golden.ts` 重產，**逐屬性**列出差異，確認只落在確認版範圍（registry 的網格／影像／文字／擠出）。hook 層不在快照裡，改用瀏覽器 `getPaintProperty` 讀值佐證。
4. `npm run design:audit-layers` 重產，差異只落在本輪範圍；`legendsWithIssues` 不得增加（目前 3）。
5. 瀏覽器：dev server 用 port **3749**（`npx vite --host 127.0.0.1 --port 3749 --strictPort`）。worktree 沒有大型圖資時，照 R3a 做法用暫時的 vite 設定把 `publicDir` 指到主目錄的 `public/`（該設定檔不 commit）。**絕不 `pkill -f vite`**，用 `lsof -ti tcp:3749 -sTCP:LISTEN` 找 PID 再 kill。agent-browser 要帶 WebGL 參數（`--enable-unsafe-swiftshader,--use-gl=angle,--use-angle=swiftshader,--ignore-gpu-blocklist,--enable-webgl`），不要平行截圖；深連結要帶 `v=1`，淡色要 `theme=light&style=light`。每塊（A–E）至少挑 1–2 層，暗／淡 × 改前（master）／改後截圖，做成對照頁 `docs/features/map-layer-restyle/r3b-compare.html`（圖片內嵌，commit）。
6. 滑桿：每塊挑一層，用 app 的 `layerParamsStore.setParam`（滑桿 onChange 走的同一個）設 min／預設／max，讀 `getPaintProperty` 確認等比例、預設值等於規格、上限夾在 1。
7. 本機拿不到資料的層（例：`parkingOnstreet` 本機 0 筆）照實標「待正式站目視」，不要當作通過。

## 8. 回報（第二段；寫在 PR 描述，並另存 `docs/features/map-layer-restyle/R3b-report.md` commit）

1. §7 每項結果（含逾時重跑、快照逐屬性差異、盤點前後數字）。
2. A：每層｜子圖層｜確認版的階｜改前 → 改後值｜用了哪個 helper。
3. B：每層｜語意判斷｜做了什麼（不畫 0 值格／維持／斜線）｜依據。
4. C、D、E：每層｜分類｜改前 → 改後。
5. 圖例同步了哪些。
6. 保留原樣的層與原因（資料編碼、掃描誤列、拿不到資料）。
7. 需要 Claude 或使用者決定的事。

## 9. 環境與鐵則

- 不讀 `.env`、不 curl vite 轉譯後的模組（會印出金鑰）；`.env` 需要時用 symlink，不讀內容。
- 本機 `grep` 被 shell function 覆寫、可能吞輸出；否定結論用 `/usr/bin/grep` 或 `rg` 複驗。
- 不 `reset --hard`／`checkout -- .`／`clean -fd`。
- commit 用 Conventional Commits，分段 commit（第一段提案頁一個；第二段建議 A、B、C、D、E、文件各一）。
- push、開 PR 可以；**不要 merge**。merge 一律等使用者，用一般 merge。
