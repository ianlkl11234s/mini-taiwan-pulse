# Backlog — education-layers

> 本 feature 的待辦。上游 **9 個 dataset 全部接完**（W1 2 個 ＋ W2 2 個 ＋ W3 5 個），
> 共 16 個圖層。剩下的只有分析層、技術債與待拍板事項。

## 待用戶拍板（本輪產出，不自己動）

- [ ] **EDU-0a**：S3 上傳 `deploy-assets/education/`（`bash scripts/deploy/upload-deploy-assets.sh`）
- [ ] **EDU-0b**：push `feat/education-layers` + 開 PR
- [ ] **EDU-0c**：上游 `taipei-gis-analytics` 的 education 批次也**尚未 push**，需一併處理
      （跨 repo 順序：上游先、下游後）

## ✅ 已完成 — W2（學區面，2026-08-09）

- [x] **EDU-1**：`school_district_k12`（860 面，PMTiles 1.40 MB）→ 拆成
      `eduDistrictElementary` 621／`eduDistrictJunior` 239 兩個 toggle（兩級的面完全疊合，
      合成一個會糊成一片）。`precision` 分色（淡色 = 部分鄰屬 654 面）、popup 顯示 `lin_specs`、
      圖例五句誠實性標示、共同學區 292 面未去重
- [x] **EDU-2**：`school_district_senior`（15 面，GeoJSON 0.70 MB）→ `eduDistrictSenior`，
      5 色循環、popup 含跨區就讀規則（最長 685 字，捲動顯示）
      - 踩到一個上游契約錯誤：`district_no` 實際是**字串**（handoff §3.4 寫 number），
        表達式必須包 `["to-number", …]`，否則 15 個面全黑。已回報上游

## ✅ 已完成 — W3（幼托補習 + 大專學生數，2026-08-09）

- [x] **EDU-3**：`kindergartens` 6,689 → `eduKindergarten`（公/私立二色 2,392／4,297）
- [x] **EDU-4**：`cram_schools` 17,137 → `eduCramSchool`（PMTiles z8-15，14 類 fold 成 5 組）。
      `各地短期補習班數量` 已確認**不顯示**；密度處理靠切片 minzoom=8 ＋ 小一階半徑，未上 cluster
- [x] **EDU-5**：`afterschool_care` 782 → `eduAfterschoolCare`
- [x] **EDU-6**：`mutual_care` 148 → `eduMutualCare`（與幼兒園共用 popup panel）
- [x] **EDU-7**：`university_students` 159 → `eduUniversityStudents`（bubble 面積正比於學生數；
      21 筆 null 畫固定小灰點 + popup 說明三種原因，未當成 0）
- [x] **EDU-8**：`interpolated`（84 筆）**決定淡化**——`geocodeFadeOpacity()` 降到 45% opacity，
      popup 另標「⚠️ 同路段內插（位置是估計值）」

  踩到三個 handoff 沒寫的顯示層陷阱（已記在 handoff.md）：`[NN]` 方括號前綴、
  `地區縣市` 其實是機關名、`立案時間` 兩份紀年不同

## 待辦 — 分析層（上游 layer-plan 規劃但未做）

- [ ] **EDU-9**：`eduCampusArea` — 同一份 campus PMTiles 用 `area_ha` 分級著色（面量圖）

## 技術債 / 清理（低優先，需確認無引用後才動）

- [ ] **EDU-10**：舊資產 `public/geo/schools.geojson` 與 S3 扁平根 `deploy-assets/schools.geojson`
      已成孤兒（registry 全指 `./education/`）。要清的是：
      `upload-deploy-assets.sh` 第 29 行、`pull-deploy-assets.sh` geo 段的 `--include "schools.geojson"`
- [ ] **EDU-11**：`classificationCoverage.test.ts` 的 CASES 機制只吃 GeoJSON，
      `campus_polygon` 的 10 類 `school_level`、`cram_schools` 的 14 類 `短期補習班類別`、
      `school_district_k12` 的 `precision` 都是 PMTiles，目前靠各自 color expr 的 fallback 兜底，
      沒有測試守門。若之後有 PMTiles 解析能力再補
- [ ] **EDU-13**：上游 `school_district_k12` 的 `lin_specs` 有 **Excel 日期污染**
      （富安國小 `11月12日` 應為 `11-12` 鄰；雙蓮 `1月19日` 應為 `1-19`）。
      前端忠實渲染，修法在上游 pipeline 讀 Excel 時該欄位強制 `str` dtype。已回報

## 非本 feature 範圍（明確不做）

- **教育主題的即時資料**：上游實打 12 個端點確認 `realtime=0`，最高頻只到「每日更新的名冊」。
  停班停課即時已在 `src/data/disasterAlertTypes.ts:44` 的 NCDR 鏈上，**不要在教育 tab 重做**。

## 既有問題（非本次引入，但驗收時撞到）

- [ ] **EDU-12**：`pnpm test` 的 `upstreamRegistry.test.ts` 有一筆 `lightningCwa → lightning_cwa` 紅燈，
      HEAD 上就存在。上游 catalog 只有 `lightning_taipower.md`，缺 `lightning_cwa.md`。
      修法是**上游補 catalog doc**，不該把 datasetId 改成 `lightning_taipower`
      （不同資料源，且台電源自 2026-07-10 起永遠回空）
