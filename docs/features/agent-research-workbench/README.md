# Agent Research Workbench（Codex 研究／地圖探索橋接）

> **Slug**：`agent-research-workbench`
> **狀態**：historical（2026-09 本地開發紀錄；現行 Agent 分析工作已移至 [`../general-analysis/`](../general-analysis/README.md)）
> **最後相關改動**：2026-10-16（文件歸檔）；程式 `src/research/` 仍持續演進（最近 2026-10-15 i18n P4-B）
> **現行架構說明書**：[ARCHITECTURE.md](./ARCHITECTURE.md)（2026-10-21，MCP core 23 工具＋五 skill＋分析倉庫）

## 一句話說明

讓使用者在本機 Codex（經 `pulse-research` MCP）與正式站地圖之間配對，由 Agent 找圖層、做有界的資料分析，並把結果（點／線／面／格網）呈現回地圖。spec 見 [spec.md](./spec.md)。

## 現況與接手

- 本資料夾多為 2026-09-10～22 的規格、驗收與 checkpoint，多份文件開頭已自標「歷史」；工具數、發布狀態以後來文件為準。
- 現行狀態與下一步：[`../general-analysis/STATUS.md`](../general-analysis/STATUS.md)；正式站連線 SPEC：[`../general-analysis/SPEC-prod-connect-p1-p3.md`](../general-analysis/SPEC-prod-connect-p1-p3.md)。
- 本資料夾內最新的能力入口：[exploration-capabilities-plan.md](./exploration-capabilities-plan.md)。

## Runtime 路徑

- 前端：`src/research/`（例：`bridgeClient.ts`、`main.tsx`、`MainMapConnection.tsx`、`AgentTokenSection.tsx`）
- 本機試用腳本：`scripts/research/`（例：`start-local.mjs`、`acceptance-map.html`）
- Gateway 與 MCP 在獨立 repo，不在本 repo（見 exploration-capabilities-plan.md 的合併／部署表）。
- 端點契約：[bridge-contract.md](./bridge-contract.md)

## 驗收方式

各階段驗收見 [acceptance.md](./acceptance.md)、[research-streamline-acceptance-20260922.md](./research-streamline-acceptance-20260922.md)、[statistics-acceptance-20260918.json](./statistics-acceptance-20260918.json)、`evidence/`。「合併／CI／部署 receipt／正式站回讀」為不同證據，不可互相代替。

## 文件索引

| 文件 | 用途 |
|---|---|
| [spec.md](./spec.md) | v1 規格（2026-09-10，歷史） |
| [exploration-capabilities-plan.md](./exploration-capabilities-plan.md) | 地圖探索能力、發布狀態、優先級（本資料夾入口） |
| [analysis-capability-onboarding.md](./analysis-capability-onboarding.md) | 新圖層接入分析能力的規則 |
| [layer-capability-inventory-20260919.md](./layer-capability-inventory-20260919.md) | 全圖層能力盤點快照 |
| [layer-discovery-mcp-handoff-20260920.md](./layer-discovery-mcp-handoff-20260920.md) / [-20260921.md](./layer-discovery-mcp-handoff-20260921.md) | 圖層搜尋／MCP／GIS 分析接手文件 |
| [handoff.md](./handoff.md) / [backlog.md](./backlog.md) / [changelog.md](./changelog.md) | 歷史接手、待辦（含持久化分析成果、正式服務拓樸）、改動紀錄 |
| [tool-foundation-plan.md](./tool-foundation-plan.md)、[gis-analysis-roadmap.md](./gis-analysis-roadmap.md)、[map-exploration.md](./map-exploration.md) | 工具基礎、分析路線圖、第一階段探索（歷史） |
| [pulse-research-system-guide-20260921.md](./pulse-research-system-guide-20260921.md)、[pulse-research-system-map.html](./pulse-research-system-map.html) | 白話導覽與互動架構圖 |
| [jev-routing-accelerator.md](./jev-routing-accelerator.md) | MCP shadow routing 說明 |
| [day-prefetch-scope-2026-10-05.md](./day-prefetch-scope-2026-10-05.md) | AU-3 逐日預抓範圍契約 |
| [checkpoint-20260917.md](./checkpoint-20260917.md)、[connection-audit-20260917.md](./connection-audit-20260917.md)、[release-handoff-20260917.md](./release-handoff-20260917.md) | 2026-09-17 接手點、連線盤點、release handoff（歷史） |
| `inventory/`、`evidence/` | 圖層／RPC 盤點產物、驗收證據 |

## 相關

- 全站待辦：`.claude/memory/BACKLOG.md`（Agent research 列指向 layer-discovery-mcp-handoff-20260921.md）
