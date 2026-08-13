# Handoff — 社福長照 Welfare（下游視角）

> **上游 SSOT**：[`../../../taipei-gis-analytics/docs/handoff/welfare-layers.md`](../../../taipei-gis-analytics/docs/handoff/welfare-layers.md)
> 本檔是該契約的**下游反向引用**：記下 pulse 這端實際怎麼接、哪些欄位是硬依賴、上游改什麼會炸。

## 上游產物 → pulse 路徑

上游 `output/welfare/pulse/*.geojson`（gitignored）→ 本 repo `public/welfare/`，
**檔名不改**，copy 即可（重生指令見下方）。

| catalog dataset_id | pulse 路徑 | 點數 | 大小 | git |
|---|---|--:|--:|---|
| `nursing_homes` | `public/welfare/nursing_homes_national.geojson` | 1,611 | 949 KB | ✅ |
| `elderly_care_homes` | `public/welfare/elderly_care_homes_national.geojson` | 1,160 | 736 KB | ✅ |
| `disability_facilities` | `public/welfare/disability_facilities_national.geojson` | 334 | 231 KB | ✅ |
| `ltc_institutions` | `public/welfare/ltc_institutions_national.geojson` | 3,117 | 1.68 MB | ✅ |
| `childcare_centers` | `public/welfare/childcare_centers_national.geojson` | 1,578 | 794 KB | ✅ |
| `child_services` | `public/welfare/child_services_national.geojson` | 1,396 | 714 KB | ✅ |
| `welfare_service_centers` | `public/welfare/welfare_gov_offices_national.geojson` | 151 | 72 KB | ✅ |
| `mental_health_facilities` | `public/welfare/mental_health_facilities_national.geojson` | 70 | 33 KB | ✅ |
| `social_work_orgs` | `public/welfare/social_work_orgs_national.geojson` | 587 | 295 KB | ✅ |

⚠️ `welfare_service_centers` 這個 catalog id 對應的 pulse 檔叫 `welfare_gov_offices_*`
（上游刻意改名，因為已排掉 T0103 → 它不再是「社福服務中心」名冊）。

- 座標系統：WGS84（EPSG:4326），已 round 6 位小數，0 筆出界／NaN／null
- 更新頻率：上游名義「每月」，**實測 21 個月未換檔** → registry 排 `irregular`
- 資料窗口：無時間序，是現況名冊快照
- 授權：**OGDL-Taiwan-1.0**（前端標註即可，無商用限制）
- **不走 Supabase**：規劃中的 `reference.*` ×9 migration **未寫**，前端不依賴
- **重生指令**（上游 repo）：`./venv/bin/python3 pipelines/welfare/08_pulse_export.py`
  （全鏈重跑 01→07→08 見上游 handoff §8；**先看 01 印的 `Last-Modified`，沒變就不用往下跑**）

## 硬依賴欄位（改一定爆）

契約已焊進 `src/data/__tests__/staticDataContract.test.ts`（型別 ＋ 覆蓋率下限）
與 `classificationCoverage.test.ts`（分類值全覆蓋）。上游改了跑 `pnpm test` 會紅。

| 欄位 | 層 | 型別 | 用途 | 漏了會怎樣 |
|---|---|---|---|---|
| `uid` | 全 9 層 | string | 前端 key ＋ filter 的 `["has","uid"]` 兜底 | 「全部」精度模式的 filter 失效 |
| `name` | 全 9 層 | string | popup 標題 | 標題落 fallback 字串 |
| `coord_precision` | 全 9 層 | string | 高 zoom 降階 ＋ 精度篩選的唯一依據 | 概略點變成看起來像門牌級 |
| `nh_type` | nursing | string (93%) | 三分色 ＋ 型別篩選 | 全落中性灰 |
| `beds_nh` / `beds_postpartum` / `beds_infant` | nursing | **string** (93%) | 泡泡半徑（三欄相加） | 泡泡全縮成基底 |
| `attr_type` | elderly | string (94%) | 公私別分色（5 raw 值 fold 3 群） | 全落中性灰 |
| `beds_approved` | elderly | **string** (94%) | 泡泡半徑 | 同上 |
| `quota_*` / `actual_*` | disability | **string** (80%) | 使用率分色 | 全落「無資料」灰 |
| `sub_code` | ltc / mental / gov / socialWork | string | 分色（前兩者）＋ popup 類別名 | 分色失效／popup 顯示原始碼 |
| `welfare_class` | childServices | string | 三類分色 ＋ 類別篩選 | 全落中性灰 |

