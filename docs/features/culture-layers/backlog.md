# Backlog — culture-layers

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 對應項編號要一致（CU 系列）。

## 進行中

（無）

## 待辦

- [ ] **CU-1**：arts_events `category` 代碼（"1"-"19"）→ 名稱對照表 — 上游查得官方對照後補進 `cultureTypes.ts`，popup 改顯示名稱、可升級成分類篩選（上游 handoff §6）
- [ ] **CU-2**：tpml_seat 上游 data-catalog 條目補齊 → `upstreamRegistry.ts` 的 `librarySeats` 從 `pulse_only` 升 `verified`（照 erHospital/parking 同批處理）
- [ ] **CU-3**：arts_events 每月整檔換血 SOP — 上游 08_pulse_export 重出後 copy 替換 `public/culture/`，前端無需改碼；納入月更提醒（next 2026-08）
- [ ] **CU-4**：venue 粒度混雜（「國家音樂廳」vs「一樓大廳」、空白變體重複）— v1 如實保留，待上游反萃取改善
- [ ] **CU-5**：librarySeats 24h 折線閉館段升級 — 現為排除不畫 + 註記「閉館時段不顯示」，TimeseriesSparkline 若日後支援區段標示改灰帶（上游 handoff §3 建議）

## 已完成（近期）

- [x] **CU-0**：culture 首批 5 圖層接線（4 靜態 + librarySeats realtime）— commits `aacdc41` + `a4ef900`，2026-07-16，PR 待開

## 已放棄 / 延後

- arts_events 改走 S3 — 2.8MB 略超 2MB 建議線，但沿用 sports 9MB 放 public/ 前例，維持 git 管理（上游 handoff §6 授權下游自行決定）
