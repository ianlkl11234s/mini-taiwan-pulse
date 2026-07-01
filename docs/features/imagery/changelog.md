# Changelog — imagery

最新在上。

---

## 2026-06-10 — mini-taiwan-pulse `d85f5be` + gis-platform migration 160

- 雷達歷史日改 `p_step_minutes=30` 抽稀 RPC（單日 ~90MB base64 → ~32MB）
- 雨量柵格前端拿掉「過舊隱藏」門檻（原本會把 24h 一天一張的產品永久隱藏）→ 改「顯示不晚於當前的最近一張」+ 載入窗前推 48h margin
- 修 StrictMode + useRef 卸載旗標坑：effect body 開頭 `disposedRef.current = false`（原本 mount→unmount→remount 後 ref 不重置，所有載入被永久擋掉，toggle 開了完全沒反應、連 RPC 都不發）
- 修 PostgREST function overload：改 RPC 簽名要 `DROP` 舊簽名再 CREATE（保留兩個 overload 會 ambiguous 300）

### 前置背景

- CWA 雷達 O-A0058-005 / 衛星 O-C0042-004 10min cadence，DB 自 2026-04-07 完整保留
- IoW `precipitation_raster_frames` 自 2026-06-05 才開始收，發布不規律（1h 每 1~2h、24h 約一天一張）
