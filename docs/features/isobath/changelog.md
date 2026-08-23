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

## 2026-08-23 — (未合併，feat/isobath 分支)

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

### 尚未完成（需拍板）

- ⚠️ **正式環境未部署**：`.gitignore:107` 擋 `public/base_map/*.pmtiles`，
  prod 的 `/base_map/` 是純 volume 無 dist fallback →
  上線前必須手動跑 `scripts/deploy/upload-deploy-assets.sh`，否則正式站 404
- 尚未 commit / 未開 PR
