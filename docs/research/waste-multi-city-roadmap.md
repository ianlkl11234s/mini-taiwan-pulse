# 全臺垃圾清運多城擴展 — 進度表

> 寫於 2026-05-10
> 對應規劃：[`waste-multi-city-survey.md`](./waste-multi-city-survey.md)
> User 確認的 4 個方向：(1) 接台中 GPS、(2) 時刻表視覺化、(3) City 切換 UI、(4) TGOS 補強

---

## TL;DR — 5 Phase / 預估 5-7 週

```
Phase 1   資料層擴展（collector）        2 週   並行多 task
Phase 2   OSRM 擴展 + UI 基礎建設        1 週   依賴 Phase 1.1 + 1.2
Phase 3   時刻表視覺化                  1-2 週  依賴 Phase 1.2 完成
Phase 4   TGOS 補強                     等 TGOS 端進度  Phase 2/3 不必等
Phase 5   誤差分析 + 缺口 11 縣市        長期  另排
```

每 Phase 結束有 demo / commit point，不用 5 週後一次驗收。

---

## Phase 1 — 資料層擴展（collector）

**目標**：把 Tier 1 7 城資料全部進 DB，不依賴前端

**依賴**：無，可立即開始

**Sub-tasks**（並行）：

| # | Task | 工程量 | DoD（驗收條件） | 備註 |
|---|---|---|---|---|
| 1.1 | 寫 `collectors/waste_positions.py` 加台中 GPS | 0.5-1 天 | DB 有 city='臺中市' 的 GPS 進來、過去 24h > 100 vehicles | 仿 `_fetch_kaohsiung` pattern；endpoint 待找 |
| 1.2 | 寫 `collectors/waste_stops.py` 接 4 城靜態 stops/routes | 2-3 天 | DB `spatial.waste_collection_stops` 加台中/台南、`spatial.waste_collection_routes` 加台中/台南/台北/基隆/宜蘭 | 每城 endpoint 不同，要逐個寫 normalize；可分 sub-PR |
| 1.3 | TGOS 對接啟動（user 端） | 等外部 | TGOS 確認可協助範圍 | 並行 |
| 1.4 | 已有 GPS 城（新北 / 台南）OSRM map-matching 確認穩定 | 0.5 天 | BACKLOG BL-9 partial 收尾、撰寫成 note | 5/9 已完成 90%、待視覺驗收 |

**Phase 1 結束 deliverable**：
- DB 內 7 城都有 stops + routes（除非 endpoint 真的找不到）
- DB 內 4 城（含台中）有即時 GPS
- 1 個 commit + 1 份 update 到 survey.md

---

## Phase 2 — OSRM 擴展 + UI 基礎建設

**目標**：讓 4 GPS 城在地圖上都能「沿馬路走」+ 前端能切換

**依賴**：Phase 1.1（台中 GPS）+ 1.2（stops/routes）+ 5/9 高雄/台南 OSRM 已在線

**Sub-tasks**：

| # | Task | 工程量 | DoD | 備註 |
|---|---|---|---|---|
| 2.1 | 台中 GPS 接 OSRM map-matching | 0.5 天 | `WASTE_MATCH_CITIES` 加台中、attempt 表有台中、success rate ≥ 30% | trip-gap 可能要 1500-1800s（採樣 10 min） |
| 2.2 | 新北 GPS 接 OSRM map-matching | 0.5 天 | 同上、success rate ≥ 60% | 採樣 2 min 跟高雄一樣，trip-gap 600s 應足夠 |
| 2.3 | 前端 City 切換 UI（BL-16） | 1-2 天 | 仿 BusGroup pattern；至少 4 GPS 城可獨立 toggle；timeline 切換不破 | useWasteLayer.ts 已支援 cities 陣列、純 UI 工程 |
| 2.4 | LegendPanel 加「沿路網 vs 直線」說明（BL-13） | 0.5 天 | 圖例對應到實際 render 視覺 | 跟 2.3 並行 |
| 2.5 | 台南 success rate 持續觀察（BL-9 收尾） | 0.5 天 | 連 3 天 success > 30%、寫進 INCIDENTS / REFLECTIONS | 等資料累積、不卡關 |

**Phase 2 結束 deliverable**：
- 地圖上看到 4 GPS 城車輛沿馬路跑、可獨立 toggle
- success rate baseline 對 4 城都建立
- 1-2 個 PR

---

## Phase 3 — 時刻表視覺化

**目標**：把 Tier 1 7 城的「停運點 + 表定時間」變成視覺化（含無 GPS 的台北 / 基隆 / 宜蘭）

**依賴**：Phase 1.2 完成（4 城 stops/routes 進 DB）

**這 phase 是新功能，要先 design decision**

### 3.0 Design 決策（一週內定）

| 議題 | 選項 A | 選項 B | 選項 C |
|---|---|---|---|
| 視覺呈現 | 「預期車已到 X 站」靜態 marker | 動畫車按表跑（火車式） | 路線整段標色（pulse 動畫） |
| 時間驅動 | 跟 timeline 連動 | 跟 wall clock 連動 | 兩種模式切換 |
| GPS 城處理 | GPS + 表定疊加（誤差視覺） | GPS 完全取代表定 | toggle 切換 |

**建議**：B + 跟 timeline 連動 + A（GPS + 表定疊加，給誤差分析鋪路）。但要 user 拍板。

### 3.1 - 3.5 Sub-tasks（依 design 決策後展開）

