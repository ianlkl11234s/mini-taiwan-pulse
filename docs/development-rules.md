# Mini Taiwan Pulse — 開發規則（詳細版）

> CLAUDE.md 是精簡版規則索引，本文件是完整 rationale + 範例。

## 1. 資料來源管理

### Supabase 為主，靜態檔為輔
- **動態時序資料**（船舶、航班、溫度、壅塞、地震、災害示警 等）→ Supabase RPC
- **靜態 GeoJSON**（機場、港口、燈塔、路網 等）→ `public/*.geojson`
- **大型預聚合 JSON**（H3、rail_bundle、station_pillars）→ `public/`（由 S3 deploy-assets 管理）

### Schema 分工
| Schema | 用途 | 前端可讀 |
|---|---|---|
| `realtime` | 高頻時序（ship/flight/freeway/temperature/disaster...） | ❌（要透過 public RPC） |
| `reference` | 低頻參考（daily_schedules, temperature_grid_cells） | ✅ 可 PostgREST 直讀 |
| `spatial` | 空間分析（boundaries, h3_demographics） | ✅ |
| `metadata` | 系統管理 | ❌ |
| `public` | 所有對前端開放的 RPC wrapper | ✅ |

**Rule**: 前端只用 `public.*` RPC 或 `reference.*` / `spatial.*` 直讀。不允許前端直接打 `realtime.*`。

### 環境變數
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`（前端）
- `SUPABASE_SERVICE_ROLE_KEY`（腳本，禁止進前端 bundle）
- `SUPABASE_DB_URL`（psql 直連，腳本用）

## 2. 資料載入規範（必配 Loading UI）

### 原則
**所有** 透過 Supabase 的非同步載入，使用者必須看到「正在載入什麼」。

### 觸發場景（必須有 loading）
- 初次載入（LoadingScreen）
- 切換 timeline 日期
- Toggle 圖層開關（若 layer 首次開啟會打 DB）
- 切換 layer 參數（若會重抓資料）

### 實作方式
使用 `src/lib/loadingRegistry.ts` + `src/hooks/useLoadingTasks.ts`：

```typescript
// Loader 端：開始 task
import { loadingRegistry } from "../lib/loadingRegistry";

export async function loadXxxData(date: string) {
  const taskId = loadingRegistry.start({
    id: `xxx-${date}`,
    label: `載入 XXX ${date}`,
    source: "xxx",
  });
  try {
    const { data, error } = await supabase.rpc("get_xxx", { target_date: date });
    if (error) throw error;
    return data;
  } finally {
    loadingRegistry.complete(taskId);
  }
}
```

```tsx
// Hook 端：React state + loading 自動綁定
export function useXxxLayer(date: string, enabled: boolean) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    loadXxxData(date).then(setData).catch(console.error);
  }, [date, enabled]);
  return data;
}
```

`LoadingIndicator` 會自動從 `loadingRegistry` 訂閱所有 task，顯示在右上角。

### 反例（禁止）
```typescript
// ❌ 靜默抓取
useEffect(() => {
  supabase.rpc("get_xxx").then(({ data }) => setData(data));
}, []);
```
→ 使用者看不到 loading，誤以為當機。

## 3. 資料庫優化（Pre-aggregate Pattern）

### 觸發條件
任何 RPC **任一** 條件成立就必須套 pattern：
- 響應時間 > 1 秒
- 回傳 > 10,000 rows
- 對分區表做 cross-partition 掃描
- 含 string_agg / ST_Union / 複雜 JOIN

### SOP
1. 先 `EXPLAIN (ANALYZE, BUFFERS) SELECT ...` 確認瓶頸
2. `ANALYZE` 更新統計看能不能改善 plan（可能就夠了）
3. 真需要預聚合 → 照 `docs/supabase-optimization.md` pattern
4. SQL 範本放 `../data-collectors/docs/sql/matview_xxx.sql`
5. 加進 `docs/supabase_rpc_audit.md` 追蹤

### 禁止
- ❌ 用 `MATERIALIZED VIEW`（一次 REFRESH 會撞 pooler 2min timeout）
- ❌ 前端自己做 N+1 query 拼資料
- ❌ 假設 Supabase pooler statement_timeout 可以繞過

## 4. 新增 Layer 流程（強制順序）

| 順序 | 檔案 | 動作 |
|---|---|---|
| 1 | `src/types/index.ts` | `LayerVisibility` interface 加 key |
| 2 | `src/data/xxxLoader.ts` | 寫 loader（loadingRegistry + Supabase RPC） |
| 3 | `src/hooks/useXxxLayer.ts` | React hook：state + 觸發 loader + cleanup |
| 4 | `src/map/overlayRegistry.ts` 或 `src/map/xxxCustomLayer.ts` | 靜態 → registry；動態 → CustomLayer |
| 5 | `src/components/LayerSidebar.tsx` | UI toggle + **`LAYER_COLORS` 加 key（⚠️ 漏了會 tsc error）** |
| 6 | `src/App.tsx` | 接線：引入 hook、傳 props 到 MapView |
| 7 | `src/hooks/useLayerVisibility.ts` | 加預設可見性 |

### 檢查清單
- [ ] `tsc -b` pass
- [ ] `LAYER_COLORS` 補齊（`Record<keyof LayerVisibility, string>` 編譯時會強制）
- [ ] Loader 有 loadingRegistry
- [ ] Toggle 開關有 loading 提示
- [ ] 無 DB 查詢時間 > 1s（否則套 pre-aggregate）

## 5. 命名慣例

| 角色 | 位置 | 命名 |
|---|---|---|
| Supabase fetcher | `src/data/` | `xxxLoader.ts`，export `loadXxxData()` |
| Layer React hook | `src/hooks/` | `useXxxLayer.ts`（新）；舊的 `useXxxData.ts` 漸進改名 |
| Mapbox overlay config | `src/map/overlayRegistry.ts` | 加一筆 `OverlayConfig` |
| Three.js scene | `src/three/` | `XxxScene.ts` |
| Custom WebGL layer | `src/map/` | `xxxCustomLayer.ts` |
| 靜態 GeoJSON | `public/` | `xxx.geojson`（扁平，S3 deploy-assets 契約） |
| 預處理腳本 | `scripts/preprocess/` | `preprocess-xxx.py` 或 `generate-xxx.py` |
| S3 上傳腳本 | `scripts/deploy/` | `upload-xxx-to-s3.ts` |
| 外部 API fetch | `scripts/fetch/` | `fetch-xxx.ts` / `.py` |
| 資料庫匯出 | `scripts/export/` | `export-xxx.py` |

## 6. TypeScript 驗證
```bash
npx tsc -b   # project references，不要用 tsc --noEmit
```
Commit 前必跑。

## 7. 部署 Checklist
見 CLAUDE.md 或 deploy-checklist memory。改 `public/*` 檔案要注意 S3 deploy-assets 契約（扁平檔名）。
