# Changelog — imagery

最新在上。

---

## 2026-09-01 — aqi_imagery R2 雙寫 + backfill（AR-11f；data-collectors #70 / gis-platform #82 migration 387+388，已上線驗證）

- **背景**：`aqi_imagery_frames`（base64 影像）無 R2 副本、無 retention。用戶 2026-09-01 拍板 A 案：先備份 R2 再清。
- **收集器 R2 雙寫**：比照 cwa，每張 AQI/PM25/PM10/O3/NO2 上傳 R2（key `imagery/aqi/{product}/{YYYYMMDD}/{HHMMSS}.png`），`image_key` 同一次 INSERT 寫入；上傳失敗留 NULL、frame 照常落地 → `image_key IS NOT NULL` = 已備份判準。
- **migration 387**：`aqi_imagery_frames ADD COLUMN image_key text`（cwa 當年 ALTER 未回補版控，這次進版控）。
- **migration 388**：守衛 cleanup cron（`image_key IS NOT NULL`，14 天，批次 5000），只刪已上 R2 的。
- **backfill**：既有 16,185 幀全上 R2（100%，0 失敗；R2 物件數 = DB image_key 數）。
- **驗收**：pytest 339；部署後 15z 起新圖自帶 image_key（live 雙寫生效）；bucket `mini-tw-pulse`（含 cwa 既有影像）確認。首夜 cron 刪 14,525 幀（>14天已備份）回收 ~251MB。
- 待辦：aqi 表 `VACUUM FULL` 回收 OS 空間（BACKLOG ST-1）；前端切 CDN 讀路徑（AR-11f 後續）。

---

## 2026-06-10 — mini-taiwan-pulse `d85f5be` + gis-platform migration 160

- 雷達歷史日改 `p_step_minutes=30` 抽稀 RPC（單日 ~90MB base64 → ~32MB）
- 雨量柵格前端拿掉「過舊隱藏」門檻（原本會把 24h 一天一張的產品永久隱藏）→ 改「顯示不晚於當前的最近一張」+ 載入窗前推 48h margin
- 修 StrictMode + useRef 卸載旗標坑：effect body 開頭 `disposedRef.current = false`（原本 mount→unmount→remount 後 ref 不重置，所有載入被永久擋掉，toggle 開了完全沒反應、連 RPC 都不發）
- 修 PostgREST function overload：改 RPC 簽名要 `DROP` 舊簽名再 CREATE（保留兩個 overload 會 ambiguous 300）

### 前置背景

- CWA 雷達 O-A0058-005 / 衛星 O-C0042-004 10min cadence，DB 自 2026-04-07 完整保留
- IoW `precipitation_raster_frames` 自 2026-06-05 才開始收，發布不規律（1h 每 1~2h、24h 約一天一張）
