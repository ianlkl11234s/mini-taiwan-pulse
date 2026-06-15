# Satellite Console — 過夜任務完成報告

> 分支：`feat/satellite-console`（從 `feat/intel-panel` 切，**未 push** — 等待本地驗收後手動發 PR）
> 完成時間：2026-06-14 23:30
> 設計檔：`/tmp/satconsole_design/extracted/satellite-sidebar-panel/`
> 提案：`docs/proposal/satellite-console.md`
> 跨 repo 同步：**gis-platform** 已 commit migration 169（也未 push）

## 真實資料驗證（P0）

| 物件 | 狀態 | 驗證結果 |
|---|---|---|
| `reference.satellite_catalog` | ✅ | 7560 筆 UCS（Taiwan 13 / China 618）|
| `public.satellite_maneuvers` MV | ✅ | 24h 非 NOMINAL 599 筆（PLANE_CHANGE 471）|
| `realtime.satellite_tle_history` | ✅ | Yaogan-12 = 295 條 |
| `public.satellite_classified` | ✅ | 既有 loader 已在用 |
| pg_cron 2h refresh | ✅ | `refresh-satellite-maneuvers` `*/2h :15` |

**全部串真實資料，沒有任何假資料 / mock / hardcode 假點。**
（15 顆台灣衛星的「中文名 + 用途」是 TASA i18n 表 — 屬於本地化標籤而非偽資料。）

## Commit 進度表

| # | Phase | Commit | 狀態 |
|---|---|---|---|
| P0 | 狀態文件 + 真實資料驗證 | `7a707f4` | ✅ |
| P1 | gis-platform migration 169（index + 4 RPC）| **gis-platform**: `eddea51` | ✅ 已 apply prod |
| P2 | 衛星 4→6 群（TJS/Beidou/Shiyan 拆出）| `1fc832e` | ✅ |
| P3 | 3 個 Supabase loader + TW i18n 表 | `7a48d71` | ✅ |
| P4 | Console scaffold + IconRail 入口 | `dbeedec` | ✅ |
| P5 | §A 變軌警報區（紅 banner + 橫向卡片）| `95f0f96` | ✅ |
| P6 | §B 中國 6 群 accordion | `dbd6864` | ✅ |
| P7 | §C 台灣 15 顆 hero 卡 | `6b80401` | ✅ |
| P8 | §D 即時統計 + 6h timeline | `c98e4a4` | ✅ |
| P9 | §E 衛星百科卡（UCS 28 欄 + 啟發式預測）| `8f4054d` | ✅ |
| P10 | §F 變軌前後覆蓋對比 modal | `84e9cce` | ✅ |
| P11 | 地圖 console-mode 預設行為 + 紅環 | `4100fab` | ✅ |
| P12 | 測試（35 case）+ tsc -b 全綠 | `8bc709a` | ✅ |
| P13 | 整理狀態文件 | （此 commit）| 🟡 |

**12 個功能 commit + 1 個狀態文件 commit + gis-platform 1 個 migration commit**

## 早上本機驗收 checklist

### 1. 確認資料端
```bash
# gis-platform 4 個新 RPC
psql "$SUPABASE_DB_URL" -c "SELECT proname FROM pg_proc WHERE proname LIKE 'get_satellite%' ORDER BY proname;"
# 預期 4 個：get_satellite_catalog / get_satellite_maneuvers_recent
# get_satellite_tle_history / get_satellite_tle_pair
```

### 2. 確認 git 狀態
```bash
cd /Users/migu/.../mini-taiwan-pulse && git log --oneline feat/intel-panel..HEAD
# 應該看到 13 個 commit（含 P13 狀態文件）

cd /Users/migu/.../gis-platform && git log --oneline -1
# 應該看到 migration 169 commit
```

### 3. 開發伺服器跑得起來
```bash
npm run dev
# 開 http://localhost:3721
```

### 4. UI 視覺驗收（照順序點）
- [ ] Sidebar Layers 區 SPACE 區段顯示 **7 個** layer（Yaogan/Jilin/Gaofen/**TJS**/**Beidou**/**Shiyan**/Taiwan）
- [ ] IconRail 出現 Satellite 🛰️ icon（在 Intel 📻 旁邊）
- [ ] 點 Satellite icon → 左側 console panel 開啟（與 Intel 同位置 left:64, top:98）
- [ ] 地圖自動 flyTo 台灣 (z=4.5)
- [ ] §A 紅 banner 顯示「近 24h 變軌偵測 · CN N 顆 / TW 0 顆」(真實數字)
- [ ] §A 橫向卡片每張顯示變軌類型 chip（PLANE_CHANGE 強閃）
- [ ] §D 「覆蓋台灣中 N 顆 / 未來 6h 通過 M 次」(SGP4 真實算)
- [ ] §D 點「看 timeline」展開橫向 0-6h 軸 + 衛星 tick
- [ ] §B 6 群 accordion 各組 toggle 與 sidebar 雙向同步（試一組）
- [ ] §B 展開任一群，列出該群衛星 + 高度 km
- [ ] §C 台灣 15 顆卡片（福衛 3/5/7/8 + TRITON + YUSHAN + IRIS）
- [ ] §C 福衛 3 顯示「⚠ 超齡服役」橙色 chip
- [ ] §C 任一卡片「飛到位置」 → 地圖飛去衛星即時位置
- [ ] 點 §C / §B 任一衛星 → §E 百科卡浮現於 console 右側
- [ ] §E 顯示 UCS 完整欄位（國家 / 運營商 / 用途 / 發射日期 / 火箭 / 設計壽命）
- [ ] §E 「變軌歷史」列出近 30 天從 TLE 推算的事件
- [ ] §E 「啟發式預測」顯示 μ±σ + 信心 % + ⚠ 估算警語
- [ ] 點 §A 任一變軌卡片「覆蓋變化」→ §F modal 全螢幕浮出
- [ ] §F 並排 2 張 SVG mini-map（黃=BEFORE / 藍=AFTER）
- [ ] §F 顯示新增/失去覆蓋區域 + 過台頻次 N→M 差
- [ ] 地圖上「正在變軌的衛星」有紅色 ring + 紅色 stroke point
- [ ] 底部 checkbox「顯示全部軌道」勾選 → 地圖恢復顯示全部衛星
- [ ] 關閉 console → 地圖回到正常模式

