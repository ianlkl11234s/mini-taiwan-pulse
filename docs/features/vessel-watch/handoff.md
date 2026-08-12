# Handoff — Vessel Watch

## 跨 repo 契約

| repo | 產出 | 狀態 |
|---|---|---|
| **gis-platform** | migrations 339 / 340 / 341 / 342 | ✅ applied to production |
| **data-collectors** | `scripts/backfill_vessel_watch.py`、`scripts/scan_vessel_registry.py` | ✅ 已驗證可跑（回補進行中） |
| **mini-taiwan-pulse** | `vesselWatch` 圖層 | ✅ 上線 |
| **taipei-gis-analytics** | — | 未涉及（無新 catalog dataset，沿用既有 `ship`） |
| **mini-taiwan-osint** | grayzone-incursion ledger G04 待回灌 | ⏸ VW-7 |

**collector 本體未改** —— sweep 走 DB 端 pg_cron，不碰熱寫入路徑，不必 Zeabur 重部署。

## 資料契約

### RPC（`public`，開放 anon）
| RPC | 參數 | 回傳 |
|---|---|---|
| `get_vessel_watch_current` | `p_max_age interval` = '24 hours' | 一船一列：mmsi, ship_name, vessel_class, flag, lat, lng, speed, heading, nav_status, destination, collected_at, imo, call_sign, length_m |
| `get_vessel_watch_trails` | `p_from`, `p_to` timestamptz | 一船一列，`trail` 為 JSONB `[[lat,lng,0,unix_ts],…]` |
| `get_vessel_watch_classes` | — | vessel_class, ship_count, active_24h |

⚠️ `get_vessel_watch_current` 的 `p_max_age` **不可省** —— 少了它會畫出停在數週前位置的幽靈船。

### 分類是 read-time 計算
`live.classify_vessel()` 是唯一真相。**改字典不需要 backfill**，全部歷史自動重新分類。
但 registry 的 `rule_class` 是快照，改函數後要跑一次 342 那種重算 UPDATE。

### 寫入端刻意比分類端寬
`live.is_watch_candidate()` 收得比 `classify_vessel()` 認得的多。
⚠️ **不要為了「乾淨」把寫入條件收緊** —— 被濾掉的 row 在母表 21 天後就永遠沒了，
誤收只花幾 MB，漏收不可逆。認不出的由人工在 registry 審。

## 上游依賴

- `live.ship_positions`（21 天分區表）— sweep 來源
- `live.ship_current`（sticky）— 名冊 seed 來源，⚠️ 不可當「現在在海上」的依據
- `s3://migu-gis-data-collector/ship_ais/{2026/,archives/}` — 歷史回補來源，欄位比 DB 豐富（imo / call_sign / 尺寸）
