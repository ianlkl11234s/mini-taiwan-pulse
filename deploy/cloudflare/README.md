# Cloudflare Workers 部署（Zeabur 搬家第 ③ 關，測試中）

- `src/worker.js`：重現 `nginx.conf` 路由。網頁走 Workers 靜態資產（`dist/`），圖層大檔走 R2 `data.itsmigu.com/site/`，
  `/api/*`、氣候、GFW 與短效 manifest 測試期轉回 `ORIGIN`（現行 Zeabur 正式站）。回應 header `X-Pulse-Src` 標示來源。
- 部署：在 repo 根目錄 `npm run build`（需 VITE_SUPABASE_URL／VITE_SUPABASE_ANON_KEY／VITE_MAPBOX_TOKEN），再於本資料夾 `npx wrangler deploy`。
- 靜態資產 binding 不處理 Range，Worker 自己切 206（dist 內的 PMTiles 需要）。
- 計畫與驗收紀錄：`.gis-agent-system/projects/2026-10-zeabur-migration/`。切換正式網域前，`ORIGIN` 必須改成不會被轉回本 Worker 的主機名稱。
- `sync_site_assets.py`（＋`site_manifest.py`）：S3 deploy-assets → R2 `site/` 只補差異（依 metadata `src-etag`）；預設 dry-run，`--execute` 才寫；
  只用 R2_MIGRATION_*、只寫 `site/`、不刪、排除 climate／global-maritime。`site_manifest.py` 手抄了 `nginx.conf` 與
  `pull-deploy-assets.sh` 的規則，那兩個檔改了要同步改。測試：`python3 deploy/cloudflare/test_sync_site_assets.py`。
- `.github/workflows/deploy-workers.yml`：push master → 同步 → build → `wrangler deploy` → smoke；每天 03:40 只同步。
