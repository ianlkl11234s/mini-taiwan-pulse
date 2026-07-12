# Backlog — 養殖漁業 Aquaculture

> 本 feature 的待辦。前綴用 `AQ-`。

## 進行中

- [ ] **AQ-1**：養殖漁業 3 層（逐口魚塭 / 生產區 / 海上箱網）上線 — feat/aquaculture-layers 已驗證，**未 commit / 未 push**（過夜先不 push），PR 待開。

## 待辦

- [ ] **AQ-2**：**部署方式待決** — 3.1MB pmtiles 要 git commit 進版控、還是 gitignore + 跑 `upload-deploy-assets.sh` 上 S3（deploy 腳本已備 S3 路徑）。待用戶決定。
- [ ] **AQ-3**：放養量 G70 dataset（79 點）未接。
- [ ] **AQ-4**：牡蠣養殖區（上游 staged，未正式 pipeline 化）未接。
- [ ] **AQ-5**（可選 polish）：popup footer 顯示「資料來源 (Tier ?)」— 養殖資料未帶 `source_org` / `source_tier` 欄位（共用 `SourceFooter` 既有行為，cosmetic；OSM 歸屬已在地圖 attribution）。可於上游資料補 source 欄位。

## 已知現象（非 bug）

- 逐口魚塭屬性稀疏：15,241 筆僅 ~118 有 `produce`、~21 有 `name` → 多數 popup「養殖物 / 名稱」空（Row 對空值自動隱藏，非 bug）。
</content>
