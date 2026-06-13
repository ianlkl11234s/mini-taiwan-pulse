# Satellite Intel Console — 衛星情報儀表板

> 提案日期：2026-06-13
> 分支：`feat/satellite-layer`（接續現有衛星圖層）
> 狀態：規劃中，待 Phase A 拍板實作

## 0. 背景與目標

現有 `feat/satellite-layer` 已上線：3 個 sidebar toggle（中國軍事 / 中國遙測 / 台灣），地圖上顯示足跡圓 + 軌跡。資料來源 gis-platform Supabase（每 2h 從 Space-Track 同步 TLE），中國 351 顆 + 台灣 15 顆。

**問題**：
1. 351 顆中國衛星「重要性差距極大」——Yaogan/Jilin/Gaofen 是即時偵察，Beidou 是 PNT 導航、TJS 是 GEO SIGINT，混在一起呈現不利判讀
2. 衛星只看到「現在在哪」，看不到「**剛剛變軌了**」這個事件——但 Supabase `satellite_maneuvers` MV 每 2h 已經算好
3. 點下衛星只有極簡 popup（名稱/NORAD/類別/高度），UCS catalog 大量元資料（發射日期/承包商/COSPAR/用途）沒用上

**目標**：點 sidebar `Satellite` icon → 進入「**衛星情報模式**」（與現有 3 toggle 並存）：
- 右側浮動 panel = 戰情台
- 地圖預設**不**顯示所有軌道（只有變軌警報 + 台灣 + 通過台灣中的衛星）
- 主視覺從「地圖滿滿軌道」轉成「panel 上的情報摘要」

---

## 1. 資料層盤點（已驗證）

| Supabase 物件 | 內容 | 用途 |
|---|---|---|
| `satellite_classified` view | 67k 衛星基本資料 + TLE + UCS country/category | 載入清單 + 即時 SGP4 |
| `satellite_catalog` | UCS 詳細欄位（用途/發射場/火箭/COSPAR/承包商/質量）| 百科卡 §E |
| `satellite_maneuvers` MV | 每 2h refresh，比對 prev/curr TLE 算 delta，分類 4 型 | 變軌警報 §A、§F 對比 |
| `satellite_tle_history` | 每顆 ~289 條歷史 TLE（Yaogan 12 自 2011 起）| §F 變軌前後軌道對比、§E 變軌時間軸 |

**證據範例**：今日（2026-06-13 11:33 UTC）抓到的 Yaogan 變軌：
- YAOGAN-35 03A — ALTITUDE_CHANGE，週期 −0.06 min
- YAOGAN-36 05C — ALTITUDE_CHANGE，週期 +0.09 min
- YAOGAN 12 — **PLANE_CHANGE 傾角 −0.01°**（最貴機動、最有戲）

---

## 2. UX 架構

### 2.1 模式入口

`Satellite` icon onClick：
- 開啟 `SatelliteConsole` panel（右側、寬 ~340 px，可摺）
- `map.flyTo({ center: [121, 25], zoom: 4 })`（不是全球；主視覺在 panel）
- 自動關閉其他無關 layer（保留衛星 3 toggle 為使用者預期）
- 地圖初始預設只渲染：⚡ 變軌的衛星（紅色脈動）+ 台灣全部 15 顆（藍）+ 當前 elevation cone 含台灣的衛星

### 2.2 Sidebar 不變

3 toggle（CN Mil / CN Obs / TW）保留並存。Console 是進階模式，sidebar 是輕量入口。

---

## 3. Panel 區塊

### §A · 變軌警報區（最上方）

紅色 banner：`⚡ 近 24h 變軌偵測 · CN N 顆 / TW 0 顆`

橫向滾動卡片，每張：
```
⚡ YAOGAN 12              PLANE_CHANGE
傾角 −0.01°  ·  14 分鐘前
[飛到衛星] [看覆蓋變化]
```

4 種變軌 icon：
- ⬆⬇ `ALTITUDE_CHANGE`（最常見，drag compensation）
- ↻ `PLANE_CHANGE`（最貴，重新覆蓋目標——警示色強閃）
- ◯→◓ `SHAPE_CHANGE`（離心率變化）
- · `NOMINAL`（不顯示）

Click「看覆蓋變化」→ 觸發 §F modal。

### §B · 中國衛星分群（accordion）

依名稱 regex 拆 6 群（解決「Beidou 喧賓奪主」）：

| Group | regex | tier | 預設 |
|---|---|---|---|
| 🛰️ Yaogan 遙感 | `^YAOGAN` | S | 開 |
| 🛰️ Jilin-1 吉林 | `^JILIN` | S | 開 |
| 🛰️ Gaofen 高分 | `^GAOFEN` | S | 開 |
| 📡 TJS / TJSW GEO 情報 | `^TJS` | A | 開 |
| 🧭 Beidou 北斗 | `^BD-` or `^BEIDOU` | B | **關** |
| ⚙️ Shiyan / 實踐 / 其他 | 餘 | C | 關 |

