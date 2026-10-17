# News Map Layer - 即時新聞地圖計畫

## 概述

在 Mini Taiwan Pulse 地圖上新增「新聞 Insight」圖層，自動抓取中央社 RSS 新聞，
透過 NER 辨識地點並 geocoding，在地圖上即時標記新聞發生位置。

---

## 系統架構

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (已有)                        │
│  React 19 + Mapbox GL + Three.js                        │
│  新增: NEWS 圖層 (marker + popup + sidebar)              │
└────────────────────┬────────────────────────────────────┘
                     │ fetch /api/news/latest
┌────────────────────▼────────────────────────────────────┐
│                 Backend (新增)                            │
│  可整合進 data-collectors (Flask) 或獨立 FastAPI 服務     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ RSS 抓取  │→│ NER/LLM  │→│ Geocoding │→ SQLite/JSON  │
│  │ (排程)    │  │ 地名辨識  │  │ 地址→座標 │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: PoC 驗證 (1-2 天)

**目標**: 用 Python 腳本跑通 RSS → NER → Geocoding 全流程

### 1.1 RSS 抓取
- 來源: 中央社 Feedburner
  - 地方: `https://feeds.feedburner.com/rsscna/local`
  - 社會: `https://feeds.feedburner.com/rsscna/social`
  - 生活: `https://feeds.feedburner.com/rsscna/lifehealth`
- 備用: RSSHub `/cna/:id`
- 抓取: `feedparser` 套件解析 RSS XML
- 輸出: 標題 + 摘要 + 連結 + 發布時間

### 1.2 地名辨識 (二選一)

#### 方案 A: Claude Haiku API (推薦)
- 用 Haiku 4.5 一次完成: 地名抽取 + 分類 + 摘要
- Prompt 範例:
  ```
  從以下新聞中抽取地點資訊，回傳 JSON:
  { locations: [{ name, type: "city"|"district"|"address"|"landmark", confidence }],
    summary: "一句話摘要",
    category: "社會"|"天災"|"交通"|"政治"|... }
  ```
- 優點: 精度高、不需額外模型、一次搞定多任務
- 缺點: 有 API 費用（但極低）

#### 方案 B: CKIP Transformers (離線)
- `pip install ckip-transformers`
- 用 NER 模型抽取 GPE + LOC 實體
- 優點: 免費、離線、無 API 依賴
- 缺點: GPL-3.0 授權、需 GPU 加速、只做 NER 不做摘要

### 1.3 Geocoding (三層 fallback)

```
地名 → ① 台灣縣市/鄉鎮靜態座標表 (最快，覆蓋粗粒度)
     → ② TGOS API (精確門牌，已有 taipei-gis-analytics 整合經驗)
     → ③ Nominatim / Mapbox Geocoding (fallback)
```

- 靜態座標表: 自建 JSON，涵蓋 22 縣市 + 368 鄉鎮市區 → 零成本、零延遲
- TGOS: 適合完整地址 → 免費
- Mapbox Geocoding: 專案已在用 Mapbox，每月 100,000 次免費

---

## Phase 2: 後端服務 (2-3 天)

**目標**: 建立定時抓取 + 儲存 + API 服務

### 2.1 整合位置選擇

| 方案 | 優點 | 缺點 |
|------|------|------|
| **整合進 data-collectors** | 統一管理、共用 S3/排程基礎設施 | Flask 專案，需配合既有架構 |
| **獨立 FastAPI 服務** | 乾淨隔離、可獨立部署 | 多一個服務要維運 |

建議: **整合進 data-collectors**，新增 `collectors/news.py`，保持一致性。

### 2.2 資料儲存

```python
# news_item schema
{
    "id": "cna_20260307_001",
    "title": "花蓮強震 多處道路坍方",
    "summary": "花蓮縣秀林鄉今日凌晨發生規模5.2地震...",
    "url": "https://www.cna.com.tw/news/...",
    "published_at": "2026-03-07T03:45:00+08:00",
    "category": "天災",
    "source": "cna",
    "locations": [
        {
            "name": "花蓮縣秀林鄉",
            "type": "district",
            "lat": 24.1167,
            "lng": 121.6000,
            "confidence": 0.95
        }
    ],
    "processed_at": "2026-03-07T03:50:00+08:00"
}
```

儲存方式: 與 data-collectors 一致用 **JSON 檔案 + S3 歸檔**
（未來量大再考慮 SQLite/PostgreSQL）

### 2.3 排程

- 每 15-30 分鐘抓取一次 RSS
- 以 `news_id` 去重，避免重複處理
- 每日歸檔至 S3

---

## Phase 3: 前端圖層 (2-3 天)

**目標**: 在地圖上顯示新聞點位

### 3.1 新增圖層定義

```
types/index.ts    → LayerVisibility 新增 newsEvents
hooks/            → 新增 useNewsData.ts
data/             → 新增 newsLoader.ts
components/       → LayerSidebar 新增 NEWS 區段
map/              → overlayRegistry 新增新聞圖層配置
```

### 3.2 UI 設計

