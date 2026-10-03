# Session Analytics — 行為追蹤系統設計

> 記錄原子事件（raw atomic events），事後再拼貼分析。
> 不預聚合、不假設分析維度。

## 1. 動機

Mini Taiwan Pulse 有 102 個圖層、18 個分區，但零追蹤。需要回答：

1. **圖層熱門度** — 哪些圖層最常被打開？
2. **瀏覽行為** — 使用者怎麼看資料？（zoom 到哪、停多久）
3. **圖層共現** — 哪些圖層會被同時打開？開關順序是什麼？

## 2. 架構概覽

```
瀏覽器記憶體 buffer
  → visibilitychange / 定時 flush
  → Supabase analytics.session_events（1 row per flush）
```

- 每次造訪 ≈ 1~3 rows（每 150 秒 flush + 離開時一次）
- 100 人/天 ≈ 300 writes/天，IO 幾乎無感
- 不需要額外 server、不需要 GA

## 3. Supabase Schema

### 3a. Table

```sql
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE analytics.session_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  uuid        NOT NULL,
  site        text        NOT NULL DEFAULT 'mini-taiwan-pulse',
  flushed_at  timestamptz NOT NULL DEFAULT now(),
  event_count int         NOT NULL,
  payload     jsonb       NOT NULL,   -- [{type, ts, data}, ...]
  ua          text,                    -- navigator.userAgent
  screen      text                     -- e.g. "1920x1080"
);

CREATE INDEX idx_se_session ON analytics.session_events (session_id);
CREATE INDEX idx_se_flushed ON analytics.session_events (flushed_at);
CREATE INDEX idx_se_site    ON analytics.session_events (site);
```

### 3b. RPC（放 `public` schema，anon key 可 call）

```sql
CREATE OR REPLACE FUNCTION public.log_session_events(
  p_session_id  uuid,
  p_site        text,
  p_events      jsonb,
  p_event_count int,
  p_ua          text DEFAULT NULL,
  p_screen      text DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO analytics.session_events(session_id, site, event_count, payload, ua, screen)
  VALUES (p_session_id, p_site, p_event_count, p_events, p_ua, p_screen);
$$;
```

- SECURITY DEFINER：anon key 只能 call RPC，不能直接 SELECT/UPDATE analytics schema
- 無 RLS overhead，寫入路徑最短

## 4. 前端模組 `src/lib/sessionTracker.ts`

### 4a. Public API

```typescript
sessionTracker.init(site: string)
// 產生 session_id、記錄 ua/screen、綁定 visibilitychange + beforeunload

sessionTracker.log(type: string, data: Record<string, unknown>)
// 推入 buffer：{type, ts: Date.now(), data}

sessionTracker.logWithSnapshot(type: string, data: Record<string, unknown>, visibility: LayerVisibility)
// 同 log，但 data 額外附帶 layers: string[]（當前可見圖層 key 陣列）
```

### 4b. 內部機制

| 機制 | 說明 |
|------|------|
| Session ID | `crypto.randomUUID()`，每個 tab 一個 |
| Buffer | `Array<{type, ts, data}>`，純記憶體 |
| 圖層快照 | `LayerVisibility` 102 booleans → 只記 `true` 的 key 陣列（通常 < 10 個） |
| 環境開關 | 讀 `supabaseConfigured`，未設定時全部 no-op |

### 4c. Flush 策略

| 優先序 | 觸發條件 | 方式 |
|--------|---------|------|
| 1 | `visibilitychange` → hidden | `fetch` with `keepalive: true`（頁面關閉也能送出） |
| 2 | `beforeunload` | `fetch` with `keepalive: true`（兜底） |
| 3 | `setInterval` 每 150 秒 | `supabase.rpc()` 正常呼叫 |
| 4 | buffer 長度 > 200 | `supabase.rpc()` 立即 flush |

**注意**：`sendBeacon` + `Content-Type: application/json` 會觸發 CORS preflight 但 sendBeacon 不支援，改用 `fetch` with `keepalive: true`，效果相同且能帶 Authorization header。

## 5. 事件類型（6 種）

| 事件 | Payload | 說明 |
|------|---------|------|
| `session_start` | `{appMode, layers: string[]}` | App mount 時自動送 |
| `layer_toggle` | `{layer, on, layers: string[]}` | 圖層開/關 + 當前快照 |
| `all_off` | `{layers_before: string[]}` | 全部關閉前的快照 |
| `mode_switch` | `{from, to}` | realtime ↔ historical |
| `feature_click` | `{layerType}` | 點擊地圖上的物件 |
| `map_view` | `{zoom, lat, lng, pitch}` | 地圖視角變化（tracker 內部 5 秒 throttle） |

所有事件共享結構：`{type, ts: number, data: {...}}`，同 session 帶同一個 `session_id`。

## 6. 埋點位置（3 個檔案、6 個插入點）

### `src/App.tsx`（4 處）

