# Backlog — education-layers

> 本 feature 的待辦。上游 **9 個 dataset 全部接完**（W1 2 個 ＋ W2 2 個 ＋ W3 5 個），
> 共 16 個圖層。剩下的只有分析層、技術債與待拍板事項。

## ✅ 已完成

- [x] **EDU-0a**：**S3 上傳完成**（2026-08-09）。`deploy-assets/education/` 9 個檔、
      合計 **17,350,525 bytes**，逐檔大小與本地比對全部吻合。

      ⚠️ 踩到一個假警報值得記錄：本專案的 S3 憑證在 **`mini-taiwan-pulse/.env`**
      的 `S3_ACCESS_KEY` / `S3_SECRET_KEY`，**不在 `~/.aws/credentials`**。
      `~/.aws/` 裡那幾個 profile 是別的用途、對本 bucket 沒權限。
      `scripts/deploy/upload-deploy-assets.sh` 第 4-8 行**本來就會**從 `.env`
      export 成 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`，腳本沒有問題 ——
      直接跑 `aws sts get-caller-identity` 或 `aws s3 ls` 測連線會失敗是正常的，
      **測之前要先 `set -a; . ./.env; set +a`**，別誤判成沒有憑證。

- [x] **EDU-0b**：PR [#116](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/116)
      已 squash merge 進 master（`f402147`），CI test + review 全綠
- [x] **EDU-0c**：上游 `taipei-gis-analytics` 已 push（`03d66d7`，含 25 個 commit）。
      順帶 merge 進來的 `lightning_cwa.md` 修掉了 EDU-12 → `pnpm test` 現在 **326/326 全綠**

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

## ✅ 已完成 — 分析層與技術債（2026-08-09）

- [x] **EDU-9**：`eduCampusArea` 校地面積面量圖 —— 教育主題第 **17 個圖層**。
      與 `eduCampusPolygon` **同一份切片、同一個 sourceId**（4.36 MB 只下載一次），
      差別只在讀法：那層按學制分色、本層按 `area_ha` 分 5 級（YlGnBu 色階）。
      門檻 1/2/5/10 ha 取自實測分布（median 2.08／p90 4.80／p99 24.86／max 293.48），
      各級 708／1,337／1,883／260／136 = 4,324。popup 共用既有 `eduCampus` panel，
      未新增 layerType。
- [x] **EDU-10**：舊資產退役。`upload-deploy-assets.sh` 的 `public/geo/schools.geojson`
      與 `pull-deploy-assets.sh` 的 `--include "schools.geojson"` 已移除（各留一行註解說明原因）。
      全 `src/` 掃過確認無引用。**S3 上的 `deploy-assets/schools.geojson` 物件保留未刪**
      （刪除不可逆，且留著只佔空間不影響任何行為）。
- [x] **EDU-11**：新增 `src/data/__tests__/pmtilesClassificationCoverage.test.ts`。
      `pmtiles` 套件的 `FileSource` 只吃瀏覽器 File 物件，Node 端自己實作了 Source 介面
      （只需 `getKey`／`getBytes`），從 PMTiles 檔頭的 `tilestats` 取每個屬性的 distinct values
      比對分色表。守住三個先前無人看管的分類：`campus_polygon.school_level`（10 類）、
      `cram_schools.短期補習班類別`（14 類）、`school_district_k12.precision`（2 類），
      並順帶對帳 feature 總數 4,336／17,137／860。
      **做過負向驗證**：暫時從分色表移除 `kindergarten` 後測試確實轉紅，不是假綠。
- [ ] **EDU-14**：上游 `cram_schools` PMTiles 用 `--drop-densest-as-needed` 切片，
      **z8~z14 每層都大量丟點，只有 z15 完整**（實測台北同一 bbox：z12 只有 15 筆、
      z13 35、z14 84、z15 204）。前端已在圖例誠實標示抽稀，但根治要上游重切：
      `-r1 --no-feature-limit --no-tile-size-limit`（代價是檔案變大）。
      要不要重切由 owner 拍板 —— 17,137 點在 z10-12 全畫出來也可能糊成一片，
      現況「抽稀 + 標示」未必比較差
- [x] **EDU-13**：`lin_specs` 的 Excel 日期污染 **上游已修**（B163，PR #40）並重出資產，
      下游 2026-08-09 已同步 `school_district_k12.pmtiles`（1,466,615 → 1,461,763 bytes）並重傳 S3。
      驗證：含「月」字的 `lin_specs` **歸零**；富安國小 → `11-12`、
      雙蓮 → `16；19-21；1-19；21-24；27-32`；面數 860 與 precision 206/654 完全不變。
      成因確認是**上游原始 CSV 就已污染**（臺北 476 筆），非讀取造成。
      上游連帶修掉一個更危險的問題：`build_web_assets.py` 原本用 `sorted(...)[0]` 取
      processed geojson，重跑後會拿到**最舊**那份，等於默默交付舊資料，已改 `[-1]`

## 非本 feature 範圍（明確不做）

- **教育主題的即時資料**：上游實打 12 個端點確認 `realtime=0`，最高頻只到「每日更新的名冊」。
  停班停課即時已在 `src/data/disasterAlertTypes.ts:44` 的 NCDR 鏈上，**不要在教育 tab 重做**。

## ✅ 既有問題（非本次引入，驗收時撞到，已解決）

- [x] **EDU-12**：`upstreamRegistry.test.ts` 的 `lightningCwa → lightning_cwa` 紅燈。
      判斷正確——修法確實是**上游補 catalog doc**，而不是把 datasetId 改成 `lightning_taipower`
      （不同資料源，且台電源自 2026-07-10 起永遠回空）。
      2026-08-09 上游 pull 時 merge 進 `docs/data-catalog/weather/lightning_cwa.md`（PR #39），
      `pnpm test` 從 325/326 變成 **326/326 全綠**
