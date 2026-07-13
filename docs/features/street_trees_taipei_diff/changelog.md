# Changelog — 行道樹變化 Street Tree Diff

> 逐 PR 變更紀錄。最新在上。

格式：
```
## YYYY-MM-DD — PR #NN <squash commit hash>
- <what changed>
- <why (optional)>
- <breaking? migration needed?>
```

---

## 2026-07-12 — PR #（pending）`（pending）`

- 新增 `streetTreesTaipeiDiff` 圖層（台北行道樹 2024/11 vs 現在 三狀態變化）
- 資料源：上游 `street_trees_taipei_diff` PMTiles（99,527 點，sourceLayer `street_trees_taipei_diff`, z5–14，9 欄 keep_attrs）
- 接線：types 三處 / overlayRegistry circle / layerCatalog（新分組「都市開放空間」）/ IconRailSidebar（TreePine）/ useTransportParams（opacity + status select）/ LegendPanel / useMapInteraction + urbanPanels + registry / upstreamRegistry
- 部署：新 group `urban/`（D 類），.gitignore + upload/pull/nginx 三處已接
- Breaking：無
