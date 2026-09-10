# Status

**最後更新**：2026-09-10（Statistics browser runtime 去 Supabase：R2 snapshot、Cloudflare immutable cache、Zeabur production 全鏈完成）

> 本檔只保留目前主線、release truth、blockers 與下一棒；歷史過程留在 git、feature 文件與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **taipei-gis-analytics** | `master == origin/master` `02dbb218`；PR **#87 merged**，Statistics exact-selector contract 與 snapshot input 完成。|
| **gis-platform** | `main == origin/main` `09494f14`；PR **#106** publisher code／docs merged，docs correction PR **#107** merged。|
| **mini-taiwan-pulse** | remote `master` `1f992a3e`；PR **#239** R2 frontend merged，docs correction PR **#240** merged。收尾記憶在本機 `docs/statistics-r2-wrap-up-memory`，四個 atomic commits，未 push。|
| **R2** | `regional-statistics-cdn-v1`；current manifest `83e3c063…6278`，66 indicators／476 releases／3,174 selectors／4 geometries；3,177 immutable objects readback，pointer last。|
| **Cloudflare** | `current.json`：60 秒、DYNAMIC；僅 `manifests/`、`artifacts/`、`geometries/` 三個 content-hashed prefix 為一年 immutable，代表 artifact 與 45 MB geometry 已 HIT。|
| **Zeabur** | core deployment `6aa196d3…82a7`（`7b473eb2`）完成；docs-only deployment `6aa23b93…2838`（`1f992a3e`）2026-09-10 05:14Z 完成且為 RUNNING。|

## Release truth matrix

| release unit | build | contract-wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| Analytics Statistics contract | done | done：PR#87 | N/A | N/A | done：exact selectors／geometry refs | N/A | N/A | N/A | N/A |
| Platform R2 publisher | done：4 tests + py_compile | done：PR#106 | done | done：3,177 immutable + pointer last | done：hash／size／manifest counts | N/A | N/A | done：custom-domain objects | N/A |
| Cloudflare cache scopes | N/A | done：3 immutable prefixes | N/A | N/A | done：pointer DYNAMIC；artifact／geometry HIT | N/A | N/A | done：CORS + Cache-Control + CF status | N/A |
| Pulse Statistics frontend | done：47 focused tests + tsc | done：PR#239；no Supabase fallback | N/A | N/A | done：production lazy chunk | done：R2 fetch | done：`6aa196d3…82a7` | done | done：selector／日期／單位／STALE／COMPLETE 368/368／缺值語意 |
| docs cache evidence | done：platform sql-lint + Pulse test | done：#107／#240 | N/A | N/A | done：merge SHA | N/A | done：docs-only `6aa23b93…2838` | done：正式站 200；pointer 60 秒 | no rerun：runtime code unchanged；沿用 #239 production browser evidence |

## Blockers / next-session entry

- **runtime／資料發布／docs 無 blocker**；Statistics production 已完成，可正常封存功能工作。
- 唯一未遠端化項目是本機 memory branch `docs/statistics-r2-wrap-up-memory`：
  - commits：`fec1f7bf` DATA_SCOPE、`2ef03437` INCIDENTS、`1fc1062e` REFLECTIONS、STATUS（本 commit）。
  - 原因：wrap-up memory commits 不沿用先前 push 授權，需使用者另行明確允許。
  - 下一棒第一步：取得授權後 `git push -u origin docs/statistics-r2-wrap-up-memory`；若要 PR／merge，再依明確授權執行。
  - 驗收：remote branch 含四個 path-scoped commits；四個 target memory paths clean；不夾帶其他檔案。

## Verification boundaries

- 「不打 Supabase」只指 Statistics browser runtime。整個應用仍因 auth／其他功能保留 Supabase host，不能宣稱全站去 Supabase。
- `current.json` 的 `CF-Cache-Status: DYNAMIC` 是刻意設計，不是 cache miss；只有 content-hashed objects 可 immutable。
- docs PR 的 Claude review job 因外部組織 access／runtime `is_error:true` 失敗；必要 `sql-lint`／`test` 已通過，失敗不屬 code evidence。
- docs-only deployment 未重跑 browser；因 runtime code 未變，browser evidence來自 core PR #239 的 production acceptance，另以 docs-only deployment HTTP 200 證明 cutover。