每組標題：N 顆 · toggle · `近 24h 變軌 X 顆` chip（紅閃若 X>0）
展開：該組所有衛星列表（名稱 / 高度 / lat-lng / ⚡ icon if maneuvered）

### §C · 🇹🇼 台灣衛星專區

15 顆 hero 卡：
```
🛰️ FORMOSAT-8A  福衛 8 號
   光學遙測 · 720 km SSO · 2025-10 發射
   現在位置：23.4°N 121.0°E（南台灣上空）
   下次過台灣：12 min  ·  距上次變軌：8 天
   [飛到] [軌道] [百科]
```
資料來自 catalog + 即時 SGP4 + nextPassToTaiwan。

### §D · 即時統計列

```
覆蓋台灣中：3 顆（Yaogan 35-12 / Jilin-04A / Gaofen-3）
未來 6h 預計通過：18 次  · [看 timeline]
```
覆蓋判定：每秒掃所有開啟衛星，elevation > 10° 從台灣中心算。
Timeline 展開：橫向 6h 時間軸，每顆衛星預計通過時刻標 tick。

### §E · 衛星百科卡（點任一衛星觸發）

從 `satellite_catalog` 拉所有 UCS 欄位 + `satellite_tle_history` 算變軌歷史：

```
🛰️ YAOGAN 12  (Remote Sensing Satellite 12)
NORAD 37875 · COSPAR 2011-066B
─────────────────
🇨🇳 中國國防部
用途：地球觀測（軍事偵察）
─────────────────
🚀 發射：2011-11-09  太原 · 長征 4B
🏭 製造：CAST 中國空間技術研究院
⏱️ 已運作：14 年 7 個月
─────────────────
🌍 軌道：SSO 487 × 496 km · 97.4° · 94.4 min
📍 當前位置：實時計算
─────────────────
📜 變軌歷史（近 30 天）：
   ⚡ 06-13 11:33  PLANE_CHANGE 傾角 −0.01°
   ⬆ 05-28 03:21  ALTITUDE  週期 +0.08 min
   ⬇ 05-12 19:45  ALTITUDE  週期 −0.06 min
   平均每 14 天變軌一次（μ=14.2d σ=5.1d）
─────────────────
🔮 啟發式估算：下次變軌約 7-21 天內
   *基於歷史間隔，非精準預測 · 信心 60%
```

### §F · 變軌前後覆蓋對比（OSINT 核心）

點變軌警報「看覆蓋變化」→ 全螢幕 modal：

- **左 mini-map**：變軌前 7 天 ground track（從 `satellite_tle_history` 找 `prev_epoch` 的 TLE 跑 SGP4）
- **右 mini-map**：變軌後 7 天 ground track（最新 TLE 跑 SGP4）
- 兩張 mini-map 共用相機（pan/zoom 連動）
- 下方差異摘要：
  ```
  🆕 新增覆蓋：日本沖繩、菲律賓呂宋島北部
  📤 失去覆蓋：阿留申群島、阿拉斯加西部
  📊 過台灣頻次：5 次/日 → 7 次/日（+40%）
  ```
- 頻次差異算法：兩條 ground track 各掃 `nextPassToTaiwan` 7×24h，比對命中次數

### §G · 故事卡（Phase D 選做）

關聯 `news-events` layer：
> 「Yaogan 12 於 2026-06-13 11:33 變軌時，台灣 / 周邊新聞」
列出當日相關新聞（用 newsEventsLoader 既有 by-day 接口）。

---

## 4. 用戶設想 vs 可實現性

| 用戶設想 | 評估 |
|---|---|
| 1(a) 「掌握預計變軌時間」 | ⚠️ 精確預測**不可能**（軍方機密 + 詳細地面測控資料缺）。<br>✅ **可做啟發式**：用歷史變軌間隔給機率分佈 + 信心區間 |
| 1(b) 「變軌後覆蓋變化」 | ✅ 完全可做（§F），可量化過台灣頻次差 |
| 1(c) 「點衛星看詳情」 | ✅ catalog 完整（§E）|
| 2(a) 中國分群 | ✅ 名稱 regex 拆 6 群（§B）|
| 2(b) 台灣專區 | ✅ 15 顆全列（§C）|
| 3 不全顯示軌道 | ✅ 預設只顯示變軌 + TW + 通過中（§0）|

### 啟發式變軌預測的標示鐵則

所有預測時間**必須**標：
- 「估算」字樣
- 信心區間（如 `7-21 天內，信心 60%`）
- `*基於歷史變軌間隔` 註腳

避免誤導為「精準預測」。

### 補位選做

