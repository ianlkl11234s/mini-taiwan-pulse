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

### Supabase 表（前端可直接查詢）
| Schema | 表 | 用途 | 資料狀態 |
|--------|-----|------|---------|
| realtime | temperature_grids | CWA 0.03° 溫度網格 | ~61 萬筆 (1 個月) |
| realtime | youbike_snapshots | YouBike 車位快照 | ~219 萬筆 (6 天) |
| spatial | h3_demographics | H3 人口/社經指標 | ~6.5 萬筆 (2025) |
| spatial | village_demographics_yearly | 村里歷年人口 | 需補 105-113 年 |
| reference | daily_schedules | 每日/固定時刻表 | TRA/THSR/捷運 |

### 仍使用本地/S3 的資料
- 鐵道軌道幾何（GeoJSON，靜態不變）
- H3 人口/社經（本地 JSON + S3 fallback）
- 溫度場（本地 JSON，待遷移）
- YouBike H3（本地 JSON，待遷移）
- 18+ 靜態 GeoJSON 圖層（機場/港口/燈塔/國道等）

## S3 Bucket
- **Base**: `https://migu-gis-data-collector.s3.ap-southeast-2.amazonaws.com`
- **Credentials**: `S3_ACCESS_KEY` / `S3_SECRET_KEY`（非 AWS CLI 預設）
- **Prefixes**: `flight-arc/`, `ship-data/`, `rail-data/`, `h3-data/`

## 關聯專案
| 專案 | 路徑 | 用途 |
|------|------|------|
| gis-platform | `../gis-platform` | Supabase 時空資料庫（migrations/） |
| pulse-api | `../pulse-api` | FastAPI+DuckDB（備援 API） |
| data-collectors | `../data-collectors` | 多源資料收集腳本 |
| mini-taipei-v3 | `../mini-taipei-v3` | 鐵道 Supabase 模式參考 |
