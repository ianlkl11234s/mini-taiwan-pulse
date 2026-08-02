# 共機活動區圖層 + 情報群組改組（PL 系列）

> **2026-08-02 更新：本規劃已全數執行完畢，保留作為決策軌跡。**
> 實作結果與驗收見 [`../features/pla-activity/README.md`](../features/pla-activity/README.md)。
>
> §6 四項待決事項的拍板結果：
> 1. 群組名稱 → **情勢 Situation**
> 2. 資料範圍 → **先上 2026**（規劃時通過 116 天，實際上線時已提升到 152 天）
> 3. needs_review → **進表但以旗標區分**（兩支 RPC 預設排除，顯示時 popup 標「待核實」＋虛線）
> 4. 災害示警 → **暫不搬**
>
> 與規劃的差異：
> - 群組多了「軍事」子群（規劃只寫放進群組，未指定子群）
> - 表多了 `guided` / `edge_precision` / `red_recall` / `balloon_items` 四欄（向量化改進後才有的資訊）
> - 兩支 RPC 都多了 `p_include_review` 參數（因為第 3 項拍板為「進表」）
> - 實際 migration 編號為 **330**

> 2026-08-02 規劃 · 對應 BACKLOG `PT-0` Phase 5
> 上游：`taipei-gis-analytics/docs/topic-research/defense_pla/`（向量化方法與失敗紀錄）
> 資料現況：`live.pla_activity_daily` 729 天零缺日；航跡圖 588 天（2024-08 起）；
> 2026 年 181 天已完成向量化，守門通過 116 天（69.9%）

## 1. 目標

把國防部每日航跡示意圖向量化的「共機活動區」做成 pulse 的**依日期回放圖層**，
並把新聞所在的主題改組為可容納情報類圖層的群組。

## 2. 群組改組

現況：`layerCatalog.ts:1374` 主題「新聞 News」底下只有 1 個子群「事件」、1 個圖層 `newsEvents`。

**改法（範圍比想像小）**：theme title 無任何硬編碼複本，全部消費端從 `THEMES` derive，
改一行即可。但有 3 處**手寫雙語說明**不會自動跟著走，要一起改：

| 檔案 | 行 | 內容 |
|---|---|---|
| `src/components/sidebar/layerCatalog.ts` | 1374 | `title` 主標題（+ L1371 區塊註解） |
| `src/components/InfoModal.tsx` | 363 | `<SectionTitle>NEWS — {L ? "新聞" : "News"}` |
| `src/components/InfoModal.tsx` | 365-370 | 新聞事件說明卡 |
| `src/components/InfoModal.tsx` | 726-730 | 資料來源列表 |

**副作用（皆無害，但要知道）**
- 摺疊狀態以 `theme.title` 當 key（`IconRailSidebar.tsx:1158/1230/1273`、`LayerSidebar.tsx:195/225/245`），
  純 in-memory 無持久化 → 改名只重置當次 session
- `src/chat/tools/catalogTools.ts:34/93/97` 用 `t.title` 比對 → 對話說「新聞」可能查不到，
  必要時在 systemPrompt 補別名
- `WORLD_TAB_THEME_TITLES`（L419）只含「世界／全球氣候」，不搬進世界 tab 就不用動

**命名候選**：`即時消息 Live Feed` / `情勢 Situation` / `情報 Intel`。
考量此群組未來要收共機、災害警訊、衛星過境等**每日回顧型**而非秒級即時的內容，
「情勢 Situation」語意較準；待 owner 拍板。

## 3. 資料上線（後端）

### 3.1 新表 `spatial.pla_tracks`

```sql
report_date   DATE      NOT NULL,
shape_no      INT       NOT NULL,
geom          geometry(Polygon, 4326) NOT NULL,
shape_kind    TEXT      NOT NULL,   -- 'rect' 走廊 / 'poly' 不規則活動區
vertices      INT,
table_items   INT,                  -- 圖上表格項次數（守門用 ground truth）
needs_review  BOOLEAN   NOT NULL DEFAULT false,
chart_url     TEXT,                 -- 來源航跡圖
PRIMARY KEY (report_date, shape_no)
```
索引 `(report_date)`；RLS 比照 `live.*` 對 anon + authenticated 開 SELECT。

**只灌守門通過的日子**（2026 年 116 天）；`needs_review` 的先不進表，
避免把已知有問題的形狀當成正式資料。

### 3.2 RPC `get_pla_tracks_day(p_date DATE)`

