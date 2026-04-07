# 專案運作原則 — Mini Taiwan Pulse

## 技術棧
- **Frontend**: React 19 + TypeScript + Vite
- **Map**: Mapbox GL JS v3
- **3D**: Three.js (透過 Mapbox CustomLayer)
- **Data**: Supabase (`gis-platform` 專案)
- **Port**: 3721 (dev), 5174 (alt)

## TypeScript 驗證

```bash
npx tsc -b   # ✅ 用 project references
# ❌ 不要用 tsc --noEmit（行為不同，可能漏檢）
```

## Supabase 整合原則

### 資料來源切換
- `VITE_DATA_SOURCE=supabase` → 使用 Supabase RPC
- 否則使用 Pulse API（FastAPI + DuckDB 備援）

### Schema 分工
| Schema | 用途 | 範例表 |
|--------|-----|--------|
| `realtime` | 高頻時序 | `ship_positions`, `flight_positions`, `temperature_grids` |
| `reference` | 低頻參考 | `daily_schedules` (TRA/THSR/捷運時刻表) |
| `spatial` | 空間分析 | `h3_demographics`, `village_demographics_yearly` |
| `metadata` | 系統管理 | dataset catalog, collector status |

### RPC 慣例
- 高頻時序資料用 RPC 而非直接 PostgREST
- 例如 `get_ship_trails(target_date)` 在後端做 group by + string_agg，比前端組裝快 9x

## 時區處理（核心，學自 timezone bug）

### 前端
- Timeline 內部用 **真實 UTC unix epoch** 計算（不是台灣時間）
- `dayStartUnix(taiwan_date)` 轉成 `Date.UTC(...) - 8*3600`
- **絕不用 naive datetime 字串**

### 從 Supabase 讀資料
- RPC 回傳 `EXTRACT(EPOCH FROM collected_at)::bigint` → 真實 UTC unix
- 前端直接拿 epoch 比對 timeline `currentTime`，不做時區轉換

### 驗證
若懷疑時區問題：
```js
console.log(`now: ${Date.now()/1000}, sample: ${ship.path[0][3]}`)
// 兩值差距應該等於「最後寫入到現在」的真實秒數
```

## 渲染原則

### Three.js 場景
- 每個運具一個 Scene class（`ShipScene`, `FlightScene`, `RailScene`）
- 透過 `useThreeJsLayers` hook 統一管理 ref
- Mapbox CustomLayer (`map/customLayer.ts`) 橋接 Three.js
- 用 ref 而非 state 傳給 render callback（避免每幀 re-render）

### Timeline 慣例
- 「今天」預設從**現在時間**開始（不是午夜），避免空等無資料時段
- 過去日期從午夜開始
- 切換日期時自動偵測 + 觸發跨日載入

### 視覺化參數
- 用 `useTransportParams` hook 集中管理
- Slider / Toggle 直接綁 ref，避免 React re-render

## 部署

- **平台**: Zeabur
- **指令**: `git push` 後自動部署
- **同步更新提醒**：當改動 5 處關鍵檔案時記得同步：
  1. `vite.config.ts` (port)
  2. `Dockerfile`
  3. `nginx.conf`
  4. `zeabur.json`
  5. `package.json` scripts

## 資料來源依賴

| 資料 | 來源 | 備註 |
|------|------|------|
| Ship AIS | Supabase RPC `get_ship_trails` | 來自 [data-collectors](../../data-collectors) |
| Flight OpenSky | Supabase RPC `get_flight_trails` | 來自 [data-collectors](../../data-collectors) |
| Rail 時刻表 | Supabase `reference.daily_schedules` | 來自 [mini-taipei-v3](../../mini-taipei-v3) 匯出 |
| H3 demographics | 本地 JSON + S3 fallback | 靜態，由 [taipei-gis-analytics](../../taipei-gis-analytics) 產生 |
| 鐵道軌道幾何 | 本地 GeoJSON | 靜態 |

## Git 慣例

- Commit message 用繁體中文 + conventional commits prefix
- 重大修改說明 **問題 → 修正 → 影響範圍**
- TypeScript 跑過 `tsc -b` 才 commit

## 與 Claude 協作

- `CLAUDE.md` (專案根) 是「always-on」上下文
- `.claude/` (本資料夾) 是協作經驗、踩坑、原則
- 重大 bug 修完後請補一份 pitfall 文件到 `.claude/pitfalls/`
