# 金融服務據點與可及性 Finance Access（G10）

> **Slug**：`finance-access-layers`
> **狀態**：dev（等 PR review）
> **Owner**：migu
> **相關 PR**：（開 PR 後補）
> **上游**：taipei-gis-analytics `pipelines/socioeconomic/finance_access/`、`docs/handoff/finance-access-statistics-recipes.json`；上線紀錄 `.gis-agent-system/projects/2026-10-roadmap-batch2/w0/G10*.md`。全部來源為政府資料開放授權條款第 1 版。

## 一句話說明

Statistics「財稅與消費」加「金融服務可及性」小群組（11 層）；台灣分頁「基礎建設 › 金融據點」加 ATM 裝設點與金融機構總分支機構 2 個點層。

## 統計（11 層，5 dataset，144 selector；資料讀 R2 統計 CDN）

| 群組 | layer key | 層級／期別 | 圖例要點 |
|---|---|---|---|
| 金融卡 ATM 台數 | `statsAtmCount`／`statsAtmPer10k` | 縣市，2019-01～2026-09 月（每萬人只在有人口快照的 8 期） | 跨行**機台數**，不是裝設點數 |
| 金融服務欠缺鄉鎮（第一類） | `statsFinanceUnderserved`／`statsFinanceUnderservedInstitutions` | 鄉鎮，2026-06-30 | 判定依據：金管會金管銀合字第 11002745482 號令第一類；0＝不在名單，不代表服務充足 |
| 各縣市金融機構家數（央行） | `statsFinancialInstitutions` | 縣市，115/09/30，16 類 | 金門、連江來源合併為「金馬地區」，合併計算未拆分，兩縣標無資料 |
| 金融機構分支數 | `statsFinancialBranches`／`Per10k`（縣市）、`statsFinancialBranchesTown`／`Per10kTown`（鄉鎮） | 名冊 2026-10-24 | 只計銀行、信合社、農漁會信用部；郵局見郵局圖層 |
| ATM 裝設點數（鄉鎮） | `statsAtmSitesTown`／`statsAtmSitesPer10kTown` | 名冊 2026-10-24 | 裝設點數（同址多台算一點），不是機台數 |

## 點位（2 層，public/finance/，git 追蹤隨 dist 部署）

| layer key | 筆數 | 格式 | 樣式／篩選 | popup 重點 |
|---|---|---|---|---|
| `atmSitesFisc`「ATM 裝設點（財金公司名冊）」 | 27,390（22 筆無法定位不上圖） | PMTiles z5–12（逐 zoom 完整）；< z10 熱區 | 依機構類別 5 色多選；「只看輪椅可用」「只看視障語音服務」兩個開關 | 一點一裝設地點（可能多台）；輪椅、語音、國際卡；不對外開放（865）注意列；座標來源與**定位精度一定顯示**，Google 約略位置（222）加警示；名冊快照日 |
| `financialBranchesFisc`「金融機構總分支機構」 | 4,988（1 筆無法定位） | GeoJSON | 依機構類別 10 色多選 | 同上的定位說明；名冊只含 2 個郵局儲匯單位，各地郵局見「郵局」圖層 |

- 圖層名刻意不叫「全國 ATM」：名冊是財金公司裝設點，圖例寫明「裝設點數，不是機台數；財金公司 115 年 9 月跨行 ATM 共 33,712 台」。
- 成品不含個資欄（builder `no_pii` 斷言）；旗標缺值保持 null，不當成「否」。

## 重產

```bash
python3 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --root <analytics checkout> --family financeAccess
npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
python3 scripts/preprocess/build-atlas-public.py --src <analytics>/data/processed --only atmSitesFisc financialBranchesFisc
```

名冊上游標每日更新；重跑 analytics pipeline 後再跑上面最後一行。
