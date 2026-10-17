# 治安統計 Crime Statistics（G17）

> **Slug**：`crime-statistics`（analytics `docs/topic-research/crime_statistics/`）
> **狀態**：dev（PR 到 develop，未發布 master）
> **上線日期**：未發布
> **相關 PR**：#634（merge a6194172；見 changelog.md）

## 一句話說明

把警政署犯罪資料（data.gov.tw 14200，8 案類）與電信詐欺犯罪資料（98176）的鄉鎮／縣市年統計（4 dataset、36 指標、386 個 exact selector，R2 統計 CDN 已上線）接上 Statistics，並取代舊的 `crimeAreaMonthly`（11 年累計、沒有年份也沒有人口分母的 PMTiles）。

## 放在哪裡

| 位置 | 內容 |
|---|---|
| Statistics 分頁「犯罪與治安 Crime & Safety」 | 群組「刑案發生」（8 案類）、「詐欺」（電信詐欺）；每個案類一列，選單切「鄉鎮・件數／鄉鎮・每十萬人／縣市・件數／縣市・每十萬人」 |
| Layers 完整目錄 | 新主題「治安統計 Crime Statistics」（安全大分類） |
| 資料檔 | `src/data/crimeStatisticsRecipes.json`（交付 SSOT，含 `delivery` 收據）＋`.catalog.json`（首屏目錄）＋`crimeStatisticsRecipes.ts`（key 順序） |
| 產生器 | `scripts/statistics/build_crime_statistics_recipes.py`（讀 analytics `docs/handoff/crime-statistics-recipes.json` 與每個 release bundle 逐一核對）→ `npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts` |

接法：用 atlas recipe 型別當第 7 個家族掛進 `atlasStatisticsRecipes.ts` 的 `FAMILIES`，loader、期別白名單、連動選單、圖例、說明・來源、目錄都走 atlas 共用路徑，不另開管道。

## 圖層（36）

| 案類 | 鄉鎮 件數／每十萬人 | 縣市 件數／每十萬人 | 期別 |
|---|---|---|---|
| 毒品 | `statsCrimeDrugCasesTownship`／`statsCrimeDrugPer100kTownship` | `statsCrimeDrugCasesCounty`／`statsCrimeDrugPer100kCounty` | 2015–2025＋2026 年 1–6 月（比率到 2025） |
| 住宅竊盜 | `statsCrimeResidentialBurglary{Cases,Per100k}Township` | `…County` | 同上 |
| 機車竊盜 | `statsCrimeMotorcycleTheft{Cases,Per100k}Township` | `…County` | 同上 |
| 汽車竊盜 | `statsCrimeCarTheft{Cases,Per100k}Township` | `…County` | 同上 |
| 強盜 | `statsCrimeRobbery{Cases,Per100k}Township` | `…County` | 同上 |
| 搶奪 | `statsCrimeSnatching{Cases,Per100k}Township` | `…County` | 同上 |
| 強制性交 | `statsCrimeSexualAssault{Cases,Per100k}Township` | `…County` | 同上 |
| 組織犯罪 | `statsCrimeOrganizedCrime{Cases,Per100k}Township` | `…County` | 2018 年 10–12 月、2019–2025、2026 年 1–6 月（比率 2019–2025） |
| 電信詐欺 | `statsTelecomFraud{Cases,Per100k}Township` | `…County` | 同組織犯罪 |

門檻用交付的 `breaks`（2025 年分布取好讀數，跨期固定）；唯一例外是組織犯罪鄉鎮件數只有一個門檻 `[1]`，補成 `[1, 2]`（0／1／≥2 三級）以符合 atlas「至少兩個門檻」契約。

## 呈現規則

- **預設期別＝最新全年 2025**（recipe `default_release_id`），不是排第一的 2026 年 1–6 月。atlas 共用層新增 `atlasDefaultReleaseOption`；其他 atlas 家族 default 本來就是最新期別，行為不變（有測試）。
- **部分期別**（2026 年 1–6 月、2018 年 10–12 月）在期別選單、圖例、彈窗都標「（部分期別）」（`partial_period_label` → `statisticsSelect.partialPeriod` 三語）。比率層沒有部分期別；在件數層停在 2026 時切到比率，群組切換照既有規則拒絕跳期別（不靜默改成 2025），畫面顯示「載入失敗：此類型沒有相同期別的資料…」；「載入失敗：」前綴來自所有連動選單共用的 `paramsPanel.loadFailedWith`，改字會牽動共用層，未改。
- **圖例逐行說明**（recipe `legend.notes`，英日文 `enum.statLegendNote.*`）：人口分母＝戶籍人口；季初步統計，以年度刑案統計為準；毒品案發生地多為查獲地（只在毒品層）；電信詐欺「2024 年第 3 季起季件數約為前一季 7 倍，原因未查明」；機車竊盜鄉鎮層 2025 登記口徑斷點；住宅竊盜 2023 起連年倍增原因未查明；有部分期別的層加「部分期別只有件數、沒有比率」。
- **不遮蔽**（使用者 2026-10-17 決定）：0 照實顯示並有 0 值說明；小數字照實顯示；沒有 suppressed 樣式。缺值以 status 標記不補 0（本批 386 個 release 全為 observed）。
- **位置口徑與查獲地**：交付 36 個 recipe 共用一句「案件發生地；毒品案多為查獲地」。前端：「毒品案發生地多為查獲地」只出現在毒品層（圖例一行＋資料限制），其他案類的圖例、彈窗都不出現；位置口徑一律「案件發生地（鄉鎮市區精度）」，電信詐欺寫「案件發生地點（鄉鎮市區精度；來源未說明是受騙地或報案地）」；圖例同一句不重複（測試檢查）。交付的 disclosure 拿掉內部註記（決策日期、reconciliation、null）後照用。
- **外文**：圖例說明 `enum.statLegendNote.*`、案類群組名 `enum.statGroup.*`（`MedicalStatisticsGroupControls` 改查此 enum，其他家族查不到維持中文）、小群組與主題 `theme.*`；位置口徑與資料限制同 atlas 前例維持中文。
- 用語只寫「件數較多／比率較高」，recipe 內沒有「最危險／最安全」（測試檢查）。
- 時間軸：Pulse 的統計圖層一律以「期別」下拉切年度，不接全域時間軸（所有統計家族相同）。

## 汰換 crimeAreaMonthly

刪除：manifest、overlay、點擊登記、line/fill tier、params、型別、彈窗 `CrimeAreaMonthlyPanel` 與其 6 個 i18n key、圖例項、`layer.crimeAreaMonthly` 英日文名、資產 `public/police_justice/crime_area_monthly/`（含 PMTiles）、`scripts/preprocess/prepare-crime-area-preview.sh`、`crimeAreaMonthlyAsset.test.ts`；`layerManifest` 統計正規化迴圈的特例一併拿掉。

舊分享連結：`parseLayers` 對未知 key（含已下架圖層）一律略過，repo 沒有 alias 機制，所以舊連結裡的 `crimeAreaMonthly` 會被靜默略過，不映射到新圖層。

其他 repo（主 agent 處理）：MCP `datasetLabels.json`／`publishAllowlist.json` 的 `crime_area_monthly`、analytics registry deprecate（見 analytics `registry-spec.yaml`）。
