# 街頭藝人登記人數統計 Registered Street Performers（G23 補做）

> **Slug**：`street-performers-statistics`
> **狀態**：dev（等 PR review）
> **Owner**：migu
> **相關 PR**：#690（三群合一 PR；merge hash 待 merge 後補）
> **上游**：taipei-gis-analytics `pipelines/culture/culture_coin_venues_moc/07_export_statistics.py`、`docs/handoff/culture-coin-street-performers-recipes.json`；上線紀錄 `.gis-agent-system/projects/2026-10-roadmap-batch2/w0/G23-street-performers.md`；來源文化部文化幣可用藝文消費點（data.gov.tw 177601，2026-10-24 下載，政府資料開放授權條款第 1 版）

## 一句話說明

Statistics 新主題「文化與藝文 Culture & Arts」（大分類「人口與社會」，排在體育運動之後）→ 群組「街頭藝人」→ 一列「街頭藝人登記人數」，可切鄉鎮市區／縣市。單期（下載日 2026-10-24）。

| layer key | dataset | 層級 | 門檻 |
|---|---|---|---|
| `statsCultureStreetPerformersTown` | culture_coin_street_performers_township | 鄉鎮 368 | 1／3／6／15 人（0 人自成最淺一級；243 區為 0） |
| `statsCultureStreetPerformersCounty` | culture_coin_street_performers_county | 縣市 22 | 1／10／30／60 人（連江、金門 0） |

## 口徑（圖例逐行寫出）

- 名冊登記人數，依**登記或聯絡地址**所在行政區計，不是表演地點；不含姓名（Roadmap 第二批決定 #1：不做點位）。
- 0＝名冊在該區無登記（名冊是全國完整名單，不是無資料）。
- 臺中市西區 100 人多為登記於草悟道（地址只定位到地名）。
- 自願登記，臺中市偏多（223／549）可能是制度差異。
- 550 筆中 1 筆縣市欄與地址衝突，未計入任何區（合計 549）。
- 與點位層的互相指引：本層圖例指向「文化 → 藝文消費 → 文化幣藝文消費點」；文化幣圖層說明（ATLAS_NOTES 與英日文）補一句「登記人數見統計分頁文化與藝文」。統計層會被 `withoutStatisticsLayers` 從台灣分頁移除，無法實體放在文化幣旁邊。

## 重產

```bash
python3 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --root <analytics checkout> --family culture
npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
```

資料讀 R2 統計 CDN（release 已於 2026-10-24 增量發布），前端只帶 recipes。
