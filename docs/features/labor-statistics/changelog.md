# Changelog — labor-statistics

## 2026-09-27 — 本地 frontend wiring

- 新增精確 9 個 Work & Income layer keys 與 12 個 exact selectors，保護既有 Statistics、social 與 agriculture 基線。
- 新增 dataset-scoped `VITE_LABOR_STATISTICS_PREVIEW` 路由；只有已登錄的 `labor_statistics` recipe 能使用本地 snapshot。
- details、legend、popup 加入 location semantics、coverage、missing reason 與 reference boundary 揭露；observed zero、missing、`source_not_covered`、`source_join_or_time_mismatch` 分開。
- 行業維持單一 toggle，四個選項均可切換，並顯示 manufacturing 是 industry 子集的警語。
- 完整 tests、build、桌面逐層、臺北 73.5、新竹市 90.2、All Off 與 390×844 mobile membership 驗收通過。
- 尚未 commit、push、PR、發布資料或部署。
