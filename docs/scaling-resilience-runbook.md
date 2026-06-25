# 擴展與韌性 Runbook

> 起因：2026-06-24 公開上線後訪客尖峰（Cloudflare 24h 1.44M 請求 / 1.01TB 頻寬 / 6.45k visits；
> Supabase 24h 204,590 DB 請求）打爆 Small 實例連線池 → collector 寫入無限 hang → 資料停寫 14 小時。
>
> 路線：**短解（1–5，全 0 成本）+ 治本（6，花錢）一起走**。先止血再決定要不要花錢。

## 根因（白話）

Supabase = 一間小廚房（Small，廚師固定）。訪客點餐（讀）+ collector 送食材（寫）走**同一個廚房**。
兩件事疊加炸掉：

1. **開場畫面強迫每個訪客一進門就預載 4 個重型動態層**（空域/船舶/鐵道/溫度場）→ 6k 訪客瞬間湧入 = 廚師全忙翻。
2. **Collector 寫入沒有 timeout** → 廚師被占滿時供應商無限期乾等，單筆卡死整條寫入鏈（單連線 + 單一 RLock）→ 14h 停擺。

---

## 優先序總覽

| # | 項目 | 解決 | 成本 | 排程 | repo |
|---|---|---|---|---|---|
| 1 | Collector 寫入 timeout | 14h 停擺根因 | 0 | 今晚 | data-collectors |
| 2 | 開場流程不預載動態層 | 訪客尖峰併發 | 0 | 今晚 | mini-taiwan-pulse |
| 3 | Collector health check + watchdog | 卡死自我恢復 | 0 | 本週 | data-collectors |
| 4 | 靜態資產長快取 immutable | 1TB/天 頻寬 | 0 | 本週 | mini-taiwan-pulse / nginx |
| 5 | 熱門讀取改 GET + Cloudflare 快取 | 連線池病（讀取側）| 0 | 本週 | mini-taiwan-pulse + gis-platform |
| 6 | Read Replica（治本） | 讀寫物理隔離 | 花錢 | 止血後評估 | Supabase |

---

## 1. Collector 寫入 timeout 〔今晚〕

**問題**：`storage/supabase_writer.py` 主 writer 用 psycopg2 單一長連線（transaction pooler 6543），
`_connect()`（約 `:49-56`）沒帶 `connect_timeout`，`_write_to_db`（約 `:1624`）沒設 `statement_timeout`。
DB hang / 網路黑洞時寫入無限阻塞 → 因為全 collector 共用同一條連線 + 同一把 RLock（`:45/:70`），
任一寫入卡住 → 全部 collector 寫入鎖死。

**範本已在 repo**：`tasks/backup_supabase.py:133`（`connect_timeout=30`）+ `:166-170`（`SET statement_timeout`）做對了，主 writer 漏套。

**改哪裡**：
- `_connect()`：`psycopg2.connect(url, connect_timeout=10)` + keepalive 參數。
- 連線後設 session `statement_timeout`（如 30s）+ `idle_in_transaction_session_timeout`。
- buffer 重試（`_flush_buffer_locked` `:129`）順手加指數 backoff（不重寫機制）。

**驗收標準**：
- [ ] 模擬 DB 不可用（擋掉 6543 或設極短 timeout）→ 寫入在 N 秒內**拋例外而非 hang**，落 buffer。
- [ ] 同時間其他 collector 的 `write()` 不被鎖死（RLock 在 timeout 後釋放）。
- [ ] DB 恢復後 buffer flush 正常補回。

## 2. 開場流程不預載動態層 〔今晚〕

**問題**：開場畫面（Image #5「載入中 2/5」）預載 空域+船舶+鐵道+溫度場 給**每個訪客**。
圖層雖已預設關，但開場預載這條路徑還在 → 仍是訪客尖峰併發的主來源。

**改哪裡**（mini-taiwan-pulse）：
- 開場只載：底圖 + 輕量 `*_dates`（日期清單）。
- 動態圖層資料**改成 toggle 開啟才載**，不在 boot 預載。
- 「載入中 X/5」進度條對應縮短或移除（沒東西要預載了）。

**驗收標準**：
- [ ] 全新訪客開站 → Network 面板初始 RPC 數大幅下降（目標：只剩 `*_dates` 等輕量呼叫）。
- [ ] 點開單一動態層 → 該層資料才載入（loadingRegistry 有對應 task，符合 CLAUDE.md §3）。
- [ ] 開場到可互動的時間明顯變短。

## 3. Collector health check + watchdog 〔本週〕

**問題**：`api/server.py:96-104` 的 `/health` 是靜態的，只回 `status: healthy`，
**不檢查 DB 連線 / scheduler 活性** → 進程卡死也回 healthy → Zeabur liveness 永不重啟。

**改哪裡**：
- `/health` 改成真的探：DB 能連嗎（短 timeout）+ scheduler 主迴圈最近有跑嗎 + writer 鎖是否被長期持有。
- Zeabur 配 liveness probe 指向 `/health`，失敗自動重啟。

