# Atlas 統計批次 Atlas Statistics

> **Slug**：`atlas-statistics`（analytics worktree `atlas-batch-20261012`）
> **狀態**：dev（PR 到 develop，未發布 master）
> **上線日期**：未發布
> **相關 PR**：見 changelog.md

## 一句話說明

把 atlas 批次 22 個縣市／鄉鎮統計 dataset（66 個指標、2,278 個 exact selector，R2 manifest `5070788a…` 已上線）接上 Statistics：疾病與健康、財稅與消費、原民與農村、體育、災害風險、海洋六個家族。

## 放在哪裡

| 家族 | 資料檔 | Statistics 分頁 | Layers 目錄 |
|---|---|---|---|
| 疾病與健康（19） | `healthStatisticsRecipes.*` | 併入「醫療與長照」：傳染病、癌症、癌症篩檢、出生健康、疫苗、醫療利用 | 疾病與健康統計 |
| 財稅與消費（22） | `fiscalStatisticsRecipes.*` | 新主題「財稅與消費」（經濟與住宅） | 財稅與消費統計 |
| 原民與農村（3） | `indigenousRuralStatisticsRecipes.*` | 「人口與教育／原住民保留地」、「農林漁牧／農村再生」 | 原民與農村統計 |
| 體育（4） | `sportsStatisticsRecipes.*` | 新主題「體育運動」（人口與社會） | 體育統計 |
| 災害風險（8） | `hazardStatisticsRecipes.*` | 新主題「災害風險」（土地與環境）：土石流警戒、社會脆弱度 | 災害風險統計 |
| 海洋（10） | `marineStatisticsRecipes.*` | 新主題「海洋」（土地與環境）：海洋動物擱淺、海洋廢棄物 | 海洋統計 |

## 圖層（66）

標「新命名」的 20 個 key 交付時沒有 layer_key，依既有 `stats<Family><Indicator>` 風格命名。門檻為預設維度組合的固定門檻。

