# 日本旅宿、自然保護與世界遺產

> **狀態**：production-ready code；production assets 需以 scoped publisher 完成 S3 readback
> **上游 SSOT**：`/private/tmp/jp-tourism-data-ready-20260910/docs/handoff/jp-tourism-data-ready.md`

## Runtime 路徑

- 大型靜態 geometry：PMTiles → `deploy-assets/world/` → `/data/world/` → `/world/`，圖層 visible 時才建立 source，瀏覽器以 HTTP Range 取 tile。
- 小型靜態資料：GeoJSON 走相同 S3/nginx 路徑，圖層 visible 時才整檔 fetch。
- 不使用 Supabase；本批沒有動態／參數化 runtime query。

## 發布邊界

- Production：旅宿 canonical/JTA/地方許可/OSM、UNESCO 現行代表點、EBSA。
- Local research only：A10、A11、鳥獸保護區、A28 historical、Ramsar；保留 NON_COMMERCIAL、HOLD_LICENSE、LICENSE_UNVERIFIED、HOLD_GEOMETRY 狀態，不進公開 S3 或 production catalog。
- 不接 A15、OECM geometry、A34 HOLD layers。

詳細資產、filter 與驗收見 [handoff.md](./handoff.md)。

## 發布

```bash
S3_ENV_FILE=/path/to/local/.env scripts/deploy/publish-jp-tourism-assets.sh
S3_ENV_FILE=/path/to/local/.env scripts/deploy/publish-jp-tourism-assets.sh --upload
```

第一行只做 read-only preflight；第二行只建立缺少的 6 個 production objects。若同 key 已存在但 bytes 或 SHA-256 不符，腳本會拒絕覆寫。
