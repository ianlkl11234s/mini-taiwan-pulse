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

## 2026-07-13 — PR #（pending）`（pending）`

- 新增「染色模式」select（依狀態 / 依樹種 / 依胸徑 / 依樹高），預設維持依狀態三色
- 新增色票 SSOT `src/data/streetTreeColors.ts`（前 10 大樹種 categorical 亮色 + 胸徑/樹高 sequential 暖色帶 + 表達式 builder），overlayRegistry 與 LegendPanel 共用
- 前 10 大樹種與分級 break 由全量 geojson（99,527 點）統計：Diameter 分位 → 10/20/30/40 cm；TreeHeight 分位 → 6/8/10/13 m；缺值/≤0 給灰
- 接線：useTransportParams（colorMode state + colorModeIdx 進 params + deps + select）/ overlayRegistry（circle-color switch 分支 + rebuildOnParamChange）/ LegendPanel（圖例依 colorMode 切換）
- status 篩選（opacity）與 renumber 降透明在四種模式下都繼續有效；circle-color 不引入 zoom（沿用 circle-radius 的雷防線）
- Breaking：無

## 2026-07-12 — PR #（pending）`（pending）`

- 新增 `streetTreesTaipeiDiff` 圖層（台北行道樹 2024/11 vs 現在 三狀態變化）
- 資料源：上游 `street_trees_taipei_diff` PMTiles（99,527 點，sourceLayer `street_trees_taipei_diff`, z5–14，9 欄 keep_attrs）
- 接線：types 三處 / overlayRegistry circle / layerCatalog（新分組「都市開放空間」）/ IconRailSidebar（TreePine）/ useTransportParams（opacity + status select）/ LegendPanel / useMapInteraction + urbanPanels + registry / upstreamRegistry
- 部署：新 group `urban/`（D 類），.gitignore + upload/pull/nginx 三處已接
- Breaking：無