🔴 **型別是最容易靜默壞掉的一項**：床數／核定量上游給的是**字串**。
前端已一律 `to-number` + `coalesce`（上游哪天改成 number 也吃得下），
但如果有人「順手優化」成直接 `["get", …]` 算術，字串進來就整層泡泡消失且不報錯。

## 前端接線觸點（照 development-rules §4 完整表）

| # | 檔案 | 動作 |
|---|---|---|
| 1 / 2 | `src/types/index.ts` | `LayerVisibility` ＋ `FeatureInfo["layerType"]` 各加 9 key |
| 4 | `src/data/welfareTypes.ts` | **新檔** —— 分色／篩選／精度／數值表達式 SSOT |
| 6 | `src/map/overlayRegistry.ts` | 9 個 entry（靜態 GeoJSON circle，排序＝點數多→少） |
| 7 / 8 / 17 / 18 | — | **免手寫**，由 manifest 派生（AR-22 Phase 4） |
| 8 | `src/components/sidebar/layerCatalog.ts` | 新主題「社福長照 Welfare」3 子群 |
| 11 / 11a | `src/data/layerParamsSpec.ts` ＋ `layerManifest.ts` | 9 筆規格（3 或 4 控件）＋ 9 筆 manifest entry |
| 12 / 13 | `src/components/LegendPanel.tsx` | `WelfareLegend`（一個元件涵蓋 9 key）＋ `LEGEND_REGISTRY` 一行 |
| 14 / 15 | `src/components/featureInfo/welfarePanels.tsx` ＋ `registry.tsx` | **新檔** 9 個 panel ＋ `PANEL_REGISTRY` / `HEADER_LABELS` 各 9 行 |
| 16 | `src/map/gisClickRegistry.ts` | `GIS_LAYERS` 9 條（layer id ＝ `{sourceId}-circle`） |
| 20 | `nginx.conf` ＋ `scripts/deploy/{upload,pull}-deploy-assets.sh` | `/welfare/` location ＋ 上傳／同步段（`deployContract` 測試會擋） |
| — | `src/layers/__tests__/layerHookRegistry.test.ts` | 9 key 進 `NO_HOOK_LEDGER`（純 registry 驅動，無 hook） |
| — | `src/data/__tests__/{staticDataContract,classificationCoverage}.test.ts` | 資料契約 ＋ 分類覆蓋 |
| — | `src/data/__tests__/__fixtures__/layer-golden.json` | 重生（348 → **357** key；既有層零 diff） |

**沒有**動的：`src/App.tsx`、`useLayerVisibility.ts`、任何 loader/hook —— 9 層全走
OVERLAY_REGISTRY 通用路徑。`DEFAULT_ON` 也**刻意沒動**（理由見 README「預設全關」段）。

## 上游改什麼會炸（給上游看的）

1. **改欄位型別**（字串 → 數字或反之）→ `staticDataContract` 紅。改前請先開 issue。
2. **新增分類值**（`nh_type` 第 4 種、`attr_type` 第 6 種寫法、`sub_code` 新碼）
   → `classificationCoverage` 紅。前端要同步補 `welfareTypes.ts`，否則那批點靜默落中性灰。
3. **改檔名**（例如 `welfare_gov_offices_national` 改回 `welfare_service_centers`）
   → `deployContract` ＋ `staticDataContract` 紅。
4. **T0103 過濾條件放寬** → 會與 `welfareCenters` 重複；那層的「零重疊」承諾寫進了
   popup 與圖例文案，要一起改。
5. **空值約定改成保留空字串** → 前端的 `"key" in props` 判斷會把空字串當有值，
   popup 出現空白列。

