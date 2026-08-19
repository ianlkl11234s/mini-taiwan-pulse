# Backlog — 畜牧 Livestock

> 本 feature 的待辦。前綴用 `LS-`。

## Active work（進行中／待辦）

- 暫無；source 已有 `src/hooks/useLivestockLayers.ts`、manifest 與 host 接線，不能再寫「feat/livestock 施工中」。production/PR evidence 仍需核對，見 Verifying。

## Data / product backlog

- [ ] **LS-2** · `data-health` · P2 · `waiting_external`：farm 補到 100% 覆蓋率；Next action：上游 ARIS 後續 batch 查回後重出同名檔，CDN + Supabase 雙寫重載；Acceptance：覆蓋率、checksum、雙寫 row count。
- [ ] **LS-3** · `product` · P3 · `ready`：低精度 769 場視覺處理再評估；Next action：先以現行 opacity 建 baseline，再決定精確/概略模式；Acceptance：browser readability 與效能 evidence。
- [ ] **LS-4** · `data-health` · P2 · `waiting_external`：EMS_S_01 補 geocode miss 的豬/牛場；Next action：確認上游授權與欄位後做小批試跑；Acceptance：命中率、來源標記、popup accuracy。

## Decision needed

- LS-1 是否已達 production release 仍需以實際 PR/部署與 browser evidence 判定；不可用舊 branch 文字直接宣稱上線。

## Verifying

- [ ] **LS-1** · `release` · P1 · `verifying`：7 層接線在目前 source 可見（含 `useLivestockLayers.ts` 與 host registry），但本檔未提供 production/PR 證據。Next action：核對 PR/merge、CDN/Supabase 成品與 All Off 逐層驗收；Acceptance：HTTP/checksum、row count、browser。

## Explicitly not planned（明確不做）

- **LS-X**：化製場（動物屍體處理）— 資料未開放，缺。
- **LS-Y**：即時 / 時序畜牧資料 — 無 collector、無即時面向（HANDOFF §4 明定），不做。
- **LS-Z**：畜牧用地「面」圖層 — 畜牧用地是統計非界線，無面資料。