| 家族 | layer key | 指標 | 分頁／群組 | 維度 | 門檻 |
|---|---|---|---|---|---|
| 疾病與健康 | `statsHealthTbNewCases` | 結核病新案發生數 | 醫療與長照／傳染病 | — | 100, 200, 400, 600, 1000 |
| 疾病與健康 | `statsHealthTbNewCasesPer100kHrp` | 結核病新案每十萬人口（戶籍年底人口衍生） | 醫療與長照／傳染病 | — | 15, 20, 25, 30, 40 |
| 疾病與健康 | `statsHealthTbNewCasesTownship` | 結核病新案發生數 | 醫療與長照／傳染病 | — | 5, 10, 20, 40 |
| 疾病與健康 | `statsHealthTbIncidencePer100kTownship` | 結核病新案發生率 | 醫療與長照／傳染病 | — | 10, 20, 30, 50, 80 |
| 疾病與健康 | `statsHealthTbDeaths` | 結核病死亡數 | 醫療與長照／傳染病 | — | 10, 30, 60, 100 |
| 疾病與健康 | `statsHealthTbDeathRate` | 結核病死亡率 | 醫療與長照／傳染病 | — | 1, 2, 3, 5 |
| 疾病與健康 | `statsHealthCancerNewCases` | 癌症新發生數（全癌症） | 醫療與長照／癌症 | — | 1000, 3000, 8000, 15000 |
| 疾病與健康 | `statsHealthCancerIncidenceAsr` | 癌症年齡標準化發生率（WHO 2000） | 醫療與長照／癌症 | 性別（預設 全部）、癌別（預設 全癌症） | 250, 300, 350, 400 |
| 疾病與健康 | `statsHealthCancerIncidenceCrude` | 癌症粗發生率 | 醫療與長照／癌症 | 性別（預設 全部）、癌別（預設 全癌症） | 400, 500, 600, 700 |
| 疾病與健康 | `statsHealthBreastScreening2yr` | 乳癌篩檢率（45–69 歲婦女兩年內） | 醫療與長照／癌症篩檢 | — | 30, 35, 40, 45, 50 |
| 疾病與健康 | `statsHealthCervicalScreening3yr`（新命名） | 子宮頸癌篩檢率（30–69 歲婦女三年內） | 醫療與長照／癌症篩檢 | — | 30, 35, 40, 45, 50 |
| 疾病與健康 | `statsHealthColorectalScreening2yr`（新命名） | 大腸癌篩檢率（50–74 歲兩年內） | 醫療與長照／癌症篩檢 | — | 30, 35, 40, 45, 50 |
| 疾病與健康 | `statsHealthLiveBirthsMotherResidence` | 活產新生兒數（出生通報，產婦現住地） | 醫療與長照／出生健康 | — | 1000, 5000, 10000, 20000 |
| 疾病與健康 | `statsHealthLowBirthWeightRate` | 活產新生兒低出生體重率 | 醫療與長照／出生健康 | 性別（預設 全部） | 10, 10.5, 11, 11.5, 12 |
| 疾病與健康 | `statsHealthBirthSexRatio` | 活產新生兒出生性別比 | 醫療與長照／出生健康 | — | 104, 106, 108, 110 |
| 疾病與健康 | `statsHealthImmunizationCompletion` | 常規疫苗接種完成率 | 醫療與長照／疫苗 | 疫苗劑次（預設 麻疹腮腺炎德國麻疹混合疫苗第一劑） | 97, 98, 98.5, 99 |
| 疾病與健康 | `statsHealthOutpatientVisitRate` | 健保平均門診就診率 | 醫療與長照／醫療利用 | — | 95000, 95500, 96000, 96500 |
| 疾病與健康 | `statsHealthMentalOutpatientPer1000` | 每千人口精神疾病門診件數 | 醫療與長照／醫療利用 | 疾病別（預設 精神、行為和神經發展疾患） | 600, 650, 700, 750 |
| 疾病與健康 | `statsHealthHospitalAlos` | 醫院平均住院日數 | 醫療與長照／醫療利用 | 病床別（預設 醫院一般病床合計） | 6, 7, 8, 9, 10 |
| 財稅與消費 | `statsFiscalLocalRevenue` | 縣市政府歲入 | 財稅與消費／地方財政 | — | 25000, 50000, 100000, 150000 |
| 財稅與消費 | `statsFiscalLocalExpenditure` | 縣市政府歲出 | 財稅與消費／地方財政 | — | 25000, 50000, 100000, 150000 |
| 財稅與消費 | `statsIncomeTaxUnits` | 綜所稅納稅單位 | 財稅與消費／所得 | — | 50000, 100000, 300000, 700000 |
| 財稅與消費 | `statsIncomeTaxTotal` | 綜合所得總額 | 財稅與消費／所得 | — | 100000000, 200000000, 500000000, 800000000 |
| 財稅與消費 | `statsIncomeTaxMean` | 每納稅單位所得平均數 | 財稅與消費／所得 | — | 900, 1000, 1100, 1300 |
| 財稅與消費 | `statsIncomeTaxMedian` | 每納稅單位所得中位數 | 財稅與消費／所得 | — | 680, 720, 780, 850 |
| 財稅與消費 | `statsIncomeTaxQ1` | 每納稅單位所得第一分位數 | 財稅與消費／所得 | — | 410, 430, 460, 500 |
| 財稅與消費 | `statsIncomeTaxQ3` | 每納稅單位所得第三分位數 | 財稅與消費／所得 | — | 1150, 1250, 1350, 1600 |
| 財稅與消費 | `statsVatDeclarers` | 營業稅申報家數 | 財稅與消費／營業與消費 | — | 10000, 20000, 50000, 120000 |
| 財稅與消費 | `statsVatSales` | 營業稅申報銷售額 | 財稅與消費／營業與消費 | — | 200000000000, 500000000000, 1500000000000, 5000000000000 |
| 財稅與消費 | `statsVatTaxPayable` | 營業稅本年應實繳稅額 | 財稅與消費／營業與消費 | — | 2000000000, 5000000000, 15000000000, 50000000000 |
| 財稅與消費 | `statsCreditCardResidentAmount` | 居民信用卡消費金額 | 財稅與消費／營業與消費 | — | 30000000000, 60000000000, 150000000000, 400000000000 |
| 財稅與消費 | `statsCreditCardCrossCountyAmount` | 居民跨縣市信用卡消費金額 | 財稅與消費／營業與消費 | — | 20000000000, 50000000000, 100000000000, 300000000000 |
| 財稅與消費 | `statsCreditCardCrossCountyShare` | 居民跨縣市消費占比 | 財稅與消費／營業與消費 | — | 75, 80, 85, 90 |
| 財稅與消費 | `statsCreditCardCards` | 居民持卡數（12 月） | 財稅與消費／營業與消費 | — | 250000, 500000, 1000000, 3000000 |
| 財稅與消費 | `statsCreditCardLocationAmount` | 縣市信用卡消費金額（消費地） | 財稅與消費／營業與消費 | — | 10000000000, 20000000000, 50000000000, 150000000000 |
| 財稅與消費 | `statsEinvoiceAvgTicket` | 電子發票平均客單價 | 財稅與消費／營業與消費 | 行業（預設 便利商店） | 125, 135, 145, 155 |
| 財稅與消費 | `statsCensusPersonsEngaged` | 工商普查年底從業員工人數 | 財稅與消費／普查 | — | 60000, 120000, 300000, 1000000 |
| 財稅與消費 | `statsCensusEmployeePayroll` | 工商普查僱用員工全年薪資 | 財稅與消費／普查 | — | 30000000, 60000000, 150000000, 500000000 |
| 財稅與消費 | `statsCensusEstablishments` | 工商普查場所單位數 | 財稅與消費／普查 | — | 15000, 30000, 60000, 150000 |
| 財稅與消費 | `statsBankDeposits` | 金融機構存款餘額 | 財稅與消費／金融 | — | 300000, 600000, 1500000, 5000000 |
| 財稅與消費 | `statsBankLoans` | 金融機構放款餘額 | 財稅與消費／金融 | — | 100000, 300000, 600000, 3000000 |
| 原民與農村 | `statsIndigenousReservedLandParcels` | 原住民保留地筆數 | 人口與教育／原住民保留地 | — | 5000, 20000, 40000, 70000 |
| 原民與農村 | `statsIndigenousReservedLandArea` | 原住民保留地面積 | 人口與教育／原住民保留地 | — | 5000, 15000, 30000, 50000 |
| 原民與農村 | `statsRuralRegenTraining` | 農村再生培根累計執行社區數 | 農林漁牧／農村再生 | — | 25, 75, 150, 250 |
| 體育 | `statsSportsBudgetTotal` | 體育運動經費總額 | 體育運動／體育經費 | — | 100000000, 300000000, 600000000, 1500000000 |
| 體育 | `statsSportsBudgetPerCapita` | 每人平均享有體育運動經費 | 體育運動／體育經費 | — | 400, 600, 900, 1500 |
| 體育 | `statsExerciseParticipationRate` | 有運動比例 | 體育運動／運動參與 | — | 78, 80, 82, 85 |
| 體育 | `statsRegularExerciseRate` | 規律運動比例 | 體育運動／運動參與 | — | 33, 35, 37, 39 |
| 災害風險 | `statsDebrisFlowAlertStreamsCounty`（新命名） | 土石流警戒發布溪流次數（黃＋紅） | 災害風險／土石流警戒 | — | 1, 25, 100, 200, 300 |
| 災害風險 | `statsDebrisFlowRedAlertStreamsCounty`（新命名） | 土石流紅色警戒發布溪流次數 | 災害風險／土石流警戒 | — | 1, 25, 50, 100, 150 |
| 災害風險 | `statsSocialVulnerabilityCompositeCounty`（新命名） | 社會脆弱度綜合指標 | 災害風險／社會脆弱度 | — | -0.4, -0.2, 0, 0.2, 0.4 |
| 災害風險 | `statsSocialVulnerabilityExposureCounty`（新命名） | 社會脆弱度－暴露量構面 | 災害風險／社會脆弱度 | — | -0.4, -0.2, 0, 0.2, 0.4 |
| 災害風險 | `statsSocialVulnerabilityMitigationCounty`（新命名） | 社會脆弱度－減災整備構面 | 災害風險／社會脆弱度 | — | -0.4, -0.2, 0, 0.2, 0.4 |
| 災害風險 | `statsSocialVulnerabilityResponseCounty`（新命名） | 社會脆弱度－應變能力構面 | 災害風險／社會脆弱度 | — | -0.4, -0.2, 0, 0.2, 0.4 |
| 災害風險 | `statsSocialVulnerabilityRecoveryCounty`（新命名） | 社會脆弱度－復原能力構面 | 災害風險／社會脆弱度 | — | -0.4, -0.2, 0, 0.2, 0.4 |
| 災害風險 | `statsSocialVulnerabilitySubindicatorCounty`（新命名） | 社會脆弱度子指標 | 災害風險／社會脆弱度 | 子指標（預設 農林漁牧業產值） | -1, -0.5, 0, 0.5, 1 |
| 海洋 | `statsCetaceanStrandedCounty`（新命名） | 鯨豚擱淺隻數 | 海洋／海洋動物擱淺 | — | 1, 5, 10, 20 |
| 海洋 | `statsCetaceanStrandedAliveCounty`（新命名） | 鯨豚活體擱淺隻數 | 海洋／海洋動物擱淺 | — | 1, 2, 4 |
| 海洋 | `statsCetaceanStrandedDeadCounty`（新命名） | 鯨豚死亡擱淺隻數 | 海洋／海洋動物擱淺 | — | 1, 5, 10, 20 |
| 海洋 | `statsSeaTurtleStrandedCounty`（新命名） | 海龜擱淺隻數 | 海洋／海洋動物擱淺 | — | 1, 10, 30, 60 |
| 海洋 | `statsSeaTurtleStrandedAliveCounty`（新命名） | 海龜活體擱淺隻數 | 海洋／海洋動物擱淺 | — | 1, 10, 30, 60 |
| 海洋 | `statsSeaTurtleStrandedDeadCounty`（新命名） | 海龜死亡擱淺隻數 | 海洋／海洋動物擱淺 | — | 1, 10, 30, 60 |
| 海洋 | `statsMarineDebrisCleanedTonnesCounty`（新命名） | 海洋廢棄物清理量 | 海洋／海洋廢棄物 | — | 100, 300, 1000, 2000 |
| 海洋 | `statsMarineDebrisFishingGearTonnesCounty`（新命名） | 廢漁具漁網清理量 | 海洋／海洋廢棄物 | — | 1, 5, 20, 100 |
| 海洋 | `statsMarineDebrisCleanupOperationsCounty`（新命名） | 海洋廢棄物清理次數 | 海洋／海洋廢棄物 | — | 500, 1500, 3000, 6000 |
| 海洋 | `statsMarineDebrisCleanupParticipantsCounty`（新命名） | 海洋廢棄物清理參與人次 | 海洋／海洋廢棄物 | — | 3000, 8000, 15000, 25000 |

