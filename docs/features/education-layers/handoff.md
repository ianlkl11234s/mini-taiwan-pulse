# Handoff — education-layers（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/education-layers.md`
> （上游 commit `9ec823e`，contract 細節看那份，本檔只放接線簡表 + **與上游文件的差異點**）

## 上游 handoff 摘要

- 產物路徑（本次取用 2 個）：
  - `data/processed/education/schools/taiwan_schools_2024.geojson` → `public/education/schools.geojson`
  - `data/processed/education/campus_polygon/pmtiles/campus_polygon_20260807.pmtiles` → `public/education/campus_polygon.pmtiles`
- 部署：S3 `deploy-assets/education/`（鏡像子前綴，非扁平根）
- 更新頻率：`schools` yearly（113 學年度）／`campus_polygon` 官方圖資不定期
- 座標系統：WGS84
- 資料量：2.50 MB + 4.36 MB = 6.86 MB（`public/education/` 整夾 gitignore，純走 S3）

## ⚠️ 與上游 handoff 文件的三處差異（實測後修正）

| # | 上游文件說法 | 實測 | 本次採用 |
|---|---|---|---|
| 1 | 「`public/geo/schools.geojson` 是搬移前快照，接線時請重新從上游同步」 | md5 完全相同（`380b2336…`，2,504,719 bytes） | 不需同步，直接 cp |
| 2 | `upstreamRegistry` 的 `schools` 「應為 `education.schools`」 | `upstreamRegistry.test.ts` 把 catalog 的 `dataset_id` frontmatter 收成**扁平 Set**；`education/schools.md` 是 `dataset_id: schools` | 用無點號的 **`schools`** / `campus_polygon`。寫 `education.schools` 測試會紅 |
| 3 | 5 分層筆數 2614/736/508/140/28 | 加總 4,026，**少 289 校** | fold 後 2656/964/508/159/28 = **4,315**（見下） |
| 4 | §3.4 `school_district_senior` 契約列 `"district_no": 6`（數字） | 15 筆**全是字串** `"6"`；同檔的 `county_count`／`area_km2`／`rule_row_count` 都是 number | 前端表達式必須包 `["to-number", …]`。不包的話 Mapbox 算術對字串 evaluation error → match 回 null → **15 個面全黑** |

### 差異 3 的細節（最容易踩）

`school_level` 有 **9 種**原始值，上游表列的只是「主類別」。9 種值必須全部落到某一級，
否則附設國小 42、附設國中 228、空大進修 10、宗教研修 9 共 **289 校會靜默消失**，
且 `classificationCoverage.test.ts` 會擋。fold 表在 `src/data/educationTypes.ts` 的 `SCHOOL_LEVEL_GROUPS`。

## 硬依賴欄位表

### `public/education/schools.geojson`（4,315 點）

| 欄位 | 型別 | nullable | 用途 | 漏了會怎樣 |
|---|---|---|---|---|
| `school_level` | string | ✗ | 5 分級 filter + 分色 | 分級層全空 |
| `school_name` | string | ✗ | popup 標題 | popup 無標題 |
| `region_type` | string | **✓** | 偏遠層 filter + popup | 偏遠層全空 |
| `city` / `district` | string | ✗ | popup 行政區 | popup 缺列 |
| `address` / `phone` / `website` | string | ✓ | popup | popup 缺列 |
| `system_type` | string | ✓（僅大專有值） | popup | popup 缺列 |

🔴 **`region_type` 的 key 在全部 4,315 筆都存在**，非偏遠的 3,163 筆值是 JSON `null`。
filter **必須用 `match`**（`REMOTE_SCHOOL_FILTER`）；寫 `["has","region_type"]` 會全數命中。

### `public/education/campus_polygon.pmtiles`（4,336 面 → 渲染 4,324）

layer name `campus_polygon`，切片 **minzoom 8 / maxzoom 15**（`pmtiles show` 實測，
`pmtilesContract.test.ts` 會擋比切片更小的 registry.minzoom）。

| 欄位 | 型別 | 用途 |
|---|---|---|
| `school_level` | string（英文代碼 10 類） | 分色 + `non_school` 濾除 |
| `school_level_zh` | string | popup 學制（**中文，與 schools.geojson 的欄位不同一套**） |
| `school_name` | string | popup 標題 |
| `area_ha` | number | popup 校地面積 |
| `county` | string | popup 縣市 |
| `is_branch` | boolean | popup（true 才顯示「分校／分部」） |

⚠️ campus 的 `school_level` 是**英文代碼**，餵進 `schoolLevelGroupOf()` 會每筆都回 `null`。
取色一律用 `CAMPUS_LEVEL_COLORS[school_level] ?? "#90a4ae"`（與圖層 `campusLevelColorExpr` 同一份表）。

### `public/education/school_district_k12.pmtiles`（860 面）

layer name `school_district_k12`，切片 **minzoom 6 / maxzoom 13**（實測）。
`level`：`elementary` 621 ／ `junior` 239。`county`：僅臺北市／新北市／臺中市／新竹市。

| 欄位 | 型別 | 用途 |
|---|---|---|
| `school` | string | popup 標題（校名） |
| `level` | string | 拆 2 個 sublayer + 分色主色 |
| `precision` | string | `village_full` 206 ／ `village_partial` 654 → **分色**（淡色 = 部分鄰屬） |
| `lin_specs` | string | popup **鄰別**（上游明確要求必顯示） |
| `is_shared` | boolean | true 292 → popup 共同學區警告 |
| `county` / `village_count` / `villages` / `n_full` / `n_partial` / `area_km2` | — | popup |

