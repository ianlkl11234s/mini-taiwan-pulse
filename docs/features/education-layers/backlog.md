# Backlog — education-layers

> 本 feature 的待辦。上游 9 個 dataset 已接 **4 個**（W1 的 schools／campus_polygon
> ＋ W2 的 school_district_k12／school_district_senior），剩 5 個點層。

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

## 待辦 — W3（其餘點層）

- [ ] **EDU-3**：`kindergartens` 幼兒園 6,689 點（3.59 MB）
- [ ] **EDU-4**：`cram_schools` 短期補習班 17,137 點（PMTiles 3.80 MB；**每日更新**）
      - ⚠️ `各地短期補習班數量` 欄是**全國總數 17772**（每列都一樣），不是該縣市數量，別拿來顯示
      - >10k 點，照 UX baseline 要考慮 cluster 或低 zoom 抽稀
- [ ] **EDU-5**：`afterschool_care` 兒童課後照顧中心 782 點
- [ ] **EDU-6**：`mutual_care` 互助教保服務中心 148 點
- [ ] **EDU-7**：`university_students` 大專校別學生數 159 點（bubble size）
      - ⚠️ **21 筆 `students_total` 為 null**（進修學院/空大 10 歸母校、宗教研修 9 不在統計、停辦改名 2）
        做 bubble size 要處理 null，**不要當成 0**
- [ ] **EDU-8**：W3 四個點層都有 `precision` 欄（exact / cached / tgos / **interpolated**）。
      `interpolated` 84 筆位置是估的，要不要淡化顯示待決

## 待辦 — 分析層（上游 layer-plan 規劃但未做）

- [ ] **EDU-9**：`eduCampusArea` — 同一份 campus PMTiles 用 `area_ha` 分級著色（面量圖）

## 技術債 / 清理（低優先，需確認無引用後才動）

- [ ] **EDU-10**：舊資產 `public/geo/schools.geojson` 與 S3 扁平根 `deploy-assets/schools.geojson`
      已成孤兒（registry 全指 `./education/`）。要清的是：
      `upload-deploy-assets.sh` 第 29 行、`pull-deploy-assets.sh` geo 段的 `--include "schools.geojson"`
- [ ] **EDU-11**：`classificationCoverage.test.ts` 的 CASES 機制只吃 GeoJSON，
      `campus_polygon` 的 10 類 `school_level` 目前靠 `campusLevelColorExpr` 的 fallback 兜底，
      沒有測試守門。若之後有 PMTiles 解析能力再補

## 非本 feature 範圍（明確不做）

- **教育主題的即時資料**：上游實打 12 個端點確認 `realtime=0`，最高頻只到「每日更新的名冊」。
  停班停課即時已在 `src/data/disasterAlertTypes.ts:44` 的 NCDR 鏈上，**不要在教育 tab 重做**。

## 既有問題（非本次引入，但驗收時撞到）

- [ ] **EDU-12**：`pnpm test` 的 `upstreamRegistry.test.ts` 有一筆 `lightningCwa → lightning_cwa` 紅燈，
      HEAD 上就存在。上游 catalog 只有 `lightning_taipower.md`，缺 `lightning_cwa.md`。
      修法是**上游補 catalog doc**，不該把 datasetId 改成 `lightning_taipower`
      （不同資料源，且台電源自 2026-07-10 起永遠回空）
