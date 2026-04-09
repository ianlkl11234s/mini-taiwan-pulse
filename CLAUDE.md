# Mini Taiwan Pulse — 專案指引

## 技術棧
- React 19 + TypeScript + Vite (port 3721)
- Mapbox GL JS + Three.js (3D 視覺化)
- Supabase (gis-platform) 作為主要資料庫

## TypeScript 驗證
```bash
npx tsc -b   # 使用 project references，不要用 tsc --noEmit
```

## Supabase 連線
- **專案**: gis-platform (`utcmcikhvxnohbxchbrs`)
- **Schema**: `realtime`（高頻時序）、`reference`（低頻參考）、`spatial`（空間分析）、`metadata`（系統管理）
- **環境變數**: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（前端用），`SUPABASE_SERVICE_ROLE_KEY`（腳本用）
- **Data source 開關**: `VITE_DATA_SOURCE=supabase`（啟用 Supabase，否則用 Pulse API）

### 已遷移的資料流（Supabase 為主）
| 資料 | RPC / 表 | 前端 Hook |
|------|---------|-----------|
| 船舶 AIS | `get_ship_trails(target_date)` | useShipData |
| 航班 OpenSky | `get_flight_trails(target_date)` | useAirspaceData |
| TRA/THSR 時刻表 | `reference.daily_schedules` (PostgREST) | useRailData |
| 捷運時刻表 | `reference.daily_schedules` (*_fixed) | useRailData |
| CWA 溫度網格 | `get_temperature_dates/grid_info/frames` | temperatureLoader |
| YouBike H3 聚合 | `get_youbike_h3_dates/snapshots` | youbikeH3Loader |
| H3 歷年人口 | `get_h3_demographics_years/yearly` | h3Loader |
| 國道壅塞 | `get_freeway_dates` / `get_freeway_congestion_day(target_date)` | useFreewayLayer |

### Supabase 表（前端可直接查詢）
| Schema | 表 | 用途 | 資料狀態 |
|--------|-----|------|---------|
| realtime | temperature_grids | CWA 0.03° 溫度網格 | ~61 萬筆 (1 個月) |
| realtime | youbike_snapshots | YouBike 車位快照 | ~219 萬筆 (6 天) |
| spatial | h3_demographics | H3 人口/社經指標 | ~6.5 萬筆 (2025) |
| spatial | village_demographics_yearly | 村里歷年人口 | 需補 105-113 年 |
| reference | daily_schedules | 每日/固定時刻表 | TRA/THSR/捷運 |

### 仍使用本地的靜態資料
- 鐵道軌道幾何（rail_bundle.json，53MB，靜態不變）
- H3 單期快照（h3_population/demographics/socioeconomic/spatial_economy_*.json，無對應 RPC）
- 18+ 靜態 GeoJSON 圖層（機場/港口/燈塔/國道等）

## S3 Bucket
- **Base**: `https://migu-gis-data-collector.s3.ap-southeast-2.amazonaws.com`
- **Credentials**: `S3_ACCESS_KEY` / `S3_SECRET_KEY`（非 AWS CLI 預設）
- **Prefixes**: `flight-arc/`, `ship-data/`, `rail-data/`, `h3-data/`

## 資料收集（data-collectors）
- **部署**: Zeabur，24/7 執行
- **Ship AIS**: 每 10 分鐘，來源：航港局 API → `realtime.ship_positions`
- **Flight OpenSky**: 每 5 分鐘，來源：OpenSky Network → `realtime.flight_positions`
- **正常量**: ship ~800K records/day, flight ~34K records/day
- **Materialized Views**: `mv_ship_dates` / `mv_flight_dates`（每 30 分鐘更新，用於日期清單）
- **分區管理**: `realtime.manage_all_partitions()` 每日 00:05 台灣，預建 7 天 + 清理 30 天前
- **防護**: BEFORE INSERT trigger `auto_create_partition()` 自動建缺失分區

### 已知問題：資料斷層 + 歷史時區 bug（2026-04-07 修復）
- Zeabur 可能無預警重啟，導致資料斷層（如 2026-04-04 08:00 ~ 04-06 21:00 無資料）
- 前端在無資料時段會顯示 0 ships/flights（非時區 bug，是真的沒資料）
- Timeline 已改為「今天從當前時間開始」避免從午夜空等

### ⚠️ 歷史時區 bug 修復記錄（2026-04-07）
- **Bug**: `data-collectors/collectors/base.py` 用 `datetime.now()` 產生 naive 台灣時間，
  PostgreSQL UTC session 當 UTC 解讀，所有 `collected_at` 偏移 +8h
- **修復**: 改用 `datetime.now(TAIPEI_TZ)` (timezone-aware)
- **資料修復**: 從 S3 archive 全量回填 3/9 ~ 4/6 (29 天)，TRUNCATE 後重建
- **回填腳本**: `data-collectors/scripts/backfill_ship_flight.py`
  - ship `_fetch_time` 是台灣時間 → 加 `+08:00`
  - flight `fetch_time` 是 UTC → 加 `+00:00`

### 診斷指令（Supabase PostgREST）
```bash
# 查看船舶可用日期（快速確認斷層）
curl -s "$SUPABASE_URL/rest/v1/rpc/get_ship_dates" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" | python3 -m json.tool

# 查某日最早紀錄
curl -s "$SUPABASE_URL/rest/v1/ship_positions?select=collected_at&collected_at=gte.2026-04-06T00:00:00%2B08:00&order=collected_at.asc&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## 關聯專案
| 專案 | 路徑 | 用途 |
|------|------|------|
| gis-platform | `../gis-platform` | Supabase 時空資料庫（migrations/） |
| pulse-api | `../pulse-api` | FastAPI+DuckDB（備援 API） |
| data-collectors | `../data-collectors` | 多源資料收集腳本 |
| mini-taipei-v3 | `../mini-taipei-v3` | 鐵道 Supabase 模式參考 |
