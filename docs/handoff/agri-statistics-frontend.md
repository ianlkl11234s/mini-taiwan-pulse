# 農林漁牧 Statistics 前端接線交付

本交付範圍是本地 frontend wiring package。Production migration/import、Pulse UI 實接、匿名正式環境readback、browser與部署尚未執行；不能因本地測試成功視為已上線。

## 最終本地驗收結果

| source family | 目標 | 可接線 | blocked與下一步 |
|---|---:|---:|---|
| 178038 國土利用 | 15 | 15 | 最新11501統計參考版、113–114年調查；368鄉鎮，使用1140318參考圖形，相容證明不作啟用門檻 |
| 7302 農情調查 | 4 | 4 | 2025年、664實際crop-season tuples；PARTIAL缺區明示 |
| 既有fishery SSOT | 4 | 3 | 放養量沒有年度且舊code mapping有疑點；取得G70調查期及官方code表再修既有pipeline |
| 115Q1 畜禽 | 2 | 2 | 24畜種，因已有115Q2標STALE；保留suppressed/not_reported |
| 40268/40270 林產值 | 2 | 0 | 完整URL官方回[]；確認現行有效resource或取得官方歷史CSV，再驗rows/年度/unit/coverage |
| **合計** | **27** | **24** | **3 blocked：放養量、兩項林產值；本輪不再追查** |

另外兩個既有layer只有cross-topic index entry，不計新layers或重複observations。

本地驗證：49 parser/bundle tests通過；可啟用50 immutable bundles、1,001,230 observations，2,748完整selector tuples，HTTP逐一核對catalog/releases/values/health/coverage。15國土利用layers已納入可選API，source統計參考版與display geometry版本分開記錄。每可接線layer的真實case見acceptance receipt；養殖面積与本期畜禽未找到真0，標NOT_PRESENT_IN_SOURCE，不假造零案例。

Catalog audit：本次5 datasets **0 ERROR**，所有manifest列檔存在且hash吻合；全域既有兩fatal是GEBCO manifest額外欄位、MLIT passenger routes manifest不存在，沒有代修或掩蓋。範圍證據`output/agri-statistics/catalog-audit-scope.json`；完整global結果`catalog-audit-final.json`。

## 唯一入口與檔案

- `docs/handoff/agri-statistics-recipes.json`：27目標recipes、五source families，以及兩個既有layer的cross-topic引用。`enabled=false`只列阻塞項，不建立toggle或空release。
- `docs/handoff/agri-statistics-selector.ts`：可直接引用的exact whitelist selector。每個選項含真正存在的release、period、dimensions與bundle_path。
- `output/agri-statistics/frontend-acceptance.json`：每層exact selector、真實非零/零/missing/suppressed案例與HTTP回讀證據。來源未出現的狀態明記NOT_PRESENT_IN_SOURCE，沒有製造測試案例冒充真實數據。
- `docs/handoff/agri-statistics-boundaries.json`：四個可用reference版本對應的確切geometry/code/name欄位與hash；11501是來源統計參考版，非圖形版本別名。
- `output/agri-statistics/boundary-acceptance.json`：縣市22／鄉鎮368 identity唯一、geometry有效；不把11501未證轉為已證。
- `output/agri-statistics/delivery-files.json`：交付全部來源、bundles、selectors、docs與receipt的SHA-256清單；`frontend-wiring-package.tar.gz`可攜封裝。

## 接入既有 Pulse 的位置

沿用交通production的 `src/data/regionalStatisticsRecipes.ts`、`src/data/statisticsLayerRegistry.ts`、Statistics UI catalog、LayerVisibility/manifest，以及既有統計loader。讀JSON中的label/group/subgroup及related_layer_keys，不需重新分類。

1. 只把`enabled=true`鍵加入統計choropleth registry與UI catalog，保留single/overlap既有行为。
2. 將recipe.dataset_id/indicator_id/level交給catalog/releases API；正式環境只取已publish版本，再與本交付白名單交集。
3. UI篩選用`release_options`中的完整tuple。`filters.options`是顯示候選，**不可將不同dimension各自選項做笛卡兒積**；每次選擇必須對到一個完整tuple，無匹配就顯示無該組資料。
4. 把選中tuple傳給`resolveAgriRelease`，取得releaseId/dimensions後呼叫values。這沿用交通的selector contract；同一release有多作物/畜種時，UI必須先選tuple，再resolve，不能只憑release_id決定。
5. unit/format/legend/boundary_version直接從recipe使用。固定breaks跨交付期別共用；不可每期重新分位後把色差說成量值成長。單產不可相加，作物面積是複種計次，不能等同不重疊土地。
6. 點擊區域顯示period、source、raw hash、method、reference boundary語意、coverage與health。缺值灰色，suppressed用圖例與紋理區分，真0用數值色階。

