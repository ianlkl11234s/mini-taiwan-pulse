# Status

**最後更新**：2026-10-28 國家主體化上線（v2.16.0＋v2.16.1）

> 本檔只重寫當前 checkpoint；舊段落在 [`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。完整計畫與數字看 [`PLAN-prod-connect-20261003.md`](../../docs/features/general-analysis/PLAN-prod-connect-20261003.md)，契約看 [`SPEC-prod-connect-p1-p3.md`](../../docs/features/general-analysis/SPEC-prod-connect-p1-p3.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0017。

## 2026-10-28：國家主體化（v2.16.0＋v2.16.1）

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #721 國家設定與 `c=`、#722 圖層入口＋國家選單＋通訊主題、#723 manifest `country`＋map_context、#724 視野提示、#726 選單與全部關閉同列＋台灣飛全台 → #727／#728 發 v2.16.0；#729 飛行中不閃舊提示 → #730／#731 發 v2.16.1。tag 與 GitHub Release 都已建。 |
| **.gis-agent-system** | 計畫與研究：`projects/2026-10-multi-country/`（README、PLAN-topic1-website §9 有完成紀錄）。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| v2.16.0 | done：#728 CI 綠 | done：CI（layerConsistency、golden、inventory） | done：develop `7c6b44f4` | N/A：無新資產 | N/A | N/A | done：master `e0a4474d` | done：`main-Bg1eBBYX.js` 含 "2.16.0" | done：選單同列、切法國（只剩通訊）、切回全台；not run：見 **MC-3** |
| v2.16.1 | done：#731 CI 綠 | done：CI | done：develop `ebebbd1b` | N/A | N/A | N/A | done：master `301557e7` | done：`main-BFfdCd84.js` 含 "2.16.1" | done：切法國後 14 秒取樣 0/19 出現舊提示 |

- 下一步：MCP 補 country 說明（**MC-2**）；補目視（**MC-3**）；同名主題前先拆識別名（**MC-1**）；議題 2、3 等使用者討論（**MC-4**）。
- 接手：從 origin/develop 開分支；多國化脈絡先讀 `.gis-agent-system/projects/2026-10-multi-country/README.md`。

## 2026-10-28：日本第四波正式站驗收

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | 第四波 6 層（#716：障礙福祉、兒童福祉、主要道路、高速道路、地理院陰影起伏、色別標高）已隨 v2.15.0 上線；#720 BACKLOG 新增 JPRD-1。 |
| **taipei-gis-analytics** | #228（三條 pipeline）、#229（README 數字）已合併；`japan_opendata/_status.md` 改為已上線。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| 日本第四波（#716） | done：#716 CI 綠 | done：golden 1324→1330、inventory | done：develop `b1a01e71` | done：`jp_welfare_facilities`、`jp_major_roads` 在 S3 `deploy-assets/world/` | done：大小與 sha256 一致 | done：正式站回 206 | done：v2.15.0 master `bcbba48b` | done：三個 PMTiles 2026-10-28 回 206 | done：2026-10-28 六層畫面、圖例、popup（raster 無 popup）、`errors` 無輸出 |

- 下一步：市町村道等 Zeabur 搬遷後做（**JPRD-1**）；收費道路樣式待使用者決定（**JPRD-2**）；WAM NET 表單待使用者填（**JPW4-1**）；CSP enforcing 前補 gsi／jma 網域（**BC-4b**）。
- 接手：日本 P1 第 1–4 波都已上線，下一輪從英國 P1 或日本 P2 選起，先讀 analytics `.claude/skills/country-opendata-scout/references/country-runs.md`。