## 設計決定

- **六個家族、一個接點**：資料照主題拆六個 `*StatisticsRecipes.{json,catalog.json,ts}`；查詢、期別白名單、維度、圖例與目錄分組集中在 `atlasStatisticsRecipes.ts`，共用檔（loader、selection、linkedSelect、manifest、圖例、Details、資料來源總覽）只接這一個入口。
- **多維度**：癌症（性別×癌別）、疫苗劑次、精神疾病別、病床別、行業、社會脆弱度子指標都做成連動選單（期別 → 各維度）。預設照 layer-plan：癌症 全部／全癌症、疫苗 MMR 第一劑、精神門診 全部精神疾患、病床 一般病床合計、低出生體重 全部；layer-plan 沒寫的自訂：電子發票行業＝便利商店（22 縣市都有值、沒有遮蔽）、子指標＝si01。
- **各維度組合各有固定門檻**：癌別、疾病別、病床別、行業、疫苗劑次量級差很大，單一門檻會讓甲狀腺癌等組合全落在最淺一格。build 時依各組合最新一年分布算一次（四分位附近取整），之後不隨期別重算；map 與圖例都經 `statisticsRenderRecipe(key, indicator, dimensions)` 取同一組。
- **社會脆弱度方向**：Z 分數不走 PuOr 雙向色，改用環境序列色並宣告方向。綜合指標、暴露量越高越深；減災整備、應變能力、復原能力反轉（值越低越深），圖例寫「能力較弱 ← → 能力較強」。子指標依 NCDR `vulnerability_sign` 逐項決定方向，說明欄標出所屬構面與「方向為推論」。
- **原始數與比例同一列**：結核病（縣市新案數／每十萬人衍生／鄉鎮新案數／鄉鎮發生率）、結核病死亡、癌症發生、癌症篩檢、歲入歲出、所得分位、營業稅、居民信用卡、工商普查、存放款、保留地、體育經費、運動調查、土石流、社會脆弱度構面、鯨豚／海龜擱淺、海洋廢棄物。群組第一個成員是原始數。
- **非數值狀態**：不適用（無潛勢溪流、非臨海縣市、無保留地、無此類病床）、無資料、來源刪除（電子發票營業人少於 5 家）都畫斜線，圖例分列文字，不畫成 0。
- **二元指標**：本批沒有二元指標；計數層含 0 時門檻從 1 起（例如土石流、擱淺），最淺色含 0 並在圖例註明。

## 關鍵檔案

- 交付轉換：`scripts/statistics/build_atlas_statistics_recipes.py`（逐 option 對 bundle 核對 dataset／indicator／unit／期別／邊界／層級／維度；沒有圖例文字的狀態會中止）
- 接點：`src/data/atlasStatisticsRecipes.ts`、`src/data/atlasStatisticsTypes.ts`
- 契約測試：`src/data/__tests__/atlasStatisticsContract.test.ts`
- 色階：`src/data/statisticsVisuals.ts`（`ATLAS_KEY_ICONS`、`statisticsVisualColors` 的 `direction`）

## 重跑

```bash
python3 scripts/statistics/build_atlas_statistics_recipes.py \
  --recipes <analytics atlas WT>/docs/handoff/atlas-statistics-recipes.json --root <analytics atlas WT>
npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
```