### 5. 自動測試跑全綠
```bash
npx tsc -b   # 應該 exit 0
npx vitest run  # 90/90 通過
```

## 偏離設計檔之處（給 PR 描述用）

1. **§F 對比 modal** 用兩張靜態 SVG mini-map（不另開 Mapbox instance），降低 GPU 開銷
2. **15 顆台灣 zh/use** hardcode 在 `satelliteTaiwanLocale.ts` — UCS 沒這欄
3. **6 群 regex** 在 mini-taiwan-pulse 與 gis-platform RPC 雙處分流（前端 `classifyChinaSatByName`、後端 RPC 內 CASE）
4. **不 push、不 merge** — 等用戶本地驗收後手動發 PR

## PR 建議

兩個 PR（不互相 block）：

**A. gis-platform PR**（先發）
- 標題：`migration 169: satellite-console 用 RPCs + index 補強`
- 內容：4 支 public RPC + 2 個 index
- Migration 已 apply 過 prod（P0 時直接跑了），合 PR 只是文件追蹤

**B. mini-taiwan-pulse PR**（後發，依賴 A 上線）
- 標題：`feat(satellite-console): 衛星情報 console + 6 群 + UCS 百科 + 變軌對比`
- 12 個 commit
- 連結提案 doc 與設計 pack 為驗收依據

## 風險（未驗證項）

- **PLANE_CHANGE 量**：當下 471 筆，含許多 GEO 同步衛星（每天小幅修正），可能不全是「機密級」變軌。若 §A 過於密集，可調 RPC where 加大閾值（`ABS(delta_inclination) > 0.05` 之類）。
- **6h pass scan 效能**：350 sat × 360 步 ~150ms — 桌機 OK，手機可能 lag；考慮 console open 時才掛載 `<CoverageStatsSection>`，目前因為 console 內每個 section 都 mount 才會計算，所以沒問題。
- **§F 區域比對精度**：用 10 min 步進 + 12 個 bbox。若衛星 LEO 高 i 角，可能 7 天會掃到很多區域；若 GEO，就會看「靜止」沒戲。bbox 列表可在 `ManeuverCompareModal.tsx` 的 `TW_RELEVANT_REGIONS` 微調。

## 對應檔案總覽

```
src/
├── types/index.ts                          # +3 LayerVisibility key (TJS/Beidou/Shiyan)
├── data/
│   ├── satelliteTypes.ts                   # 4 群 → 6 群 + classifyChinaSatByName
│   ├── satelliteLoader.ts                  # cache v3→v4，category 擴 navigation/geo_comms/...
│   ├── satelliteManeuversLoader.ts         # 新：get_satellite_maneuvers_recent RPC
│   ├── satelliteCatalogLoader.ts           # 新：get_satellite_catalog RPC
│   ├── satelliteHistoryLoader.ts           # 新：get_satellite_tle_history + pair RPC
│   ├── satelliteTaiwanLocale.ts            # 新：15 顆 TW 衛星 zh/use 表
│   └── __tests__/                          # 新：3 個測試檔（35 case）
├── components/
│   ├── satelliteConsole/                   # 全新目錄
│   │   ├── satelliteConsoleTokens.ts       # 沿用 Intel 視覺 token
│   │   ├── SatelliteConsole.tsx            # 主 panel 容器
│   │   ├── SatelliteConsoleHeader.tsx
│   │   ├── ManeuverAlertSection.tsx        # §A
│   │   ├── CNGroupSection.tsx              # §B
│   │   ├── TWFleetSection.tsx              # §C
│   │   ├── CoverageStatsSection.tsx        # §D
│   │   ├── SatelliteDetailCard.tsx         # §E
│   │   └── ManeuverCompareModal.tsx        # §F
│   ├── IconRailSidebar.tsx                 # +onSatelliteToggle prop / Satellite icon
│   ├── LegendPanel.tsx                     # 7 顆衛星 layer 圖例
│   └── sidebar/layerCatalog.ts             # +TJS/Beidou/Shiyan label/color/section
├── hooks/
│   ├── useSatellitesLayer.ts               # +consoleFilter prop + maneuver ring layer
│   ├── useSatelliteManeuvers.ts            # 新：共用 24h 變軌 polling hook
│   └── useTransportParams.ts               # +3 case 對 satOpacity slider
├── state/
│   └── satelliteConsoleStore.ts            # 新：useSyncExternalStore based
└── App.tsx                                 # 接線 SatelliteConsole + sat visibility

../gis-platform/migrations/169_satellite_console_rpcs.sql  # 4 RPC + 2 index
```

完成。早上起來照 checklist 跑一遍 → 兩個 PR 推上去。