**驗收標準**：
- [ ] DB 斷線時 `/health` 回非 200。
- [ ] 主迴圈卡死超過閾值 → `/health` 回非 200 → Zeabur 重啟。

## 4. 靜態資產邊緣快取 〔本週〕

**根本問題（2026-06-24 查證）**：**Cloudflare 預設不快取 `.json` / `.geojson` / `.pmtiles`**
（只快取 js/css/圖片等副檔名）。所以目前**每個訪客**的大檔 PMTiles/GeoJSON 請求都**直穿到 origin**
（Zeabur nginx）。nginx 的 `expires 1d` header 形同被忽略——Cloudflare 根本沒在快取這些副檔名。
→ 頻寬 1TB/天 + origin 負載的元兇之一。

**這不是 nginx 問題，是缺一條 Cloudflare Cache Rule。**（content hash 那條原計畫太重、且動到扁平檔名契約，廢棄。）

### 要做的（Cloudflare dashboard，使用者手動套）

**Cache Rule**（Caching → Cache Rules → Create）：
- **Rule name**：`cache-static-assets`
- **When incoming requests match**（URI Path）— 用 `or` 串：
  `starts_with /geo/`、`/h3/`、`/bus/`、`/forestry/`、`/agriculture/`、`/coverage/`、
  `/medical/`、`/fire/`、`/rail/`、`/flood/`
  （或更簡單：`URI Path ends with` `.pmtiles` `or` `.geojson`）
- **Then**：
  - Cache eligibility → **Eligible for cache**（這就是讓 Cloudflare 開始快取這些副檔名的關鍵）
  - Edge TTL → **Respect origin / existing headers**（= 沿用 nginx 的 1d，stale window ≤ 1d，免清快取）
- ⚠️ **不要**把 `/`、`/index.html` 納入（SPA 入口無 hash，快取會釘死舊版）。
- ⚠️ 已知雷（PRINCIPLES.md:425-427）：另設「**404/5xx → Bypass cache**」，避免暫態 404 被釘整個 TTL。

### 進階（可選，要更狠的 origin 保護）
把 Edge TTL 改寫成較長（如 7d），則**每次 redeploy 後**跑：
`bash scripts/deploy/purge-cloudflare-cache.sh`（需 `.env` 設 `CF_ZONE_ID` / `CF_API_TOKEN`）。
若用「Respect headers」就**不需要**這步。

**驗收標準**：
- [ ] 開站後對 PMTiles/GeoJSON 看 response header `CF-Cache-Status`：第二次起應為 **HIT**（目前是 DYNAMIC/MISS）。
- [ ] origin（Zeabur）對外流量明顯下降、訪客大檔請求多由 Cloudflare 邊緣供應。
- [ ] redeploy 換新資產後 ≤ 1d（或跑 purge 後立即）使用者拿到新版。

> 註：item 2（lazy load）其實已先砍掉「自動載入全部圖層」的大半頻寬；item 4 是把「使用者主動開的那些層」也讓 Cloudflare 邊緣分擔，保護 origin。兩者疊加。

## 5. 熱門讀取改 GET + Cloudflare 快取 〔本週〕

**問題**：118 個讀取全是 supabase-js `.rpc()` = **POST**，CDN 不快取 POST。
但資料 0 個人化（全 anon、全域或純資料維度），天生可快取。

**改哪裡**：
- 優先把**載入必打、命中率最高**的改 GET：`*_dates`（`get_bus_dates` 等）、`*_latest`/`*_now`（全域快照）、單一 `target_date` 系列。
- supabase-js：`.rpc(name, args, { get: true })`；對應 Postgres 函式須為 `STABLE`/`IMMUTABLE` 且**純量參數**。
- Cloudflare cache rule：歷史日期/`*_dates` 長 TTL；`*_latest`/今天的日資料 30–60s 短 TTL。
- **不改**：`get_waste_*`、`get_news_events_day_clustered_v2`（陣列/多參，cache key 爆炸 + GET 不支援陣列）→ 留 POST。

**驗收標準**：
- [ ] `*_dates`/`*_latest` 走 GET，Cloudflare cache HIT。
- [ ] Supabase DB 請求數較尖峰大幅下降（目標砍 80%+）。
- [ ] 資料新鮮度可接受（短 TTL 內）。

## 6. Read Replica（治本）〔止血後評估〕

**問題**：根因是讀寫共用同一 Postgres compute。訪客尖峰榨乾 → collector 餓死。

**做什麼**：
- Supabase Pro 加一台同規格 read replica。public client 指向 replica endpoint，collector 繼續寫 primary。
- 成本：約 +1 台同規格 compute（需查當前定價）。
- 限制：replication lag（讀取慢幾秒，對時序資料可接受）。

**何時做**：做完 1–5 後觀察。若仍吃緊才上；很可能 1–5 後就夠穩，6 變「更保險」而非「非做不可」。
**與第 5 項不衝突，可疊加。**

---

## 不用改（省力，別過度工程）

- ❌ Cloudflare Worker 反代快取 — 第 5 項 GET 快取已夠。
- ❌ 兩個 Supabase 專案 + 自寫同步 — ops 太重，read replica 更省。
- ❌ 為快取改 `waste`/`news` 陣列參數 RPC — 不常打，留 POST。
- ❌ 動 PMTiles 扁平檔名契約結構 — 加 hash 是可選優化。
- ❌ 重寫 collector buffer 機制 — 只加 backoff。

