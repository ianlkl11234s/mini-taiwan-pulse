# Backlog — Static-to-CDN

> 本 feature 的細節與批次盤點留在 [README.md](./README.md)；本檔只保留尚未完成的 current residual。

## Release blocker / verifying

- [ ] **STC-1 · `verifying`**：完成 `perf/static-to-cdn` 的 PR／merge lifecycle，並核對 25 個 snapshot 在 production 可取得。
  - Outcome：靜態層正式脫離 DB 併發隊列，不把 local/S3 記錄當成 production evidence。
  - Next action：核對 PR/CI、S3 manifest/checksum、冷載 Network 確實走 `/static-rpc/` 且 fallback 為零。

## Conditional / deployment

- [ ] **STC-2**：部署後建立 `/static-rpc/` Cloudflare cache rule。
  - Trigger：STC-1 merge 且 production path 已驗證。
  - Outcome：快照由 edge cache 提供，降低重複 origin fetch。
  - Acceptance：cache rule scope 僅 `/static-rpc/`，purge/refresh 流程可重現。

## Decision / future scope

- [ ] **STC-3**：評估是否為 `waste_stops` 拆 per-city snapshots；目前刻意保留 per-city RPC。
  - Outcome：避免 193k/56MB 全量快照與 fallback 壓垮 pooler。
  - Next action：只有在需求證明 CDN 受益大於拆檔維護成本時，才做 schema/檔案切分 POC。

- [ ] **STC-4**：其餘 bespoke 項目（data catalog、年度 H3、混即時 reservoir、satellite catalog、電廠 popup provenance）維持 deferred。
  - Trigger：出現明確使用者需求或 DB 壓力證據；各項應另開 feature backlog，不回填已完成批次。

## 已完成（歷史，不列入 active）

- [x] Pilot、Batch 1、Batch 1b、Batch 2 與 `primary_operating` 共 25 檔 — 見 [README.md](./README.md).
