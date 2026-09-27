# Handoff — labor-statistics

上游完整 handoff：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/docs/handoff/labor-statistics-frontend.md`。

本 repo 以 `src/data/laborStatisticsRecipes.json` 保存 recipe SSOT 副本，`laborStatisticsRecipes.ts` 提供 exact-selector whitelist 與型別。runtime 仍走共享 Statistics loader/store/map renderer；本地 snapshot 只透過 dataset-scoped DEV route `/__labor-statistics-cdn` 使用，不會取代既有 Statistics CDN。

工作分支：`codex/labor-statistics-frontend-20260927`。工作區：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/labor-statistics-frontend-20260927`。建立基底為本地 `origin/master` 的 `f40a0f5989aa20027336fe6848670ad27dd19313`；原 checkout 的未提交修改沒有被碰觸。

目前本地 code、contract、delivery、routing、catalog、manifest、store、map、hook/click registry、完整 tests、build 與瀏覽器驗收皆通過。尚無 commit、push、PR、資料發布、部署或 production browser 證據；不得把本地 preview 成功描述成正式上線。

重現與驗收摘要見 [README](./README.md)，剩餘門檻見 [backlog](./backlog.md)。
