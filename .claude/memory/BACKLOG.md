# Backlog

優先級：**P0** = 阻塞中 / **P1** = 規劃期內 / **P2** = 穩定後再做 / **P3** = nice-to-have

## 進行中 / 待辦

### 水資源系統（BL 系列 — 盤點 DB 有資料但前端沒用的 Quick Wins）

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| BL-1 | P1 | `river_levees` 堤防 4,222 筆上線 | **done** | 2026-04-24 完成；overlayRegistry amber line，status=待建用 case expression 淡化 |
| BL-2 | P2 | `water_protection_zones` 水源保護區 107 筆 | **done** | 2026-04-24 合併 BL-3 為「管制區 Protection」單一 toggle |
| BL-3 | P2 | `groundwater_zones` 地下水管制區 21 筆 | **done** | 2026-04-24 與 BL-2 合併，zone_kind 四色 match expression |
| BL-4 | P2 | `flood_hazard_zones` 淹水潛勢**多情境** 17,303 筆 | open | dropdown 情境 slider，目前前端只用 650mm 單情境 |
| BL-5 | P1 | 水庫點選顯示 3D 進/出流雙排日柱 | **done** | 2026-04-23 完成（commit dae1c78 / 06116e7 / 52a56ba / 6600433）|
| BL-6 | P3 | 水庫 3D 柱顯示「最新日期」標記 | open | 討論中：panel ribbon 或 Marker「最新」小字；暫停 |
| BL-7 | P3 | `reservoir_daily_ops` 04-23 停擺診斷 | open | collector / cron 4-23 後沒進新筆，需查 Zeabur log（2026-04-25 盤點時發現）|
| BL-8 | P3 | Git history 清舊 water_*.geojson 大檔 | open | 5 個檔留在 history（最大 79MB water_flood_extreme），每次 push GitHub 警告但不影響功能。.gitignore + S3 機制已正確。需 git filter-repo + force push（風險高 → 暫不做）|

### 水資源擴展（新 collector / 新 RPC）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| W001 | P2 | 警戒水位視覺化 | open | 需先 seed `public.river_stations`（目前空表），再回 055 RPC 加三級警戒欄位 |
| W002 | P2 | 地下水 RPC + 前端 | **done** | 2026-04-24 完成；migration 058（latest/day/timeseries）+ useGroundwaterLayer + timeline 驅動；739 站覆蓋 |
| W003 | P3 | 枯旱預警燈號 | open | WRA dataset 36695 |
| W004 | P3 | 洩洪訊息 | open | WRA dataset 58343 |
| W005 | P3 | 水權統計 | open | data.gov.tw 36696，**非空間**表格，做指標卡/長條圖，補「用水」最大缺口 |
| W006 | P3 | 集水區敏感區（內/外 0.5km） | open | WRA 129475 / 129476 |

### 一般待辦

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| G001 | P2 | 刪 `useTransportParams` 裡的 `reservoirBubbleOpacity/Glow/Size` 殘留 slider | done | 2026-04-22 已拆 |
| G002 | P3 | `[ReservoirLayer] render #N` 改 `DEBUG_RESERVOIR` env flag 控制 | done | 2026-04-23 render loop 修掉時順手移除 |
| G003 | P3 | `public/three-showcase.html` / `public/showcase/` untracked 是什麼？要 commit / 忽略 / 刪？ | open | 本次 session 前就存在的 untracked 檔案 |

## 已完成（近期 10 筆）

- 2026-04-26 ✅ **iot_wra 重複度檢核 SOP**（座標 + 名字 sample，不信編號系統；發現 groundwater 95% 重複 / river 16% 互補）
- 2026-04-26 ✅ **Migration 063 iot_wra 雙表 pre-aggregate**（latest 4k snapshot + daily timeline 字串編碼，仿 freeway pattern）
- 2026-04-26 ✅ **iot_wra collector 停 groundwater 子端點**（避重複；iot 5 年歷史保留在 DB）
- 2026-04-26 ✅ **前端 iotWraRiver + iotWraStructure 兩 layer**（含細項 toggle 即時/預測 + 5 類型 + LegendPanel +2 段）
- 2026-04-26 ✅ **研究報告區 docs/research/**（iot 整合研究 + 水資源 layer 故事 cookbook 兩篇）
- 2026-04-25 ✅ **Toggle 設定 4 水層 × 2 滑桿**（rain/river/groundwater/wells 的 scale + opacity，支援 setPaintProperty 熱更）
- 2026-04-25 ✅ **河川水位改 delta 著色**（跨站可比；解「timeline 拖不動 + 中南部看似沒資料」）
- 2026-04-25 ✅ **Migration 060b 河川水位降頻**（44K → 8K rows，解 PostgREST 20K cap 導致南部 103 → 1 站）
- 2026-04-25 ✅ **Migration 060 地下水井降頻 + delta_24h**（78K → 16.5K rows）
- 2026-04-25 ✅ **地下水井拆兩 toggle**（groundwaterWells 靜態 + groundwater 動態 delta 著色）
- 2026-04-25 ✅ **底圖切換 throw 修復**（styleReady helper + 6 處 guard；H3 res9/res8 loader fallback）
- 2026-04-24 ✅ **W002 地下水井**（migration 058 + useGroundwaterLayer + GroundwaterPanel，timeline 驅動，739 站）
- 2026-04-24 ✅ **BL-2+BL-3 水資源管制區**（合併 toggle，zone_kind 四色 match expression，128 polygon）
- 2026-04-24 ✅ **BL-1 堤防**（4,222 筆 MultiLineString，amber line，status=待建 case-expression 淡化）
- 2026-04-23 ✅ **BL-5 水庫 3D 進/出流雙排日柱**（初版雙柱 → 雙排 N 日柱 → 位置/高度修正）
- 2026-04-23 ✅ **Phase 2.3 Timeline 回放**（rain/river/reservoir 三層走 timeStore）
- 2026-04-23 ✅ **雨量 Mapbox heatmap**（擴散視覺 + zoom 分工）

> 更早完成項目見 git log 與 REFLECTIONS.md