- 🔥 **離軌（decay）預測**：用 TLE B* 拖曳 + 高度衰減模型可估，老衛星很有戲
- ❌ **燃料剩餘**：沒公開資料
- ❌ **任務指派**：軍事機密

---

## 5. 檔案結構（規劃）

```
src/components/satelliteConsole/
├── SatelliteConsole.tsx              -- panel 容器
├── ManeuverAlertSection.tsx          -- §A
├── CNGroupSection.tsx                -- §B（含 accordion）
├── TWFleetSection.tsx                -- §C
├── CoverageStatsSection.tsx          -- §D
├── SatelliteDetailCard.tsx           -- §E（modal 風格）
└── ManeuverCompareModal.tsx          -- §F

src/data/
├── satelliteManeuversLoader.ts       -- 載入 satellite_maneuvers 近 24h
├── satelliteCatalogLoader.ts         -- 載入 UCS catalog（by NORAD）
└── satelliteHistoryLoader.ts         -- 載入 satellite_tle_history（指定 NORAD）

src/utils/
├── satelliteGrouping.ts              -- CN 6 群 regex
├── maneuverPrediction.ts             -- 啟發式預測（μ σ + 信心區間）
└── coverageDiff.ts                   -- 變軌前後覆蓋差異算法

src/state/
└── satelliteConsole.ts               -- panel open/close + selected NORAD
```

---

## 6. Phase 切割

| Phase | 內容 | 預估 |
|---|---|---|
| **A** ⭐ 先做 | Console 框架 + §A 變軌警報 + §C 台灣專區 + §B 中國分群 6 群（含 toggle）。地圖預設只顯示變軌 + TW + 通過中 | 4-6 h |
| **B** | §E 百科卡（UCS 完整欄位 + 變軌歷史列表）+ §D 即時統計 + 啟發式預測（含信心區間警語） | 3-4 h |
| **C** ⚡ 戲劇性 | §F 變軌前後覆蓋對比 modal + 過台灣頻次差量化 | 3-5 h |
| **D** | 離軌（decay）預測 + §G 串 newsEvents 故事卡 | 視需求 |

Phase A 完成後即可 demo「今日 Yaogan 12 變軌」這個強敘事。

---

## 7. 5a 圖層 UX 鐵則檢查

| 鐵則 | 對應 |
|---|---|
| 透明度 slider | 沿用既有 satOpacity（sidebar 已有）|
| 分類 ≥ 2 → 圖例 | Console panel 內 §B/§C/§D 自帶分類視覺，地圖圖例維持現狀 |
| 可選取 → popup | 點衛星走 §E SatelliteDetailCard（取代原 SatellitePanel；輕量 popup 仍保留給 toggle 模式） |
| Select ≥ 4 → dropdown | Console 內 §B 已是 accordion，符合 |

---

## 8. 待決議

- §F 變軌前後對比 modal 用「兩張並排 Mapbox 小地圖」還是「主地圖切換 ghost 軌跡」？前者直觀但要新增第二 map instance；後者輕量但對比力弱。**初步傾向並排**。
- §C 台灣 15 顆是否要再分子類：FORMOSAT-3 已 14 年（接近 EOL）vs FORMOSAT-7/8（現役主力）vs IRIS-C（學研）—— 還是用 catalog 的 `expected_lifetime_yrs` 自動標「⚠️ 超齡服役」？
- §E 變軌歷史顯示範圍：近 30 天 vs 全部 14 年？老衛星全部 14 年會太雜，傾向 30 天 + 「看全部歷史」展開選項
- Phase A 是否 inline TaskCreate / 還是先寫骨架待 review？

---

## 9. 風險

- **`satellite_maneuvers` MV 含 67k 衛星全部**：每 2h refresh 跑全表，但我們只 query CN/TW 子集，響應 < 200ms 沒問題
- **`satellite_tle_history` 累積快**：Yaogan 12 一顆 14 年累積 289 筆（看起來 server 端有歸檔／取樣）。實際 query by NORAD 不會炸
- **啟發式預測信心區間**：低變軌頻次衛星（如 FORMOSAT）μ 樣本太少 σ 大，要 fallback「歷史變軌少，無法估算」而非給離譜大範圍

---

附：今日（2026-06-13）資料層即時驗證紀錄

```
satellite_classified · 中國 military+earth_obs = 351 顆
satellite_classified · 台灣 (含 FS-8A + TRITON 名稱保底) = 15 顆
satellite_maneuvers · 近 24h 全部變軌（不含 NOMINAL）= 1,422 筆
                    · 其中 Yaogan = 3 筆（含 1 筆 PLANE_CHANGE）
satellite_catalog · YAOGAN 12 完整欄位齊全（含 COSPAR / 發射場 / 火箭 / 承包商）
satellite_tle_history · YAOGAN 12 = 289 條（自 2011 發射累積）
```
