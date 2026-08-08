# Backlog — education-layers

> 本 feature 的待辦。上游 9 個 dataset 本輪只接了 2 個。

## 待用戶拍板（本輪產出，不自己動）

- [ ] **EDU-0a**：S3 上傳 `deploy-assets/education/`（`bash scripts/deploy/upload-deploy-assets.sh`）
- [ ] **EDU-0b**：push `feat/education-layers` + 開 PR
- [ ] **EDU-0c**：上游 `taipei-gis-analytics` 的 education 批次也**尚未 push**，需一併處理
      （跨 repo 順序：上游先、下游後）

## 待辦 — W2（學區面，最需要仔細設計圖例與 popup）

- [ ] **EDU-1**：`school_district_k12`（國中小學區 860 面，PMTiles 1.40 MB）
      - 🔴 **面與面本來就重疊**，1,115 組「一里多校」是制度事實，**不要 dedup**
      - popup **必須顯示 `lin_specs`**（鄰級文字），圖層說明要寫「實際學區以各校公告為準」
      - 🔴 只有 4 縣市有資料（臺北 226／臺中 302／新北 286／新竹市 46），另 11 縣市完全無公告
        → 圖例必須區分「無資料」與「無學區」
      - 臺北是 **110 學年度**，比其他三縣市舊，popup 或圖例宜註明學年度
      - ⚠️ 務必用 `web/` 的 simplified 版（1.40 MB），不要用 processed 根目錄的 21.71 MB 原精度檔
- [ ] **EDU-2**：`school_district_senior`（高中就學區 15 面，GeoJSON 0.70 MB）
      - 這是**縣市級**，與 EDU-1 的里級完全不同粒度，**不要放同一個 toggle 群組**
      - 同樣要用 `web/` 版（0.70 MB），非 12.24 MB 原精度檔

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
