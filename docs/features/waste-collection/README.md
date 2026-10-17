# waste-collection — 垃圾清運圖層

> **狀態**：shipped（v0.8.0 2026-05-13「歷史模式：火災與垃圾車回放」起）；status.md 內仍有未完成 backlog（最後更新 2026-05-06，之後項目散見其進度紀錄）
> **相關 PR**：#81（清運 RPC 預先彙總）、#543（切底圖後設施／投放點不消失）、#573（立體效果開關，R6 段 3）

## 一句話說明

以高雄為主城的垃圾車 GPS 光球＋音符特效，加上表定動畫（`wasteSchedule`，擴到 22 城）與垃圾處理設施、投放點 3D 場景。

## 圖層（layer key）

`wasteTruck`、`wasteSchedule`、`wasteScheduleNote`、`wasteCleaningSquads`、`wasteStopsStatic`、`wasteRoute`、`wasteStop`、`wdClothes`、`wdMixed`、`wdRecyclingContainer`、`wdBattery` 等（見 `src/data/layerManifest.ts`）。

## 主要檔案

- `src/data/wasteLoader.ts`、`src/data/wasteScheduleLoader.ts`、`src/data/wasteFacilityColors.ts`、`src/data/wasteTruckFrames.ts`
- `src/hooks/useWasteLayer.ts`、`useWasteScheduleLayer.ts`、`useWasteFacilityLayer.ts`、`useWasteDisposalPointLayer.ts`、`useWasteCleaningSquadLayer.ts`

## 資料夾內文件

| 文件 | 用途 |
|---|---|
| [status.md](./status.md) | 背景決策、任務清單、backlog、執行紀錄（主入口） |
| [research/survey.md](./research/survey.md) | 22 縣市清運資料盤點與擴展策略 |
| [research/roadmap.md](./research/roadmap.md) | 全臺多城擴展進度表 |
| [research/progress.md](./research/progress.md) | 全臺資料整合進度紀錄（資料源 hwms） |
| [research/phase-1-handoff.md](./research/phase-1-handoff.md) | Phase 1+3 交接（Pulse 端） |
| [research/osrm-mapmatching-plan.md](./research/osrm-mapmatching-plan.md) | 垃圾車 OSRM map-matching 設計 |
| [research/schedule-osrm-plan.md](./research/schedule-osrm-plan.md) | 表定動畫 OSRM 沿路網方案 |
| [research/schedule-data-quirks.md](./research/schedule-data-quirks.md) | 表定資料怪癖與 22 城擴展 checklist |

## 資料來源

環境部 hwms 清運資料，經度緯度以 TGOS 補（見 research/progress.md）；即時 GPS 走 `public.get_waste_*` RPC。

## 驗收方式

RPC 回應時間（status.md 記錄 105ms，>1s 才套 pre-aggregate）；`npx tsc -b`；其餘依 status.md 任務清單。
