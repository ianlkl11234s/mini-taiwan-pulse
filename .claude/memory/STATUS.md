# Status

**最後更新**：2026-04-26（session：iot_wra 整合 + 雙表 pre-aggregate + 兩 layer 接前端 + 研究文件區）
**分支**：`master`（本機領先 origin **109 commits**；gis-platform 領先 **5 commits**；data-collectors 待 commit 1 個）

## 本次 session 完成

### Collector 重複度檢核（方法論）
- **疑似重疊**：iot_wra（4-22 上線）跟既有 4 個水資源 collector 關係不清
- **方法論**：座標 ST_DWithin 100m + sample 名字驗證（**不信編號**，前面 agent 用 UUID/text 判斷錯了）
- **結論**：
  - groundwater 95% 配對 → **完全重複**（停 iot 子端點）
  - river 16% 配對 → **互補**（兩邊都留）
  - 5 個獨有類別（流量/閘門/堤防/沖刷/揚塵）→ 全新

### Migration 063：iot_wra 雙表 pre-aggregate
- `realtime.iot_wra_latest`：每站每測項最新值 + delta_since_day_start（~4k rows 固定）
- `realtime.iot_wra_daily`：每站每測項每日 1 row + hourly timeline 字串編碼（~4k × 7 天，仿 freeway pattern）
- 改寫 `get_iot_wra_latest`、新增 `get_iot_wra_day`
- 3 個 cron job 排程（錯開分鐘 7,17,27,37,47,57 / 19,39,59 / 04:10 cleanup）
- 已跑進 Supabase 驗證：3,684 latest rows / 7 types / 99% 有 delta / daily 7 天 backfill

### Collector 改動（cross-repo）
- `data-collectors/collectors/iot_wra.py` 註解 groundwater 子端點（避重複；歷史 5 年保留 DB）

### 前端 2 新 Layer + 細項 toggle + 圖例
- **iotWraRiver**：1,634 站河川補強（含預測水位 9 種測項），紫↔cyan delta 著色，timeline 驅動
- **iotWraStructure**：5 in 1（流量/閘門/堤防/沖刷/揚塵），按 station_type 著色，純 latest snapshot
- 細項 toggle（即時/預測 + 5 類型，預設全開）
- LegendPanel +2 段（IoT 河川 delta gradient + IoT 水工結構 5 種類別 + 主要測項說明）
- boolean 透過 `overlayParams` 0/1 中介（仿 metroPillarVisible pattern）

### 研究文件區（新建 docs/research/）
- `iot-wra-integration-study.md` — 7 章重疊度分析 + 架構決策 + 方法論
- `water-layer-cookbook.md` — 12 個故事組合速查（含 4 個 iot 新解鎖故事）
- CLAUDE.md 加 `docs/research/` 指向

## 本次 session commits（atomic）

**mini-taiwan-pulse**（11 個）
- `feat(iot-wra)` 兩 layer + 細項 toggle + LegendPanel
- `docs(research)` 新增研究報告區 + 2 篇文件
- `docs(claude)` CLAUDE.md 指向 docs/research/
- `memory: append INCIDENTS` +2（IconRailSidebar 漏改 / overlayParams 型別嚴格）
- `memory: PRINCIPLES` +3（collector 重複檢核 / 一前端兩 sidebar / boolean 0/1 中介）
- `memory: append PLAYBOOKS` PB-09 + PB-10
- `memory: GLOSSARY` +5（iot_wra 術語）
- `memory: update DATA_SCOPE` (+iot_wra 區段)
- `memory: BACKLOG` +5 done +1 new (BL-7 reservoir_daily_ops 診斷)
- `memory: append REFLECTIONS` (iot_wra 整合反省)
- `memory: rewrite STATUS` (本檔)

**gis-platform**（待 cross-repo commit）
- `063_iot_wra_pre_aggregate.sql`（已手動跑進 Supabase）

**data-collectors**（待 cross-repo commit）
- `iot_wra.py` 註解 groundwater 子端點

## 本機未 push 累計

- mini-tw：109 commits（98 + 本次 11）
- gis-platform：5 commits（4 + 本次 1）
- data-collectors：本次 +1
- Supabase 已部署：migration 063 已手動跑過（cron 已啟動）

## 等用戶執行

- [ ] cross-repo commits（gis-platform 063 / data-collectors iot_wra.py）
- [ ] `git push` × 3 repo
- [ ] **重啟 data-collectors**（讓 STATION_TYPES 改動生效，停止收 iot groundwater 重複資料）
- [ ] 瀏覽器驗證：iotWraRiver / iotWraStructure 兩 toggle 視覺 + 細項 toggle + 右下圖例
- [ ] BL-7 reservoir_daily_ops 04-23 停擺診斷（看 Zeabur log）

## 新增規則（PRINCIPLES.md）

- **Collector 重複度檢核**（⚠ P0，2026-04-26）：不信編號系統，用座標 ST_DWithin 100m + sample 名字驗證；> 90% 配對 = 重複，< 30% = 互補
- **一前端兩 Sidebar 同步改**（⚠ P0，2026-04-26）：LayerSidebar + IconRailSidebar，漏改 = tsc 過但 toggle 看不到
- **boolean 透過 overlayParams 一律 0/1 中介**（2026-04-26）：仿 metroPillar3d pattern；動既有型別前先看相同類型 state 怎麼處理

## 下一步候選（[BACKLOG.md](BACKLOG.md)）

- **BL-7** reservoir_daily_ops 04-23 停擺診斷（P3 但容易做）
- **BL-4** 淹水潛勢多情境 slider（P2，17,303 polygon × 10 情境）
- **W001** 警戒水位視覺化（P2，需先 seed `river_stations` 空表）

## 累計狀態快照

- 40 座水庫 / 1,304 雨量站 / 332 河川水位站 / 733 地下水井 / **2,800+ iot_wra 站**
- Timeline 五層同步回放（rain / river / reservoir / groundwater / iotWraRiver）
- **15 個水資源圖層上線**（9 靜態 backdrop + 6 動態）
- 監測站視覺 pattern：delta_since_day_start 著色（跨站可比，timeline 撥放動）
- **Pre-aggregate pattern**：8 個 cron refresh job（ship/flight/freeway/youbike/disaster/temp/iot 2）錯開分鐘
- **PostgREST 20K cap 已修 2 + 1 預防**（060 / 060b / 063 daily 字串編碼）
- 3D 視覺：水位計 + 點選後雙排日柱
- 記憶系統：v2 9 檔 + SessionStart auto-load + /wrap-up
- **研究報告區**：`docs/research/`（2 篇 + 方法論 SOP 進 PB-09/PB-10）

詳細：[DATA_SCOPE.md](DATA_SCOPE.md) / [BACKLOG.md](BACKLOG.md) / [REFLECTIONS.md](REFLECTIONS.md)