## UX baseline 對照（layer-onboarding Step 3 點層 POI 表）

| layer | 點數 | 級距 | radius z6/z12 | opacity | 對照 |
|---|--:|---|---|--:|---|
| `welfareLtcInstitutions` | 3,117 | 1k–10k | 3 / 6 | 0.85 | ✅ 照表 |
| `welfareNursingHomes` | 1,611 | 1k–10k | **床數泡泡** 2→~13 | 0.85 | ✅ 泡泡層，基底貼近表 |
| `welfareChildcare` | 1,578 | 1k–10k | 3 / 6 | 0.85 | ✅ 照表 |
| `welfareChildServices` | 1,396 | 1k–10k | 3 / 6 | 0.85 | ✅ 照表 |
| `welfareElderlyHomes` | 1,160 | 1k–10k | **床數泡泡** 2→~14 | 0.85 | ✅ 泡泡層，基底貼近表 |
| `welfareSocialWorkOrgs` | 587 | <1k | 2.6 / 5 | 0.7 | ⚠️ **刻意偏離**（表為 4/8 @0.9） |
| `welfareDisability` | 334 | <1k | 4 / 8 | 0.9 | ✅ 照表 |
| `welfareGovOffices` | 151 | <1k | 4 / 8 | 0.9 | ✅ 照表 |
| `welfareMentalHealth` | 70 | <1k | 4 / 8 | 0.9 | ✅ 照表 |

唯一偏離是 `welfareSocialWorkOrgs`：上游明確不建議把「組織」放進服務可近性地圖，
故縮小 ＋ 降透明度 ＋ 配灰色，不與服務據點爭焦點。理由寫在 registry entry 的註解裡。
全部 9 層 < 10k 點 → **不需要 cluster**（表的門檻是 10k）。

## 驗收紀錄（2026-08-13）

- `npx tsc -b` ✅
- `npx vitest run` ✅ 42 檔 / 573 tests
  （⚠️ `upstreamRegistry.test.ts` 的跨 repo dataset_id 檢查在 **worktree 下會 skip**
  —— 它按 sibling path 找 taipei-gis-analytics，worktree 深了兩層找不到。
  9 個 dataset_id 已手動核對 `docs/data-catalog/welfare/*.md` 的 frontmatter，全數對上；
  在主樹或 CI 跑會真的驗。）
- 瀏覽器實測（headless Chromium + SwiftShader，dev :3731）：
  - 9 層全數加進 map style 並渲染（台北 z11：長照 621／托嬰 656／護理 389／兒少 378／
    老人 353／社福團體 147／身障 90／公部門 29／心衛 10 點）
  - `welfareCenters` 保持 `visibility: none`（沒有被誤開）
  - 護理之家泡泡：一般護理之家／產後護理之家半徑隨床數變化、居家護理所落基底最小點 ✅
  - 身障使用率：琥珀（80-100%）為主 ＋ 綠／藍／灰散佈，**沒有出現整片紅**（除零守門有效）✅
  - z16.5 概略點降階：同街廓的 `exact` 點實心、`approximate` 點淡化成空心圈 ✅
  - popup ×4（兒少概略點／居家護理所無床／一般護理之家床數明細／身障無核定量）✅
  - 圖例只顯示已開啟層的區段 ＋ 概略點說明 ✅
  - console 無 Mapbox 表達式錯誤 ✅
  - **鐵則 4（控件不得橫向溢出）**：首版**沒過** —— 「定位精度」只有 3 個選項
    （`options.length > 3` 才走原生 select），被渲染成橫向 button row，
    「排除概略點」「只看概略點 (98)」在 ~240px 側欄裡三顆**全部折行**，
    連「全部」都被拆成「全」「部」兩行。
    修法：label 縮到 ≤4 字（`全部` / `排除概略` / `僅概略點`），
    **`value` 與 `encode` 完全不動**（篩選語意零變更），筆數（98）改寫在圖例。
    重測：三顆按鈕 36/54/54 px、高度 17 px＝單行，型別走原生 select，
    透明度／大小 slider 各佔一行，全部裝進側欄 ✅（`/tmp/wf-sidebar3.png`）
