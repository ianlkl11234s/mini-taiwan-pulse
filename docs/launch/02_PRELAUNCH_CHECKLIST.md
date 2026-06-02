# 上線前 Go / No-Go Checklist

> 三大門檻：**Supabase 穩定 / 費用可控 / 資安**。每項標：✅ 已驗證 ｜ 🟡 待你拍板或執行 ｜ 🔴 blocker。
> 全綠才對外開放。本檔對應 `01_DATA_SOURCE_AUDIT.md` 的證據。

## A. 功能正確性（明早 layer 與本地一致）

- [x] ✅ `npx tsc -b` exit 0
- [x] ✅ WIP code review 無 blocker、無既有 layer 回歸（LayerSidebar -280 為純搬移）
- [x] ✅ fire / road events / water 部署鏈三清單齊全
- [x] ✅ **GAP-1**：agriculture 10 檔 upload+pull+nginx 接好，已上傳 S3，本地 docker 實測 200/206
- [x] ✅ **GAP-2/GAP-3**：nginx `/geo /h3 /bus` 加 `@dist` fallback，本地實測 git 小檔即使 volume 空也 200
- [x] ✅ **/data entrypoint**：改背景 pull，nginx 立即啟動（本地實測秒起，不阻塞）
- [x] ✅ **本地 docker build + 全鏈路 smoke test 通過**（git archive 忠實重現 Zeabur）。抓並修了 4 個會炸的雷：
      ① package-lock 未同步（npm ci 會掛）② fire sync 遞迴誤抓 agriculture pmtiles ③ entrypoint 阻塞 pull ④ bus 3 大檔從未上 S3
- [ ] 🟡 部署後逐層 smoke test（All Off → 逐一開，對照本地）— 線上最終確認

## B. Supabase 穩定

- [x] ✅ 81 個 public RPC anon 全可 EXECUTE（DB 實測）
- [x] ✅ 大 payload RPC 有 statement_timeout（ship/flight/imagery/freeway/youbike/road/waste）
- [x] ✅ 高量 RPC 已套 pre-aggregate / hourly DISTINCT ON / JSONB grouped
- [x] ✅ realtime schema 未對 anon 曝光（459 表打不到）
- [x] ✅ 31 cron job 分鐘錯峰
- [x] ✅ **`get_bus_trails` timeout 已是 60s**（live DB 實測；migration 033 已覆蓋舊版 030 的 0）。實測單城 22ms / 全城 35ms，零風險
- [ ] 🟡 部署後觀察 Supabase Dashboard：connection pool、CPU、slow query

## C. 費用可控

- [ ] 🔴 **確認 Zeabur 帳務**：credit $0.00 / DEVELOPER plan → volume 容量、egress、build 分鐘是否在預算內
- [ ] 🟡 **agriculture 380MB 是否納入**（影響 S3 egress + volume + 首次載入）
- [ ] 🟡 anon 直讀曝光靜態表 → egress 被刷風險（見 D）；建議加 rate-limit
- [ ] 🟡 Mapbox token 用量上限 / domain 白名單（避免被盜用刷量）
- [x] ✅ busLive/waste 有 dedupRpc + poll 節流（不會 per-frame 狂打）

## D. 資安

- [x] ✅ `.env` 未洩漏進 git（`.gitignore` 已涵蓋，git 史無敏感值）
- [x] ✅ 前端無誤用 service_role key（只在後端 Python 腳本）
- [x] ✅ 前端全走 public RPC（唯一 `.from()` = earthquake_events，public）
- [x] ✅ 無 SECURITY DEFINER + anon + 無 search_path 的高危組合（AQI RPC 有設 search_path）
- [ ] 🟡 **收斂 anon 對 reference/spatial/fire/maritime/rail/safety 的 table 直讀**（撤授權或縮 exposed schemas，撤完 smoke test）— 你拍板
- [ ] 🟡 **Key 處理（你指定留早上）**：Mapbox / S3 / Gemini / FR24 / Supabase 是否輪換；Zeabur runtime 用**最小權限 S3 key**（只讀 deploy-assets prefix）
- [ ] 🟡 commit 前補 `.gitignore`：排除 `public/fire/*.pmtiles`、`demographics-*.png`、`.pingtung_geocode_cache.json`

## E. 部署機制

- [x] ✅ Zeabur 已登入（鄭敏弘 / DEVELOPER）
- [x] ✅ backup tags + stash 安全網就緒
- [ ] 🟡 Zeabur 設 runtime env：`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_REGION`/`S3_BUCKET`、build arg `VITE_MAPBOX_TOKEN`、`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_DATA_SOURCE=supabase`
- [ ] 🟡 確認 `/data` volume 已掛載且容量足夠（agriculture 納入則需 >~1GB）
- [ ] 🟡 merge → push → 部署 master → 容器內 pull → smoke test → 開放

---

## Go 判定
全部 🔴 清除 + 三門檻 🟡 都有明確處置（修掉或你接受風險）→ **Go**。
任一 🔴 未解 → **No-Go**，可先部署「不含該層」的縮減版（例：暫不納 agriculture）。