| 函式 | 事件 | 插入內容 |
|------|------|---------|
| `handleMapReady` (~L720) | `session_start` | `sessionTracker.init('mini-taiwan-pulse')` |
| `handleLayerClick` (~L991) | `layer_toggle` | `sessionTracker.logWithSnapshot('layer_toggle', {layer, on: !isVisible}, layerVisibilityRef.current)` |
| `handleAllOff` (~L1017) | `all_off` | `sessionTracker.logWithSnapshot('all_off', {}, layerVisibilityRef.current)` |
| `setAppMode` 呼叫處 (~L414 區域) | `mode_switch` | `sessionTracker.log('mode_switch', {from: prev, to: next})` |

### `src/App.tsx` — map move（1 處）

| 函式 | 事件 | 說明 |
|------|------|------|
| `updateCamera` callback (~L724) | `map_view` | tracker 內部 throttle 5 秒，不影響既有 60fps move 回呼 |

### `src/hooks/useMapInteraction.ts`（1 處）

| 位置 | 事件 | 說明 |
|------|------|------|
| `setFeatureInfo()` 呼叫後 (~L224) | `feature_click` | 只記 `layerType`，不記 feature 屬性（省空間 + 隱私） |

## 7. 隱私

- **不存** user ID / email / IP / cookie
- `session_id` 是隨機 UUID，跨 session 不可關聯
- `ua` / `screen` 僅供裝置分布統計（可省略）
- 地圖座標是視角中心，不是使用者位置
- 可用 `VITE_ANALYTICS_ENABLED=false` 環境變數整個關掉

## 8. 多站擴展

`site` 欄位已預留。其他站（如 mini-cctv-tw）只需：

1. 複製 `sessionTracker.ts`（或未來抽成共用套件）
2. `sessionTracker.init('mini-cctv-tw')` 傳不同站名
3. 共用同一張 Supabase table，查詢時 `WHERE site = 'xxx'`

## 9. 查詢範例

### 圖層熱門度

```sql
SELECT e->'data'->>'layer' AS layer, count(*)
FROM analytics.session_events,
     jsonb_array_elements(payload) e
WHERE e->>'type' = 'layer_toggle'
  AND (e->'data'->>'on')::boolean = true
GROUP BY 1 ORDER BY 2 DESC;
```

### 圖層共現（哪些一起開）

```sql
WITH snapshots AS (
  SELECT session_id,
         jsonb_array_elements_text(e->'data'->'layers') AS layer
  FROM analytics.session_events,
       jsonb_array_elements(payload) e
  WHERE e->>'type' = 'layer_toggle'
)
SELECT a.layer AS layer_a, b.layer AS layer_b, count(DISTINCT a.session_id)
FROM snapshots a
JOIN snapshots b USING (session_id)
WHERE a.layer < b.layer
GROUP BY 1, 2 ORDER BY 3 DESC
LIMIT 20;
```

### Zoom 到高雄的人偏好哪些圖層

```sql
WITH kaohsiung_sessions AS (
  SELECT DISTINCT session_id
  FROM analytics.session_events,
       jsonb_array_elements(payload) e
  WHERE e->>'type' = 'map_view'
    AND (e->'data'->>'lat')::float BETWEEN 22.5 AND 23.0
    AND (e->'data'->>'zoom')::float > 10
)
SELECT e->'data'->>'layer' AS layer, count(*)
FROM analytics.session_events se
JOIN kaohsiung_sessions ks USING (session_id),
     jsonb_array_elements(se.payload) e
WHERE e->>'type' = 'layer_toggle'
  AND (e->'data'->>'on')::boolean = true
GROUP BY 1 ORDER BY 2 DESC;
```

### 每日活躍 session 數

```sql
SELECT flushed_at::date AS day, count(DISTINCT session_id)
FROM analytics.session_events
WHERE site = 'mini-taiwan-pulse'
GROUP BY 1 ORDER BY 1 DESC;
```

## 10. 檔案清單

| 動作 | 檔案 | 說明 |
|------|------|------|
| 新建 | `src/lib/sessionTracker.ts` | 核心模組 ~130 行 |
| 修改 | `src/App.tsx` | 4 處插入（init + layer_toggle + all_off + mode_switch）+ 1 處 map_view |
| 修改 | `src/hooks/useMapInteraction.ts` | 1 處插入（feature_click） |
| 新建 | gis-platform migration SQL | analytics schema + table + RPC |

## 11. 驗證步驟

1. `npx tsc -b` 通過
2. 開 dev server (`npm run dev`, port 3721)
3. 開 DevTools → Network tab
4. 操作：開關圖層、切模式、移動地圖、點擊 feature
5. 切換 tab（觸發 visibilitychange）→ 觀察 sendBeacon 請求發出
6. Supabase Studio → `analytics.session_events` 確認資料寫入
7. 跑 §9 查詢範例確認可正常分析
