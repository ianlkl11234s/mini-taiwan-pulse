# 人口統計 Statistics（戶籍人口／年齡結構）

> **Slug**：`demographics-statistics`（上游 handoff：`household-registration-population`、`population-age-structure`）
> **狀態**：dev（本地接線＋本地 browser QA 完成；尚未發布 R2／CDN）
> **上線日期**：未上線

## 一句話說明

Statistics「人口與教育」新增「戶籍人口」與「年齡結構」兩組，共 32 層（縣市＋鄉鎮 × 16 指標），107–114 年底＋115 年 8 月底共 9 期；村里 HOLD 不收。

## 圖層 / 群組

| 群組（Statistics 一列） | 成員 | 選單 |
|---|---|---|
| 戶籍人口數／戶數／戶量／人口密度 | 縣市、鄉鎮 各 1 | 地理層級＋資料期別 |
| 年齡組人口數、年齡組人口占比 | 0-14／15-64／65+ × 縣市、鄉鎮 | 指標／地理層級＋資料期別 |
| 老化指數與扶養比 | 老化指數、扶養比、扶幼比、扶老比 × 縣市、鄉鎮 | 同上 |
| 性比例、年齡中位數 | 縣市、鄉鎮 | 地理層級＋資料期別 |

- 群組內切換保留同一期別（county↔township 以 period 比對）。
- 期別只有一列「資料期別」（每期恰一組 `{roc_year, month}`，不拆成年／月串連）；時點期別顯示「YYYY-MM-DD（時點）」。

## 視覺

- 色階唯一入口 `src/data/statisticsVisuals.ts`：新增 `population` 主題 ColorBrewer **RdPu**（淺粉→深紫，sequential），key 前綴 `statsDemographics` 優先判定，避免未來「出生」等標籤落入出生登記（公用事業）分支。不用紅綠暗示好壞；性比例也維持 sequential。
- 門檻用 recipe `legend.breaks`（`fixed_breaks`），不重算 quantile；recipe 自帶的藍色 colors 不使用。
- icon：人數 Users、戶 HousePlus、密度 UsersRound、年齡組 PersonStanding、老化／扶養 Hourglass、性比例 Scale、中位數 CalendarClock。

## 來源與口徑

- 來源卡：「內政部戶政司 RIS（授權條款待確認）」，不寫 OGDL。
- 年齡中位數：本專案依單一年齡內插自算，非內政部公告。
- 人口密度面積：參考界線在 EPSG:3826 的平面面積，縣市合計比公告面積約 +1.8%。
- 缺值：鄉鎮 10712、10812 高雄三民區、鳳山區 missing → 斜線，不補 0；PARTIAL（366/368）保留於圖例與 popup。

## 關鍵檔案

- Recipes：`src/data/demographicsStatisticsRecipes.{json,catalog.json,ts}`（builder：`scripts/statistics/build_demographics_statistics_recipes.py`）
- Loader：`src/data/regionalStatisticsLoader.ts`（DEV preview route `/__demographics-statistics-cdn`）
- 群組：`demographicsStatisticsRecipes.ts` `GROUP_SPECS` → `medicalStatisticsGroups.ts`
- Catalog：`src/components/sidebar/layerCatalog.ts`；Legend：`StatisticsDetails.tsx` `StatisticsLegend`

## 本地預覽

```sh
# analytics：合併 fragments（不改原包）並起唯讀 server
python3 pipelines/shared/regional_statistics/assemble_demographics_preview.py household-registration-population population-age-structure
cd output/demographics-statistics-preview/cdn/v1 && python3 -m http.server 3763 --bind 127.0.0.1
# pulse worktree
VITE_DEMOGRAPHICS_STATISTICS_PREVIEW=true DEMOGRAPHICS_STATISTICS_PREVIEW_PORT=3763 npm run dev -- --host 127.0.0.1 --port <free port>
```

只有 DEV＋flag＋已登錄 key＋dataset 相符才走 preview；不改全域 `VITE_STATISTICS_CDN_BASE`。

資料契約見 [handoff.md](./handoff.md)；後續見 [backlog.md](./backlog.md)。
