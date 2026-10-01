# 環境統計 Statistics 前端接線

更新：2026-10-02。接入環境部／國土管理署 18 個縣市年度 dataset、37 個 layer key（1,018 個 exact release selector），沿用既有 `regionalStatisticsLoader`、store、Mapbox renderer、legend、popup 與 click registry。資料走 production R2（`https://data.itsmigu.com/statistics/v1/current.json`），**沒有 preview 路由**；R2 發布前畫面會顯示「統計尚無已公開且通過交付白名單的期別」。

## 範圍與契約

- recipe SSOT 副本：`src/data/environmentStatisticsRecipes.json`，由 `scripts/statistics/build_environment_statistics_recipes.py` 從 analytics `frontend_recipes.json` ＋ `data/processed/*/*/releases/*.json` 產生。白名單是各 release 實際出現的 `(release_id, dimensions)` tuple，不是 releases × dimension_options。
- 首屏目錄：`environmentStatisticsRecipes.catalog.json`（去掉 `delivery` 收據，保留 `release_options`），由 `build_statistics_recipe_catalogs.ts` 派生、`statisticsRecipeCatalog.test.ts` 保證一致。
- 預設：最新公開期別＋交付指定的預設細項（總計）。`STATISTICS_RECIPES` 不寫死 `releaseId`。
- 期別與細項分開選（原生 select）：期別＝release，細項＝dimension（陳情事由／陳情對象／稽查類別／場址類型／回收物種類／污水來源），只列該期別已公開的 tuple。
- 原始數／比例同一個 toggle（8 組）：公害陳情、燃燒陳情（每萬人）、環保稽查（每列管設施）、罰鍰次數（裁處率）、一般廢棄物產生量、一般垃圾量、資源回收量（每萬人）、BOD 排放量（每平方公里）。切換時保留同期別與同細項；無對應期別／細項（例如每列管設施只有 2025、5 類）就拒絕切換並提示。
- 公害陳情頻率原表三指標（件數／人口數／每萬人）合為一個「指標」toggle，避免與 89048 件數重複上架；件數優先用「公害陳情案件數」。
- 配色：環境 BuPu；自來水水質、污水下水道為公用事業 GnBu（`statisticsVisuals.ts` 以 key 明確指定，不再落入「機車」→交通、「水」→供水）。自來水不合格件數／率為二元（0＝無不合格／大於 0＝有不合格）；observed 0 是真零、缺值斜線。
- popup／details 揭露：來源機關、期別、單位、位置口徑（車籍縣市、陳情受理縣市…）、資料限制（分母快照非同年、裁處率可 >100%、燃燒陳情含燒香紙錢、責任業者期別為擷取日…）、coverage 與參考邊界。

## 分組

| Layers 中分類 | 小分組 | Statistics 分頁群組 |
|---|---|---|
| 污染與公害統計 | 公害陳情／燃燒陳情／土壤地下水 | 污染與公害 |
| 環境治理統計 | 稽查與罰鍰 | 環境治理 |
| 空氣品質統計 | 空品概況／機車定檢 | 空氣品質 |
| 水質與污水統計 | 污水下水道／自來水水質／廢污水排放 | 水質與污水 |
| 廢棄物統計（既有） | ＋產生與清理 | 廢棄物與回收 |
| 資源回收統計（既有） | ＋回收量／責任業者 | 廢棄物與回收 |

全部掛 `environment` 巨分類。既有「水資源統計」沒有新增層。

## 重產

```sh
A=/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/.worktrees/env-stats-20261002
python3 scripts/statistics/build_environment_statistics_recipes.py \
  --recipes $A/data/intermediate/regional_statistics/moenv/frontend_recipes.json --processed $A/data/processed
npx vite-node --script scripts/statistics/build_statistics_recipe_catalogs.ts
```

analytics 的 `docs/handoff/environment-statistics-recipes.json` 產出後，改用它當 `--recipes`（同一組 per-layer 欄位）。

## 驗收（本地，2026-10-02）

- `npx tsc -b` 綠；`npm test` 452 files／2,879 passed／30 skipped，0 failed；`npm run build` 成功；designSystemGuard 15/15，無新增違規。
- layer-golden：851 keys（+37），既有層零 diff，只有新 key 與 `regionalStatistic` click 清單的追加。
- 瀏覽器驗收：待 R2 發布後進行（見 backlog）。
