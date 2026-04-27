# 水資源 Layer 故事組合 Cookbook

> Last updated: 2026-04-26
> 用途：示範 15 個水資源圖層（含 iot_wra 新類別）怎麼搭配看出有意義的故事。
> 給展示者、報告人、demo 設計者參考。
> 對應前端 toggle key 在右上 LayerSidebar 「WATER」section。

---

## 0. 全景圖層清單

### 🗺️ 靜態地理背景（9 個）

| Toggle key | 中文名 | 看到什麼 |
|---|---|---|
| `waterBasins` | 流域 Basin | 集水區邊界 |
| `waterRivers` | 河川 River | 河道 + 河床面積 |
| `waterLevees` | 堤防 Levee | 4,222 條堤防線 + 施工狀態 |
| `waterCanals` | 渠道 Canal | 灌溉/排水渠網 |
| `waterProtectionZones` | 管制區 Protection | 飲用水保護區/超抽禁區 |
| `waterReservoirs` | 水庫 Reservoir | 21 座水庫位置 + 3D 水位計 |
| `waterFacilities` | 水利設施 Facility | 抽水站/淨水廠/水塔 |
| `waterMonitorStations` | 監測站 Monitor | 雨量/水位/地下水井統合 |
| `waterFloodExtreme` | 淹水潛勢 Flood | 650mm/24h 淹水深度分區 |

### ⚡ 即時 / 時間軸動態（6 個）

| Toggle key | 中文名 | 看到什麼 | 取樣頻率 |
|---|---|---|---|
| `rainGauge` | 即時雨量 Rain Gauge | CWA 1,313 站降雨 | 10 min |
| `riverLevel` | 河川水位 River Level | WRA 河川水位 + 漲跌色 | 10 min |
| `groundwater` | 地下水井 Groundwater | 地下水位 + 24h delta | hourly |
| `groundwaterWells` | 水井點位 Wells | 733 灰點 backdrop | static |
| `iotWraRiver` | IoT 河川（補強） | 1,634 站 + 含預測水位 | 10 min |
| `iotWraStructure` | IoT 水工結構（5 in 1） | 流量/閘門/堤防/沖刷/揚塵 | 10 min |

---

## 1. 故事：淹水預警 🌧️

> **問題**：暴雨來了，哪裡會淹？

| 開的 toggle | 看什麼 |
|---|---|
| `rainGauge` | 即時降雨位置 + 強度 |
| `riverLevel` + `iotWraRiver` | 上游河川水位漲幅 |
| `waterFloodExtreme` | 對應的淹水潛勢區（650mm 情境）|
| `iotWraStructure`（只開閘門）| 閘門開度，看排洪能力 |
| `waterReservoirs` | 水庫蓄水率，預判是否需要洩洪 |

**操作**：開 `iotWraStructure` 後在 expandable panel 把流量/堤防/沖刷/揚塵都關掉，只留閘門。

**焦點**：先看 rainGauge 大圈的位置 → 找下游的 riverLevel/iotWraRiver 紫色（下降）轉 cyan（上升）的站 → 對應 floodExtreme 紅色淹水潛勢 → 看附近閘門狀態。

---

## 2. 故事：供水平衡 💧

> **問題**：缺水危機什麼時候緩解？

| 開的 toggle | 看什麼 |
|---|---|
| `rainGauge` | 集水區降雨 |
| `waterBasins` | 框出集水區範圍 |
| `waterReservoirs` | 21 座水庫 3D 水位計，蓄水率即時數字 |
| `iotWraStructure`（只開累計流量）| 河川實際流量（補水進水庫）|
| `riverLevel` + `iotWraRiver` | 上游河川水位上升 |

**操作**：把 `iotWraStructure` 細項只留 cumulativeflow，看流量站讀數。

**焦點**：雨在哪 → 流域邊界 → 流量站累計 m³ → 水庫水位計回升。

---

## 3. 故事：超抽警告 ⚠️

> **問題**：哪些區域地層下陷風險高？

| 開的 toggle | 看什麼 |
|---|---|
| `groundwater` | 動態 delta 著色，紅 = 持續下降 |
| `groundwaterWells` | 灰色 backdrop，看完整觀測網 |
| `waterProtectionZones` | 超抽禁區紅色塊 |

**焦點**：紅色井點（下降）落在紅色塊（禁抽區）= 超抽違規嫌疑高。

> 註：`iotWraGroundwater` 已在前端跳過（與既有重複），這個故事用既有 `groundwater` 即可。

---

## 4. 故事：防洪缺口 🏗️

> **問題**：哪一段堤防覆蓋率不夠？

| 開的 toggle | 看什麼 |
|---|---|
| `waterLevees` | 4,222 條堤防 |
| `waterFloodExtreme` | 高風險淹水區 |
| `waterBasins` | 流域分隔 |
| `iotWraStructure`（只開堤防安全 + 沖刷）| 結構警訊位置 |

**操作**：`iotWraStructure` 只留 damstructure + erosiondepth。

**焦點**：高淹水潛勢區內，堤防是否有缺口 + 該段是否有結構安全/沖刷監測站。

---

## 5. 故事：水系全景 🌊

> **問題**：一條河從上游到下游的完整基礎設施？

| 開的 toggle | 看什麼 |
|---|---|
| `waterBasins` | 流域邊界 |
| `waterRivers` | 河川主支流 |
| `waterCanals` | 灌溉渠網 |
| `waterFacilities` | 抽水站/淨水廠 |
| `waterMonitorStations` | 監測點位 |
| `riverLevel` + `iotWraRiver` | 即時水位變化 |

