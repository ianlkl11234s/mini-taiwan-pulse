# 人口統計 Statistics（戶籍人口／年齡結構）

> **Slug**：`demographics-statistics`（上游 handoff：`household-registration-population`、`population-age-structure`）
> **狀態**：dev（本地接線＋本地 browser QA 完成；尚未發布 R2／CDN）
> **上線日期**：未上線

## 一句話說明

Statistics「人口與教育」依序新增「戶籍人口→年齡結構→人口動態→遷徙→原住民→外來人口」六組，共 117 層、640 個 exact selector（P0–P6；含村里 20 層，只有 115 年 8 月一期）。既有「每月出生數（歷史快照）」併入「人口動態」末尾。

## 圖層 / 群組

| 群組（Statistics 一列） | 成員 | 選單 |
|---|---|---|
| 戶籍人口數／戶數／戶量／人口密度 | 縣市、鄉鎮、村里 各 1 | 地理層級＋資料期別 |
| 年齡組人口數、年齡組人口占比 | 0-14／15-64／65+ × 縣市、鄉鎮、村里 | 指標／地理層級＋資料期別 |
| 老化指數與扶養比 | 老化指數、扶養比、扶幼比、扶老比 × 縣市、鄉鎮、村里 | 同上 |
| 性比例、年齡中位數 | 縣市、鄉鎮、村里 | 地理層級＋資料期別 |
| 出生與死亡、自然增加、結婚與離婚 | 數與粗率 × 縣市、鄉鎮（2021–2025） | 指標／地理層級＋資料期別 |
| 人口動態年初累計、遷徙年初累計 | 115 年 1–8 月累計（獨立列，不與年度值互換或比較） | 指標／地理層級 |
| 遷入與遷出、淨遷徙（社會增加） | 2018–2025（社會增加率 2019 起） | 指標／地理層級＋資料期別 |
| 原住民人口數／占比 | 平地、山地 × 縣市、鄉鎮、村里 | 同上 |
| 已設戶籍外來人口數／占比、歸化國籍人數 | 原屬地區 × 縣市、鄉鎮；歸化只有縣市 | 同上 |

- 群組內切換保留同一期別（county↔township 以 period 比對）。
- 村里層僅提供 115 年 8 月一期（界線版本須與資料期別一致：RIS 11508 × 內政部村里界 `VILLAGE_NLSC_1150817`，7,781 村里代碼完全一致）。從縣市／鄉鎮的其他期別切到村里時落到 11508（`medicalStatisticsSelection.ts`，只限「村里且唯一一期」）；切回縣市保留 11508。村里期別只有一個值，依連動選單規則不顯示期別選單、寫在說明・來源。人口動態、遷徙（流量跨 3/1、7/1 村里調整）與外來人口（無 11508）沒有村里層。
- 村里 geometry 每份約 80 MB，只有該村里層被開啟（或展開為群組可見成員）時才下載；群組列的預設成員永遠是縣市。
- 期別只有一列「資料期別」（每期恰一組 `{roc_year, month}`，不拆成年／月串連）；時點期別顯示「YYYY-MM-DD（時點）」。

## 視覺

- 色階唯一入口 `src/data/statisticsVisuals.ts`：新增 `population` 主題 ColorBrewer **RdPu**（淺粉→深紫，sequential），key 前綴 `statsDemographics` 優先判定，避免未來「出生」等標籤落入出生登記（公用事業）分支。不用紅綠暗示好壞；性比例也維持 sequential。
- 可正可負（自然增加、淨遷徙及其率，含年初累計）：recipe 門檻對稱於 0，`statisticsVisualColors` 走 PuOr 六階（棕負、紫非負、0 為分界），不以紅綠表好壞；四種色覺模擬明度測試覆蓋。
- 門檻用 recipe `legend.breaks`（`fixed_breaks`），不重算 quantile；recipe 自帶的藍色 colors 不使用。
- icon：人數 Users、戶 HousePlus、密度 UsersRound、年齡組 PersonStanding、老化／扶養 Hourglass、性比例 Scale、中位數 CalendarClock。

## 來源與口徑

- 「資料可用狀態」STALE 是上游 health 規則（非最新期別＝歷史快照，`07_export_statistics_bundles.py:248`、`population_bundle_kit.py:238`），不是資料錯誤；顯示改為「STALE（歷史期別：已有較新期別，數值本身不受影響）」。
- P3：按登記日期；2022 年含 1 個月（3 月）來自 data.gov.tw 131138 靜態 CSV。P4：縣市遷入 ≠ 鄉鎮加總（只計跨越本層界線者）。P6：只含已設戶籍者，不是移工、不是外僑居留；授權依 data.gov.tw 127528／62563 頁為 OGDL v1；歸化為年度流量、縣市層，110／111／113 年 PARTIAL。

- 來源卡：「內政部戶政司 RIS（授權條款待確認）」，不寫 OGDL。
- 年齡中位數：本專案依單一年齡內插自算，非內政部公告。
- 人口密度面積：參考界線在 EPSG:3826 的平面面積，縣市合計比公告面積約 +1.8%。
- 缺值：鄉鎮 10712、10812 高雄三民區、鳳山區 missing → 斜線，不補 0；PARTIAL（366/368）保留於圖例與 popup。村里老化指數 4 村里 0–14 歲為 0（not_applicable，7,777/7,781）。
- 村里界線：內政部國土測繪中心 115 年 8 月 17 日版（data.gov.tw 7438，OGDL v1），排除 206 個未編定村里、補入瑪家鄉三和村；只驗證代碼集合，多邊形未獨立驗證。來源總覽卡與說明・來源皆顯示中文界線名，不印代碼。

## 關鍵檔案

- Recipes：`src/data/demographicsStatisticsRecipes.{json,catalog.json,ts}`（builder：`scripts/statistics/build_demographics_statistics_recipes.py`）
- Loader：`src/data/regionalStatisticsLoader.ts`（DEV preview route `/__demographics-statistics-cdn`）
- 群組：`demographicsStatisticsRecipes.ts` `GROUP_SPECS` → `medicalStatisticsGroups.ts`
- Catalog：`src/components/sidebar/layerCatalog.ts`；Legend：`StatisticsDetails.tsx` `StatisticsLegend`

## 本地預覽

```sh
# analytics：合併 fragments（不改原包）並起唯讀 server
python3 pipelines/shared/regional_statistics/assemble_demographics_preview.py household-registration-population population-age-structure population-vital-events population-migration indigenous-population foreign-origin-population
cd output/demographics-statistics-preview/cdn/v1 && python3 -m http.server 3763 --bind 127.0.0.1
# pulse worktree
VITE_DEMOGRAPHICS_STATISTICS_PREVIEW=true DEMOGRAPHICS_STATISTICS_PREVIEW_PORT=3763 npm run dev -- --host 127.0.0.1 --port <free port>
```

只有 DEV＋flag＋已登錄 key＋dataset 相符才走 preview；不改全域 `VITE_STATISTICS_CDN_BASE`。

資料契約見 [handoff.md](./handoff.md)；後續見 [backlog.md](./backlog.md)。