🔴 **`lin_specs` 只有 `village_partial` 的 654 筆有值，`village_full` 的 206 筆是空字串（不是 null）**。
popup 不能直接印，一律走 `linSpecsLabel(lin_specs, precision)` —— 有值回原文、`village_full`
回「整里皆屬本校」、其餘回「—」。這條 handoff 沒寫，是實測發現的。

### `public/education/school_district_senior.geojson`（15 面）

| 欄位 | 型別 | 用途 |
|---|---|---|
| `district` | string | popup 標題（如「基北區」） |
| `district_no` | **string**（⚠️ 非 number） | 5 色循環分色 → 表達式**必須** `["to-number", …]` |
| `counties` / `county_count` | string / number | popup 涵蓋縣市 |
| `cross_district_rules` | string | popup 跨區就讀規則，**最長 685 字**，需 `maxHeight` + `overflowY:auto` |
| `area_km2` / `rule_row_count` | number | popup |

### 幼托四份（⚠️ 原始中文欄位名）

`kindergartens.geojson` 6,689 ／ `cram_schools.pmtiles` 17,137（layer `cram_schools`，z8-15）
／ `afterschool_care.geojson` 782 ／ `mutual_care.geojson` 148

| dataset | popup 欄位 | 分色 |
|---|---|---|
| kindergartens | `學校名稱`／`公/私立`／`地址`／`縣市名稱`／`鄉鎮市區名稱`／`電話`／`學年度`／`代碼` | `公/私立` 二色 |
| mutual_care | 同上（代碼欄是 `學校代碼`）→ **共用同一個 panel** | 單色（全數私立） |
| afterschool_care | **schema 不同**：`名稱`（非「學校名稱」）／`縣市`（非「縣市名稱」）／`地址`／`電話`／`立案時間` | 單色 |
| cram_schools | `短期補習班名稱`／`短期補習班類別`／`地址`／`county`／`立案時間`／`電子郵件` | 類別 14 種 fold 成 5 組 |

四者都有 geocode `precision`（`exact`／`cached`／`tgos`／`interpolated`）。
`interpolated` 全體僅 84 筆，用 `geocodeFadeOpacity()` 降到 45%。

🔴 **三個顯示層陷阱（handoff 都沒寫，實測發現）**：

1. kindergartens 的 `縣市名稱`／`地址` **全 6,689 筆帶 `[NN]` 方括號前綴**（`[01]新北市`、`[237]新北市三峽區…`）。
   只在**顯示層** strip，**不要動資料**——上游 geocode 刻意保留，拿掉命中率歸零。
2. cram 的 `地區縣市` 其實是**機關名**（「臺南市政府」「南投縣政府」），要用 `county` 才是清洗後的縣市名。
3. `立案時間` 兩份**紀年不同**：cram 是西元 8 位（`20041103`）、afterschool 是民國 6-7 位（`1020812`）。
   兩份都要正規化成 `YYYY-MM-DD`，直接印會出現「1020-08-12」這種鬼日期。

🔴 **`各地短期補習班數量` 絕對不可顯示** —— 全國總數 17772，每列值都一樣，
顯示出來會被讀成「該縣市有 17772 家」。`educationTypes.ts` 有 `CRAM_FORBIDDEN_POPUP_FIELD` 標記。

### `public/education/university_students.geojson`（159 點，⚠️ **英文欄位**）

| 欄位 | 型別 | 用途 |
|---|---|---|
| `school_name` | string | popup 標題 |
| `students_total` | number **nullable** | bubble 半徑（sqrt → 面積正比） |
| `students_male` / `students_female` | number | popup |
| `school_level` / `city` / `district` / `academic_year` / `code` | — | popup |

🔴 **21 筆 `students_total` 是 null**（有值 138 筆，368 ~ 34,941）。
全部可解釋：進修學院/空大 10（學生數歸母校）／宗教研修學院 9（不在統計範圍）／停辦改名 2。
bubble 半徑走 `case` 給固定小灰點，**不能落進 interpolate**（會被當成 0）。

## 前端接線點（17 檔）

`types/index.ts`(3 處) → `data/educationTypes.ts`(新) → `map/overlayRegistry.ts`(8 config) →
`sidebar/layerCatalog.ts`(LAYER_COLORS + THEMES) → `hooks/useTransportParams.ts`(4 處含 deps) →
`components/LegendPanel.tsx` → `featureInfo/educationPanels.tsx`(新) + `featureInfo/registry.tsx` +
`featureInfo/infraPanels.tsx`(移出 SchoolPanel) → `hooks/useMapInteraction.ts` →
`components/IconRailSidebar.tsx` → `data/upstreamRegistry.ts`(8 筆) →
4 支契約測試 → `nginx.conf` + `scripts/deploy/{pull,upload}-deploy-assets.sh`

**零新 hook、零新 loader、不碰 `App.tsx`** —— 全走 overlayRegistry 宣告式路徑。

## Mapbox layer id（改 sourceId 要同步這些字串）

`edu-schools-{glow,circle,elementary,junior,senior,university,special,remote-halo,remote-dot}`
`edu-campus-{fill,line}`
`edu-district-k12-{elementary-fill,elementary-line,junior-fill,junior-line}`
`edu-district-senior-{fill,line}`
`edu-kindergarten-circle`／`edu-cram-circle`／`edu-afterschool-circle`
`edu-mutual-care-circle`／`edu-university-students-bubble`

## 回填上游（待辦）

接線完成後要回填 `taipei-gis-analytics/docs/data-catalog/education/{schools,campus_polygon}.md`
的 `used_by_pulse_layers` 欄與本次 commit hash。
