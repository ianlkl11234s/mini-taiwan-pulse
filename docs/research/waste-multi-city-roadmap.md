# 全臺垃圾清運多城擴展 — 進度表

> 最新更新：2026-05-10
> **核心 framing 修正**：用戶 5/3-5/8 在 taipei-gis-analytics 已完成 hwms 爬蟲 + TGOS 批次 + Schema migrations。剩 TGOS 上傳 + callback + 視覺化
> 對應規劃：[`waste-multi-city-survey.md`](./waste-multi-city-survey.md) / [`waste-multi-city-progress.md`](./waste-multi-city-progress.md)

---

## TL;DR — 重排成 2-3 週（Phase 3 prototype 提前）

```
Track A: TGOS 流程（user / taipei-gis-analytics）
  ✅ day_001+002 已上傳完拿到結果（5/10 16:36）
  ⏳ user 持續上傳 day_003-007
  🔴 寫 12_unified_callback.py（含 TWD97 → WGS84）
  → 全 22 縣市 stops 灌進 DB

Track B: mini-taiwan-pulse（next session）
  Week 1: Phase 3 prototype（5 城時刻表動畫）  ← 先做（不卡 TGOS）
  Week 2: 接台中 GPS + 新北 OSRM
  Week 3: 等 callback 完 → Phase 2 OSRM 擴展（22 城）
```

**為何 Phase 3 prototype 提前**：5/10 驗證 5 城 77K stops 已 100% 完整（時刻表 + 星期 + 路線都齊），Phase 3 prototype 不必等 TGOS callback。

比上版 (5-7 週) 縮短到 2-3 週 — 因為 hwms + TGOS 批次 + schema + 5 城資料都已 ready。

---

## Phase 1 — 資料層收尾（兩 track 並行）

**目標**：TGOS callback 跑完讓 22 縣市 stops/routes 全進 DB + 台中 GPS 上線

### Track A — TGOS 流程（user 端，taipei-gis-analytics）

| # | Task | 工程量 | 誰 | DoD |
|---|---|---|---|---|
| 1A.1 | 上傳 day_001 到 TGOS | 5 min × 7 天 | user | TGOS 確認收件 |
| 1A.2 | 等結果、下載到 result/ | 數小時 - 1 天 | TGOS server | result/ 有 day_NNN_*.csv 含經緯 |
| 1A.3 | 寫 12_unified_callback.py | 0.5-1 天 | user 或我 | 合併三源 + 灌 DB 跑通 |
| 1A.4 | 7 天結果都收齊後執行 callback | 0.5 天 | user | DB stops 從 77K → ~385K |

### Track B — Mini Taiwan Pulse 收尾（我做，並行不卡 Track A）

| # | Task | 工程量 | DoD |
|---|---|---|---|
| 1B.1 | 接台中 GPS collector | 0.5-1 天 | DB 有 city='臺中市' GPS、24h > 100 vehicles |
| 1B.2 | 新北 / 台南 OSRM 收尾（BL-9 partial → done） | 0.5 天 | 連 3 天 success rate 穩、寫 retro |
| 1B.3 | 查 BL-14 高雄 5/9 落差 | 0.5 天 | 結論寫進 INCIDENTS（daily variance 還是 trip-gap 副作用）|

**Phase 1 結束 deliverable**：

- DB 內 22 縣市 stops + routes 齊
- 4 城（新北 / 台中 / 台南 / 高雄）GPS 持續進
- BL-9 / BL-14 收尾

---

## Phase 2 — OSRM 擴展 + UI 基礎建設

**目標**：4 GPS 城都能 OSRM matching、前端能切換 city

**依賴**：Phase 1 callback 跑完（stops 進 DB）+ Phase 1B.1（台中 GPS）

| # | Task | 工程量 | DoD |
|---|---|---|---|
| 2.1 | 台中 GPS 接 OSRM map-matching | 0.5 天 | success rate ≥ 30% / trip-gap 視採樣調 |
| 2.2 | 新北 GPS 接 OSRM map-matching | 0.5 天 | success rate ≥ 60%（採樣 2 min 跟高雄同） |
| 2.3 | 前端 City 切換 UI（BL-16） | 1-2 天 | 仿 BusGroup pattern；4 GPS 城獨立 toggle |
| 2.4 | LegendPanel 加「matched vs fallback」說明（BL-13） | 0.5 天 | 圖例對應視覺 |

**Phase 2 結束 deliverable**：4 GPS 城都能在地圖上看到車沿路網跑、可獨立 toggle。

---

## Phase 3 — 時刻表視覺化（捷運式動畫）

**目標**：22 縣市都看得到「車按時刻表跑」的動畫