---

## master / staging 環境

接下來要動 DB 連線 / 快取 / timeout，**不該在正式環境試**。專案暫停中是設定的好時機。

**前端 / 程式碼**（馬上，0 成本）：
- Git `master`（正式）+ `staging`（測試）兩分支。
- Zeabur 兩個 deploy，`staging` 綁測試網址。
- 改動先上 staging → 過了才 merge master。

**資料庫**（搭配 5、6 項）：
- 用 Supabase Branching（Pro preview branch）或開免費 Micro 專案當 staging DB。
- ⚠️ 坑：staging 前端若連正式 Supabase，測試流量仍打正式廚房 → staging 最好配 staging DB 或錯開測試時間。

---

## ⏳ 待驗收清單（之後回來做）

### 第 3 項 — watchdog 自動重啟（staging 實測）
1. collector 部署到 **staging**，設 env `WATCHDOG_SELFTEST=true`。
2. 觀察：啟動 90s 後 log 出現 `🧪 WATCHDOG_SELFTEST：停止心跳…`；再 ~120s 後收到 Telegram「🔁 Watchdog 重啟進程」。
3. 看 **Zeabur dashboard**：容器是否重啟（uptime 歸零 / restart +1）。
4. ✅ 通過 = watchdog 全鏈成立；測完**移除 `WATCHDOG_SELFTEST` env**。
5. ❌ 沒重啟 = Zeabur 不重啟崩潰進程 → 改用外部 cron ping + API 重啟。

### 第 4 項 — Cloudflare 邊緣快取（網站解 suspend 後）
1. Cloudflare Cache Rules 應只剩**一條** `cache-static-assets`（Active）。
2. 無痕開站 → DevTools → Network → 點任一 `.pmtiles` / `.geojson`。
3. 看 Response Header `cf-cache-status`：第一次 `MISS`，**重整後 `HIT`** = 成功。
4. 一直 `DYNAMIC` = 規則沒對到（檢查 expression 路徑前綴）。

## 進度追蹤

- [x] 1. Collector 寫入 timeout（2026-06-24 完成：connect_timeout + statement_timeout + keepalive + 連線斷路器；breaker fail-fast 已驗證 <0.5ms）
- [x] 2. 開場流程不預載動態層（2026-06-24 完成：4 個動態 hook 加 `enabled` gate + App.tsx 接 layerVisibility；loadingSteps 只列開啟的源；tsc -b 通過；**待 browser 驗收**）
- [x] 3. Collector health check + watchdog（2026-06-24 完成 + 修正設計）
  - ⚠️ **重要發現**：Zeabur **不**用 Dockerfile HEALTHCHECK、也**不**在 runtime unhealthy 時重啟容器（它的 health check 只用於部署當下決定要不要切流量）。原本「/health 503 → 平台重啟」的設計在 Zeabur 上不成立。
  - ✅ **改用進程內自殺式 watchdog**：`health.start_watchdog()` daemon thread，主迴圈靜默 > `HEALTH_MAX_LOOP_SILENCE`(120s) → `os._exit(1)` → 容器崩潰 → **Zeabur 重啟崩潰進程**（通用行為，不依賴平台設定）+ Telegram 告警。
  - 保留：`/health` 端點（200/503，供手動檢視 / 外部 uptime ping）、healthcheck.py（本機 docker-compose 用）。
  - 本機已驗證：/health 200/503/down ✅、watchdog 心跳新鮮靜默 / 卡死 exit(1) ✅。
  - **待 staging 實測**：設 `WATCHDOG_SELFTEST=true` 部署 → 啟動 90s 後停心跳 → ~120s 後 watchdog 自殺 → 確認 Zeabur 重啟容器（uptime 歸零 + Telegram）。測完移除 env。
- [x] 4. 靜態資產邊緣快取（2026-06-24：查證 Cloudflare 預設不快取 .json/.geojson/.pmtiles → 元兇是缺 Cache Rule；已寫精確 Cache Rule 規格 + 可選 purge 腳本 `scripts/deploy/purge-cloudflare-cache.sh`。**待使用者在 Cloudflare dashboard 套 Cache Rule + 驗 CF-Cache-Status=HIT**）
- [x] 5A. 面板輪詢降載（2026-06-24：item 2 後發現 per-visit RPC 幾乎歸零，剩情報/監控面板開啟時的 30s 輪詢。已把輪詢→60s + intelLoaders TTL_FAST 25→55s / TTL_SLOW 55→115s，面板快照 DB 請求約砍半；純降載、零視覺/互動影響；tsc -b 通過）
- [ ] 5B/5C（**延後，看數據再決定**）：B = targeted 反代無參快照走 Cloudflare 邊緣（cross-user 減量）；C = read replica（讀寫隔離治本，要花錢）。兩者互補，等網站重開觀察連線池再選。
- [ ] 6. Read Replica（評估）
- [ ] staging 環境建置