| # | Task | 工程量 | DoD |
|---|---|---|---|
| 3.1 | OSRM /route 從 stop A 到 stop B 預先算 polyline | 1-2 天 | DB 有 `realtime.waste_routes_modeled`（路線模擬）表 |
| 3.2 | 前端「時刻表車輛」3D scene（仿 WasteTruckScene） | 2-3 天 | timeline 推進時車按表跑 |
| 3.3 | 7 城 toggle 整合進 City 切換 UI | 0.5 天 | UI 顯示「表定 + GPS 兩源」 |
| 3.4 | LegendPanel 加「表定 / GPS 即時」區分 | 0.5 天 | 視覺一目了然 |
| 3.5 | 跨日 / 多週反覆驗證 | 1 天 | 跨日切換不卡、車不亂跳 |

**Phase 3 結束 deliverable**：
- 7 城都能看到「車按表在跑」
- 4 GPS 城能比較「表定 vs 實際」差距（為 Phase 5 鋪路）

---

## Phase 4 — TGOS 補強

**目標**：把 4 縣市（雲林 / 嘉義市 / 新竹市 / 澎湖）門牌轉經緯後接入

**依賴**：等 TGOS 端回覆 + Phase 1-3 進行中可並行

**Sub-tasks**：

| # | Task | 工程量 | DoD | 備註 |
|---|---|---|---|---|
| 4.1 | TGOS 跟外部接洽 + 取得處理後資料 | user 端 | 收到 4 城地址 → 經緯對照表 | 並行 |
| 4.2 | 用 tgos-batch-geocoding skill 整理結果 | 0.5 天 | 4 城資料進 `spatial.waste_collection_stops` | skill 已存在 |
| 4.3 | 接 4 城靜態時刻表 collector | 1-2 天 | DB 有 4 城 stops + weekday | 仿 Phase 1.2 pattern |
| 4.4 | 4 城 toggle 整合進前端 | 0.5 天 | UI 顯示 4 城 | 仿 Phase 2.3 pattern |

**Phase 4 結束 deliverable**：
- Tier 2 4 城上線、總共 11 城在地圖上

---

## Phase 5 — 長期（先排程，不馬上做）

| # | Task | 預期效果 | 備註 |
|---|---|---|---|
| 5.1 | 時刻表 vs GPS 誤差分析 | 找出常誤點路線、「車今天會準時嗎」終端 demo | 你提到的方向 3-c |
| 5.2 | 缺口 11 縣市逐個爬 | 全臺覆蓋 | 工程量大、每縣市分次評估 |
| 5.3 | OSRM stop-to-stop /route 取代 HMM /match（BL-11） | 採樣稀疏城 success > 90% | 對台南 / 台中特別有用 |
| 5.4 | ETL UNIQUE constraint（BL-15） | 每天少寫 50K dup row | hygiene |
| 5.5 | PBF 月更自動化（BL-10） | 維運省人力 | nice-to-have |

---

## 任務依賴圖

```
                    Phase 1.1 (台中 GPS)
                          ↓
                    Phase 2.1 (OSRM 台中)
                          ↑
Phase 1.4 (新北 OSRM 收尾) → Phase 2.2 (OSRM 新北)
                                   ↓
Phase 1.2 (stops/routes) → Phase 2.3 (City UI) ← Phase 2.4 (Legend)
                          ↓                   ↑
                    Phase 3.1 (OSRM /route 預計算)
                          ↓
                    Phase 3.2 - 3.5 (時刻表視覺化)

Phase 4 (TGOS) ──────────────────────→ 接入 City UI
            （並行、不卡 Phase 2/3）

Phase 5 - 排程在 Phase 1-4 之後
```

---

## 預估時間線（最積極節奏）

```
Week 1: Phase 1.1 + 1.2 + 1.3 啟動 + 1.4 收尾
Week 2: Phase 1.2 完成 + Phase 2.1 + 2.2 + 2.3 開始
Week 3: Phase 2.3 + 2.4 + 2.5 + Phase 3.0 design 決定
Week 4: Phase 3.1 - 3.3
Week 5: Phase 3.4 - 3.5 + Phase 4.1 收 TGOS 結果
Week 6: Phase 4.2 - 4.4
Week 7: Phase 5 開始排程
```

**最小可 demo 時點**：Week 2 結束（4 GPS 城 + City 切換 UI）

---

## 進度追蹤建議

```
1. 用 .claude/memory/STATUS.md 每週末更新進度
2. 用 .claude/memory/BACKLOG.md 加新發現的 sub-task
3. 每完成一個 Phase 開一個 git tag（e.g. waste-phase-1-done）
4. 每個 Phase 結束寫一篇 .claude/retrospectives/ 短回顧
```

---

## 待 user 拍板（Phase 進去前）

```
Q1. Phase 1.2 是否要分台中 / 台南 vs 台北 / 基隆 / 宜蘭 兩批做？
    （前者有 GPS 是 OSRM 必需、後者是時刻表用）

Q2. Phase 3.0 視覺呈現決策（A/B/C）？
    建議：B + GPS 疊加表定（誤差分析鋪路）

Q3. 台中 GPS endpoint 待 user 提供 / 從 catalog 確認 URL
    （或 me 用 catalog-search 再深掘）

Q4. 時間預估積極 vs 保守？
    積極 = 全職 5-7 週。如果是 part-time 投入，乘 2-3。
```
