# 金融服務據點與可及性 Finance Access（G10）

> **Slug**：`finance-access-layers`
> **狀態**：dev（等 PR review）
> **Owner**：migu
> **相關 PR**：#690（三群合一 PR，merge 444ab425）、#692（二元圖例）、G10 延伸 PR 見 changelog
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

## G10 延伸（2026-10-24）

上游：analytics `docs/handoff/finance-access-ext-statistics-recipes.json`（10 recipes）、`docs/topic-research/finance_access_ext/{layer-plan.md,merchants/,points/}`；上線紀錄 `w0/G10-ext-release.md`。統計另開 `financeAccessExt` 家族（financeAccessExtStatisticsRecipes.json／catalog／ts），subgroup 同「金融服務可及性」。

| 群組 | layer key（群內第一個為預設） | 層級／期別 | 圖例要點 |
|---|---|---|---|
| 金融及保險業場所單位（縣市） | `statsFinanceEstablishments`／`Per10k` | 縣市，2016、2021 年底（每萬人只有 2021）；行業別 35 值依來源階層排序，預設「總計」 | 場所單位不是公司數；105→110 年多項行業大幅變動、原因未查證，不建議比較變化 |
| 金融卡類交易縣市分佈 | `statsDebitCardTxnCount`／`statsDebitCardTxnShare` | 縣市，月 2012-01～2026-09；交易類型 3 值，預設「金融卡交易」 | 交易發生地，不是居民消費；跨行通匯臺北 5–6 成疑為入帳機構所在地；三種類型各自色階；「其他非實體通路」不屬任何縣市，比重由 builder 從 bundle 處理參數寫進圖例（115-09 占金融卡交易 59.37%） |
| 壽險業分支機構（縣市） | `statsLifeInsurerBranches`／`statsLifeInsurerAgencyOffices` | 縣市，2024、2025 年底 | 臺中市為來源兩列合計（UDI-0076）；handoff disclosure 仍寫「標 missing」已過期，builder 以 DISCLOSURE_REPLACEMENTS 改寫 |
| 金融卡特約商店（鄉鎮） | `statsDebitMerchantsPer10k`（預設）／`ExclBulk`／`statsDebitMerchants`／`statsDebitMerchantAddresses` | 鄉鎮，下載日 2026-10-24 | 排除全國同址 >200 家的 9 個地址；含集中登記版灌高總部所在區；新竹市約 8.3%、嘉義市約 11.5% 地址缺區無法歸屬 |

builder 新增的 spec 選項：`fractional`（萬筆等小數計數不走整數門檻）、`dim_order`（依 release 處理參數排序維度值）、`nonphysical`（非實體通路比重 note）。

| 點層 key | 筆數 | 樣式／篩選 | popup 重點 |
|---|---|---|---|
| `securitiesFuturesInstitutions`「證券期貨據點」 | 1,038（33 處名冊無營業地址不上圖） | 依據點類型 5 色多選；「隱藏證券自營部門」開關 | 類型、期貨商類別、自營部門、開業日、定位精度、名冊下載日與檔內資料日（依名冊不同：檔內資料日期／data.gov.tw 更新日／公會更新日） |
| `insuranceInstitutions`「保險公司與保險代理人」 | 655 | 依機構類型 5 色多選 | 類型、據點層級（總公司／分公司）、代理險種、定位精度、名冊資料日 |

兩層都是 GeoJSON（public/finance/，git 追蹤隨 dist 部署），資料與 gis-platform `reference.securities_futures_institutions`／`insurance_institutions`（mig 483）同一份 analytics 成品；同址兼營據點會重疊（未做 cluster）。

```bash
python3 scripts/statistics/build_roadmap_batch2_statistics_recipes.py --root <analytics checkout> --family financeAccessExt
npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
python3 scripts/preprocess/build-atlas-public.py --src <analytics>/data/processed --only securitiesFuturesInstitutions insuranceInstitutions
```
