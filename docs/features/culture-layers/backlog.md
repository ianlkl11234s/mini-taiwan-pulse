# Backlog — culture-layers

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 對應項編號要一致（CU 系列）。

## Active work（進行中／待辦）

（無）

## Release / verifying

- [ ] **CU-0** · `release` · P1 · `verifying`：culture 首批 5 圖層實作 commits `aacdc41` + `a4ef900` 已存在，但此檔沒有 PR/merge 與 production 證據。Outcome：確認 4 靜態層＋librarySeats realtime 已真正上線；Next action：核對 PR/CI、資產 HTTP 與 All Off browser；Acceptance：無 404、popup/legend/slider 可用且 realtime 有資料。

## Data / product backlog

- [ ] **CU-1** · `product` · P2 · `waiting_external`：查官方 arts_events `category`（"1"–"19"）對照並補 `cultureTypes.ts`；Acceptance：官方來源、popup 名稱與分類測試。
- [ ] **CU-2** · `data-health` · P2 · `waiting_external`：補 tpml_seat data-catalog，將 `librarySeats` 從 `pulse_only` 升 `verified`；Acceptance：上游 catalog commit、`upstreamRegistry` test。
- [ ] **CU-3** · `data-health` · P2 · `conditional`：arts_events 每月整檔更新 SOP。Trigger：上游 08_pulse_export 產生新檔；Next action：替換 `public/culture/` 並核 checksum；Acceptance：成品日期、checksum、HTTP 200。
- [ ] **CU-4** · `data-health` · P3 · `waiting_external`：venue 粒度/空白變體由上游反萃取改善；Next action：上游提供規則或新成品後再評估；Acceptance：重複率與命名對帳。

## Decision needed

- **CU-5** · `product` · P3：librarySeats 閉館段是否要在 `TimeseriesSparkline` 以灰帶呈現。Owner 決定後才動共用元件；Acceptance：元件測試與 browser popup/monitor 回歸。

## Explicitly not planned（明確不做）

- arts_events 改走 S3 — 2.8MB 略超 2MB 建議線，但沿用 sports 9MB 放 public/ 前例，維持 git 管理（上游 handoff §6 授權下游自行決定）