- **Sidebar**: NEWS 區段，顯示新聞數量
- **地圖 Marker**: 依分類著色（天災=紅、交通=橙、社會=黃...）
- **Popup**: 點擊顯示標題 + 摘要 + 時間 + 連結
- **參數控制**: 時間範圍篩選（最近 1h / 6h / 24h / 3d）

### 3.3 資料載入

```typescript
// useNewsData.ts
const loadNews = async (hours: number = 24) => {
  const res = await fetch(`${API_BASE}/api/data/news/latest`);
  const data = await res.json();
  // 轉為 GeoJSON FeatureCollection
  return toGeoJSON(data);
};
```

---

## Phase 4: 優化與擴展 (持續)

- 新聞熱區 heatmap 圖層
- 新聞時間軸動畫
- 多來源: 自由時報、聯合新聞網、公視新聞
- 推播通知: 重大新聞即時彈窗
- 情感分析: 正面/負面/中性標記

---

## 費用分析

### 完全免費方案

| 組件 | 方案 | 費用 |
|------|------|------|
| RSS 來源 | 中央社 Feedburner | $0 |
| NER | CKIP Transformers | $0 (GPL-3.0) |
| Geocoding | 靜態座標表 + TGOS | $0 |
| 地圖渲染 | Mapbox (已有) | $0 (不增加 map loads) |
| 部署 | Zeabur (已有) | $0 (整合進 data-collectors) |
| **合計** | | **$0/月** |

### 推薦方案 (用 Claude API)

| 組件 | 方案 | 費用 |
|------|------|------|
| RSS 來源 | 中央社 Feedburner | $0 |
| NER + 摘要 | Claude Haiku 4.5 API | ~$2-5/月 |
| Geocoding | 靜態座標表 + TGOS + Mapbox fallback | $0 |
| 地圖渲染 | Mapbox (已有) | $0 |
| 部署 | Zeabur (已有) | $0 |
| **合計** | | **~$2-5/月** |

### 費用估算依據

```
中央社 RSS 每日約 50-100 篇新聞（地方+社會+生活）
→ 每篇約 500-1000 tokens input + 200 tokens output
→ 每日: 100 篇 × 1K input = 100K input tokens = $0.10
         100 篇 × 0.2K output = 20K output tokens = $0.10
→ 每月: ~$6 (未優化)
→ 用 Batch API (50% off): ~$3/月
→ 用 Prompt Caching: 可再降至 ~$2/月
```

### 各 Geocoding 服務免費額度對比

| 服務 | 免費額度 | 足夠處理 | 備註 |
|------|---------|---------|------|
| 靜態座標表 | 無限 | 100% 粗粒度 | 自建，22 縣市 + 368 鄉鎮 |
| TGOS | 未公開 (預計數千次/日) | 100% | 免費申請，已有整合經驗 |
| Mapbox Geocoding | 100,000 次/月 | 100% | 專案已在用 Mapbox |
| Nominatim 公開 | 2,500 次/日 | 100% | 需加 User-Agent |
| Google Geocoding | 10,000 次/月 | 100% | 需綁信用卡 |

**結論: Geocoding 對新聞場景完全免費**（每日最多 100 篇，任何免費方案都綽綽有餘）

---

## 技術風險與對策

| 風險 | 影響 | 對策 |
|------|------|------|
| RSS 只有標題+摘要，地名資訊不足 | NER 辨識率低 | 用 LLM 從標題+摘要推斷；或爬全文 |
| CKIP GPL-3.0 授權感染 | 商用風險 | 改用 Claude API 或 SpaCy |
| 中央社 RSS 中斷/改版 | 資料來源斷裂 | 多來源備援 (RSSHub, 其他媒體) |
| TGOS API 不穩定 | Geocoding 失敗 | 三層 fallback 策略 |
| 新聞地點辨識錯誤 | 標記位置不準 | confidence 閾值過濾 + 人工標記介面 |

---

## 建議執行順序

```
Week 1:
  [Phase 1] PoC 腳本 — 驗證 RSS→NER→Geocoding 管線
  確認: 辨識率、geocoding 成功率、資料品質

Week 2:
  [Phase 2] 後端服務 — 整合進 data-collectors
  確認: 排程穩定性、資料格式、API 端點

Week 3:
  [Phase 3] 前端圖層 — Mapbox marker + sidebar
  確認: 視覺效果、互動體驗、效能

持續:
  [Phase 4] 優化 — 多來源、heatmap、時間軸
```

---

## 既有資源可複用

| 資源 | 來源專案 | 複用方式 |
|------|---------|---------|
| TGOS 格式化工具 | taipei-gis-analytics `tgos_formatter.py` | 直接複製或抽為共用模組 |
| S3 上傳/下載 | data-collectors `storage/s3.py` | 直接使用 |
| Flask API 框架 | data-collectors `api/server.py` | 新增 news 端點 |
| 排程系統 | data-collectors `main.py` (schedule) | 新增 news 排程 |
| Mapbox 圖層系統 | mini-taiwan-pulse | 擴展既有 LayerVisibility |
