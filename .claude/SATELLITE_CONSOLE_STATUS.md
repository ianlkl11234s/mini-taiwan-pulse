# Satellite Console — 過夜任務進度

> 分支：`feat/satellite-console`（從 `feat/intel-panel` 切）
> 開工：2026-06-14
> 設計檔：`/tmp/satconsole_design/extracted/satellite-sidebar-panel/`（gzip pack 已解開）
> 提案：`docs/proposal/satellite-console.md`

## 真實資料驗證（P0 完成）

| 物件 | 狀態 | 驗證結果 |
|---|---|---|
| `reference.satellite_catalog` | ✅ | 7560 筆（Taiwan 13 / China 618 / 全部都有 country_operator）|
| `public.satellite_maneuvers` MV | ✅ | 近 24h 非 NOMINAL 599 筆（PLANE_CHANGE 471）；MV 內建欄位含 `name` 可直接用 |
| `realtime.satellite_tle_history` | ✅ | YAOGAN-12 (37875) = 295 條歷史 TLE |
| `public.satellite_classified` | ✅ | 既有 loader 已在用，不動 |
| pg_cron 2h refresh | ✅ | `refresh-satellite-maneuvers` `*/2h :15` |

**結論：沒有任何資料假裝點，全部上線可接。**

## Phase 進度表

| # | Phase | 狀態 | Commit | 備註 |
|---|---|---|---|---|
| P0 | 分支 + 狀態文件 + 真實資料驗證 | 🟡 in_progress |  | 驗證完成 |
| P1 | gis-platform migration (index + RPC) | ⬜ pending |  |  |
| P2 | 4→6 群 + LayerVisibility 擴充 | ⬜ pending |  |  |
| P3 | 3 loaders (maneuvers / catalog / tle history) | ⬜ pending |  |  |
| P4 | Console scaffold + IconRail 入口 | ⬜ pending |  | 仿 Intel Panel |
| P5 | §A 變軌警報 | ⬜ pending |  |  |
| P6 | §B 中國 6 群 accordion | ⬜ pending |  |  |
| P7 | §C 台灣 15 顆 hero | ⬜ pending |  |  |
| P8 | §D 即時統計 + 6h timeline | ⬜ pending |  |  |
| P9 | §E UCS 百科卡 + 啟發式預測 | ⬜ pending |  |  |
| P10 | §F 變軌前後對比 modal | ⬜ pending |  |  |
| P11 | 地圖 console-mode 預設行為 | ⬜ pending |  |  |
| P12 | 測試 + tsc + lint | ⬜ pending |  |  |
| P13 | merge → master + push | ⬜ pending |  |  |

## 設計原則

- **絕無假資料**：所有 panel 欄位接 Supabase 真實 RPC / 既有 SGP4
- **視覺一致**：沿用 Intel Panel tokens（`src/components/intel/intelTokens.ts`）；色號用 design tokens（`--status-danger / --status-warn / --accent`）
- **時間訂閱**：currentTime 走 `timeStore`（專案規則 §6）
- **Loading UI**：每個 loader 註冊 loadingRegistry（專案規則 §3）
- **rule §5a**：透明度 slider 沿用既有 satOpacity；6 分群有圖例；衛星 click 走 §E DetailCard；group accordion 取代多 toggle

## 偏離設計檔之處

- **§F 對比 modal**：用兩張靜態 SVG/Canvas mini-map（不另開 Mapbox instance），降低 GPU 開銷
- **15 顆台灣 zh/use**：hardcode 在前端 lookup 表（UCS 沒這欄）— 不污染 DB
- **6 群 regex**：擴 `satelliteTypes.ts` 既有 4 群為 6 群（TJS/Beidou/Shiyan 從 china_other 拆出）

## 早上驗收 checklist

1. `git log feat/satellite-console --oneline | head -20` 看分階段 commit
2. `npm run dev` → 點 sidebar Satellite icon → 確認 console 開啟
3. 確認紅 banner「近 24h 變軌 CN X 顆 / TW 0 顆」是真數字（早上跑會跟 sample 不同）
4. 點任一變軌卡片 → §F 對比 modal 跑出兩張軌跡圖
5. 點台灣 15 顆任何一個 → §E 百科卡顯示 UCS 完整欄位
6. CN 6 群 accordion 各組 toggle 跟 sidebar 雙向同步
7. 跑 `npx tsc -b` 沒錯誤
8. 跑 `npx vitest run` 通過

如果有問題，回滾單一 commit：`git reset --hard <commit-id>~1`
