# Status

**最後更新**：2026-09-21（Layer Discovery／MCP／GIS 分析基礎完成，下一棒處理畫面閉環）

> 本檔只保留目前 touched scope、release truth、邊界與下一棒；完整脈絡見 [`layer-discovery-mcp-handoff-20260921.md`](../../docs/features/agent-research-workbench/layer-discovery-mcp-handoff-20260921.md)。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse** | branch `feat/layer-discovery-mcp-contract`，base `6464004ad3c55b805de817fd51810dd49844467b`；Dataset／Access schemas、bounded query、analysis session、Gateway、GIS Skill、Jev shadow、local stack、文件與架構圖已完成。 |
| **mini-pulse-gis-mcp-layer-discovery** | branch `feat/layer-discovery-mcp-contract`，base／upstream `origin/main` at `cd23db5b25f06856f85e73b91fc72d434ba61b7f`；41 typed tools、Jev router、offline geocoder、relay metadata 已完成。 |
| **OpenRouter Jev** | `typesafe/jev-1.13` 只做一次候選分類；`executed:false`，低信心／錯誤退 deterministic fallback。沒有在 repo 保存 key。 |
| **Paired local browser** | 地址 → 臺北學校 query → 最近 10 筆直線距離 → receipt 已成功；camera state 套用後 `wait_scene_ready` 曾 error，尚未取得完整 visual-ready 證據。 |

## Current capability

- 41 個 MCP tools：routing、session、layer／dataset discovery、bounded access、typed analysis、evidence、address、map／time control。
- DatasetDescriptor → AccessDescriptor → Query Result／Receipt 契約已落地；保留 source、version、coverage、missingness、access、limits。
- 支援 bounded query、Point nearest／within-distance、aggregate、key join、ratio／difference、time series、quality／evidence、result paging／bounds。
- 本機地址索引支援 `exact_cache`／`exact_osm`／`interpolated`／`no_match`／`unavailable`，不將地址送往外部 geocoder。
- guest／owner／release gate fail-closed；catalog entry 不等於可讀、最新、授權或 production healthy。

## Release truth matrix

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| Research runtime | done：tsc／Vite | done | local commit | N/A | local stdio／gateway done；scene-ready partial | not run | not run | local only | partial |
| MCP server | done：tsc／dist | done：41 tools | local commit | N/A | done：46 tests／real stdio | not run | not run | N/A | paired local only |
| Jev／offline geocoder | done | done | local commit | N/A | live route／address E2E done | N/A | not run | external Jev only | local paired E2E |

## Blockers / next-session entry

- repo／branch：上述兩個 `feat/layer-discovery-mcp-contract` branches。
- 第一個步驟：重現 `set_camera`／`fit_bounds` 後的 `pulse_wait_scene_ready` error，追 command revision、applied、ready 與 render completion。
- 驗收：accepted → applied → ready，並以 browser readback 確認中心、zoom、目標圖層；state 更新不可冒充視覺完成。
- 第二步：設計 bounded、session-local、可撤銷的 result overlay。
- 之後才進入 boundary adapter、point-in-polygon、面積／密度；路網、isochrone、raster 放後續階段。

## Verification boundaries

- 現有 result bounds 只能取景，沒有 `present_result`；不得宣稱 filtered result 已成為 overlay。
- Haversine 是直線距離，不是步行／車行距離或服務可達性。
- PMTiles、raster、RPC、scene、mixed／custom source 無 sidecar／專用 adapter 時維持 fail-closed。
- 本輪沒有 push、PR、merge、deploy、production 啟用或 Supabase 寫入。
- 後續整合使用普通 merge commit；禁止 squash、rebase merge 或改寫歷史。