## 缺值與狀態

共用bundle維持existing status contract：observed/missing/suppressed/not_applicable。畜禽原始`-`在bundle是missing/null，但sidecar的source_status為not_reported、source_token為`-`；原始`*`仍為suppressed/null。本地preview values會把source_status/source_token附在每列；正式匯入時需同步保存及透過既有source/provenance傳出這份semantics，不可丟棄後只顯示一般missing。

`STALE`與`PARTIAL`是不同軸：前者為時效，後者為覆蓋。不能因本輪取得成功就把歷史快照設CURRENT；不能把suppressed或not_reported當0。畜種大類與子類可能重疊，僅切換，不把牛/乳牛/肉牛或雞/肉雞/蛋雞相加。官方縣市總計保留於raw/gate報告，不由可見鄉鎮回推。

## 既有鍵相容

`statsRiceHarvest`仍維持`rice_harvested_area_township/rice_harvested_area_hectare`與全年兩期複種計次語意，只增加農業統計索引入口。新作物收穫面積是crop×season，不能直接alias。未來只有全年稻作同口徑逐值對帳通過後才可加alias；保留舊saved-state key至少一版，退場僅移除UI重複入口並保留redirect。

`statsPigWaterCounty`只增加畜牧／用水與循環入口，沿用`livestock_pig_water_county/pig_water_thousand_m3`、dimensions animal_kind=pig。不複製observations或releases。

一般GIS農業12、畜牧10、養殖7、林業16維持獨立；related keys只提供捷徑。三個deprecated林業衍生分析沒有納入。

## 本地執行

在本交付worktree根，使用原analytics venv（或安裝相同依賴的本地venv）：

```bash
./venv/bin/python3 pipelines/shared/regional_statistics/assemble_agri_frontend.py
./venv/bin/python3 pipelines/shared/regional_statistics/verify_frontend_package.py
./venv/bin/python3 pipelines/shared/regional_statistics/frontend_preview.py --port 3743
```

Preview僅bind 127.0.0.1，URL `http://127.0.0.1:3743/`。API為 `/statistics/catalog`、`releases`、`values`、`sources`、`health`、`coverage`。除catalog外指定layer_key；values/sources/health/coverage再指定release_id與完整dimensions JSON。未知selector回400、blocked項回BLOCKED而非空成功，沒有寫入路由。

這是與golden path同樣dataset/indicator/release/value語意的本地驗收adapter；正式Pulse使用既有public RPC，不應把這個開發server部署到production。

## 尚未授權的 production 步驟

在platform review既有import_bundle/register_geometry與缺值semantics承載；只新增本交付白名單release，hash不符拒绝覆盖。確認boundary identity及geometry註冊、發布後匿名catalog/releases/values/sources/health readback，再接Pulse UI、桌面/手機browser與實際部署版本驗收。此輪未commit、push、merge、部署或套用遠端migration。

## 每source family的精確入口

| family | raw receipt | normalized／gate與manifest目錄 |
|---|---|---|
|178038|`data/raw/agriculture/land_use_township_statistics/178038-receipt.json`|`data/processed/agriculture/land_use_township_statistics/`|
|7302|`data/raw/agriculture/crop_township_statistics/7302-receipt.json`；本輪安全重抓全hash一致證據`verification-refetch/7302-receipt.json`|`data/processed/agriculture/crop_township_statistics/`|
|fishery|`data/raw/agriculture/fishery_stats/statistics-reuse-receipt.json`|`data/processed/agriculture/fishery_stats/`|
|livestock|`data/raw/agriculture/livestock_township_statistics/115Q1-county-township-livestock-receipt.json`|`data/processed/agriculture/livestock_township_statistics/`|
|forest value|`data/raw/forestry/forest_product_value_statistics/receipt.json`|`data/processed/forestry/forest_product_value_statistics/hold-gate.json`|

所有路徑相對本交付worktree `/private/tmp/agri-statistics-wiring-20260908`。大資料與部分JSON未納Git，不可只複製git diff交給前端；使用封裝及hash清單，或完整保留此worktree。


### 2026-09-08 使用者更新：115參考版國土利用接線

15國土利用層採最新已取得178038（11501統計參考、113–114調查），368鄉鎮全數對帳。使用者明確取消版本相容證明門檻；實際display仍標TOWN_MOI_1140318，不借名115圖形，不重分配面積。總計24 enabled／3 HOLD。放養量重抓官方79列仍無期別且來源碼表未確認，與舊快照hash相同，保留HOLD；兩林產值依使用者決定不再追查。精確證據：`output/agri-statistics/stocking-recheck.json`與frontend handoff。

放養量官方重查receipt：`data/raw/agriculture/fishery_stats/stocking-recheck/receipt.json`；79列無期別，不能借用面積資料年度，09020不能沿用舊連江映射。
