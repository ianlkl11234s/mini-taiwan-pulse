# 珊瑚礁歷史分布（UNEP-WCMC）

> **Slug**：`coral-reef-layers`（上游：`taipei-gis-analytics/docs/handoff/coral-reef-layers.md`）
> **狀態**：shipped（2026-09-08 本地整合，同日改為私人遠端；2026-09-16 起改為公開地圖）
> **相關 PR**：#229、#230、#232；公開化 #253、#254（依 CHANGELOG.md）

## 一句話說明

UNEP-WCMC v4.1（2021-03 發布）全球暖水珊瑚礁歷史分布 polygon，僅為歷史基線，不是現況健康、活珊瑚覆蓋率或白化。

## 圖層

- layer key：`coralReefDistribution`（`src/data/layerManifest.ts`）
- source `coral-reef-distribution`／source-layer `coral_reef_distribution`，PMTiles z0–12；經 `/api/private-research/coral` 匿名受限 Range 讀取（S3 維持 private）。
- 授權 UNEP-WCMC General Data License，無再散布權；`source_year` 全 null，2021 是發布年非觀測年。

## 關鍵檔案

- Hook：`src/hooks/useCoralReefDistributionLayer.ts`
- Sidecar：`server/coral-private/coral-private-server.mjs`（與 Allen 共用，Allen 另見 [`../allen-coral-atlas/`](../allen-coral-atlas/README.md)）

## 驗收方式

[browser-acceptance.md](./browser-acceptance.md)（九視角、桌面／手機）。未驗證：實體手機效能與 Light 底圖（見 [backlog.md](./backlog.md)）。公開化後的驗收見 [`../allen-coral-atlas/access-release-20260916.md`](../allen-coral-atlas/access-release-20260916.md)。

## 文件索引

| 文件 | 用途 |
|---|---|
| [handoff.md](./handoff.md) | 本地前端交接與資料契約（2026-09-08，歷史） |
| [private-access.md](./private-access.md) | 存取沿革：開頭為現行（公開），其後為 2026-09-08 私人設計 |
| [browser-acceptance.md](./browser-acceptance.md) | 本地 browser 驗收 |
| [backlog.md](./backlog.md) / [changelog.md](./changelog.md) | 範圍清單／改動紀錄 |
