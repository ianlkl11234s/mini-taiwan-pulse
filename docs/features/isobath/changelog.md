# Changelog — 海底等深線 Isobath

> 逐 PR 變更紀錄。最新在上。

格式：
```
## YYYY-MM-DD — PR #NN <squash commit hash>
- <what changed>
- <why (optional)>
- <breaking? migration needed?>
```

---

## 2026-08-23 — PR #160 `509732c`（已上線）

- 新增「海底等深線」圖層前端接線：`isobath` LayerVisibility key、manifest entry、
  overlayRegistry 一筆 config（fill=深度分帶 12 級 + line=等深線 11 級，靠 `kind` filter 分流）、
  4 個參數控件（配色 select / 分帶填色 toggle / 線透明度 slider / 填色濃度 slider）、
  LegendPanel 圖例（隨配色模式換色）、popup（line 顯示水深、band 顯示深度區間）
- 色票 SSOT：`src/data/isobathTypes.ts`（單色藍反向強調 / Haxby / Turbo 三模式）
- 資料源：GEBCO 2025 Grid（15 arc-second），public domain，圖例 / popup 已掛署名
- Breaking：無
- 上游資料已落地：`public/base_map/gebco_isobath.pmtiles`（2.8 MB，tippecanoe layer `isobath`，
  z4–12，2,409 features＝line 2,397 ＋ band 12）；上游 pipeline `taipei-gis-analytics/
  pipelines/base_map/gebco_isobath/`、catalog `gebco_isobath`、handoff 皆已建立
- `line-width` 由固定 0.6 改為 zoom interpolate（z5 0.4 → z15 2.2）——
  畫面實測 z13 時固定寬度細到幾乎看不見（layer-onboarding 線層 baseline）
- `upstream.status` 由 `catalog_missing` 修正為 `verified` + `datasetId: gebco_isobath`
  （上游 catalog 已建立；平行作業時的暫時狀態）

### 驗收紀錄（2026-08-23）

- `npx tsc -b` exit 0；`npm test` 50 檔 / 650 測試全綠
- Browser 實測（localhost:3721，All Off → 只開本層）：
  - `isobath-fill` / `isobath-line` 兩層皆建立，`queryRenderedFeatures` 於 z8 取得 511 筆
    （band 69 / line 442），`kind` 兩種值與 `depth_m`／`dmin`~`dmax` 屬性皆正確
  - popup 顯示「水深 4,000 m」＋ GEBCO 署名
  - 圖例 12 帶完整、隨配色模式換色
  - 分帶填色 toggle 關閉後 `fill-opacity=0` 而 `visibility` 仍為 `visible`（符合規則）
  - 三種配色模式切換皆正常
- 陸地誤塗驗證：福州／南平／廈門／台中四個內陸點皆**未**被任何深度帶覆蓋（環差 hole 正確）

### 上線紀錄（2026-08-23）

| 步驟 | 結果 |
|---|---|
| 上游 PR | taipei-gis-analytics **#54** → squash `494d59e` |
| 下游 PR | mini-taiwan-pulse **#160** → squash `509732c` |
| S3 | `deploy-assets/base_map/gebco_isobath.pmtiles`，2,930,664 bytes（與本機逐位元一致） |
| 部署 | merge 後約 4 分鐘落地（Zeabur 綁 master，無 staging） |
| 正式站驗證 | PMTiles HTTP 200 且 `pmtiles show` 可讀 metadata；browser 實測 z8 取得 **511 筆**（band 69 / line 442）—— **與本機數字完全一致** |
| attribution | 正式站頁面含 GEBCO 署名 |

上傳採單檔 `aws s3 cp` 而非跑整支 `upload-deploy-assets.sh` —— 後者對 `base_map/`
用的是無條件 `aws s3 cp` 迴圈，會把 S3 上既有的 12 個檔案（約 780MB，含 297MB
底圖與 242MB 等高線）整批重傳。容器端 `pull-deploy-assets.sh` 對 `base_map/` 是
整夾 `aws s3 sync`（增量），新檔案自動涵蓋，不需改任何部署腳本。

### 待辦

- `.claude/memory/STATUS.md` 尚未更新（本次上線當下工作區被平行 session 的
  `feat/jp-religion-layers` 佔用，未代為改動）→ 下次 `/wrap-up` 時補