**焦點**：建議 demo / 教學起手式 — 純粹「看水系結構」沒分析。

---

## 6. 故事：洪汛閘門調度 🚪（iot 新解鎖）

> **問題**：暴雨時閘門怎麼開？開了多少？

| 開的 toggle | 看什麼 |
|---|---|
| `rainGauge` | 即時暴雨 |
| `iotWraStructure`（只開閘門）| 全台 134 個閘門開度 % |
| `riverLevel` + `iotWraRiver` | 閘門上下游水位 |
| `waterReservoirs` | 上游水庫蓄水率 |

**操作**：`iotWraStructure` 細項只留 watergate。閘門站會以橘色顯示，點開可看「開度 %」+「閘門內水位」+「閘門外水位」。

**焦點**：暴雨來了 → 閘門開度從 0% 拉高到 80%+ → 配合上游水庫水位下降（洩洪）+ 下游水位上升（接水）。**這是 mini-taiwan-pulse 過去看不到的故事**。

---

## 7. 故事：河床安全監測 🪨（iot 新解鎖）

> **問題**：大雨後河床被沖深多少？堤防結構動了嗎？

| 開的 toggle | 看什麼 |
|---|---|
| `iotWraStructure`（只開沖刷 + 堤防安全）| 218 個沖刷站 + 41 個堤防站 |
| `waterRivers` + `waterLevees` | 河道 + 堤防位置 |
| `rainGauge` | 之前的暴雨記錄 |

**操作**：`iotWraStructure` 只留 erosiondepth + damstructure。

**焦點**：沖刷站（黃）讀「沖刷深度 m」、堤防站（紅）讀「X/Y/Z 軸角度」+「混凝土應力」。大雨後比對前後讀值找「動最多」的點。

---

## 8. 故事：乾季揚塵 💨（iot 新解鎖）

> **問題**：乾季河床乾涸，揚塵從哪裡來？

| 開的 toggle | 看什麼 |
|---|---|
| `iotWraStructure`（只開揚塵）| 7 個揚塵站 PM10 / 風速 / 溫濕度 |
| `waterRivers` | 河床位置 |
| `rainGauge` | 反向看「沒下雨」的區域 |
| `waterBasins` | 揚塵屬於哪個流域 |

**操作**：`iotWraStructure` 只留 dustemission。

**焦點**：揚塵 PM10 高 + 該流域 rainGauge 沒讀值 = 河床乾燥起塵。

> 註：揚塵站只 7 個，主要在中南部大河床。

---

## 9. 故事：流量總量 📈（iot 新解鎖）

> **問題**：河川實際流多少水量（不是水位高度，是「過了多少 m³」）？

| 開的 toggle | 看什麼 |
|---|---|
| `iotWraStructure`（只開累計流量）| 250 站 m³ 累計 |
| `riverLevel` + `iotWraRiver` | 對比水位 vs 流量 |
| `waterReservoirs` | 上下游水庫 |

**焦點**：水位高 ≠ 流量大（河道寬窄影響）。流量站才是供水決策真實依據。

---

## 10. Combo 預設組合速查

| 場景 | 一鍵開的 toggles |
|---|---|
| **災害模式（颱風夜）** | rainGauge + riverLevel + iotWraRiver + waterFloodExtreme + iotWraStructure(閘門) |
| **缺水模式（乾旱期）** | rainGauge + waterReservoirs + iotWraStructure(流量) + waterBasins |
| **環境監測（日常）** | groundwater + groundwaterWells + waterProtectionZones |
| **基礎設施巡檢** | waterLevees + iotWraStructure(堤防+沖刷) + waterRivers |
| **教學 demo** | waterBasins + waterRivers + waterReservoirs + rainGauge |

---

## 11. 視覺重疊提醒

開多個圖層時可能看不清楚的組合 + 解法：

| 重疊組合 | 問題 | 解法 |
|---|---|---|
| `riverLevel` + `iotWraRiver` | 兩個都是河川站，顏色都帶 cyan | iotWraRiver 用紫↔cyan，old riverLevel 用紅↔藍，故意分開色系 |
| `groundwater` + `groundwaterWells` | 動態層蓋住灰點 backdrop | 透明度 slider 把 wells 拉低 |
| `iotWraStructure` 全開 | 5 種顏色一起出現眼花 | 用細項 toggle 只留要看的類別 |
| `rainGauge` + `iotWraRiver` | 雨量泡泡蓋住水位點 | rainGauge 透明度拉到 0.4 |

---

## 12. 圖例對照（右下 LegendPanel）

開啟對應 layer 時自動浮現：

- **IoT 河川（補強）**：紫↔cyan 漸層 = 當日水位變化（-1m 到 +1m）；圈大小 = 變化幅度
- **IoT 水工結構**：5 個 colored dot + 主要測項說明
  - 累計流量（紫）— m³
  - 閘門（橘）— 開度 % / 水位 m
  - 堤防安全（紅）— 角度 / 應力
  - 河床沖刷（黃）— 深度 m
  - 揚塵（棕）— PM10 / 風速 / 溫濕度

---

## 相關文件

| 路徑 | 內容 |
|---|---|
| `docs/water-resources-status.md` | 水資源系統 Phase 1 + 2 完成狀態 |
| `docs/water-opendata-catalog.md` | 開放資料盤點 + DB schema 對照 |
| `docs/research/iot-wra-integration-study.md` | iot_wra 跟既有 collector 重疊度研究 + 架構決策 |
| `CLAUDE.md` § 新增 Layer 強制順序 | 加新故事如要加 layer 的步驟 |
