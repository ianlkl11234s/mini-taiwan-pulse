# Handoff — environment-statistics

上游：taipei-gis-analytics worktree `env-stats-20261002`，`data/intermediate/regional_statistics/moenv/frontend_recipes.json`（37 layers）與 `data/processed/{environment,waste_management,water_resources}/*/releases/*.json`。之後的 SSOT handoff 為 analytics `docs/handoff/environment-statistics-recipes.json`（本輪接線時尚未產出）。

本 repo：`src/data/environmentStatisticsRecipes.{json,catalog.json,ts}`；呈現設定（分組、toggle 標籤、位置口徑、資料限制、小數位）寫在 generator 的 `PRESENTATION`，數值、期別、來源一律來自交付。

工作分支：`feat/environment-statistics`，worktree `mini-taiwan-pulse/.worktrees/env-stats-20261002`，基底 `dffce536`。尚未 commit／push／PR；資料由主 agent import Supabase 後 export 到 production R2。R2 發布前不得把本地測試描述成上線。

上游規格疑點（需回 analytics）：
1. 自來水不合格 `breaks: [0]` 無法驅動 Mapbox `step`（0 會落到上色那一格）；前端改用件數 `[1]`、率 `[0.01]` 加二元圖例。
2. `statsResponsibleEnterprisesCounty` 期別是擷取日 2026-10-02，非來源統計期；前端已揭露，建議上游補來源期別。
3. `statsComplaintCasesPndCounty`、`statsComplaintsPer10kCounty` 標註建議不重複上架／改用衍生值；前端保留（資料來源總覽可查）但併入一個「指標」toggle。
4. recipe 缺 `location_semantics`／`disclosure`／小數位欄位，目前由前端 generator 補寫；上游 handoff 若提供，應以上游為準。

5. **release_id 釘死內容 hash**（例 `…-v1-eed49448d474`）：import Supabase／export R2 必須用產生本 recipe 的同一批 processed 檔；若 pipeline 重跑導致 hash 改變，該層會顯示「統計尚無已公開且通過交付白名單的期別」。R2 發布後若仍出現，先比對 `current.json → manifest.indicators[].releases[].release_id` 與 recipe（`delivery.receipts[].raw_sha256` 可核對），以及 `catalog.indicators[].unit` 是否與 recipe `unit` 一致（不一致 loader 會拒絕）。

瀏覽器煙霧測試未做：headless agent-browser 無 WebGL，MapView 在 sidebar 掛載前就失敗（環境限制，非本變更造成），留待 headed session。

重現與驗收見 [README](./README.md)，剩餘門檻見 [backlog](./backlog.md)。
