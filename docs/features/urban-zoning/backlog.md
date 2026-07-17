# Backlog — urban-zoning

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 對應項編號要一致（UZ 系列）。

## 進行中

（無）

## 待辦

- [ ] **UZ-1**：其他縣市逐城擴充 — 上游依 `docs/topic-research/urban_zoning_polygon/_status.md` 的來源矩陣逐城下載/清洗/PMTiles；下游每城同構複製 entry（色票/圖例/panel 共用零改動）
- [ ] **UZ-2**：新北官方站 TLS 憑證信任問題 — 上游 pipeline 目前 `--insecure` + SHA-256 記錄，正式排程前處理（上游事項，此處追蹤）
- [ ] **UZ-3**：NLSC LUIMAP WMS raster 全國視覺層 — 向量未覆蓋縣市的暫時疊圖選項（僅視覺、不可查詢，需標註來源與限制），見上游 status「路徑 A」
- [ ] **UZ-4**：deploy 前跑 `upload-deploy-assets.sh` 上傳 2 個 pmtiles 到 S3（urban glob 已涵蓋，只需執行）
- [ ] **UZ-5**：上游 02_normalize drop 北市 4 筆範圍框 meta-polygon（zone_name/zone_raw=`"nan"`，feature_id taipei_detail_0/1/2/2220）— 前端已 filter 防禦，上游清掉後 filter 留著無害

## 已完成（近期）

- [x] **UZ-0**：北市+新北 2 層接線 — commit `8a8de4b`，2026-07-17，PR 待開

## 已放棄 / 延後

- OSS godspeedhuang 2020 全國預跑庫當上線資料 — 資料時點 stale（2020），僅留歷史比較用（上游決策）
