# Status

**最後更新**：2026-05-09（凌晨 - 上午 OSRM map-matching pipeline 跨 project 部署 + drain）
**分支**：`feat/historical-mode`（本機領先 origin **16 commits**；gis-platform 領先 **4 commits**；data-collectors 已 push 至 `d6ac15d`）

## 本次 session 完成

### 廢棄物 OSRM map-matching pipeline 上線

**新建 2 個 repo**（跨 project Bearer token gateway 架構）：
- `github.com/ianlkl11234s/osrm-taiwan` — OSRM service（Geofabrik Taiwan PBF + osrm-routed MLD），listen 8080
- `github.com/ianlkl11234s/osrm-proxy` — nginx:alpine Bearer token gateway，public domain `osrm-proxy-gis.zeabur.app`

**Zeabur 部署**：兩個 service 都在 `data-collectors-gomn` project（`agent_test` Tokyo dedicated server, 4 核 8 GB Akamai/Linode）
- osrm-taiwan: id `69fe0ec75aa21e4719e6a80c`
- osrm-proxy: id `69fe18685aa21e4719e6a9c9`
- collector 跑在 `data-collectors-ship-only` project 的 `service-6940282e03ed383c19b036f5`（IP 通政府 API 的那台）

**Supabase migrations**：
- 074: `realtime.waste_trails_matched_daily`（OSRM matched 整日 polyline + RPC + cron 04:18 cleanup）
- 075: `realtime.waste_match_attempts`（attempt marker 解 retry 死循環 + cron 04:20 cleanup）
- 兩 migration 用 psql idempotent 套用，cron job id 53 + 54 active

**data-collectors 改動**：
- 新增 `collectors/waste_match.py`（532 行，含 OSRM 呼叫 + Bearer Authorization + attempt marker）
- `config.py` +OSRM_URL / OSRM_TOKEN / WASTE_MATCH_* (7 條)
- registry.py 註冊 WasteMatchCollector
- 已 push 上 production，commit `d6ac15d` RUNNING

**Drain 結果**（凌晨完整 backfill 5/4-5/9）：
- 1,510 trip success match / 1,770 fail / **success rate 46%**
- fail 全部是 OSRM NoMatch（54%，停運點 GPS 集中型）— 「資料本質難 map-match」
- 5/4-5/8 各天 ~250-274 vehicles matched / ~400-528 rows / avg confidence 0.74
- 5/9 累積中（早高峰時段持續 match 新進 GPS）

### 中間踩坑（已寫進 INCIDENTS）

7 個坑：OSRM image distroless / Zeabur PREBUILT_V2 K8s service port 8080 / Cobra `${}` 雷 / 跨 project 內網不通 / retry 死循環 / empty commit 不 trigger redeploy / AWS Lightsail IP 被擋

## 本次 session commits

**mini-taiwan-pulse** — 9 個（feat/historical-mode 分支）
- `docs(waste-osrm)` plan 文件 §14 部署紀錄 + §15 多城市擴展計畫
- `memory: append INCIDENTS +7`（7 個坑）
- `memory: PRINCIPLES +5 條`（Zeabur 部署章節）
- `memory: PLAYBOOKS +PB-11 +PB-12`（部署 SOP + Bearer gateway pattern）
- `memory: GLOSSARY +OSRM/Zeabur 兩章節`（15 條術語）
- `memory: DATA_SCOPE +廢棄物區段`（時序+靜態+RPC+跨 repo）
- `memory: BACKLOG +5 (BL-9~13) +1 done`
- `memory: REFLECTIONS +1 篇`（含 9 條 next-time rules）
- `memory: rewrite STATUS`（本檔）

**gis-platform** — 1 個 commit（已加 074 + 075 兩個 migration）

**data-collectors** — 7 個 commit（已 push）
- `feat(waste_match)` 532 行 collector + Bearer header
- `fix(waste_match)` attempt marker 解 retry 死循環
- 數個 trivial commit triggering Zeabur redeploy（empty commit 不 trigger 教訓）

**新 private repo** — 2 個（已 push）
- `osrm-taiwan`：multi-stage Dockerfile（alpine 抓 PBF + osrm-backend preprocess）
- `osrm-proxy`：nginx:1.25-alpine + envsubst template + Bearer token

## 待用戶執行

- [ ] **mini-taiwan-pulse `git push origin feat/historical-mode`**（16 commits ahead）
- [ ] **gis-platform `git push origin master`**（4 commits ahead，含 074 + 075）
- [ ] **視覺驗證**：`npm run dev` → toggle 垃圾車 layer → timeline 拉到 5/8 早上 → 看車是否沿馬路走（matched 的 ~266 台）
- [ ] **早高峰 5/9 累積**：query DB 看 5/9 rows 是否大幅成長
- [ ] **規劃寫入 gis-wiki**：本 session 的領域知識（OSRM HMM 限制、垃圾車 trip 結構、stop-to-stop 候選）規劃在 wrap-up 後寫入 `topics/廢棄物/methods/`
- [ ] **評估 BL-12**：刪除 `data-collectors-ship-only-aws` Zeabur project（Lightsail Tokyo 機器，IP 被擋沒用，月費可省）

## 累計狀態快照

- **5 個 repo 連動**：mini-taiwan-pulse / gis-platform / data-collectors / osrm-taiwan / osrm-proxy
- **跨 3 個 Zeabur project**：data-collectors-gomn（OSRM）/ data-collectors-ship-only（collector）/ data-collectors-ship-only-aws（廢棄）
- **垃圾車 OSRM matched 資料**：5/4-5/9 共 6 天 / ~2,000 rows / ~1,100 vehicle-days / avg confidence 0.74
- **attempts 表**：3,280 嘗試紀錄，永久 filter 掉 NoMatch trip 避免 retry 死循環
- **OSRM service 月費 +**：osrm-taiwan（同 Akamai 機器既有容量）+ osrm-proxy（~50 MB nginx ~$1-2/月）
- 記憶系統：v2 9 檔 + SessionStart auto-load + /wrap-up，這次 session 7 個 atomic memory commit

## 下一步候選（[BACKLOG.md](BACKLOG.md)）

- **BL-9** 多城市擴展 OSRM map-matching（P2，先解決台南 → 改 1 個 env var；新北凍結式可能要先調 trip-gap 閾值）
- **BL-13** LegendPanel 加「沿路網」說明（P2，視覺改善）
- **BL-11** 評估 stop-to-stop OSRM /route 取代 HMM /match（P3，預期 success > 90%，要先解 stop_sequence 欄位）
- **BL-12** 刪除 ship-only-aws Zeabur project 省月費（P3）
- **BL-10** PBF 月更自動化 GitHub Actions（P3）

詳細：[DATA_SCOPE.md](DATA_SCOPE.md) / [BACKLOG.md](BACKLOG.md) / [REFLECTIONS.md](REFLECTIONS.md) / [`docs/research/waste-osrm-mapmatching-plan.md`](../../docs/research/waste-osrm-mapmatching-plan.md)