**依賴**：Phase 1 callback 跑完（hwms 時刻表 + 經緯都進 DB）

### 3.0 Design 決策（先決定）

| 議題 | 選項 A | 選項 B | 選項 C |
|---|---|---|---|
| 視覺呈現 | 「車到 X 站」靜態 marker | 動畫車按表跑（捷運式）| 路線整段 pulse |
| 時間驅動 | 跟 timeline 連動 | 跟 wall clock 連動 | 兩種 toggle |
| GPS 城處理 | GPS + 表定疊加（誤差視覺） | GPS 完全取代表定 | toggle 切換 |

**建議**：B + 跟 timeline 連動 + A（GPS + 表定疊加，給誤差分析鋪路）

### 3.1 - 3.5 Sub-tasks

| # | Task | 工程量 | DoD |
|---|---|---|---|
| 3.1 | OSRM /route 預先算每段 stop A → B polyline | 1-2 天 | 新表 `realtime.waste_routes_modeled` 含 segment polyline |
| 3.2 | 前端「時刻表車輛」3D scene（仿 WasteTruckScene） | 2-3 天 | timeline 推進時車按表跑 |
| 3.3 | 22 縣市 toggle 整合 City 切換 UI | 0.5 天 | UI 顯示「表定 + GPS 兩源」 |
| 3.4 | 視覺驗證 + 跨日測試 | 1 天 | 7 天反覆驗證、車不亂跳 |

**Phase 3 結束 deliverable**：22 縣市都能切到看見「捷運式」動畫，4 GPS 城疊加實際位置看誤差。

---

## Phase 4 — 長期優化（先排程，不馬上做）

| # | Task | 預期效果 | 備註 |
|---|---|---|---|
| 4.1 | 時刻表 vs GPS 誤差分析 | 找出常誤點路線、「車今天會準時嗎」終端 demo | user 提的方向 3-c |
| 4.2 | BL-11 OSRM stop-to-stop /route 取代 HMM /match | 採樣稀疏城 success > 90% | 對台南 / 台中特別有用 |
| 4.3 | BL-15 ETL UNIQUE constraint | 每天少寫 50K dup row | hygiene |
| 4.4 | BL-10 PBF 月更自動化 GitHub Actions | 維運省人力 | nice-to-have |
| 4.5 | hwms 月更 cron（避免靜態資料漂移） | 站點增刪自動同步 | hwms 偶爾更新 |

---

## 任務依賴圖

```
                    [Track A: TGOS 上傳 7 天]
                              ↓
                    [12_unified_callback.py]
                              ↓
                    [stops 從 77K → 385K]
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
   Phase 2.1               Phase 2.3              Phase 3.1
  (台中 OSRM)             (City UI)         (OSRM /route 預算)
        ↑                                          ↓
   [Track B: 1B.1 台中 GPS]                  Phase 3.2-3.4
                                          (時刻表動畫 + 視覺)
```

Track A + Track B 並行，互不阻塞。Phase 2/3 都依賴 Phase 1 完成。

---

## 預估時間線

### 積極節奏（全職投入）

```
Week 1: Track A (TGOS 上傳 day_001-003) + Track B (台中 GPS + OSRM 收尾)
Week 2: Track A (TGOS 上傳 day_004-007 + callback 寫) + Phase 2.1-2.2
Week 3: Track A 完成 callback / Phase 2.3-2.4 + Phase 3.0 design 拍板
Week 4: Phase 3.1-3.4 完成
```

### 保守節奏（part-time）

時間 × 2-3。但 **TGOS 上傳是 user 端 7 天硬限制** — 不論積極保守，都要 7 天才收齊。

---

## 進度追蹤建議

```
1. .claude/memory/STATUS.md：每週末更新整體進度
2. .claude/memory/BACKLOG.md：發現新 sub-task 加進去
3. docs/research/waste-multi-city-progress.md：每完成一階段打勾
4. 每個 Phase 結束寫一篇 .claude/retrospectives/ 短回顧
```

---

## 待 user 拍板（Phase 進去前）

```
Q1. 12_unified_callback.py 你寫還是我寫？
    建議：你寫（你最熟悉 hwms + waste 既有 callback 邏輯）
    我可以 code review

Q2. Phase 3.0 視覺呈現決策（A/B/C）？
    建議：B + GPS 疊加表定（誤差分析鋪路）

Q3. 台中 GPS endpoint 已找到（見 handoff），可以開始接嗎？

Q4. TGOS 上傳節奏？
    建議：每天上傳 1 batch（10K 地址）、等隔天結果
    7 天循環在 5/17 結束、下週開始 callback
```
