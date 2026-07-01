# Backlog — fire-rescue

> memory 時點 2026-05-24 / 2026-05-26。已全部上線（用戶確認 2026-07-01）。

## 進行中

- 暫無

## 待辦

- [ ] **FR-hydrants-expand**：`fireHydrants` 目前僅臺北市 + 高雄市 69,839 點；其他縣市資料待補
- [ ] **FR-adr-blaze-removal**：ADR 記錄「火災火焰特效移除、回歸純 2D circle」的取捨與 5/24 用戶決定
- [ ] **FR-station-csv-schema**：`stations_7cities.csv` 與 `stations_15counties_geocoded.csv` **欄位順序不同** — 上游合併成單一 schema 較穩

## 已完成（近期）

- [x] **FR-fireEvents-popup**：既有 Supabase RPC 補 click popup + 火焰特效（後火焰特效移除，見已放棄段）— 2026-05-24
- [x] **FR-fireLatest**：113 最新年度火點圖層（`useFireLatestLayer`），任何模式可見，共用 FireEventPanel — 2026-05-24
- [x] **FR-fireStations**：全台 22 縣市 716 點；分隊階級視覺化（circle 半徑 + 3D 光柱高度 + 漣漪半徑依 cat 大隊 1.8× / 其他 0.6×）— 2026-05-24
- [x] **FR-pingtung-geocode**：屏東 39 隊用 Mapbox geocode 補齊 → 全台 716 點 — 2026-05-26
- [x] **FR-fireHydrants**：69,839 點靜態圖層（臺北 + 高雄，minzoom 12）— 2026-05-24
- [x] **FR-isochrone**：救援等時圈 5/10/15 分鐘 PMTiles，全國聚合 + 各縣市兩套，`<select>` setFilter — 2026-05-26
- [x] **FR-station-3d-scene**：`FireStationScene`（InstancedMesh 光柱 + caps + 同步擴張漣漪，向外波動）— 2026-05-24
- [x] **FR-station-2toggle**：展開面板散點 / 3D 光柱各自 toggle，散點關 = circle opacity 0 但仍可點 — 2026-05-24

## 已放棄 / 延後

- **FR-blaze-effect**：`FireBlazeScene` + `fireBlazeCustomLayer`（火焰柱 + GPU 火星 + 視野裁切 query fire-events/fire-latest）— 2026-05-24 用戶要求拿掉，兩檔已刪、useThreeJsLayers 接線移除，**火災回歸純 2D circle**。若未來重做可參考 git 歷史或音符 scene（`WasteMusicNoteScene`）

## 已記錄的坑

- **circle-radius zoom + match 表達式順序**：依 cat 分大小時，`["zoom"]` 必須在 interpolate 最上層、cat 倍率放進每個 stop 的 match 輸出；不能寫 `["*", match, interpolate(zoom)]`（會報 "zoom expression may only be used as input to top-level step/interpolate"）

## 已完成 (補)

- [x] **FR-shipped**：全部上線進 master（2026-07-01 用戶確認），含 commit/push + S3 部署 + 等時圈驗收

## Notes

- fireEvents「僅歷史模式」/ fireLatest「任何模式可見」的分工背景：memory 只有結論未記完整理由，日後若要調整需回頭看 git 歷史
- 等時圈已進 sidebar SECTIONS FIRE & RESCUE（既然全部上線）
