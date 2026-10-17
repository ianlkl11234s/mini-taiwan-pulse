# Backlog — imagery

> 2026-08-19 核對：核心坑已修完；loader/hook 已由 source 實際確認，不再以 TBD 代替檔名。

## Active work（進行中／待辦）

- 暫無

## Data health / product backlog

- [ ] **IMG-rain-history-label** · `data-health` · P3 · `ready`：雨量 collector 自 2026-06-05 才開始收，早期日期需明確顯示「無資料」而非讓使用者誤解為零；Next action：在時間軸/空狀態補資料起始日；Acceptance：早期日期 browser evidence 與測試。
- [ ] **IMG-upstream-handoff** · `governance` · P2 · `waiting_external`：上游 `taipei-gis-analytics/docs/handoff/imagery.md` 尚未建立；Next action：上游補契約，並將 `cwaImageryLoader.ts`、`aqiImageryLoader.ts`、`precipRasterLoader.ts`、`useCwaImageryLayer.ts`、`useAqiImageryLayer.ts`、`usePrecipRasterLayer.ts` 寫入 handoff；Acceptance：相對連結有效、dataset/RPC/更新頻率可核對。

## Completed / historical（已完成／歷史）

- [x] **IMG-radar-decimate**：雷達歷史日改 `p_step_minutes=30` 抽稀 — migration 160 + `d85f5be`（2026-06-10）
- [x] **IMG-rain-no-stale-threshold**：雨量柵格前端拿掉「過舊隱藏」門檻（24h 產品會被永久隱藏），改「顯示不晚於當前的最近一張」+ 載入窗前推 48h margin
- [x] **IMG-strictmode-disposedref**：修 StrictMode + useRef 卸載旗標坑 — effect body 開頭加 `disposedRef.current = false`
- [x] **IMG-postgrest-overload**：改 RPC 簽名時 `DROP` 舊簽名再 CREATE，避免 ambiguous 300

## Explicitly not planned（明確不做）

- 暫無

## 已記錄的坑

- **StrictMode + useRef 卸載旗標**：`disposedRef.current = true` 在 cleanup 設了之後，StrictMode 的 mount → unmount → remount **不會重置 ref** → 所有載入被永久擋掉（toggle 開了完全沒反應、連 RPC 都不發）。**effect body 開頭必須 `disposedRef.current = false`**。effect-local `let cancelled` 沒這問題
- **PostgREST function overload**：改 RPC 簽名要 `DROP` 舊簽名再 CREATE（保留兩個 overload 會 ambiguous 300）
- **雷達 frame 變大**：avg ~630KB，單日 ~90MB base64（要抽稀）
- **雨量產品發布不規律**：24h 產品一天一張，過舊門檻會全隱藏
