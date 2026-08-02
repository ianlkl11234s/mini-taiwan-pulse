# PLA Activity（共機活動區）

> **Slug**：`pla-activity`
> **狀態**：✅ shipped（2026-08-02 A~D 期完成；資料先上 2026 年）
> **Owner**：migu
> **上線時分支**：`feat/pla-activity-layer`
> **相關 commits**：data-collectors PR #41 / gis-platform migration 326、327、**330** /
> taipei-gis-analytics `18a3abe`+`6e7fdda`（向量化）+`bcc3d54`（loader） / mini-taiwan-pulse 本 PR

## 一句話說明

國防部每日「臺海周邊海、空域活動示意圖」的紅色活動區 → 影像向量化成多邊形 →
`spatial.pla_tracks` → 前端依時間軸換日回放，popup 帶當日通報數值與國防部原圖連結。

⚠️ **依示意圖描繪之活動區域，非精確航跡**。官方來源本身即為示意圖，精度以其為上限；
圖層說明、popup、圖例三處都標明了，改動時不得移除。

## 圖層 / 元件

| 名稱 | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| plaActivity | fill + line（單一 source） | Supabase RPC `get_pla_tracks_day(p_date, p_include_review)` | ✅ |

兩類形狀依 `shape_kind` 分色：

| kind | 意義 | 色 |
|---|---|---|
| `rect` | 細長矩形活動走廊 | `#38bdf8` 藍 |
| `poly` | 大型不規則活動區（沿 ADIZ 邊界） | `#a855f7` 紫 |

未通過守門的形狀畫**虛線**且透明度減半，預設不顯示（參數「待核實」可開）。

## 關鍵檔案

### 前端（mini-taiwan-pulse）

- Loader：`src/data/plaTracksLoader.ts`（withLoading + cachedByKey；含 `PLA_KIND_COLORS/LABELS` SSOT）
- Hook：`src/hooks/usePlaActivityLayer.ts`（**只掛 `subscribeDate`**，見下方「為什麼不用 subscribeThrottled」）
- Popup：`src/components/featureInfo/eventPanels.tsx` → `PlaActivityPanel`
- Legend：`LegendPanel.tsx` → `PlaActivityLegend`
- 參數：`useTransportParams.ts` → `plaOpacity` / `plaShowReview`
- 群組：`layerCatalog.ts` 主題「情勢 Situation」→ 子群「軍事」

### 後端

- 表 + RPC：`gis-platform/migrations/330_pla_tracks.sql`
- 通報數值：`live.pla_activity_daily`（migration 326/327）＋ `data-collectors/collectors/pla_activity_daily.py`
- 向量化：`taipei-gis-analytics/scripts/pla_tracks/`
  （`shape_extract` 形狀 / `table_items` 表格項次判讀 / `build_geojson` 串接 / `load_tracks` 入庫）

## 資料現況（2026-08-02）

| 項目 | 數字 |
|---|---|
| 通報數值 | 730 天零缺日（2024-08-02 ~ 2026-08-01），架次覆蓋 100% |
| 已向量化 | 2026 年 181 天（可評估 178 天） |
| 守門通過 | 152 天（85.4%）→ 表內 144 天有形狀可畫 |
| 待審 | 26 天（其中 20 天有形狀入表、旗標為 true） |
| 表內總量 | 348 個形狀 / 164 天 / 43 個待審形狀 |

零形狀日有兩種，語意不同：整天只有空飄氣球（期望 0、通過）vs 一個形狀都沒抽出來（待審）。

## 設計決策

### 為什麼範本用 `useDisasterAlertLayer` 而不是地震回放

地震回放刻意不掛全域 `timeStore`（走自己的 `earthquakeReplayClock`），語意是「單一事件的動畫」。
共機是「按日回放」，與災害示警同構：LRU 快取 7 天、換日競態、style.load 重餵都能直接沿用。

### 為什麼只用 `subscribeDate`、不用 `subscribeThrottled`

共機資料**一天一組形狀、無 intraday 變化**。災害示警要 `subscribeThrottled` 是因為它得依
`currentTime` 過濾出當下 active 的示警；共機沒有這個維度，掛上去只是每 500ms 做白工。

### needs_review 為什麼進表而不是擋在門外

拍板為「進表但以旗標區分」：讓前端能選擇顯示與否，但**兩支 RPC 預設排除**，
且顯示時 popup 必標「待核實」、線條改虛線。好處是待審資料仍看得到、可人工複核，
壞處是任何新的消費端如果忘了傳 `p_include_review` 就只會拿到已核實的 —— 這是刻意的預設安全。

## 驗收（2026-08-02，localhost:3721）

- `npx tsc -b` 綠、`pnpm test` 237 passed
- All Off → 單獨開 plaActivity → 7/30 渲染 4 個形狀（1 紫 13 頂點 + 3 藍），與國防部原圖一致
- popup：活動走廊 #2 / 27 架次 / 逾越中線 22 / 共艦 9 / 公務船 2 / 原圖連結 / 誠實標註
- 圖例：走廊、活動區、待核實（虛線）三項 + 標註
- 透明度 slider：`fill-opacity` 乘數 1 → 0.35、`line-opacity` → 0.3325
- 待核實 toggle：7/22 由 0 個形狀 → 2 個（皆 `needs_review=1`）