回 `shape_no / geojson / shape_kind / vertices`，比照新聞 by-day RPC 慣例：
`LANGUAGE sql STABLE`、`SECURITY INVOKER`、`SET search_path`、`GRANT anon, authenticated`。

另需 `get_pla_track_dates()` 回有資料的日期清單（給時間軸標示，比照 `get_news_event_dates`）。

## 4. 前端圖層 `plaActivity`

### 4.1 範本選擇

**用 `src/hooks/useDisasterAlertLayer.ts` 當範本**（不是地震回放）。理由：
- 同為 Polygon + by-day，且已處理 LRU 快取 7 天、換日競態、style.load 重餵
- 地震回放刻意不掛全域 timeStore（走自己的 `earthquakeReplayClock`），語意不同

共機資料**無 intraday 變化**（一天一組形狀），所以只需 `subscribeDate`，
不需要 `subscribeThrottled` 切片 —— 比災害示警更單純。

### 4.2 接線清單（測試/型別會擋的 10 處）

| # | 檔案 | 動作 | 由誰強制 |
|---|---|---|---|
| 1 | `types/index.ts:811` | `LayerVisibility.plaActivity: boolean` | tsc |
| 2 | `types/index.ts:665` | `FeatureInfo.layerType` 加 `"plaActivity"` | tsc |
| 3 | `layerCatalog.ts` LAYER_COLORS | 加 `plaActivity` 色 | tsc TS2739 |
| 4 | `layerCatalog.ts` THEMES | 放進改名後的情報群組 | layerConsistency #1 |
| 5 | `IconRailSidebar.tsx:65` LAYER_ICONS | 加 icon（建議 `Plane`） | tsc |
| 6 | `useTransportParams.ts` | `getControls` case + state + `overlayParams` deps | layerConsistency #3 + overlayParamsDeps 測試 |
| 7 | `LegendPanel.tsx:206` LEGEND_REGISTRY | 走廊/活動區兩色圖例 | layerConsistency #4 |
| 8 | `upstreamRegistry.ts` | 加 entry（dataset id 需在 analytics catalog 找得到） | upstreamRegistry 測試 |
| 9 | `featureInfo/registry.tsx:131,349` | PANEL_REGISTRY + HEADER_LABELS | registry 測試 |
| 10 | `useMapInteraction.ts` | GIS_LAYERS 加 click 目標 | mapInteractionLayers 測試 |

另需新檔：`src/data/plaTracksLoader.ts`、`src/hooks/usePlaActivityLayer.ts`、
`src/components/featureInfo/` 內的 popup panel。

### 4.3 UX 四鐵則

| 鐵則 | 做法 |
|---|---|
| 透明度 | `fill-opacity` 基底 0.22 × slider（比照 `useRoadEventsLayer.ts:252`） |
| 圖例 | 兩類：走廊（藍）/ 不規則活動區（紫），與向量化輸出的 `shape_kind` 對應 |
| popup | 當日架次、逾越中線、共艦、公務船、進入空域、形狀類型、**回國防部原始通報連結** |
| 可選取 | fill + line 兩層都納入 click 目標 |

popup 的通報數值直接讀 `live.pla_activity_daily`（已有 729 天），
不需重複存進 `pla_tracks`。

### 4.4 誠實標註（必要）

圖層說明與 popup 都要標「**依國防部示意圖描繪之活動區域，非精確航跡**」。
官方來源本身即為示意圖，精度以其為上限。

## 5. 分期與驗收

| 期 | 內容 | 驗收 |
|---|---|---|
| A | migration 建表 + 2 支 RPC；灌 2026 年 116 天 | anon 實測 RPC；抽 3 天比對 GeoJSON |
| B | 群組改名（4 處） | `pnpm test` 綠；側欄與 InfoModal 目視 |
| C | 圖層本體（10 處接線 + 3 個新檔） | `npx tsc -b` + `pnpm test` 全綠 |
| D | 瀏覽器驗收 | 拉時間軸換日、popup、圖例、透明度 slider、All Off 後單獨開 |

## 6. 待決事項

1. **群組名稱**：即時消息 / 情勢 / 情報 —— 需 owner 拍板
2. **資料範圍**：先上 2026（181 天中通過 116 天），或先把 2024-08 起 588 天全跑完
   （建議先 2026 試水溫）
3. **needs_review 的 65 天**是否也灌進表但以旗標區分（可讓前端選擇顯示與否）
4. 是否同時把「災害示警」從「災害 Hazard」搬進新群組（會改變既有使用者習慣，建議暫不搬）
