# 國營事業與國有資產 State Assets（G16）

> **Slug**：`state-assets-layers`
> **狀態**：dev（等 PR review）
> **Owner**：migu
> **相關 PR**：#690（三群合一 PR；merge hash 待 merge 後補）
> **上游**：taipei-gis-analytics `pipelines/socioeconomic/state_assets/`、`docs/handoff/state-assets-statistics-recipes.json`、`docs/topic-research/state_assets/layer-plan.md`；上線紀錄 `.gis-agent-system/projects/2026-10-roadmap-batch2/w0/G16.md`、`G16-release.md`。全部來源為政府資料開放授權條款第 1 版。

## 一句話說明

Statistics「住宅與不動產」加三個小群組（國有資產／國營事業資產／行政執行拍賣，共 23 層）；台灣分頁加 4 個點層（台水廠所、台水淨水設施、台糖糖廠據點、國有財產待標售標的）。

## 統計（23 層，8 dataset，251 selector；資料讀 R2 統計 CDN）

| 群組 | layer key | 層級／期別 | 圖例要點 |
|---|---|---|---|
| 閒置國有地 | `statsStateLandIdleArea`／`IdleShare`／`IdleParcels` | 縣市，114 年底 | 占比分母＝未處理土地（13 管理區分） |
| 國有地管理區分占比 | `statsStateLandStatusShare` | 縣市，13 子項（預設「閒置」） | 同上 |
| 國有非公用土地 | `statsStateLandArea`／`Parcels`／`ValuePerSqm` | 縣市，20 類（預設「未處理土地」小計） | 兩個小計不可跨類加總；每 m² 價值只供比較，不可乘回面積或加總；面積 0 的類別價值＝不適用 |
| 國有非公用房地 | `statsStatePropertyArea`／`Parcels`／`ValuePerSqm` | 縣市，9 類（預設「土地」小計） | 同上 |
| 國有不動產出租 | `statsStateLandRentalArea`／`Parcels` | 縣市，91–114 年 | 91–99 年三都為改制前縣＋市合併值；連江 91–93 無資料（斜線） |
| 國有住宅用地 | `statsStateResidentialArea`／`Parcels` | 縣市，都市／非都市計畫區 | — |
| 台糖可供出租土地（公告） | `statsTaisugarRentableArea`／`Parcels` | 鄉鎮，2024-08-14 | 不是台糖持有總量；未列鄉鎮＝未涵蓋（斜線），不是 0 |
| 台糖歷年標租標的 | `statsTaisugarAnnouncedArea`／`Parcels`／`Listings` | 鄉鎮，2016 起累計 | 「歷年標租標的，非持有地」；面積、地號數依地號去重，公告列數未去重 |
| 行政執行署拍定不動產 | `statsMojAuctionItems`／`Lots`／`ItemsByCategory`（縣市）、`ItemsTown`（鄉鎮） | 2020–2026 | 只有件數、無金額；不是國有財產、不含法院拍賣；預設最新全年 2025，2026 只到 9/30 標部分期別；鄉鎮層某縣市當年有標的未填鄉鎮→全縣鄉鎮無資料 |

disclosure（資料限制卡）沿用交付文字，builder 把內部欄名（dimensions.X、not_applicable、missing、dataset id）換成中文並以 regex 斷言不殘留。

## 點位（4 層，public/state_assets/，git 追蹤隨 dist 部署）

| layer key | 筆數 | 位置 | 樣式／篩選 | popup 重點 |
|---|---|---|---|---|
| `twcServiceOffices` | 137 | 水資源 › 自來水（台水） | 依單位類型 6 色、多選 | 區處、地址；同址單位數（16 個同址）；data.gov.tw 更新日 2024-11-22 |
| `twcWaterFacilities` | 486（1 筆缺座標不上圖） | 同上 | 依設施類型 5 色、多選 | 19 列連結台水「大型淨水場」17 座：顯示設計出水量並註明「同一座，不是另一座設施」；名稱編碼缺字、座標落鄉鎮界外加注意列 |
| `taisugarSugarMills` | 14 | 工商登記 › 國營事業 | 單色 | 看點、定位精度；南靖「來源座標與地址縣市不符，改用地址定位」 |
| `statePropertyTenderListings` | 947（8 筆無法定位不上圖） | 房地產 › 國有財產標售 | 土地／房地兩色、多選 | 標號、標售日、地號、面積、持分、使用分區、公告現值（註明非底價）、**定位精度一定顯示**、落點鄉鎮不一致注意列、資料下載日 2026-10-24（半動態快照） |

- 「水資源 › 點位 › 水利設施」是 OSM，可能畫到同一座淨水場；兩層來源不同，圖例說明有寫。
- 成品不含個資欄（builder `no_pii` 斷言）。

## 重產

```bash
python3 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --root <analytics checkout> --family stateAssets
npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
python3 scripts/preprocess/build-atlas-public.py --src <analytics>/data/processed \
  --only twcServiceOffices twcWaterFacilities taisugarSugarMills statePropertyTenderListings
```

待標售是半動態（上游每週～雙週），重跑 analytics pipeline 後再跑上面最後一行。
