# Cloudflare Workers 部署（Zeabur 搬家第 ③ 關，測試中）

- `src/worker.js`：重現 `nginx.conf` 路由。網頁走 Workers 靜態資產（`dist/`），圖層大檔走 R2 `data.itsmigu.com/site/`，
  `/api/*` 轉到 `ORIGIN`（新主機 `https://pulse-origin.itsmigu.com`：Cloudflare Tunnel＋Access，Caddy 再驗共用密鑰；2026-11-06 起）。回應 header `X-Pulse-Src` 標示來源。
- 部署：在 repo 根目錄 `npm run build`（需 VITE_SUPABASE_URL／VITE_SUPABASE_ANON_KEY／VITE_MAPBOX_TOKEN），再於本資料夾 `npx wrangler deploy`。
- 靜態資產 binding 不處理 Range，Worker 自己切 206（dist 內的 PMTiles 需要）。
- 計畫與驗收紀錄：`.gis-agent-system/projects/2026-10-zeabur-migration/`。切換正式網域前，`ORIGIN` 必須改成不會被轉回本 Worker 的主機名稱。
- `sync_site_assets.py`（＋`site_manifest.py`）：S3 deploy-assets → R2 `site/` 只補差異（依 metadata `src-etag`）；預設 dry-run，`--execute` 才寫；
  只用 R2_MIGRATION_*、只寫 `site/`、不刪、排除 climate／global-maritime。`site_manifest.py` 手抄了 `nginx.conf` 與
  `pull-deploy-assets.sh` 的規則，那兩個檔改了要同步改。測試：`python3 deploy/cloudflare/test_sync_site_assets.py`。
- `.github/workflows/deploy-workers.yml`：push master → 同步 → build → `wrangler deploy` → smoke；每天 03:40 只同步。

## 切換到新主機（Akamai＋Cloudflare Tunnel）

新主機的 `/api/*` 由 Caddy 提供，前面是 Cloudflare Access（service token）＋Caddy 的共用密鑰檢查。
`fromOrigin()` 會在轉送到 `ORIGIN` 時加上下列 header；值只來自 Worker secret，瀏覽器送來的同名 header 一律先刪，
回應也不會帶出。env 沒設時不加任何 header；新主機的 Access 與 Caddy 會擋下（403），所以三個 secret 缺一不可。

| Worker secret | 轉成的 header | 值從哪來 |
|---|---|---|
| `CF_ACCESS_CLIENT_ID` | `CF-Access-Client-Id` | Cloudflare Zero Trust → Access → Service Tokens，Worker 專用那組 |
| `CF_ACCESS_CLIENT_SECRET` | `CF-Access-Client-Secret` | 同上（只在建立時顯示一次） |
| `PULSE_ORIGIN_SECRET` | `X-Pulse-Origin-Auth` | 必須和新主機 Caddy 的 `PULSE_ORIGIN_SECRET`（host `env/caddy.env`）同值 |

切換步驟（正式 Worker 與測試站都要做；值不要貼進對話或 commit）：

1. 在本資料夾逐一 `npx wrangler secret put CF_ACCESS_CLIENT_ID`、`CF_ACCESS_CLIENT_SECRET`、`PULSE_ORIGIN_SECRET`（三個都是 secret，不寫進 `wrangler.jsonc`）。
2. 先驗新主機：帶這三個 header 直打 `https://pulse-origin.itsmigu.com/api/private-research/coral` 應通；少任一個應被 Access 或 Caddy 擋（403）。
3. 把 `wrangler.jsonc` 的 `vars.ORIGIN` 改成 `https://pulse-origin.itsmigu.com`（不可指回本 Worker 自己），走 PR 合進 master 由 `deploy-workers.yml` 部署。
4. 回滾：`ORIGIN` 改回原值即可；secret 留著無害。

測試：`node --test deploy/cloudflare/worker.test.mjs`（`npm run check:worker`，CI 會跑）。

私有圖層 sidecar 的映像：`server/coral-private/Dockerfile`，由 `.github/workflows/publish-coral-private.yml`
在 master 有 sidecar 改動時推到 `ghcr.io/ianlkl11234s/pulse-coral-private`（tag：commit sha、`latest`）。
第一次推完要到 GitHub Packages 確認該 package 是 private；主機 pull 需要 `read:packages` 的 PAT。
